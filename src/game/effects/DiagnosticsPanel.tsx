import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useDiagnosticsStore, updateDiagnosticsData, formatDiagnosticsStats } from './diagnosticsStore';
import { useSettingsStore } from '../../state/settingsStore';
import { autoQualityManager } from '../core/autoQualityManager';

// ============================================================================
// HTML UI Overlay (HUD)
// ============================================================================

export interface DiagnosticsOverlayProps {
  enabled?: boolean;
}

export const DiagnosticsOverlay: React.FC<DiagnosticsOverlayProps> = ({
  enabled = false,
}) => {
  const stats = useDiagnosticsStore();

  if (!enabled) {
    return null;
  }

  const formatted = formatDiagnosticsStats(stats);

  return (
    <div
      data-testid="diagnostics-panel"
      aria-label="Engine Diagnostics"
      className="fixed top-2 left-2 z-50 pointer-events-none select-none bg-black/85 backdrop-blur-sm text-green-400 font-mono text-xs p-3 rounded-lg shadow-xl border border-green-500/30 flex flex-col gap-1 min-w-[200px]"
    >
      <div className="flex items-center justify-between border-b border-green-500/20 pb-1 mb-1 font-bold text-green-300">
        <span>Engine Diagnostics</span>
        <span className="text-[10px] text-green-400/70">DEBUG</span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-gray-400">FPS:</span>
        <span className="font-semibold text-green-300">
          {formatted.fps} FPS ({formatted.frameTime})
        </span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-gray-400">Draw Calls:</span>
        <span className="text-emerald-300">Calls: {formatted.drawCalls}</span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-gray-400">Triangles:</span>
        <span className="text-emerald-300">Triangles: {formatted.triangles}</span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-gray-400">Memory:</span>
        <span className="text-emerald-300">
          Tex: {formatted.textures} | Geo: {formatted.geometries}
        </span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-gray-400">Particles:</span>
        <span className="text-emerald-300">Particles: {formatted.particles}</span>
      </div>

      <div className="flex justify-between items-center pt-1 border-t border-green-500/20">
        <span className="text-gray-400">Quality:</span>
        <span className="font-semibold text-yellow-300">{formatted.quality}</span>
      </div>
    </div>
  );
};

// ============================================================================
// Three.js / R3F In-Scene Diagnostics Collector & Auto Quality Manager Loop
// ============================================================================

export interface DiagnosticsPanelProps {
  children?: React.ReactNode;
}

/**
 * DiagnosticsPanel is rendered inside the R3F Canvas tree.
 * It observes Three.js gl.info renderer metrics, calculates rolling FPS,
 * evaluates AutoQualityManager step transitions, and feeds the diagnostics store.
 */
export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({ children }) => {
  const { gl } = useThree();
  const qualityPreset = useSettingsStore((state) => state.quality);
  const effectiveQuality = useSettingsStore((state) => state.effectiveQuality);
  const setEffectiveQuality = useSettingsStore((state) => state.setEffectiveQuality);

  const lastUpdateRef = useRef<number>(0);

  useFrame((_, delta) => {
    // 1. Run AutoQualityManager update
    const result = autoQualityManager.update(delta, qualityPreset, effectiveQuality);
    if (result.stepped && result.newQuality !== effectiveQuality) {
      setEffectiveQuality(result.newQuality);
    }

    // 2. Throttle telemetry updates to UI store (every ~100ms) to avoid unnecessary React re-renders
    const now = performance.now();
    if (now - lastUpdateRef.current >= 100) {
      lastUpdateRef.current = now;

      const frameTimeMs = delta * 1000;
      const fps = result.currentFps;
      const info = gl.info;

      updateDiagnosticsData({
        fps,
        frameTimeMs,
        drawCalls: info?.render?.calls ?? 0,
        triangles: info?.render?.triangles ?? 0,
        textures: info?.memory?.textures ?? 0,
        geometries: info?.memory?.geometries ?? 0,
        qualityPreset,
        effectiveQuality,
      });
    }
  });

  return <>{children}</>;
};

export default DiagnosticsPanel;
