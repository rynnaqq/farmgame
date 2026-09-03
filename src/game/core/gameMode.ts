/**
 * Game mode source of truth for the hybrid build.
 *
 * - `local`: strict single-player offline-first path (farm.md PRD).
 *   No Supabase network, no auth gate, no multiplayer, no leaderboard polling.
 * - `verdant`: Project Verdant MMO overlay (Supabase RPCs, auth, rooms, leaderboard).
 *
 * Defaults to `local` so dev / unit tests / E2E exercise the PRD path unless
 * `VITE_GAME_MODE=verdant` is set explicitly.
 */

export type GameMode = 'local' | 'verdant';

export const GAME_MODES: readonly GameMode[] = ['local', 'verdant'] as const;

export const DEFAULT_GAME_MODE: GameMode = 'local';

function normalizeMode(raw: string | undefined | null): GameMode | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (value === 'verdant') return 'verdant';
  if (value === 'local') return 'local';
  return null;
}

/**
 * Resolve the active game mode.
 * `source` defaults to `import.meta.env` so tests can inject `{ VITE_GAME_MODE }`.
 */
export function getGameMode(
  source: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>
): GameMode {
  return normalizeMode(source.VITE_GAME_MODE) ?? DEFAULT_GAME_MODE;
}

export function isVerdantMode(
  source: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>
): boolean {
  return getGameMode(source) === 'verdant';
}

export function isLocalMode(
  source: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>
): boolean {
  return getGameMode(source) === 'local';
}
