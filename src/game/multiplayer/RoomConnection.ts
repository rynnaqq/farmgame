import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../lib/supabase/client';
import { useAuthStore } from '../../features/auth/authStore';
import { useNetStore } from './netStore';
import { parseFarmPatch } from './farmPatchProtocol';
import {
  MOVEMENT_RATE_HZ,
  IDLE_KEEPALIVE_HZ,
  REMOTE_RENDER_DELAY_MS,
  validateMovementPacket,
  RemotePlayerBuffer,
  type MovementPacketV1,
  type AnimationState,
} from './movementProtocol';

/**
 * RoomConnection orchestrates the multiplayer session (PRD §7.13, §7.14, §10):
 * - join_or_create_room() + lease renewal every 10 s
 * - private Presence channel for join/leave liveness
 * - private movement Broadcast capped at 20 Hz outbound (2 Hz idle keepalive)
 * - private farm channel for authoritative plot patches (with crop placements)
 * - reconnect with exponential backoff 1, 2, 4, 8, 15 s + jitter
 *
 * Presence is never the allocator authority; database leases are (PRD §7.13).
 */

export const LEASE_RENEWAL_INTERVAL_MS = 10_000;
const BACKOFF_SCHEDULE_MS = [1000, 2000, 4000, 8000, 15_000];

export type FarmPatchListener = (patch: {
  ownerId: string;
  plotVersion: number;
  tiles: ReturnType<typeof parseFarmPatch>['tiles'];
}) => void;

export interface RoomConnectionOptions {
  supabase?: SupabaseClient;
  getUserId?: () => string | null;
  onFarmPatch?: FarmPatchListener;
}

export class RoomConnection {
  private readonly supabase: SupabaseClient;
  private readonly getUserId: () => string | null;
  private readonly onFarmPatch?: FarmPatchListener;

  private roomId: string | null = null;
  private ownSlot: 0 | 1 | 2 | 3 | null = null;
  private presenceChannel: RealtimeChannel | null = null;
  private movementChannel: RealtimeChannel | null = null;
  private farmChannel: RealtimeChannel | null = null;

  private leaseTimer: ReturnType<typeof setInterval> | null = null;
  private sendTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private seq = 0;
  private lastSeq = new Map<string, number>();
  private buffers = new Map<string, RemotePlayerBuffer>();
  private lastSendTime = 0;
  private backoffIndex = 0;
  private disposed = false;

  /** Latest local transform, updated by the player controller each frame. */
  private localTransform = {
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    speed: 0,
    anim: 0 as AnimationState,
  };
  private localTransformDirty = false;

  constructor(options: RoomConnectionOptions = {}) {
    this.supabase = options.supabase ?? getSupabaseClient();
    this.getUserId = options.getUserId ?? (() => useAuthStore.getState().session?.userId ?? null);
    this.onFarmPatch = options.onFarmPatch;
  }

  get currentRoomId(): string | null {
    return this.roomId;
  }

  get slot(): 0 | 1 | 2 | 3 | null {
    return this.ownSlot;
  }

  getBuffer(userId: string): RemotePlayerBuffer | null {
    return this.buffers.get(userId) ?? null;
  }

  /** Join matchmaking, subscribe to private channels, and start loops. */
  async join(): Promise<void> {
    // Re-join support: a connection that previously left must be usable again.
    this.disposed = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const net = useNetStore.getState();
    net.setJoining(true);
    try {
      const { data, error } = await this.supabase.rpc('join_or_create_room');
      if (error) throw error;
      const result = data as { ok: boolean; roomId: string; slot: 0 | 1 | 2 | 3 };
      if (!result?.ok || !result.roomId) {
        throw new Error('Matchmaking returned no room');
      }

      this.roomId = result.roomId;
      this.ownSlot = result.slot;
      this.backoffIndex = 0;
      const userId = this.getUserId();
      useNetStore.getState().setRoom(result.roomId, result.slot, userId ?? 'unknown');
      useNetStore.getState().setQuality('connected');

      await this.subscribeChannels();
      this.startLoops();

      const snapshot = await this.supabase.rpc('get_room_snapshot', { p_room_id: result.roomId });
      if (!snapshot.error) {
        const snap = snapshot.data as {
          members: Array<{ userId: string; username: string; slot: 0 | 1 | 2 | 3 }>;
          plots?: Array<{ ownerId: string; version: number; tiles: unknown[] }> | null;
        };
        // Authoritative membership for movement validation (PRD §7.13):
        // database leases, not Presence.
        this.memberIds = new Set((snap.members ?? []).map((m) => m.userId));
        this.memberIds.add(this.getUserId() ?? 'unknown');
        useNetStore.getState().setMembers(snap.members ?? []);

        // Initial farm snapshots carry crop placements for every member plot.
        for (const rawPlot of snap.plots ?? []) {
          try {
            this.onFarmPatch?.(
              parseFarmPatch({
                ownerId: rawPlot.ownerId,
                plotVersion: rawPlot.version,
                tiles: rawPlot.tiles,
              })
            );
          } catch {
            useNetStore.getState().setError('INVALID_FARM_PATCH');
          }
        }
      }
    } catch (error) {
      useNetStore
        .getState()
        .setError(error instanceof Error ? error.message : 'Failed to join room');
      this.scheduleReconnect();
    } finally {
      useNetStore.getState().setJoining(false);
    }
  }

  /** Update the local player transform; the send loop batches at 20 Hz. */
  publishLocalTransform(transform: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    speed: number;
    anim: AnimationState;
  }): void {
    this.localTransform = transform;
    this.localTransformDirty = true;
  }

  /** Graceful leave: releases the lease and unsubscribes (PRD §7.13). */
  async leave(): Promise<void> {
    this.disposed = true;
    this.stopLoops();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const roomId = this.roomId;
    this.teardownChannels();
    this.roomId = null;
    this.ownSlot = null;
    this.buffers.clear();
    this.lastSeq.clear();
    this.memberIds.clear();
    useNetStore.getState().reset();
    if (roomId) {
      try {
        await this.supabase.rpc('leave_room', { p_room_id: roomId });
      } catch {
        // best-effort: the lease expires server-side anyway
      }
    }
  }

  /** Broadcast a one-shot `use_tool` animation state (anim=3, PRD §7.14). */
  playToolAnimation(): void {
    const userId = this.getUserId();
    if (!this.roomId || !userId || !this.movementChannel) return;
    void this.movementChannel.send({
      type: 'broadcast',
      event: 'move',
      payload: {
        v: 1,
        roomId: this.roomId,
        userId,
        seq: ++this.seq,
        t: Date.now(),
        p: [this.localTransform.x, this.localTransform.y, this.localTransform.z],
        yaw: this.localTransform.yaw,
        speed: 0,
        anim: 3,
      } satisfies MovementPacketV1,
    });
  }

  private startLoops(): void {
    this.stopLoops();
    this.leaseTimer = setInterval(() => void this.renewLease(), LEASE_RENEWAL_INTERVAL_MS);
    // 20 Hz send loop for movement; idle keepalive at 2 Hz inside the same tick.
    const sendInterval = 1000 / MOVEMENT_RATE_HZ;
    this.sendTimer = setInterval(() => this.sendMovementTick(), sendInterval);
  }

  private stopLoops(): void {
    if (this.leaseTimer) clearInterval(this.leaseTimer);
    if (this.sendTimer) clearInterval(this.sendTimer);
    this.leaseTimer = null;
    this.sendTimer = null;
  }

  private async renewLease(): Promise<void> {
    if (!this.roomId) return;
    try {
      const { error } = await this.supabase.rpc('renew_room_lease', { p_room_id: this.roomId });
      if (error) throw error;
      useNetStore.getState().setQuality('connected');
    } catch {
      useNetStore.getState().setQuality('degraded');
      this.scheduleReconnect();
    }
  }

  private sendMovementTick(): void {
    const userId = this.getUserId();
    if (!this.roomId || !userId || !this.movementChannel) return;

    const now = Date.now();
    const interval = now - this.lastSendTime;
    const idleInterval = 1000 / IDLE_KEEPALIVE_HZ;
    const isIdle = this.localTransform.anim === 0 && this.localTransform.speed === 0;
    // Never exceed 20 outbound events per second (PRD §7.14).
    if (!this.localTransformDirty && isIdle && interval < idleInterval) return;
    if (!this.localTransformDirty && !isIdle && interval < 1000 / MOVEMENT_RATE_HZ) return;

    const packet: MovementPacketV1 = {
      v: 1,
      roomId: this.roomId,
      userId,
      seq: ++this.seq,
      t: now,
      p: [this.localTransform.x, this.localTransform.y, this.localTransform.z],
      yaw: this.localTransform.yaw,
      speed: this.localTransform.speed,
      anim: this.localTransform.anim,
    };
    this.localTransformDirty = false;
    this.lastSendTime = now;
    void this.movementChannel.send({
      type: 'broadcast',
      event: 'move',
      payload: packet,
    });
  }

  private async subscribeChannels(): Promise<void> {
    if (!this.roomId) return;
    const userId = this.getUserId();
    const username = useAuthStore.getState().session?.username ?? 'Farmer';
    const slot = this.ownSlot ?? 0;

    this.teardownChannels();

    this.presenceChannel = this.supabase
      .channel(`room:${this.roomId}:presence`, {
        config: { private: true },
      })
      .on('presence', { event: 'sync' }, () => {
        const state = this.presenceChannel?.presenceState<PresencePayload>() ?? {};
        const members: RoomMemberInfoView[] = Object.values(state).flatMap((entries) =>
          entries.map((entry) => ({
            userId: entry.userId,
            username: entry.username,
            slot: entry.slot,
          }))
        );
        members.sort((a, b) => a.slot - b.slot);
        useNetStore.getState().setMembers(members);
        // Presence may see a member before the next snapshot; union it in so
        // their movement packets validate immediately (leases still rule).
        for (const member of members) this.memberIds.add(member.userId);
      });

    this.movementChannel = this.supabase
      .channel(`room:${this.roomId}:movement`, {
        config: { private: true },
      })
      .on('broadcast', { event: 'move' }, (payload) => this.handleMovement(payload.payload));

    this.farmChannel = this.supabase
      .channel(`room:${this.roomId}:farm`, {
        config: { private: true },
      })
      .on('broadcast', { event: 'patch' }, (payload) => {
        try {
          const patch = parseFarmPatch(payload.payload);
          this.onFarmPatch?.(patch);
        } catch {
          // A malformed patch is never applied partially.
          useNetStore.getState().setError('INVALID_FARM_PATCH');
        }
      });

    // Subscribe all channels, then track presence once the presence channel is live.
    await Promise.all([
      this.waitForSubscription(this.presenceChannel),
      this.waitForSubscription(this.movementChannel),
      this.waitForSubscription(this.farmChannel),
    ]);

    this.presenceChannel?.track({
      userId: userId ?? 'unknown',
      username,
      slot,
      avatarVariant: slot,
      clientVersion: '1.0.0',
      joinedAt: new Date().toISOString(),
    } satisfies PresencePayload);
  }

  private waitForSubscription(channel: RealtimeChannel): Promise<void> {
    return new Promise((resolve) => {
      if (channel.state === 'joined') {
        resolve();
        return;
      }
      const timeout = setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, 10_000);
      const interval = setInterval(() => {
        if (channel.state === 'joined' || channel.state === 'errored') {
          clearInterval(interval);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);
    });
  }

  /** Authoritative member ids from the room snapshot/lease (not Presence). */
  private memberIds = new Set<string>();

  private handleMovement(raw: unknown): void {
    const userId = this.getUserId();
    if (!this.roomId) return;
    const ctx = {
      roomId: this.roomId,
      memberIds: this.memberIds,
      lastSeq: this.lastSeq,
    };
    const result = validateMovementPacket(raw, ctx);
    if (!result.ok) return;
    if (result.packet.userId === userId) return;

    const packet = result.packet;
    let buffer = this.buffers.get(packet.userId);
    if (!buffer) {
      buffer = new RemotePlayerBuffer();
      this.buffers.set(packet.userId, buffer);
    }
    buffer.push({
      t: packet.t,
      p: packet.p,
      yaw: packet.yaw,
      speed: packet.speed,
      anim: packet.anim,
    });
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.reconnectTimer) return;
    const delay = BACKOFF_SCHEDULE_MS[Math.min(this.backoffIndex, BACKOFF_SCHEDULE_MS.length - 1)];
    const jitter = Math.random() * 500;
    this.backoffIndex += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.reconnect();
    }, delay + jitter);
  }

  private async reconnect(): Promise<void> {
    if (this.disposed) return;
    this.stopLoops();
    this.teardownChannels();
    await this.join();
  }

  private teardownChannels(): void {
    for (const channel of [this.presenceChannel, this.movementChannel, this.farmChannel]) {
      if (channel) {
        void this.supabase.removeChannel(channel);
      }
    }
    this.presenceChannel = null;
    this.movementChannel = null;
    this.farmChannel = null;
  }
}

interface PresencePayload {
  userId: string;
  username: string;
  slot: 0 | 1 | 2 | 3;
  avatarVariant: number;
  clientVersion: string;
  joinedAt: string;
}

interface RoomMemberInfoView {
  userId: string;
  username: string;
  slot: 0 | 1 | 2 | 3;
}

let defaultConnection: RoomConnection | null = null;

export function getRoomConnection(): RoomConnection {
  if (!defaultConnection) {
    defaultConnection = new RoomConnection();
  }
  return defaultConnection;
}

export { REMOTE_RENDER_DELAY_MS };
