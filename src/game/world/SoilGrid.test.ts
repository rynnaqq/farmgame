import { describe, it, expect } from 'vitest';
import {
  PLOT_SIZE,
  PLOT_SPACING,
  PLOT_TOTAL_SIZE,
  MAX_GRID_SIZE,
} from '../core/constants';
import {
  getPlotPosition,
  getGridBounds,
  isPlotUnlocked,
  getPlotId,
  parsePlotId,
  getLockedPlotSlots,
  worldToGridCoords,
  getPlotDistance,
} from './gridCoordinates';

describe('SoilGrid Coordinate Calculations', () => {
  describe('Constants sanity check', () => {
    it('should have expected plot sizing constants', () => {
      expect(PLOT_SIZE).toBe(1.4);
      expect(PLOT_SPACING).toBe(0.15);
      expect(PLOT_TOTAL_SIZE).toBeCloseTo(1.55, 5);
      expect(MAX_GRID_SIZE).toBe(8);
    });
  });

  describe('getPlotPosition', () => {
    it('should calculate symmetric centered positions for 8x8 grid', () => {
      const p00 = getPlotPosition(0, 0, 8);
      const p77 = getPlotPosition(7, 7, 8);

      // (0 - 3.5) * 1.55 = -5.425
      expect(p00[0]).toBeCloseTo(-5.425, 4);
      expect(p00[2]).toBeCloseTo(-5.425, 4);
      expect(p00[1]).toBe(0.05);

      // (7 - 3.5) * 1.55 = +5.425
      expect(p77[0]).toBeCloseTo(5.425, 4);
      expect(p77[2]).toBeCloseTo(5.425, 4);
      expect(p77[1]).toBe(0.05);

      // Center should be symmetric around origin
      expect(p00[0] + p77[0]).toBeCloseTo(0, 5);
      expect(p00[2] + p77[2]).toBeCloseTo(0, 5);
    });

    it('should calculate symmetric centered positions for 4x4 grid', () => {
      const p00 = getPlotPosition(0, 0, 4);
      const p33 = getPlotPosition(3, 3, 4);

      // (0 - 1.5) * 1.55 = -2.325
      expect(p00[0]).toBeCloseTo(-2.325, 4);
      expect(p00[2]).toBeCloseTo(-2.325, 4);

      // (3 - 1.5) * 1.55 = +2.325
      expect(p33[0]).toBeCloseTo(2.325, 4);
      expect(p33[2]).toBeCloseTo(2.325, 4);

      expect(p00[0] + p33[0]).toBeCloseTo(0, 5);
      expect(p00[2] + p33[2]).toBeCloseTo(0, 5);
    });

    it('should calculate symmetric centered positions for 6x6 grid', () => {
      const p00 = getPlotPosition(0, 0, 6);
      const p55 = getPlotPosition(5, 5, 6);

      // (0 - 2.5) * 1.55 = -3.875
      expect(p00[0]).toBeCloseTo(-3.875, 4);
      expect(p00[2]).toBeCloseTo(-3.875, 4);

      // (5 - 2.5) * 1.55 = +3.875
      expect(p55[0]).toBeCloseTo(3.875, 4);
      expect(p55[2]).toBeCloseTo(3.875, 4);

      expect(p00[0] + p55[0]).toBeCloseTo(0, 5);
      expect(p00[2] + p55[2]).toBeCloseTo(0, 5);
    });

    it('should allow custom Y offset', () => {
      const pos = getPlotPosition(0, 0, 8, 0.12);
      expect(pos[1]).toBe(0.12);
    });
  });

  describe('getGridBounds', () => {
    it('should compute exact bounds for 4x4 grid', () => {
      const bounds = getGridBounds(4);
      // Width = (4 - 1) * 1.55 + 1.4 = 3 * 1.55 + 1.4 = 4.65 + 1.4 = 6.05
      const expectedSpan = 6.05;
      expect(bounds.width).toBeCloseTo(expectedSpan, 4);
      expect(bounds.depth).toBeCloseTo(expectedSpan, 4);
      expect(bounds.minX).toBeCloseTo(-expectedSpan / 2, 4);
      expect(bounds.maxX).toBeCloseTo(expectedSpan / 2, 4);
      expect(bounds.minZ).toBeCloseTo(-expectedSpan / 2, 4);
      expect(bounds.maxZ).toBeCloseTo(expectedSpan / 2, 4);
    });

    it('should compute exact bounds for 6x6 grid', () => {
      const bounds = getGridBounds(6);
      // Width = 5 * 1.55 + 1.4 = 7.75 + 1.4 = 9.15
      const expectedSpan = 9.15;
      expect(bounds.width).toBeCloseTo(expectedSpan, 4);
      expect(bounds.depth).toBeCloseTo(expectedSpan, 4);
      expect(bounds.minX).toBeCloseTo(-expectedSpan / 2, 4);
      expect(bounds.maxX).toBeCloseTo(expectedSpan / 2, 4);
    });

    it('should compute exact bounds for 8x8 grid', () => {
      const bounds = getGridBounds(8);
      // Width = 7 * 1.55 + 1.4 = 10.85 + 1.4 = 12.25
      const expectedSpan = 12.25;
      expect(bounds.width).toBeCloseTo(expectedSpan, 4);
      expect(bounds.depth).toBeCloseTo(expectedSpan, 4);
      expect(bounds.minX).toBeCloseTo(-expectedSpan / 2, 4);
      expect(bounds.maxX).toBeCloseTo(expectedSpan / 2, 4);
    });
  });

  describe('isPlotUnlocked', () => {
    it('should return true for plots within current grid size', () => {
      expect(isPlotUnlocked(0, 0, 4)).toBe(true);
      expect(isPlotUnlocked(3, 3, 4)).toBe(true);
      expect(isPlotUnlocked(2, 1, 4)).toBe(true);
    });

    it('should return false for plots outside current grid size', () => {
      expect(isPlotUnlocked(4, 0, 4)).toBe(false);
      expect(isPlotUnlocked(0, 4, 4)).toBe(false);
      expect(isPlotUnlocked(5, 5, 4)).toBe(false);
      expect(isPlotUnlocked(-1, 0, 4)).toBe(false);
    });

    it('should handle 6x6 unlocked boundary', () => {
      expect(isPlotUnlocked(5, 5, 6)).toBe(true);
      expect(isPlotUnlocked(6, 0, 6)).toBe(false);
      expect(isPlotUnlocked(0, 6, 6)).toBe(false);
    });
  });

  describe('getPlotId and parsePlotId', () => {
    it('should format and parse plot IDs consistently', () => {
      const id = getPlotId(2, 3);
      expect(id).toBe('plot-2-3');

      const parsed = parsePlotId(id);
      expect(parsed).toEqual({ row: 2, col: 3 });
    });

    it('should return null for invalid plot IDs', () => {
      expect(parsePlotId('invalid-id')).toBeNull();
      expect(parsePlotId('plot-a-b')).toBeNull();
      expect(parsePlotId('')).toBeNull();
    });
  });

  describe('getLockedPlotSlots', () => {
    it('should return 48 locked slots for 4x4 grid (total 64 - 16 = 48)', () => {
      const locked = getLockedPlotSlots(4, 8);
      expect(locked.length).toBe(64 - 16);

      // Expansion 1 slots (within 6x6 but outside 4x4) = 36 - 16 = 20 slots
      const exp1Slots = locked.filter((s) => s.requiredGridSize === 6);
      expect(exp1Slots.length).toBe(20);

      // Expansion 2 slots (outside 6x6 up to 8x8) = 64 - 36 = 28 slots
      const exp2Slots = locked.filter((s) => s.requiredGridSize === 8);
      expect(exp2Slots.length).toBe(28);

      // Verify no locked slots overlap with active 4x4
      for (const slot of locked) {
        expect(slot.row >= 4 || slot.col >= 4).toBe(true);
      }
    });

    it('should return 28 locked slots for 6x6 grid (total 64 - 36 = 28)', () => {
      const locked = getLockedPlotSlots(6, 8);
      expect(locked.length).toBe(28);

      // All remaining slots should require Expansion 2 (8x8)
      for (const slot of locked) {
        expect(slot.requiredGridSize).toBe(8);
        expect(slot.row >= 6 || slot.col >= 6).toBe(true);
      }
    });

    it('should return 0 locked slots for 8x8 grid (max reached)', () => {
      const locked = getLockedPlotSlots(8, 8);
      expect(locked.length).toBe(0);
    });
  });

  describe('worldToGridCoords', () => {
    it('should identify plot coordinates when pointer is directly on plot', () => {
      const p23 = getPlotPosition(2, 3, 8);
      const coords = worldToGridCoords(p23[0], p23[2], 8);
      expect(coords).toEqual({ row: 2, col: 3 });
    });

    it('should identify plot within PLOT_SIZE half-extent tolerance', () => {
      const p11 = getPlotPosition(1, 1, 8);
      // Half size is 1.4 / 2 = 0.7. Test at 0.5 offset (inside plot)
      const inside = worldToGridCoords(p11[0] + 0.5, p11[2] - 0.5, 8);
      expect(inside).toEqual({ row: 1, col: 1 });
    });

    it('should return null when point is in spacing gap outside plot', () => {
      const p11 = getPlotPosition(1, 1, 8);
      // Spacing gap is between 0.7 and 0.85
      const inGap = worldToGridCoords(p11[0] + 0.75, p11[2], 8);
      expect(inGap).toBeNull();
    });

    it('should return null when outside grid bounds', () => {
      expect(worldToGridCoords(20, 20, 8)).toBeNull();
      expect(worldToGridCoords(-30, 0, 8)).toBeNull();
    });
  });

  describe('getPlotDistance', () => {
    it('should calculate XZ Euclidean distance correctly', () => {
      const p1 = getPlotPosition(0, 0, 8);
      const p2 = getPlotPosition(0, 1, 8);
      const dist = getPlotDistance(p1, p2);
      expect(dist).toBeCloseTo(PLOT_TOTAL_SIZE, 4);
    });

    it('should work with vector object format', () => {
      const dist = getPlotDistance({ x: 0, z: 0 }, { x: 3, z: 4 });
      expect(dist).toBeCloseTo(5.0, 5);
    });
  });
});
