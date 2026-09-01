import React, { Component } from 'react';
import { AlertOctagon, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { resetGameStore } from '../state/gameStore';
import { resetUiStore } from '../state/uiStore';
import { resetSettingsStore } from '../state/settingsStore';

export interface ErrorBoundaryProps {
  children?: React.ReactNode;
  fallback?: React.ReactNode | ((error: Error, reset: () => void) => React.ReactNode);
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onReload?: () => void;
  onReset?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Global ErrorBoundary catching unhandled React render & runtime errors.
 * Provides accessible recovery options: Retry, Reload Game, and Reset Game Data.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
    console.error('[GardenIsland3D:ErrorBoundary] Uncaught application error:', error, errorInfo);
  }

  private handleTryAgain = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = (): void => {
    if (this.props.onReload) {
      this.props.onReload();
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleResetGameData = (): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
      } else if (typeof localStorage !== 'undefined') {
        localStorage.clear();
      }

      resetGameStore();
      resetUiStore();
      resetSettingsStore();
      this.props.onReset?.();
      this.setState({ hasError: false, error: null, errorInfo: null });
    } catch (err) {
      console.error('[GardenIsland3D:ErrorBoundary] Failed to reset game data:', err);
      this.props.onReset?.();
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  };

  public override render(): React.ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (!hasError) {
      return children;
    }

    if (fallback) {
      if (typeof fallback === 'function') {
        return fallback(error ?? new Error('Unknown error'), this.handleTryAgain);
      }
      return fallback;
    }

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 select-text overflow-y-auto"
        data-testid="error-boundary-fallback"
      >
        <div className="max-w-xl w-full bg-slate-900/95 border border-rose-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md text-center">
          {/* Header Icon */}
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-5 shadow-inner">
            <AlertOctagon className="w-8 h-8 stroke-[1.75]" aria-hidden="true" />
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-400 mb-2">
            Something went wrong
          </h1>

          {/* Subtitle */}
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-5">
            Garden Island 3D encountered an unexpected error. You can try recovering the current
            session, reloading the page, or resetting local game data.
          </p>

          {/* Collapsible Error Details */}
          <details className="text-left bg-slate-950/80 border border-slate-800 rounded-xl p-3 sm:p-4 my-5 overflow-hidden text-xs font-mono text-rose-300">
            <summary className="cursor-pointer font-semibold text-slate-400 select-none hover:text-slate-200 focus:outline-none">
              View Error Details &amp; Stack Trace
            </summary>
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
              <p className="font-semibold text-rose-400 break-words">
                {error?.name}: {error?.message || 'Unknown runtime error'}
              </p>
              {error?.stack && (
                <pre className="text-[11px] text-slate-500 overflow-x-auto whitespace-pre-wrap">
                  {error.stack}
                </pre>
              )}
              {errorInfo?.componentStack && (
                <pre className="text-[10px] text-slate-600 overflow-x-auto whitespace-pre-wrap">
                  {errorInfo.componentStack}
                </pre>
              )}
            </div>
          </details>

          {/* Recovery Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
            <button
              type="button"
              onClick={this.handleTryAgain}
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 text-slate-200 font-semibold py-2.5 px-4 rounded-xl shadow transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Try Again</span>
            </button>

            <button
              type="button"
              onClick={this.handleReload}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-900/30 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>Reload Game</span>
            </button>

            <button
              type="button"
              onClick={this.handleResetGameData}
              className="flex items-center justify-center gap-2 bg-rose-700/80 hover:bg-rose-600 active:bg-rose-800 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-rose-950/30 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-400 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              <span>Reset Game Data</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
