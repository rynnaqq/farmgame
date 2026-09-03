import { describe, it, expect } from 'vitest';
import {
  calculateAngleToTarget,
  isTargetInCone,
  isCropValidForTool,
  findNearestTargetCrop,
  isMerchantInRange,
} from './targetPlotFinder';
import {
  MOBILE_ACTION_REACH,
  MOBILE_ACTION_CONE_DEG,
  MERCHANT_POSITION,
} from '../../game/core/constants';
import { createPlacedPlot, createMaturePlot, DEFAULT_TEST_PLACEMENT } from '../../test/farmFixtures';
import type { PlotData } from '../../state/storeTypes';

describe('targetPlotFinder Unit Tests', () => {
  describe('1. Cone Angle and Proximity Math', () => {
    it('calculates 0 degree angle when target is directly ahead along player yaw', () => {
      const angle = calculateAngleToTarget(0, 0, 0, 0, 2);
      expect(angle).toBeCloseTo(0, 4);
    });

    it('calculates 90 degree angle when target is perpendicular to player facing direction', () => {
      const angle = calculateAngleToTarget(0, 0, 0, 2, 0);
      expect(angle).toBeCloseTo(90, 4);
    });

    it('calculates 180 degree angle when target is directly behind player', () => {
      const angle = calculateAngleToTarget(0, 0, 0, 0, -2);
      expect(angle).toBeCloseTo(180, 4);
    });

    it('accounts for player yaw rotation correctly', () => {
      const angle = calculateAngleToTarget(0, 0, Math.PI / 2, 2, 0);
      expect(angle).toBeCloseTo(0, 4);
    });

    it('isTargetInCone returns true when within reach (<= 2.8) and cone (<= 35 deg half-angle)', () => {
      const inCone = isTargetInCone(0, 0, 0, 0, 2.0, MOBILE_ACTION_REACH, MOBILE_ACTION_CONE_DEG);
      expect(inCone).toBe(true);
    });

    it('isTargetInCone returns false when distance exceeds reach (> 2.8)', () => {
      const inCone = isTargetInCone(0, 0, 0, 0, 3.0, MOBILE_ACTION_REACH, MOBILE_ACTION_CONE_DEG);
      expect(inCone).toBe(false);
    });

    it('isTargetInCone returns false when target is outside 70 deg cone (> 35 deg half-angle)', () => {
      const inCone = isTargetInCone(0, 0, 0, 2.0, 1.0, MOBILE_ACTION_REACH, MOBILE_ACTION_CONE_DEG);
      expect(inCone).toBe(false);
    });
  });

  describe('2. Crop Actionability Validation (isCropValidForTool)', () => {
    const now = Date.now();
    const emptyPlot: PlotData = {
      id: 'plot-0-0',
      row: 0,
      col: 0,
      crop: null,
      hydratedUntilUtcMs: 0,
    };

    const hydratedGrowingPlot = createPlacedPlot('plot-0-1', DEFAULT_TEST_PLACEMENT);
    hydratedGrowingPlot.hydratedUntilUtcMs = now + 60000;

    const dryGrowingPlot = createPlacedPlot('plot-0-2', DEFAULT_TEST_PLACEMENT);
    dryGrowingPlot.hydratedUntilUtcMs = 0;

    const maturePlot = createMaturePlot('plot-1-1', DEFAULT_TEST_PLACEMENT);

    it('never targets empty slots regardless of tool', () => {
      expect(isCropValidForTool(emptyPlot, 'watering_can', now)).toBe(false);
      expect(isCropValidForTool(emptyPlot, 'hand', now)).toBe(false);
      expect(isCropValidForTool(emptyPlot, 'seed_bag', now)).toBe(false);
    });

    it('watering_can is valid for a crop with expired hydration, invalid for hydrated crop', () => {
      expect(isCropValidForTool(dryGrowingPlot, 'watering_can', now)).toBe(true);
      expect(isCropValidForTool(hydratedGrowingPlot, 'watering_can', now)).toBe(false);
    });

    it('hand/scythe is valid for mature crop only', () => {
      expect(isCropValidForTool(maturePlot, 'hand', now)).toBe(true);
      expect(isCropValidForTool(maturePlot, 'scythe', now)).toBe(true);
      expect(isCropValidForTool(dryGrowingPlot, 'hand', now)).toBe(false);
    });

    it('seed_bag has no crop target (planting happens via soil tap)', () => {
      expect(isCropValidForTool(maturePlot, 'seed_bag', now)).toBe(false);
    });
  });

  describe('3. findNearestTargetCrop Selection', () => {
    it('targets the nearest crop by placement even when row/col suggest the opposite', () => {
      const near = createPlacedPlot('plot-7-7', {
        bedId: 'south-east',
        localX: 0,
        localZ: 0,
      });
      const far = createPlacedPlot('plot-0-0', {
        bedId: 'north-west',
        localX: 0,
        localZ: 0,
      });
      const result = findNearestTargetCrop(
        [3.8, 0, 1],
        0,
        [far, near],
        'watering_can',
        { maxDistance: 3, maxConeDeg: 180, nowUtcMs: 1000 }
      );
      expect(result?.plot.id).toBe('plot-7-7');
      expect(result?.worldPosition).toEqual([3.8, 0, 3.5]);
    });

    it('returns null when no crops exist', () => {
      const emptyPlot: PlotData = {
        id: 'plot-0-0',
        row: 0,
        col: 0,
        crop: null,
        hydratedUntilUtcMs: 0,
      };
      const result = findNearestTargetCrop([0, 0, 0], 0, [emptyPlot], 'watering_can', {
        filterByTool: true,
      });
      expect(result).toBeNull();
    });

    it('returns null when all crops are outside reach distance', () => {
      const farCrop = createPlacedPlot('plot-0-0', {
        bedId: 'north-west',
        localX: 0,
        localZ: 0,
      });
      const result = findNearestTargetCrop([10, 0, 10], 0, [farCrop], 'watering_can', {
        maxDistance: 2.8,
      });
      expect(result).toBeNull();
    });

    it('returns null when all crops are behind the player facing direction', () => {
      // Crop at south-east bed (world ~3.8, 3.5); player nearby facing away (-Z).
      const crop = createPlacedPlot('plot-3-3', {
        bedId: 'south-east',
        localX: 0,
        localZ: 0,
      });
      const result = findNearestTargetCrop([3.8, 0, 1.5], Math.PI, [crop], 'watering_can', {
        maxConeDeg: 70,
      });
      expect(result).toBeNull();
    });

    it('filters by tool when filterByTool is specified', () => {
      // Mature crop farther away; growing crop closer.
      const matureFar = createMaturePlot('plot-0-1', {
        bedId: 'south-east',
        localX: 2,
        localZ: 0,
      });
      const growingNear = createPlacedPlot('plot-0-0', {
        bedId: 'south-east',
        localX: 0,
        localZ: 0,
      });

      const matureTarget = findNearestTargetCrop(
        [3.8, 0, 3.5],
        0,
        [growingNear, matureFar],
        'hand',
        { filterByTool: true, nowUtcMs: 1000, maxConeDeg: 180 }
      );
      expect(matureTarget?.plot.id).toBe('plot-0-1');
    });

    it('accepts both array and record plot inputs', () => {
      const crop = createPlacedPlot('plot-1-0', {
        bedId: 'south-east',
        localX: 0,
        localZ: 0,
      });
      const record = { 'plot-1-0': crop };
      const fromRecord = findNearestTargetCrop([3.8, 0, 3.5], 0, record, 'watering_can', {
        maxConeDeg: 180,
      });
      expect(fromRecord?.plot.id).toBe('plot-1-0');
    });
  });

  describe('4. Merchant Proximity (isMerchantInRange)', () => {
    it('returns true when player is within 3.0 units of merchant stall (PRD §7.11)', () => {
      expect(isMerchantInRange([MERCHANT_POSITION[0], 0.5, MERCHANT_POSITION[2]])).toBe(true);
      expect(isMerchantInRange([MERCHANT_POSITION[0] + 1.5, 0.5, MERCHANT_POSITION[2]])).toBe(true);
      expect(isMerchantInRange([MERCHANT_POSITION[0], 0.5, MERCHANT_POSITION[2] + 2.4])).toBe(
        true
      );
    });

    it('returns false when player is beyond 3.0 units of merchant stall', () => {
      expect(isMerchantInRange([0, 0.5, 0])).toBe(false);
      expect(isMerchantInRange([MERCHANT_POSITION[0] + 3.5, 0.5, MERCHANT_POSITION[2]])).toBe(
        false
      );
    });
  });
});
