import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readSupabaseEnv } from './env';

/**
 * The only Supabase client instance in the app (PRD §8.3/§8.4).
 * Client contract is fixed by the PRD:
 * - persisted sessions with auto refresh
 * - no session-from-URL detection (email confirmation disabled)
 * - Realtime capped at 20 events per second
 */

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const { url, publishableKey } = readSupabaseEnv();
    client = createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
    });
  }
  return client;
}

/** Test hook: reset the singleton so env changes take effect. */
export function resetSupabaseClientForTests(): void {
  client = null;
}
