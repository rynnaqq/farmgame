import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from '../../lib/supabase/client'
import {
  useLeaderboardStore,
  type LeaderboardRow,
} from './leaderboardStore'

/**
 * Leaderboard service (PRD §7.12):
 * - requests the Top 10 from public.top_10_leaderboard
 * - failed refreshes keep the last successful data and mark it stale
 * - retry with exponential backoff is handled by the caller/poller
 */

export class LeaderboardService {
  private backoffMs = 1000

  constructor(private readonly supabase: SupabaseClient = getSupabaseClient()) {}

  async fetchTop10(): Promise<LeaderboardRow[] | null> {
    const store = useLeaderboardStore.getState()
    if (store.isFetching) return null
    store.setFetching(true)
    try {
      const { data, error } = await this.supabase
        .from('top_10_leaderboard')
        .select('rank, profile_id, username_display, balance, balance_updated_at')

      if (error || !data) {
        useLeaderboardStore.getState().markStale()
        this.backoffMs = Math.min(this.backoffMs * 2, 30_000)
        return null
      }

      const rows: LeaderboardRow[] = data.map((row: Record<string, unknown>) => ({
        rank: row.rank as number,
        profileId: row.profile_id as string,
        usernameDisplay: row.username_display as string,
        balance: row.balance as number,
        balanceUpdatedAt: row.balance_updated_at as string,
      }))

      this.backoffMs = 1000
      useLeaderboardStore.getState().setRows(rows, Date.now())
      return rows
    } catch {
      useLeaderboardStore.getState().markStale()
      return null
    } finally {
      useLeaderboardStore.getState().setFetching(false)
    }
  }

  get nextRetryDelayMs(): number {
    return this.backoffMs
  }
}

let defaultService: LeaderboardService | null = null

export function getLeaderboardService(): LeaderboardService {
  if (!defaultService) defaultService = new LeaderboardService()
  return defaultService
}
