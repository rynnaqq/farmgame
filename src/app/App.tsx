import React, { useRef, useEffect } from 'react';
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
import { ToastRegion } from '../ui/ToastRegion';
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
 * GameRuntime scene coordinator, MobileHUD, Toolbelt, and the UI overlay root container.
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      activeInputManager.attach(window);
      return () => {
        activeInputManager.detach();
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
            <ToastRegion />
          </div>
        </div>
      </Providers>
    </ErrorBoundary>
  );
};

