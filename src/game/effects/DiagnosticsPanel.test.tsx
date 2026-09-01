import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import {
  AutoQualityManager,
  stepQualityLevel,
  isDiagnosticsEnabled,
} from '../core/autoQualityManager';
import { DiagnosticsOverlay } from './DiagnosticsPanel';
import {
  resetDiagnosticsStore,
  updateDiagnosticsData,
  formatDiagnosticsStats,
} from './diagnosticsStore';
import { resetSettingsStore } from '../../state/settingsStore';

describe('Auto Quality Manager & Diagnostics', () => {
  beforeEach(() => {
    act(() => {
      resetSettingsStore();
      resetDiagnosticsStore();
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    act(() => {
      resetSettingsStore();
      resetDiagnosticsStore();
    });
  });

  describe('1. URL Parameter & Debug Flag Detection (isDiagnosticsEnabled)', () => {
    it('detects ?debug=1 in search query', () => {
      expect(isDiagnosticsEnabled('?debug=1')).toBe(true);
      expect(isDiagnosticsEnabled('?mode=game&debug=1&view=top')).toBe(true);
      expect(isDiagnosticsEnabled('https://example.com/play?debug=1')).toBe(true);
    });

    it('detects ?debug=true in search query', () => {
      expect(isDiagnosticsEnabled('?debug=true')).toBe(true);
      expect(isDiagnosticsEnabled('?DEBUG=TRUE')).toBe(true);
    });

    it('rejects ?debug=0, ?debug=false, or absent debug param', () => {
      expect(isDiagnosticsEnabled('?debug=0')).toBe(false);
      expect(isDiagnosticsEnabled('?debug=false')).toBe(false);
      expect(isDiagnosticsEnabled('?other=123')).toBe(false);
      expect(isDiagnosticsEnabled('')).toBe(false);
      expect(isDiagnosticsEnabled(undefined)).toBe(false);
    });

    it('detects window.__DEBUG__ flag if present on global window', () => {
      const mockWindow = { __DEBUG__: true, location: { search: '' } };
      expect(isDiagnosticsEnabled('', mockWindow)).toBe(true);

      const mockWindowDisabled = { __DEBUG__: false, location: { search: '' } };
      expect(isDiagnosticsEnabled('', mockWindowDisabled)).toBe(false);
    });
  });

  describe('2. Quality Level Stepping (stepQualityLevel)', () => {
    it('steps down correctly (high -> medium -> low -> low)', () => {
      expect(stepQualityLevel('high', 'down')).toBe('medium');
      expect(stepQualityLevel('medium', 'down')).toBe('low');
      expect(stepQualityLevel('low', 'down')).toBe('low'); // Clamped
    });

    it('steps up correctly (low -> medium -> high -> high)', () => {
      expect(stepQualityLevel('low', 'up')).toBe('medium');
      expect(stepQualityLevel('medium', 'up')).toBe('high');
      expect(stepQualityLevel('high', 'up')).toBe('high'); // Clamped
    });
  });

  describe('3. Auto Quality Manager: Step-Down (<45 FPS for 5 consecutive seconds)', () => {
    it('steps down from high to medium when FPS < 45 for >= 5 consecutive seconds', () => {
      const manager = new AutoQualityManager();
      const currentEffective: 'low' | 'medium' | 'high' = 'high';

      // 4 seconds of 30 FPS (delta = 0.0333s, 120 frames)
      for (let i = 0; i < 120; i++) {
        const result = manager.update(0.0333, 'auto', currentEffective);
        expect(result.stepped).toBe(false);
      }

      // Remaining 1.2 seconds of 30 FPS (total > 5.0 seconds)
      let steppedResult;
      for (let i = 0; i < 40; i++) {
        steppedResult = manager.update(0.0333, 'auto', currentEffective);
        if (steppedResult.stepped) break;
      }

      expect(steppedResult?.stepped).toBe(true);
      expect(steppedResult?.direction).toBe('down');
      expect(steppedResult?.previousQuality).toBe('high');
      expect(steppedResult?.newQuality).toBe('medium');
    });

    it('steps down from medium to low when FPS < 45 for >= 5 consecutive seconds', () => {
      const manager = new AutoQualityManager();
      let currentEffective: 'low' | 'medium' | 'high' = 'medium';

      // 5.2 seconds of 35 FPS (0.0285s per frame, 185 frames)
      let stepped = false;
      let finalResult;
      for (let i = 0; i < 190; i++) {
        const result = manager.update(0.0285, 'auto', currentEffective);
        if (result.stepped) {
          stepped = true;
          finalResult = result;
          currentEffective = result.newQuality;
          break;
        }
      }

      expect(stepped).toBe(true);
      expect(finalResult?.newQuality).toBe('low');
    });

    it('resets step-down timer if FPS recovers above 45 before 5 seconds elapse', () => {
      const manager = new AutoQualityManager();
      const currentEffective = 'high';

      // 3.5 seconds of low FPS (30 FPS)
      for (let i = 0; i < 105; i++) {
        manager.update(0.0333, 'auto', currentEffective);
      }
      expect(manager.getMetrics().underSec).toBeGreaterThan(3.0);

      // 1 second of good FPS (60 FPS)
      for (let i = 0; i < 60; i++) {
        const res = manager.update(0.0166, 'auto', currentEffective);
        expect(res.stepped).toBe(false);
      }

      // Under threshold duration should be reset to 0
      expect(manager.getMetrics().underSec).toBe(0);
    });

    it('does not step down below low quality', () => {
      const manager = new AutoQualityManager();
      const currentEffective = 'low';

      // 6 seconds of 20 FPS (0.05s per frame, 120 frames)
      let stepped = false;
      for (let i = 0; i < 120; i++) {
        const result = manager.update(0.05, 'auto', currentEffective);
        if (result.stepped) stepped = true;
      }

      expect(stepped).toBe(false);
      expect(manager.getMetrics().underSec).toBeGreaterThanOrEqual(5.0);
    });
  });

  describe('4. Auto Quality Manager: Step-Up (>58 FPS for 30 consecutive seconds)', () => {
    it('steps up from low to medium when FPS > 58 for >= 30 consecutive seconds', () => {
      const manager = new AutoQualityManager();
      let currentEffective: 'low' | 'medium' | 'high' = 'low';

      // 30.5 seconds of 60 FPS (0.0166s per frame, ~1850 frames)
      let stepped = false;
      let finalResult;
      for (let i = 0; i < 1900; i++) {
        const result = manager.update(0.0166, 'auto', currentEffective);
        if (result.stepped) {
          stepped = true;
          finalResult = result;
          currentEffective = result.newQuality;
          break;
        }
      }

      expect(stepped).toBe(true);
      expect(finalResult?.direction).toBe('up');
      expect(finalResult?.previousQuality).toBe('low');
      expect(finalResult?.newQuality).toBe('medium');
    });

    it('steps up from medium to high when FPS > 58 for >= 30 consecutive seconds', () => {
      const manager = new AutoQualityManager();
      let currentEffective: 'low' | 'medium' | 'high' = 'medium';

      let stepped = false;
      let finalResult;
      for (let i = 0; i < 1900; i++) {
        const result = manager.update(0.0166, 'auto', currentEffective);
        if (result.stepped) {
          stepped = true;
          finalResult = result;
          currentEffective = result.newQuality;
          break;
        }
      }

      expect(stepped).toBe(true);
      expect(finalResult?.newQuality).toBe('high');
    });

    it('resets step-up timer if FPS drops below 58 before 30 seconds elapse', () => {
      const manager = new AutoQualityManager();
      const currentEffective = 'low';

      // 20 seconds of 60 FPS
      for (let i = 0; i < 1200; i++) {
        manager.update(0.0166, 'auto', currentEffective);
      }
      expect(manager.getMetrics().overSec).toBeGreaterThan(19.0);

      // Brief dip to 50 FPS (0.02s delta)
      for (let i = 0; i < 30; i++) {
        manager.update(0.02, 'auto', currentEffective);
      }

      // Over threshold duration should be reset
      expect(manager.getMetrics().overSec).toBe(0);
    });

    it('does not step up above high quality', () => {
      const manager = new AutoQualityManager();
      const currentEffective = 'high';

      let stepped = false;
      for (let i = 0; i < 1900; i++) {
        const result = manager.update(0.0166, 'auto', currentEffective);
        if (result.stepped) stepped = true;
      }

      expect(stepped).toBe(false);
    });
  });

  describe('5. Hysteresis Cooldown (10 seconds minimum between steps)', () => {
    it('enforces 10-second cooldown after step-down preventing rapid successive transitions', () => {
      const manager = new AutoQualityManager();
      let currentEffective: 'low' | 'medium' | 'high' = 'high';

      // 1. Step down from high to medium (5.1s at 30 FPS)
      for (let i = 0; i < 160; i++) {
        const res = manager.update(0.0333, 'auto', currentEffective);
        if (res.stepped) {
          currentEffective = res.newQuality;
          break;
        }
      }
      expect(currentEffective).toBe('medium');
      expect(manager.getMetrics().cooldownRemainingSec).toBeCloseTo(10.0, 0);

      // 2. Continue running with bad FPS (<45 FPS) for 6 seconds (which is < 10s cooldown)
      let steppedDuringCooldown = false;
      for (let i = 0; i < 180; i++) {
        const res = manager.update(0.0333, 'auto', currentEffective);
        if (res.stepped) steppedDuringCooldown = true;
      }
      expect(steppedDuringCooldown).toBe(false);
      expect(currentEffective).toBe('medium');

      // 3. Complete the cooldown (4 more seconds, total 10s passed) + 5 seconds bad FPS
      let secondStep = false;
      for (let i = 0; i < 280; i++) {
        const res = manager.update(0.0333, 'auto', currentEffective);
        if (res.stepped) {
          secondStep = true;
          currentEffective = res.newQuality;
          break;
        }
      }
      expect(secondStep).toBe(true);
      expect(currentEffective).toBe('low');
    });

    it('enforces 10-second cooldown after step-up', () => {
      const manager = new AutoQualityManager();
      let currentEffective: 'low' | 'medium' | 'high' = 'low';

      // 1. Step up from low to medium (30s at 60 FPS)
      for (let i = 0; i < 1900; i++) {
        const res = manager.update(0.0166, 'auto', currentEffective);
        if (res.stepped) {
          currentEffective = res.newQuality;
          break;
        }
      }
      expect(currentEffective).toBe('medium');
      expect(manager.getMetrics().cooldownRemainingSec).toBeGreaterThan(9.0);
    });
  });

  describe('6. Manual Quality Presets (Non-Auto Invariance)', () => {
    it('ignores FPS drops and keeps effectiveQuality fixed when quality preset is not auto', () => {
      const manager = new AutoQualityManager();

      // Manual preset: 'high'
      for (let i = 0; i < 300; i++) {
        const res = manager.update(0.05, 'high', 'high'); // 20 FPS for 15 seconds
        expect(res.stepped).toBe(false);
        expect(res.newQuality).toBe('high');
      }

      // Manual preset: 'low'
      for (let i = 0; i < 2000; i++) {
        const res = manager.update(0.0166, 'low', 'low'); // 60 FPS for 33 seconds
        expect(res.stepped).toBe(false);
        expect(res.newQuality).toBe('low');
      }
    });
  });

  describe('7. Diagnostics Formatting & Overlay Rendering', () => {
    it('formats diagnostic stats string cleanly', () => {
      const stats = {
        fps: 59.84,
        frameTimeMs: 16.71,
        drawCalls: 42,
        triangles: 12450,
        textures: 4,
        geometries: 18,
        activeParticles: 120,
        qualityPreset: 'auto' as const,
        effectiveQuality: 'medium' as const,
      };

      const formatted = formatDiagnosticsStats(stats);
      expect(formatted.fps).toBe('59.8');
      expect(formatted.frameTime).toBe('16.7 ms');
      expect(formatted.drawCalls).toBe('42');
      expect(formatted.triangles).toBe('12,450');
      expect(formatted.quality).toBe('Auto (Medium)');
    });

    it('renders DiagnosticsOverlay when enabled with full HUD telemetry', () => {
      act(() => {
        updateDiagnosticsData({
          fps: 60.0,
          frameTimeMs: 16.6,
          drawCalls: 38,
          triangles: 8420,
          textures: 3,
          geometries: 15,
          activeParticles: 85,
          qualityPreset: 'auto',
          effectiveQuality: 'high',
        });
      });

      render(<DiagnosticsOverlay enabled={true} />);

      const panel = screen.getByTestId('diagnostics-panel');
      expect(panel).toBeInTheDocument();
      expect(panel).toHaveTextContent('60.0 FPS');
      expect(panel).toHaveTextContent('16.6 ms');
      expect(panel).toHaveTextContent('Calls: 38');
      expect(panel).toHaveTextContent('Triangles: 8,420');
      expect(panel).toHaveTextContent('Particles: 85');
      expect(panel).toHaveTextContent('Auto (High)');
    });

    it('does not render DiagnosticsOverlay when enabled is false', () => {
      const { container } = render(<DiagnosticsOverlay enabled={false} />);
      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('diagnostics-panel')).toBeNull();
    });
  });
});
