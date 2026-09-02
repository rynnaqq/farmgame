import { create } from 'zustand';

/**
 * Multiplayer connection state (PRD §8.3: serializable app state only).
 * High-frequency remote transforms live in RemotePlayerBuffer instances
 * held by the renderer, not in this store.
 */

export type ConnectionQuality = 'connected' | 'degraded' | 'offline';

export interface RoomMemberInfo {
  userId: string;
  username: string;
  slot: 0 | 1 | 2 | 3;
}

export interface NetStoreState {
  roomId: string | null;
  ownSlot: 0 | 1 | 2 | 3 | null;
  ownUserId: string | null;
  members: RoomMemberInfo[];
  quality: ConnectionQuality;
  isJoining: boolean;
  lastError: string | null;
  setRoom: (roomId: string, ownSlot: 0 | 1 | 2 | 3, ownUserId: string) => void;
  setMembers: (members: RoomMemberInfo[]) => void;
  setQuality: (quality: ConnectionQuality) => void;
  setJoining: (joining: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const INITIAL: Pick<
  NetStoreState,
  'roomId' | 'ownSlot' | 'ownUserId' | 'members' | 'quality' | 'isJoining' | 'lastError'
> = {
  roomId: null,
  ownSlot: null,
  ownUserId: null,
  members: [],
  quality: 'offline',
  isJoining: false,
  lastError: null,
};

export const useNetStore = create<NetStoreState>((set) => ({
  ...INITIAL,

  setRoom: (roomId, ownSlot, ownUserId) => set({ roomId, ownSlot, ownUserId, lastError: null }),
  setMembers: (members) => set({ members }),
  setQuality: (quality) => set({ quality }),
  setJoining: (isJoining) => set({ isJoining }),
  setError: (lastError) => set({ lastError }),
  reset: () => set({ ...INITIAL }),
}));

export function resetNetStore(): void {
  useNetStore.setState({ ...INITIAL });
}
