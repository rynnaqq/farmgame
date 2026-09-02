import { create } from 'zustand';

/**
 * Leaderboard state (PRD §7.12): Top 10 by current balance,
 * refresh on world entry, monument open, and every 60 s while visible.
 */

export interface LeaderboardRow {
  rank: number;
  profileId: string;
  usernameDisplay: string;
  balance: number;
  balanceUpdatedAt: string;
}

export interface LeaderboardStoreState {
  rows: LeaderboardRow[];
  lastFetchedAt: number | null;
  isStale: boolean;
  isFetching: boolean;
  setRows: (rows: LeaderboardRow[], fetchedAt: number) => void;
  markStale: () => void;
  setFetching: (fetching: boolean) => void;
  reset: () => void;
}

export const LEADERBOARD_REFRESH_MS = 60_000;

export const useLeaderboardStore = create<LeaderboardStoreState>((set) => ({
  rows: [],
  lastFetchedAt: null,
  isStale: false,
  isFetching: false,
  setRows: (rows, fetchedAt) => set({ rows, lastFetchedAt: fetchedAt, isStale: false }),
  markStale: () => set({ isStale: true }),
  setFetching: (isFetching) => set({ isFetching }),
  reset: () => set({ rows: [], lastFetchedAt: null, isStale: false, isFetching: false }),
}));

export function resetLeaderboardStore(): void {
  useLeaderboardStore.setState({
    rows: [],
    lastFetchedAt: null,
    isStale: false,
    isFetching: false,
  });
}
