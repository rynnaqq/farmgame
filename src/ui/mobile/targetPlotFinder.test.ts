import { describe, it, expect } from 'vitest';
import {
  calculateAngleToTarget,
  isTargetInCone,
  isPlotValidForTool,
  findNearestTargetPlot,
  isMerchantInRange,
} from './targetPlotFinder';
import {
  MOBILE_ACTION_REACH,
  MOBILE_ACTION_CONE_DEG,
  MERCHANT_POSITION,
} from '../../game/core/constants';
import type { PlotData } from '../../state/storeTypes';

describe('targetPlotFinder Unit Tests', () => {
  describe('1. Cone Angle and Proximity Math', () => {
    it('calculates 0 degree angle when target is directly ahead along player yaw', () => {
      // Player at (0, 0) facing +Z (yaw = 0). Target at (0, 2).
      const angle = calculateAngleToTarget(0, 0, 0, 0, 2);
      expect(angle).toBeCloseTo(0, 4);
    });

    it('calculates 90 degree angle when target is perpendicular to player facing direction', () => {
      // Player at (0, 0) facing +Z (yaw = 0). Target at (2, 0) (+X is 90 deg).
      const angle = calculateAngleToTarget(0, 0, 0, 2, 0);
      expect(angle).toBeCloseTo(90, 4);
    });

    it('calculates 180 degree angle when target is directly behind player', () => {
      // Player at (0, 0) facing +Z (yaw = 0). Target at (0, -2).
      const angle = calculateAngleToTarget(0, 0, 0, 0, -2);
      expect(angle).toBeCloseTo(180, 4);
    });

    it('accounts for player yaw rotation correctly', () => {
      // Player at (0, 0) facing +X (yaw = Math.PI / 2). Target at (2, 0).
      const angle = calculateAngleToTarget(0, 0, Math.PI / 2, 2, 0);
      expect(angle).toBeCloseTo(0, 4);
    });

    it('isTargetInCone returns true when within reach (<= 2.8) and cone (<= 35 deg half-angle)', () => {
      // Distance = 2.0 <= 2.8, angle = 0 <= 35
      const inCone = isTargetInCone(0, 0, 0, 0, 2.0, MOBILE_ACTION_REACH, MOBILE_ACTION_CONE_DEG);
      expect(inCone).toBe(true);
    });

    it('isTargetInCone returns false when distance exceeds reach (> 2.8)', () => {
      // Distance = 3.0 > 2.8, angle = 0
      const inCone = isTargetInCone(0, 0, 0, 0, 3.0, MOBILE_ACTION_REACH, MOBILE_ACTION_CONE_DEG);
      expect(inCone).toBe(false);
    });

    it('isTargetInCone returns false when target is outside 70 deg cone (> 35 deg half-angle)', () => {
      // Player facing +Z (0). Target at (2.0, 1.0) -> angle = atan2(2, 1) = 63.4 deg > 35 deg
      const inCone = isTargetInCone(0, 0, 0, 2.0, 1.0, MOBILE_ACTION_REACH, MOBILE_ACTION_CONE_DEG);
      expect(inCone).toBe(false);
    });
  });

  describe('2. Tool Actionability Validation (isPlotValidForTool)', () => {
    const untilledPlot: PlotData = {
      id: 'plot-0-0',
      row: 0,
      col: 0,
      tilled: false,
      crop: null,
      hydratedUntilUtcMs: 0,
    };

    const tilledPlot: PlotData = {
      id: 'plot-0-1',
      row: 0,
      col: 1,
      tilled: true,
      crop: null,
      hydratedUntilUtcMs: 0,
    };

    const hydratedTilledPlot: PlotData = {
      id: 'plot-0-2',
      row: 0,
      col: 2,
      tilled: true,
      crop: null,
      hydratedUntilUtcMs: Date.now() + 60000,
    };

    const growingPlot: PlotData = {
      id: 'plot-1-0',
      row: 1,
      col: 0,
      tilled: true,
      crop: {
        cropId: 'carrot',
        plantedAtUtcMs: Date.now(),
        growthProgressSec: 0.5,
        mutation: 'none',
      },
      hydratedUntilUtcMs: Date.now() + 60000,
    };

    const maturePlot: PlotData = {
      id: 'plot-1-1',
      row: 1,
      col: 1,
      tilled: true,
      crop: {
        cropId: 'carrot',
        plantedAtUtcMs: Date.now() - 60000,
        growthProgressSec: 1.0,
        mutation: 'none',
      },
      hydratedUntilUtcMs: 0,
    };

    it('trowel is valid for untilled plot, invalid for already tilled plot', () => {
      expect(isPlotValidForTool(untilledPlot, 'trowel')).toBe(true);
      expect(isPlotValidForTool(tilledPlot, 'trowel')).toBe(false);
      expect(isPlotValidForTool(maturePlot, 'trowel')).toBe(false);
    });

    it('watering_can is valid for tilled unhydrated plot, invalid for untilled or already hydrated plot', () => {
      expect(isPlotValidForTool(tilledPlot, 'watering_can')).toBe(true);
      expect(isPlotValidForTool(untilledPlot, 'watering_can')).toBe(false);
      expect(isPlotValidForTool(hydratedTilledPlot, 'watering_can')).toBe(false);
    });

    it('seed_bag is valid for tilled empty plot, invalid for untilled or already planted plot', () => {
      expect(isPlotValidForTool(tilledPlot, 'seed_bag')).toBe(true);
      expect(isPlotValidForTool(untilledPlot, 'seed_bag')).toBe(false);
      expect(isPlotValidForTool(growingPlot, 'seed_bag')).toBe(false);
    });

    it('scythe is valid for mature crop plot, invalid for empty or immature plot', () => {
      expect(isPlotValidForTool(maturePlot, 'scythe')).toBe(true);
      expect(isPlotValidForTool(growingPlot, 'scythe')).toBe(false);
      expect(isPlotValidForTool(tilledPlot, 'scythe')).toBe(false);
    });
  });

  describe('3. findNearestTargetPlot Selection', () => {
    // Generate 4x4 plots
    const plots: Record<string, PlotData> = {};
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const id = `plot-${r}-${c}`;
        plots[id] = {
          id,
          row: r,
          col: c,
          tilled: false,
          crop: null,
          hydratedUntilUtcMs: 0,
        };
      }
    }

    it('finds nearest plot directly in front of player', () => {
      // In 4x4 grid inside 8x8 world space:
      // col 3, row 3 is at (-0.775, 0.05, -0.775)
      // Place player at (-0.775, 0.5, -2.0) facing +Z (yaw = 0)
      const target = findNearestTargetPlot(
        [-0.775, 0.5, -2.0],
        0, // facing +Z
        plots,
        4
      );

      expect(target).not.toBeNull();
      expect(target?.plot.row).toBe(3);
      expect(target?.plot.col).toBe(3);
      expect(target?.distance).toBeLessThanOrEqual(MOBILE_ACTION_REACH);
    });

    it('returns null when all plots are outside reach distance', () => {
      // Player placed far away at (10, 0.5, 10)
      const target = findNearestTargetPlot([10, 0.5, 10], 0, plots, 4);
      expect(target).toBeNull();
    });

    it('returns null when all plots are behind player facing direction', () => {
      // Player at (-0.775, 0.5, 2.0) facing +Z (away from plots at negative Z)
      const target = findNearestTargetPlot([-0.775, 0.5, 2.0], 0, plots, 4);
      expect(target).toBeNull();
    });

    it('filters strictly by tool when filterByTool is specified', () => {
      // Make plot-1-3 tilled and plot-2-3 untilled
      plots['plot-1-3'].tilled = true;
      plots['plot-2-3'].tilled = false;

      // With trowel tool, should skip tilled plot-1-3 if filterByTool is true
      const target = findNearestTargetPlot([-0.775, 0.5, -4.0], 0, plots, 4, 'trowel', {
        filterByTool: true,
      });

      expect(target).not.toBeNull();
      expect(target?.plot.row).toBe(2);
      expect(target?.plot.col).toBe(3);
      expect(target?.plot.tilled).toBe(false);
    });
  });

  describe('4. Merchant Proximity (isMerchantInRange)', () => {
    it('returns true when player is within 3.0 units of merchant stall (PRD §7.11)', () => {
      expect(isMerchantInRange([MERCHANT_POSITION[0], 0.5, MERCHANT_POSITION[2]])).toBe(true);
      expect(isMerchantInRange([MERCHANT_POSITION[0] + 1.5, 0.5, MERCHANT_POSITION[2]])).toBe(true);
      expect(isMerchantInRange([MERCHANT_POSITION[0], 0.5, MERCHANT_POSITION[2] + 2.4])).toBe(true);
    });

    it('returns false when player is beyond 3.0 units of merchant stall', () => {
      expect(isMerchantInRange([0, 0.5, 0])).toBe(false);
      expect(isMerchantInRange([MERCHANT_POSITION[0] + 3.5, 0.5, MERCHANT_POSITION[2]])).toBe(false);
    });
  });
});
