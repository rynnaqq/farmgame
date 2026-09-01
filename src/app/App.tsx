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
import { saveService } from '../persistence/saveService';
import { simulateOfflineProgression } from '../persistence/offlineSimulation';
import { useGameStore } from '../state/gameStore';
import { useUiStore } from '../state/uiStore';
import { AUTOSAVE_INTERVAL_MS } from '../game/core/constants';
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      activeInputManager.attach(window);
      audioManager.init();
      const detachGestures = audioManager.attachUserGestureListeners(window);
      const detachVisibility = audioManager.attachVisibilityListener(document);
      const unbindSettings = audioManager.bindToSettingsStore();

      let isMounted = true;
      saveService.load().then(async ({ envelope }) => {
        if (!isMounted) return;

        const { updatedEnvelope, summary } = simulateOfflineProgression(envelope, Date.now());
        useGameStore.getState().loadSaveEnvelope(updatedEnvelope);
        await saveService.saveImmediate(updatedEnvelope);

        if (summary.shouldDisplay) {
          useUiStore.getState().openModal('offline_summary', summary);
        } else if (summary.clockMovedBackward) {
          useUiStore.getState().showToast(
            'System clock moved backward; offline simulation paused.',
            'warning'
          );
        }

        saveService.startAutosave(AUTOSAVE_INTERVAL_MS, () =>
          useGameStore.getState().toSaveEnvelope()
        );
        saveService.setupLifecycleListeners(() => useGameStore.getState().toSaveEnvelope());
      });

      return () => {
        isMounted = false;
        activeInputManager.detach();
        detachGestures();
        detachVisibility();
        unbindSettings();
        saveService.dispose();
      };
    }
  }, [activeInputManager]);


  return (
    <ErrorBoundary>
      <Providers forceWebGLSupported={forceWebGLSupported}>
        <div
          id="app-root"
          className="relative w-full h-full min-h-screen overflow-hidden select-none bg-sky-950"
          data-testid="garden-island-app"
        >
          {/* 3D WebGL Canvas Layer */}
          <GameCanvas>
            <GameRuntime
              onPlotClick={onPlotClick}
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
            <MobileHUD inputManager={activeInputManager} onPlotInteract={onPlotClick} />
            <Toolbelt inputManager={activeInputManager} />
            <ShopModal />
            <InventoryPanel />
            <SettingsModal />
            <Tutorial />
            <OfflineSummary />
            <ToastRegion />
            <DiagnosticsOverlay enabled={debugEnabled} />

          </div>
        </div>
      </Providers>
    </ErrorBoundary>
  );
};
