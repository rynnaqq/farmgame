import { create } from 'zustand';
import type { QualityLevel } from '../../state/storeTypes';

export interface DiagnosticsStats {
  fps: number;
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  textures: number;
  geometries: number;
  activeParticles: number;
  qualityPreset: QualityLevel;
  effectiveQuality: 'low' | 'medium' | 'high';
}

export interface DiagnosticsStoreState extends DiagnosticsStats {
  setDiagnostics: (stats: Partial<DiagnosticsStats>) => void;
  resetDiagnostics: () => void;
}

const DEFAULT_DIAGNOSTICS: DiagnosticsStats = {
  fps: 60.0,
  frameTimeMs: 16.6,
  drawCalls: 0,
  triangles: 0,
  textures: 0,
  geometries: 0,
  activeParticles: 0,
  qualityPreset: 'auto',
  effectiveQuality: 'medium',
};

export const useDiagnosticsStore = create<DiagnosticsStoreState>((set) => ({
  ...DEFAULT_DIAGNOSTICS,
  setDiagnostics: (partial) => set((state) => ({ ...state, ...partial })),
  resetDiagnostics: () => set(DEFAULT_DIAGNOSTICS),
}));

export function updateDiagnosticsData(stats: Partial<DiagnosticsStats>): void {
  useDiagnosticsStore.getState().setDiagnostics(stats);
}

export function resetDiagnosticsStore(): void {
  useDiagnosticsStore.getState().resetDiagnostics();
}

/**
 * Formats raw diagnostic numbers into human-readable strings for telemetry overlay.
 */
export function formatDiagnosticsStats(stats: DiagnosticsStats): {
  fps: string;
  frameTime: string;
  drawCalls: string;
  triangles: string;
  textures: string;
  geometries: string;
  particles: string;
  quality: string;
} {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const qualityStr =
    stats.qualityPreset === 'auto'
      ? `Auto (${cap(stats.effectiveQuality)})`
      : cap(stats.qualityPreset);

  return {
    fps: stats.fps.toFixed(1),
    frameTime: `${stats.frameTimeMs.toFixed(1)} ms`,
    drawCalls: `${stats.drawCalls}`,
    triangles: stats.triangles.toLocaleString(),
    textures: `${stats.textures}`,
    geometries: `${stats.geometries}`,
    particles: `${stats.activeParticles}`,
    quality: qualityStr,
  };
}
