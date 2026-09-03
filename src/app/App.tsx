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
import { executePlantAction, executeCropAction } from '../game/farming/farmingCommands';
import { installTestClock } from '../test/testClock';
import { AuthModal } from '../features/auth/AuthModal';
import { useAuthStore } from '../features/auth/authStore';
import { useRoomSession } from '../game/multiplayer/useRoomSession';
import { useNetStore } from '../game/multiplayer/netStore';
import { getRoomConnection } from '../game/multiplayer/RoomConnection';
import type { CommandResult, PlotId } from '../state/storeTypes';
import type { CropPlacement } from '../game/world/farmLayout';

export interface AppProps {
  children?: React.ReactNode;
  forceWebGLSupported?: boolean;
  onPlantAt?: (placement: CropPlacement) => void;
  onCropInteract?: (plotId: PlotId) => void;
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
  onPlantAt,
  onCropInteract,
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
        // Server-authoritative mode (Project Verdant): persistent progression
        // lives in Supabase RPCs. Do not touch the local save slot at all, so a
        // logout returns the player to their intact local save.
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

  const reportCommand = React.useCallback((result: CommandResult<unknown>) => {
    if (result.ok) {
      if (useNetStore.getState().roomId) {
        getRoomConnection().playToolAnimation();
      }
      return;
    }
    useUiStore.getState().showToast(result.message, 'warning', 2000);
  }, []);

  const handlePlantAt = React.useCallback(
    (placement: CropPlacement) => {
      if (onPlantAt) {
        onPlantAt(placement);
        return;
      }
      const ui = useUiStore.getState();
      const result = executePlantAction(placement, ui.selectedSeed, { nowMs: Date.now() });
      reportCommand(result);
      if (result.ok) audioManager.playSfx('plant');
    },
    [onPlantAt, reportCommand]
  );

  const handleCropInteract = React.useCallback(
    (plotId: PlotId) => {
      if (onCropInteract) {
        onCropInteract(plotId);
        return;
      }
      const ui = useUiStore.getState();
      const game = useGameStore.getState();
      const result = executeCropAction(plotId, ui.selectedTool, {
        isGoldenCan: game.farm.goldenWateringCanOwned,
        weather: game.weather.current,
        nowMs: Date.now(),
      });
      reportCommand(result);
      if (result.ok) {
        if (ui.selectedTool === 'watering_can') audioManager.playSfx('water');
        else audioManager.playSfx('harvest');
      }
    },
    [onCropInteract, reportCommand]
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
                  onPlantAt={handlePlantAt}
                  onCropInteract={handleCropInteract}
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
                <MobileHUD inputManager={activeInputManager} onCropInteract={handleCropInteract} />
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
