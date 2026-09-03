import { useEffect } from 'react';
import { useAuthStore } from '../../features/auth/authStore';
import { useNetStore } from '../multiplayer/netStore';
import { getRoomConnection } from '../multiplayer/RoomConnection';
import { isVerdantMode } from '../core/gameMode';

/**
 * Joins the multiplayer room while authenticated and leaves cleanly on logout
 * or unmount (PRD §6.1, §7.13). Matchmaking runs after auth; the lease is
 * renewed every 10 s and released on leave.
 *
 * No-op in `local` mode so the single-player bundle never opens sockets.
 */
export function useRoomSession(): void {
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (!isVerdantMode()) return;
    if (status === 'authenticated') {
      const connection = getRoomConnection();
      void connection.join();
      return () => {
        void connection.leave();
      };
    }
    useNetStore.getState().reset();
  }, [status]);
}
