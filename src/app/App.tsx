import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { Providers } from './providers';
import { GameCanvas } from '../game/GameCanvas';
import { GameRuntime } from '../game/GameRuntime';
import type { PlotId } from '../state/storeTypes';

export interface AppProps {
  children?: React.ReactNode;
  forceWebGLSupported?: boolean;
  onPlotClick?: (plotId: PlotId) => void;
  onPlayerFall?: () => void;
}

/**
 * Main application entry component for Garden Island 3D.
 * Combines global ErrorBoundary, WebGL validation provider, 3D GameCanvas,
 * GameRuntime scene coordinator, and the UI overlay root container.
 */
export const App: React.FC<AppProps> = ({
  children,
  forceWebGLSupported,
  onPlotClick,
  onPlayerFall,
}) => {
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
            <GameRuntime onPlotClick={onPlotClick} onPlayerFall={onPlayerFall}>
              {children}
            </GameRuntime>
          </GameCanvas>

          {/* HUD and UI Overlay Layer (pointer-events pass-through) */}
          <div
            id="ui-overlay"
            className="absolute inset-0 pointer-events-none z-10"
            data-testid="ui-overlay-container"
          />
        </div>
      </Providers>
    </ErrorBoundary>
  );
};
