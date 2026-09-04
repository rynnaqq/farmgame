import React, { useRef, useEffect, useMemo } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { Providers } from './providers';
import { GameCanvas } from '../game/GameCanvas';
import { GameRuntime } from '../game/GameRuntime';
import { InputManager } from '../game/input/InputManager';
import { HUD } from '../ui/HUD';
import { MobileHUD } from '../ui/mobile/MobileHUD';
import { Toolbelt } from '../ui/Toolbelt';
import { ShopModal } from '../ui/ShopModal';
import { InventoryPanel } from '../ui/InventoryPanel';
import { SettingsModal } from '../ui/SettingsModal';
import { Tutorial } from '../ui/Tutorial';
import { ToastRegion } from '../ui/ToastRegion';
import { DiagnosticsOverlay } from '../game/effects/DiagnosticsPanel';
import { isDiagnosticsEnabled } from '../game/core/autoQualityManager';
import { audioManager } from '../game/audio/AudioManager';
import { OfflineSummary } from '../ui/OfflineSummary';
import { LeaderboardModal } from '../features/leaderboard/LeaderboardModal';
import { saveService } from '../persistence/saveService';
import { simulateOfflineProgression } from '../persistence/offlineSimulation';
import { useGameStore } from '../state/gameStore';
import { useUiStore } from '../state/uiStore';
import { AUTOSAVE_INTERVAL_MS } from '../game/core/constants';
import { getGameMode } from '../game/core/gameMode';
import { executePlantAt, executePlotAction } from '../game/farming/farmingCommands';
import type { FarmSoilPoint } from '../game/world/FarmBeds';
import { installTestClock } from '../test/testClock';
import { AuthModal } from '../features/auth/AuthModal';
import { useAuthStore } from '../features/auth/authStore';
import { useRoomSession } from '../game/multiplayer/useRoomSession';
import { useNetStore } from '../game/multiplayer/netStore';
import { getRoomConnection } from '../game/multiplayer/RoomConnection';
import type { PlotId } from '../state/storeTypes';

export interface AppProps {
  children?: React.ReactNode;
  forceWebGLSupported?: boolean;
  onSoilClick?: (point: FarmSoilPoint) => void;
  onPlotClick?: (plotId: PlotId) => void;
  onPlayerFall?: () => void;
  inputManager?: InputManager;
}

/**
 * Main application entry component for Garden Island 3D.
 * Combines global ErrorBoundary, WebGL validation provider, 3D GameCanvas,
 * GameRuntime scene coordinator, MobileHUD, Toolbelt, Diagnostics overlay, and UI containers.
 */
export const App: React.FC<AppProps> = ({
  children,
  forceWebGLSupported,
  onSoilClick,
  onPlotClick,
  onPlayerFall,
  inputManager,
}) => {
  const defaultInputManagerRef = useRef<InputManager | null>(null);
  if (!defaultInputManagerRef.current) {
    defaultInputManagerRef.current = new InputManager();
  }
  const activeInputManager = inputManager ?? defaultInputManagerRef.current;

  const debugEnabled = useMemo(() => isDiagnosticsEnabled(), []);
  const isVerdant = useMemo(() => getGameMode() === 'verdant', []);

  const authStatus = useAuthStore((state) => state.status);
  const initializeAuth = useAuthStore((state) => state.initialize);
  // Local mode is always playable as guest; verdant requires authentication.
  const isAuthenticated = isVerdant ? authStatus === 'authenticated' : false;

  useRoomSession();

  useEffect(() => {
    if (isVerdant) {
      void initializeAuth();
    }
  }, [initializeAuth, isVerdant]);

  // Escape disarms seed planting (modals handle their own Escape to close).
  useEffect(() => {
    activeInputManager.onEscape = () => {
      useUiStore.getState().disarmPlant();
    };
    return () => {
      activeInputManager.onEscape = undefined;
    };
  }, [activeInputManager]);

  // Android back button (Capacitor): close the top modal first, otherwise
  // minimize the app instead of killing it. No-op on web builds.
  useEffect(() => {
    let removeListener: (() => void) | undefined;
    void import('@capacitor/app')
      .then(({ App: CapApp }) => {
        void CapApp.addListener('backButton', () => {
          if (useUiStore.getState().activeModal !== null) {
            useUiStore.getState().closeModal();
          } else {
            void CapApp.minimizeApp();
          }
        }).then((handle) => {
          removeListener = () => void handle.remove();
        });
      })
      .catch(() => {
        // Web builds have no native shell; ignore.
      });
    return () => removeListener?.();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      installTestClock();
      activeInputManager.attach(window);
      audioManager.init();
      const detachGestures = audioManager.attachUserGestureListeners(window);
      const detachVisibility = audioManager.attachVisibilityListener(document);
      const unbindSettings = audioManager.bindToSettingsStore();

      let isMounted = true;
      if (isVerdant && isAuthenticated) {
        // Server-authoritative mode (Project Verdant): persistent progression
        // lives in Supabase RPCs. Do not touch the local save slot at all, so a
        // logout returns the player to their intact local save.
      } else if (!isVerdant || authStatus === 'unauthenticated') {
        saveService.load().then(async ({ envelope }) => {
          if (!isMounted) return;

          const { updatedEnvelope, summary } = simulateOfflineProgression(envelope, Date.now());
          useGameStore.getState().loadSaveEnvelope(updatedEnvelope);
          const saved = await saveService.saveImmediate(updatedEnvelope);
          if (!saved) {
            useUiStore
              .getState()
              .showToast(
                'Storage unavailable — progress is kept in memory and will retry.',
                'warning'
              );
          }

          if (summary.shouldDisplay) {
            useUiStore.getState().openModal('offline_summary', summary);
          } else if (summary.clockMovedBackward) {
            useUiStore
              .getState()
              .showToast('System clock moved backward; offline simulation paused.', 'warning');
          }

          saveService.startAutosave(AUTOSAVE_INTERVAL_MS, () =>
            useGameStore.getState().toSaveEnvelope()
          );
          saveService.setupLifecycleListeners(() => useGameStore.getState().toSaveEnvelope());
        });
      }

      return () => {
        isMounted = false;
        activeInputManager.detach();
        detachGestures();
        detachVisibility();
        unbindSettings();
        saveService.dispose();
      };
    }
  }, [activeInputManager, isAuthenticated, isVerdant, authStatus]);

  const broadcastToolUse = React.useCallback(() => {
    if (isVerdant && useNetStore.getState().roomId) {
      getRoomConnection().playToolAnimation();
    }
  }, [isVerdant]);

  const handleSoilClick = React.useCallback(
    (point: FarmSoilPoint) => {
      if (onSoilClick) {
        onSoilClick(point);
        return;
      }
      const uiState = useUiStore.getState();
      if (!uiState.plantArmed) {
        uiState.showToast('Pick a seed from the hotbar or inventory to plant', 'info', 2000);
        return;
      }
      const result = executePlantAt(point.x, point.z, uiState.selectedSeed, Date.now());
      if (result.ok) {
        broadcastToolUse();
        audioManager.playSfx('plant');
      } else if (result.message) {
        uiState.showToast(result.message, 'warning', 2000);
      }
    },
    [onSoilClick, broadcastToolUse]
  );

  const handlePlotClick = React.useCallback(
    (plotId: PlotId) => {
      if (onPlotClick) {
        onPlotClick(plotId);
        return;
      }
      const uiState = useUiStore.getState();
      const gameState = useGameStore.getState();
      // No reach rule: taps and clicks always execute from anywhere.
      const result = executePlotAction(plotId, uiState.selectedTool, {
        isGoldenCan: gameState.farm.goldenWateringCanOwned,
        weather: gameState.weather.current,
        nowMs: Date.now(),
      });
      if (result.ok) {
        broadcastToolUse();
        if (uiState.selectedTool === 'watering_can') audioManager.playSfx('water');
        else if (uiState.selectedTool === 'hand' || uiState.selectedTool === 'scythe')
          audioManager.playSfx('harvest');
      } else if (result.message) {
        uiState.showToast(result.message, 'warning', 2000);
      }
    },
    [onPlotClick, broadcastToolUse]
  );

  const showAuthGate = isVerdant && authStatus !== 'authenticated';

  return (
    <ErrorBoundary>
      <Providers forceWebGLSupported={forceWebGLSupported}>
        <div
          id="app-root"
          className="relative w-full h-full min-h-screen overflow-hidden select-none bg-sky-950"
          data-testid="garden-island-app"
        >
          {showAuthGate ? (
            <AuthModal />
          ) : (
            <>
              {/* 3D WebGL Canvas Layer */}
              <GameCanvas>
                <GameRuntime
                  onSoilClick={handleSoilClick}
                  onPlotClick={handlePlotClick}
                  onPlayerFall={onPlayerFall}
                  inputManager={activeInputManager}
                >
                  {children}
                </GameRuntime>
              </GameCanvas>

              {/* HUD and UI Overlay Layer (pointer-events pass-through) */}
              <div
                id="ui-overlay"
                className="absolute inset-0 pointer-events-none z-10"
                data-testid="ui-overlay-container"
              >
                <HUD />
                <MobileHUD inputManager={activeInputManager} />
                <Toolbelt inputManager={activeInputManager} />
                <ShopModal />
                <InventoryPanel />
                <SettingsModal />
                {isVerdant && <LeaderboardModal />}
                <Tutorial />
                <OfflineSummary />
                <ToastRegion />
                <DiagnosticsOverlay enabled={debugEnabled} />
              </div>
            </>
          )}
        </div>
      </Providers>
    </ErrorBoundary>
  );
};
