import type React from 'react';
import { useEffect, useRef } from 'react';
import { useUiStore } from '../../state/uiStore';
import { useLeaderboardStore } from './leaderboardStore';
import { getLeaderboardService } from './leaderboardService';

/**
 * Accessible HTML mirror of the 3D leaderboard monument (PRD §7.12, §14.3).
 * Opens from HUD / proximity; refreshes on open; a stale banner keeps the last
 * successful data visible with a freshness label.
 */
export const LeaderboardModal: React.FC = () => {
  const activeModal = useUiStore((state) => state.activeModal);
  const closeModal = useUiStore((state) => state.closeModal);
  const rows = useLeaderboardStore((state) => state.rows);
  const isStale = useLeaderboardStore((state) => state.isStale);
  const lastFetchedAt = useLeaderboardStore((state) => state.lastFetchedAt);

  const dialogRef = useRef<HTMLDivElement>(null);

  const isOpen = activeModal === 'leaderboard';

  useEffect(() => {
    if (!isOpen) return;
    void getLeaderboardService().fetchTop10();
    dialogRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const freshnessSeconds = lastFetchedAt
    ? Math.max(0, Math.floor((Date.now() - lastFetchedAt) / 1000))
    : null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/80 backdrop-blur-sm p-4"
      data-testid="leaderboard-modal-backdrop"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-title"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl bg-gradient-to-b from-stone-800 to-stone-900 border-4 border-amber-600/70 shadow-2xl p-5 font-game select-none outline-none"
        data-testid="leaderboard-modal"
      >
        <h2 id="leaderboard-title" className="text-xl font-bold text-amber-300 text-center">
          🏆 Top 10 Farmers
        </h2>
        {isStale ? (
          <p
            className="text-xs text-red-300 text-center mt-1"
            role="status"
            data-testid="leaderboard-stale"
          >
            Connection issue — showing last successful results
          </p>
        ) : freshnessSeconds !== null ? (
          <p className="text-xs text-stone-400 text-center mt-1">Updated {freshnessSeconds}s ago</p>
        ) : null}

        {rows.length === 0 ? (
          <p className="text-sm text-stone-300 text-center mt-6" data-testid="leaderboard-empty">
            No ranked farmers yet. Harvest and sell to claim the first spot!
          </p>
        ) : (
          <table className="w-full mt-4 text-sm" data-testid="leaderboard-table">
            <caption className="sr-only">Global top 10 farmers by coin balance</caption>
            <thead>
              <tr className="text-amber-200/80 text-left">
                <th scope="col" className="py-1 pr-2">
                  Rank
                </th>
                <th scope="col" className="py-1">
                  Farmer
                </th>
                <th scope="col" className="py-1 text-right">
                  Coins
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.profileId}
                  className={row.rank <= 3 ? 'text-amber-300 font-bold' : 'text-stone-200'}
                >
                  <td className="py-1 pr-2">{row.rank}</td>
                  <td className="py-1">{row.usernameDisplay}</td>
                  <td className="py-1 text-right font-mono">{row.balance.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <button
          type="button"
          onClick={closeModal}
          className="w-full mt-5 py-2 rounded-lg font-bold bg-amber-600 text-stone-950 hover:bg-amber-500 transition-colors"
          data-testid="leaderboard-close"
        >
          Close
        </button>
      </div>
    </div>
  );
};
