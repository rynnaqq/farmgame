import React from 'react';
import { RefreshCw, Monitor, HelpCircle } from 'lucide-react';

export interface WebGLFallbackProps {
  onRetry?: () => void;
  reason?: string;
}

/**
 * WebGLFallback provides an accessible, full-page screen when WebGL2 context
 * cannot be initialized or fails.
 */
export const WebGLFallback: React.FC<WebGLFallbackProps> = ({
  onRetry,
  reason,
}) => {
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 select-text overflow-y-auto"
      data-testid="webgl-fallback"
    >
      <div className="max-w-lg w-full bg-slate-900/95 border border-amber-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md text-center">
        {/* Header Icon */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-5 shadow-inner">
          <Monitor className="w-8 h-8 stroke-[1.75]" aria-hidden="true" />
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-400 mb-3">
          WebGL2 Not Supported
        </h1>

        {/* Description */}
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6">
          Garden Island 3D requires <strong className="text-amber-300">WebGL2</strong> to render
          3D graphics, dynamic lighting, and physics simulations. Your browser or current device
          configuration does not support WebGL2 or hardware acceleration is disabled.
        </p>

        {reason && (
          <div className="mb-6 p-3 bg-slate-950/80 border border-amber-500/20 rounded-xl text-xs font-mono text-amber-200/90 text-left overflow-x-auto">
            <span className="font-semibold text-amber-400">Diagnostic Details: </span>
            {reason}
          </div>
        )}

        {/* Troubleshooting Guidance */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-left text-xs sm:text-sm text-slate-400 space-y-2.5 mb-6">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200 mb-1">
            <HelpCircle className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <span>How to fix this:</span>
          </div>
          <ul className="list-disc pl-5 space-y-1.5 leading-normal">
            <li>
              <strong>Enable Hardware Acceleration:</strong> Check browser settings (e.g., Chrome:
              Settings &rarr; System &rarr; <em>Use graphics acceleration when available</em>).
            </li>
            <li>
              <strong>Update Browser & Drivers:</strong> Ensure your graphics drivers and browser
              (Chrome, Firefox, Safari, Edge) are updated to the latest version.
            </li>
            <li>
              <strong>Check Browser Flags:</strong> Ensure WebGL is not blocked by privacy
              extensions or corporate security policies.
            </li>
          </ul>
        </div>

        {/* Retry Button */}
        <button
          type="button"
          onClick={handleRetry}
          className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-semibold py-3 px-6 rounded-xl shadow-lg shadow-amber-500/20 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-slate-900 cursor-pointer"
          aria-label="Retry WebGL initialization"
        >
          <RefreshCw className="w-4 h-4 stroke-[2.25]" aria-hidden="true" />
          <span>Retry Graphics Initialization</span>
        </button>
      </div>
    </div>
  );
};
