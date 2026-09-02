/**
 * Movement protocol V1 (PRD §10.3, §7.14).
 * Pure logic — no Three.js, no network. Fully unit-testable.
 */

export const MOVEMENT_PROTOCOL_VERSION = 1
export const MOVEMENT_RATE_HZ = 20
export const IDLE_KEEPALIVE_HZ = 2
export const MAX_PACKET_PAYLOAD_BYTES = 256
export const REMOTE_RENDER_DELAY_MS = 100
export const MAX_EXTRAPOLATION_MS = 250
export const SMALL_CORRECTION_METERS = 1.5
export const SMALL_CORRECTION_EASE_MS = 100
/** Map bounds: 64x64 m island centered on origin (PRD §7.3). */
export const WORLD_BOUND = 32
/** Plausible speed ceiling: run 5.25 m/s with generous headroom. */
export const MAX_PLAUSIBLE_SPEED = 12

/** 0=idle 1=walk 2=run 3=use_tool */
export type AnimationState = 0 | 1 | 2 | 3

export interface MovementPacketV1 {
  v: 1
  roomId: string
  userId: string
  seq: number
  t: number
  p: [number, number, number]
  yaw: number
  speed: number
  anim: AnimationState
}

export type PacketRejection =
  | 'WRONG_PROTOCOL'
  | 'WRONG_ROOM'
  | 'NOT_MEMBER'
  | 'STALE_SEQUENCE'
  | 'NON_FINITE'
  | 'OUT_OF_BOUNDS'
  | 'IMPLAUSIBLE_SPEED'

export interface PacketValidationContext {
  roomId: string
  memberIds: ReadonlySet<string>
  lastSeq: ReadonlyMap<string, number>
}

export type PacketValidationResult =
  | { ok: true; packet: MovementPacketV1 }
  | { ok: false; reason: PacketRejection }

/**
 * Receivers reject packets from non-members, wrong rooms, unknown protocol
 * versions, stale sequences, non-finite values, impossible map bounds, or
 * implausible speed deltas (PRD §7.14).
 */
export function validateMovementPacket(
  raw: unknown,
  ctx: PacketValidationContext
): PacketValidationResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'NON_FINITE' }
  const p = raw as Partial<MovementPacketV1>

  if (p.v !== MOVEMENT_PROTOCOL_VERSION) return { ok: false, reason: 'WRONG_PROTOCOL' }
  if (p.roomId !== ctx.roomId) return { ok: false, reason: 'WRONG_ROOM' }
  if (typeof p.userId !== 'string' || !ctx.memberIds.has(p.userId)) {
    return { ok: false, reason: 'NOT_MEMBER' }
  }
  if (typeof p.seq !== 'number' || !Number.isFinite(p.seq) || p.seq < 0) {
    return { ok: false, reason: 'NON_FINITE' }
  }

  const last = ctx.lastSeq.get(p.userId)
  if (last !== undefined && p.seq <= last) return { ok: false, reason: 'STALE_SEQUENCE' }

  if (
    typeof p.t !== 'number' || !Number.isFinite(p.t) ||
    typeof p.yaw !== 'number' || !Number.isFinite(p.yaw) ||
    typeof p.speed !== 'number' || !Number.isFinite(p.speed) ||
    !Array.isArray(p.p) || p.p.length !== 3 || !p.p.every((n) => typeof n === 'number' && Number.isFinite(n)) ||
    typeof p.anim !== 'number' || p.anim < 0 || p.anim > 3
  ) {
    return { ok: false, reason: 'NON_FINITE' }
  }

  const [x, y, z] = p.p
  if (Math.abs(x) > WORLD_BOUND || Math.abs(z) > WORLD_BOUND || y < -10 || y > 30) {
    return { ok: false, reason: 'OUT_OF_BOUNDS' }
  }
  if (p.speed < 0 || p.speed > MAX_PLAUSIBLE_SPEED) {
    return { ok: false, reason: 'IMPLAUSIBLE_SPEED' }
  }

  return { ok: true, packet: raw as MovementPacketV1 }
}

/** Approximate payload size guard (< 256 bytes before transport framing). */
export function estimatePacketBytes(packet: MovementPacketV1): number {
  return JSON.stringify(packet).length
}

export interface RemoteSnapshot {
  t: number
  p: [number, number, number]
  yaw: number
  speed: number
  anim: AnimationState
}

/**
 * Snapshot buffer for one remote player. Renderers sample approximately
 * REMOTE_RENDER_DELAY_MS behind the newest snapshot and lerp between
 * buffered states; extrapolation is capped at MAX_EXTRAPOLATION_MS, after
 * which the character eases to idle (PRD §7.14).
 */
export class RemotePlayerBuffer {
  private snapshots: RemoteSnapshot[] = []

  constructor(
    private readonly maxSnapshots = 32,
    _renderDelayMs = REMOTE_RENDER_DELAY_MS,
    private readonly maxExtrapolationMs = MAX_EXTRAPOLATION_MS
  ) {}

  push(snapshot: RemoteSnapshot): void {
    this.snapshots.push(snapshot)
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift()
    }
  }

  get newest(): RemoteSnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null
  }

  get depth(): number {
    return this.snapshots.length
  }

  /**
   * Sample the interpolated state at `renderTimeMs`. Larger corrections snap;
   * corrections below SMALL_CORRECTION_METERS are eased over 100 ms.
   */
  sample(renderTimeMs: number): RemoteSnapshot | null {
    if (this.snapshots.length === 0) return null
    if (this.snapshots.length === 1) {
      const only = this.snapshots[0]
      const age = renderTimeMs - only.t
      if (age > this.maxExtrapolationMs) return { ...only, anim: 0, speed: 0 }
      return only
    }

    let older: RemoteSnapshot | undefined
    let newer: RemoteSnapshot | undefined
    for (let i = this.snapshots.length - 1; i >= 0; i--) {
      if (this.snapshots[i].t <= renderTimeMs) {
        older = this.snapshots[i]
        newer = this.snapshots[i + 1]
        break
      }
    }
    if (!older) {
      // Render time is older than every buffered snapshot: clamp to oldest.
      return this.snapshots[0]
    }
    if (!newer) {
      const age = renderTimeMs - older.t
      if (age > this.maxExtrapolationMs) {
        return { ...older, anim: 0, speed: 0 }
      }
      return older
    }

    const span = newer.t - older.t
    const alpha = span > 0 ? (renderTimeMs - older.t) / span : 1
    return {
      t: renderTimeMs,
      p: [
        older.p[0] + (newer.p[0] - older.p[0]) * alpha,
        older.p[1] + (newer.p[1] - older.p[1]) * alpha,
        older.p[2] + (newer.p[2] - older.p[2]) * alpha,
      ],
      yaw: older.yaw + shortestAngleDelta(older.yaw, newer.yaw) * alpha,
      speed: older.speed + (newer.speed - older.speed) * alpha,
      anim: alpha >= 0.5 ? newer.anim : older.anim,
    }
  }
}

/** Smallest signed delta from a to b (radians). */
export function shortestAngleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}
