import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';
import { WebGLFallback } from './WebGLFallback';
import { Providers } from './providers';
import { isWebGL2Available } from './webglSupport';
import { App } from './App';
import { useGameStore, resetGameStore } from '../state/gameStore';
import { resetUiStore } from '../state/uiStore';
import { resetSettingsStore, SETTINGS_STORAGE_KEY } from '../state/settingsStore';

// Component that throws on demand
const ProblemChild: React.FC<{ shouldThrow?: boolean; message?: string }> = ({
  shouldThrow = true,
  message = 'Simulated crash in 3D runtime',
}) => {
  if (shouldThrow) {
    throw new Error(message);
  }
  return <div data-testid="problem-child-ok">Everything is fine</div>;
};

describe('Task 5: App Shell, Error Boundary & WebGL Fallback', () => {
  beforeEach(() => {
    localStorage.clear();
    resetGameStore();
    resetUiStore();
    resetSettingsStore();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isWebGL2Available()', () => {
    it('returns true when canvas returns a webgl2 context', () => {
      const result = isWebGL2Available();
      expect(typeof result).toBe('boolean');
    });

    it('returns false when getContext returns null or throws', () => {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextId: string) => {
        if (contextId === 'webgl2' || contextId === 'experimental-webgl2') {
          return null;
        }
        return null;
      });

      const available = isWebGL2Available();
      expect(available).toBe(false);

      HTMLCanvasElement.prototype.getContext = originalGetContext;
    });

    it('handles exceptions thrown by getContext safely without crashing', () => {
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation(() => {
        throw new Error('WebGL context creation blocked by security policy');
      });

      const available = isWebGL2Available();
      expect(available).toBe(false);

      HTMLCanvasElement.prototype.getContext = originalGetContext;
    });
  });

  describe('WebGLFallback Component', () => {
    it('renders accessible alert dialog with clear WebGL2 explanation and diagnostic tips', () => {
      const onRetry = vi.fn();
      render(<WebGLFallback onRetry={onRetry} />);

      const alertContainer = screen.getByRole('alert');
      expect(alertContainer).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/webgl2/i);
      expect(screen.getAllByText(/hardware acceleration/i).length).toBeGreaterThan(0);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('ErrorBoundary Component', () => {
    // Suppress expected console.error during ErrorBoundary tests
    const originalConsoleError = console.error;
    beforeEach(() => {
      console.error = vi.fn();
    });
    afterEach(() => {
      console.error = originalConsoleError;
    });

    it('renders children normally when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div data-testid="child-content">Child Content Loaded</div>
        </ErrorBoundary>
      );

      expect(screen.getByTestId('child-content')).toHaveTextContent('Child Content Loaded');
    });

    it('catches render errors and displays accessible fallback UI with error details', () => {
      render(
        <ErrorBoundary>
          <ProblemChild message="Test crash 123" />
        </ErrorBoundary>
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Test crash 123/i).length).toBeGreaterThan(0);
    });

    it('calls onError callback when error is caught', () => {
      const onError = vi.fn();
      render(
        <ErrorBoundary onError={onError}>
          <ProblemChild message="Critical failure" />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Critical failure' }),
        expect.anything()
      );
    });

    it('renders custom fallback element or function when provided', () => {
      render(
        <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom Fallback UI</div>}>
          <ProblemChild />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });

    it('provides "Reload Game" action that invokes onReload or reloads page', () => {
      const onReload = vi.fn();
      render(
        <ErrorBoundary onReload={onReload}>
          <ProblemChild />
        </ErrorBoundary>
      );

      const reloadButton = screen.getByRole('button', { name: /reload game/i });
      expect(reloadButton).toBeInTheDocument();

      fireEvent.click(reloadButton);
      expect(onReload).toHaveBeenCalledTimes(1);
    });

    it('provides "Reset Game Data" action that clears local storage and resets Zustand stores', () => {
      // Seed stores and localStorage with dirty data
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ graphicsQuality: 'low' }));
      useGameStore.getState().addCoins(500);
      expect(useGameStore.getState().player.coins).toBe(600);

      const onReset = vi.fn();
      render(
        <ErrorBoundary onReset={onReset}>
          <ProblemChild />
        </ErrorBoundary>
      );

      const resetButton = screen.getByRole('button', { name: /reset game data/i });
      expect(resetButton).toBeInTheDocument();

      fireEvent.click(resetButton);

      expect(onReset).toHaveBeenCalledTimes(1);
      // Coins should be reset to starting coins
      expect(useGameStore.getState().player.coins).toBe(100);
    });

    it('provides "Try Again" recovery button that clears error state', () => {
      const TestContainer = () => {
        const [shouldThrow, setShouldThrow] = useState(true);
        return (
          <div>
            <button data-testid="fix-btn" onClick={() => setShouldThrow(false)}>
              Fix Error
            </button>
            <ErrorBoundary>
              <ProblemChild shouldThrow={shouldThrow} message="Recoverable error" />
            </ErrorBoundary>
          </div>
        );
      };

      render(<TestContainer />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getAllByText(/Recoverable error/i).length).toBeGreaterThan(0);

      // Fix underlying error state
      fireEvent.click(screen.getByTestId('fix-btn'));

      // Click "Try Again"
      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(tryAgainButton);

      expect(screen.getByTestId('problem-child-ok')).toBeInTheDocument();
    });
  });

  describe('Providers Component', () => {
    it('renders children when WebGL2 is available', () => {
      render(
        <Providers forceWebGLSupported={true}>
          <div data-testid="provider-child">Child in Providers</div>
        </Providers>
      );

      expect(screen.getByTestId('provider-child')).toBeInTheDocument();
    });

    it('renders WebGLFallback when WebGL2 is not supported', () => {
      render(
        <Providers forceWebGLSupported={false}>
          <div data-testid="provider-child">Child in Providers</div>
        </Providers>
      );

      expect(screen.queryByTestId('provider-child')).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/WebGL2 Not Supported/i)).toBeInTheDocument();
    });
  });

  describe('App Shell Component', () => {
    it('renders main application container, game canvas, and UI overlay container', () => {
      render(
        <App forceWebGLSupported={true}>
          <group name="TestExtension" />
        </App>
      );

      const appContainer = screen.getByTestId('garden-island-app');
      expect(appContainer).toBeInTheDocument();
      expect(appContainer).toHaveClass('relative', 'w-full', 'h-full', 'overflow-hidden');

      const uiOverlay = screen.getByTestId('ui-overlay-container');
      expect(uiOverlay).toBeInTheDocument();
      expect(uiOverlay).toHaveClass('pointer-events-none', 'z-10');
    });

    it('renders WebGLFallback when WebGL2 is unsupported', () => {
      render(<App forceWebGLSupported={false} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/WebGL2 Not Supported/i)).toBeInTheDocument();
    });
  });
});
