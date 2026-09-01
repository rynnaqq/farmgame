import React, { useState, useCallback } from 'react';
import { WebGLFallback } from './WebGLFallback';
import { isWebGL2Available } from './webglSupport';

export interface ProvidersProps {
  children: React.ReactNode;
  forceWebGLSupported?: boolean;
  onRetryWebGL?: () => void;
}

/**
 * Root providers wrapper.
 * Validates WebGL2 availability before mounting 3D graphics contexts,
 * displaying an accessible fallback screen if WebGL2 is unsupported.
 */
export const Providers: React.FC<ProvidersProps> = ({
  children,
  forceWebGLSupported,
  onRetryWebGL,
}) => {
  const [webglAvailable, setWebglAvailable] = useState<boolean>(() => {
    if (typeof forceWebGLSupported === 'boolean') {
      return forceWebGLSupported;
    }
    return isWebGL2Available();
  });

  const handleRetry = useCallback(() => {
    if (onRetryWebGL) {
      onRetryWebGL();
    }

    const isAvailable =
      typeof forceWebGLSupported === 'boolean' ? forceWebGLSupported : isWebGL2Available();

    setWebglAvailable(isAvailable);

    if (!isAvailable && typeof window !== 'undefined') {
      window.location.reload();
    }
  }, [forceWebGLSupported, onRetryWebGL]);

  if (!webglAvailable) {
    return <WebGLFallback onRetry={handleRetry} />;
  }

  return <>{children}</>;
};
