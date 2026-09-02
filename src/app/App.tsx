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
import { executeToolAction } from '../game/farming/farmingCommands';
import { installTestClock } from '../test/testClock';
import { AuthModal } from '../features/auth/AuthModal';
import { useAuthStore } from '../features/auth/authStore';
import { useRoomSession } from '../game/multiplayer/useRoomSession';
import type { PlotId } from '../state/storeTypes';

export interface AppProps {
  children?: React.ReactNode;
  forceWebGLSupported?: boolean;
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

  const authStatus = useAuthStore((state) => state.status);
  const initializeAuth = useAuthStore((state) => state.initialize);
  const isAuthenticated = authStatus === 'authenticated';

  useRoomSession();

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      installTestClock();
      activeInputManager.attach(window);
      audioManager.init();
      const detachGestures = audioManager.attachUserGestureListeners(window);
      const detachVisibility = audioManager.attachVisibilityListener(document);
      const unbindSettings = audioManager.bindToSettingsStore();

      let isMounted = true;
      if (isAuthenticated) {
        // Server-authoritative mode (Project Verdant): skip local save/offline sim;
        // persistent progression lives in Supabase.
        saveService.startAutosave(AUTOSAVE_INTERVAL_MS, () =>
          useGameStore.getState().toSaveEnvelope()
        );
      } else {
        saveService.load().then(async ({ envelope }) => {
          if (!isMounted) return;

          const { updatedEnvelope, summary } = simulateOfflineProgression(envelope, Date.now());
          useGameStore.getState().loadSaveEnvelope(updatedEnvelope);
          await saveService.saveImmediate(updatedEnvelope);

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
  }, [activeInputManager, isAuthenticated]);

  const handlePlotClick = React.useCallback(
    (plotId: PlotId) => {
      if (onPlotClick) {
        onPlotClick(plotId);
        return;
      }
      const uiState = useUiStore.getState();
      const gameState = useGameStore.getState();
      const result = executeToolAction(
        plotId,
        uiState.selectedTool,
        uiState.selectedSeed,
        gameState.player.position,
        {
          isGoldenCan: gameState.farm.goldenWateringCanOwned,
          weather: gameState.weather.current,
          nowMs: Date.now(),
        }
      );
      if (result.ok) {
        if (uiState.selectedTool === 'trowel') audioManager.playSfx('till');
        else if (uiState.selectedTool === 'watering_can') audioManager.playSfx('water');
        else if (uiState.selectedTool === 'seed_bag') audioManager.playSfx('plant');
        else if (uiState.selectedTool === 'hand' || uiState.selectedTool === 'scythe')
          audioManager.playSfx('harvest');
      } else if (result.message) {
        uiState.showToast(result.message, 'warning', 2000);
      }
    },
    [onPlotClick]
  );

  return (
    <ErrorBoundary>
      <Providers forceWebGLSupported={forceWebGLSupported}>
        <div
          id="app-root"
          className="relative w-full h-full min-h-screen overflow-hidden select-none bg-sky-950"
          data-testid="garden-island-app"
        >
          {authStatus !== 'authenticated' ? (
            <AuthModal />
          ) : (
            <>
              {/* 3D WebGL Canvas Layer */}
              <GameCanvas>
                <GameRuntime
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
                <MobileHUD inputManager={activeInputManager} onPlotInteract={handlePlotClick} />
                <Toolbelt inputManager={activeInputManager} />
                <ShopModal />
                <InventoryPanel />
                <SettingsModal />
                <LeaderboardModal />
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
