import React, { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';
import { useSettingsStore } from '../state/settingsStore';

export interface GameCanvasProps {
  children?: React.ReactNode;
  className?: string;
}

/**
 * GameCanvas establishes the 3D rendering context:
 * - Three.js WebGL canvas with ACESFilmicToneMapping and sRGB output
 * - Quality-aware pixel ratio capping (Low 1.0, Med 1.5, High 2.0 desktop / 1.5 mobile)
 * - Quality-aware shadow map enablement
 * - Default isometric third-person camera perspective
 * - Rapier 3D Physics simulation container
 */
export const GameCanvas: React.FC<GameCanvasProps> = ({
  children,
  className = 'w-full h-full relative outline-none',
}) => {
  const effectiveQuality = useSettingsStore((state) => state.effectiveQuality);

  // Determine clamped device pixel ratio based on quality settings
  const dprRange: [number, number] = useMemo(() => {
    const isMobile =
      typeof window !== 'undefined' &&
      (window.innerWidth < 768 ||
        (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0));

    switch (effectiveQuality) {
      case 'low':
        return [1, 1.0];
      case 'medium':
        return [1, 1.5];
      case 'high':
      default:
        // Spec caps: 2.0 desktop / 1.5 mobile. Higher values multiply
        // fullscreen (bloom) cost quadratically for little visible gain.
        return [1, isMobile ? 1.5 : 2.0];
    }
  }, [effectiveQuality]);

  const shadowsEnabled = effectiveQuality !== 'low';

  // Prevent the browser from hijacking canvas touches for scrolling/zooming
  // when the player is idle: without touch-action none, an idle-hold can be
  // consumed by the browser as a pan/zoom gesture and the camera swipe appears
  // stuck until the next full gesture.
  const canvasStyle = useMemo<React.CSSProperties>(() => ({ touchAction: 'none' }), []);

  return (
    <div className={className} tabIndex={0} style={canvasStyle}>
      <Canvas
        shadows={shadowsEnabled ? 'soft' : false}
        dpr={dprRange}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
          outputColorSpace: THREE.SRGBColorSpace,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
        camera={{
          position: [6.5, 8.7, 6.5],
          fov: 45,
          near: 0.1,
          far: 250,
        }}
      >
        <Suspense fallback={null}>
          <Physics gravity={[0, -9.81, 0]}>{children}</Physics>
        </Suspense>
      </Canvas>
    </div>
  );
};
