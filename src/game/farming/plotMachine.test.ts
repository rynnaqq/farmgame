import { describe, it, expect } from 'vitest';
import {
  evaluateCropStage,
  isPlotHydrated,
  isPlotHarvestable,
  evaluatePlotState,
  getValidToolActions,
  describeNextAction,
} from './plotMachine';
import type { CropId, PlotData, ToolType } from '../../state/storeTypes';

describe('Task 10: Farming State Machine & Evaluator', () => {
  const baseTime = 1700000000000;

  const createMockPlot = (overrides?: Partial<PlotData>): PlotData => ({
    id: 'crop-1',
    x: 0,
    z: 0,
    crop: {
      cropId: 'carrot',
      plantedAtUtcMs: baseTime,
      growthProgressSec: 10,
      mutation: 'none',
    },
    hydratedUntilUtcMs: 0,
    ...overrides,
  });
  const NULL_CROP = null as unknown as import('../../state/storeTypes').CropData;

  describe('evaluateCropStage() - Crop Stage Boundary Evaluator', () => {
    it('returns "sprout" for 0% to 32.99% growth progress', () => {
      expect(evaluateCropStage(0, 100)).toBe('sprout');
      expect(evaluateCropStage(10, 100)).toBe('sprout');
      expect(evaluateCropStage(32.99, 100)).toBe('sprout');
      expect(evaluateCropStage(-5, 100)).toBe('sprout'); // Clamped/negative
    });

    it('returns "mid" for 33% to 74.99% growth progress', () => {
      expect(evaluateCropStage(33, 100)).toBe('mid');
      expect(evaluateCropStage(50, 100)).toBe('mid');
      expect(evaluateCropStage(74.99, 100)).toBe('mid');
    });

    it('returns "grown" for 75% to 100%+ growth progress', () => {
      expect(evaluateCropStage(75, 100)).toBe('grown');
      expect(evaluateCropStage(99.9, 100)).toBe('grown');
      expect(evaluateCropStage(100, 100)).toBe('grown');
      expect(evaluateCropStage(150, 100)).toBe('grown');
    });

    it('handles zero or negative required duration gracefully', () => {
      expect(evaluateCropStage(10, 0)).toBe('grown');
      expect(evaluateCropStage(10, -10)).toBe('grown');
    });

    it('evaluates exact boundaries for actual crops (e.g. Carrot: 45s)', () => {
      // Carrot: 45s base growth
      // Sprout max: 45 * 0.3299 = 14.8455s
      // Mid min: 45 * 0.33 = 14.85s
      // Mid max: 45 * 0.7499 = 33.7455s
      // Grown min: 45 * 0.75 = 33.75s
      expect(evaluateCropStage(0, 45)).toBe('sprout');
      expect(evaluateCropStage(14.84, 45)).toBe('sprout');
      expect(evaluateCropStage(14.85, 45)).toBe('mid');
      expect(evaluateCropStage(33.74, 45)).toBe('mid');
      expect(evaluateCropStage(33.75, 45)).toBe('grown');
      expect(evaluateCropStage(45, 45)).toBe('grown');
    });
  });

  describe('isPlotHydrated()', () => {
    it('returns true when hydration expiry is in the future', () => {
      const plot = createMockPlot({
        hydratedUntilUtcMs: baseTime + 60000,
      });
      expect(isPlotHydrated(plot, baseTime)).toBe(true);
    });

    it('returns false when hydration expiry is in the past', () => {
      const plot = createMockPlot({
        hydratedUntilUtcMs: baseTime - 1000,
      });
      expect(isPlotHydrated(plot, baseTime)).toBe(false);
    });

    it('returns false when hydration expiry equals current time', () => {
      const plot = createMockPlot({
        hydratedUntilUtcMs: baseTime,
      });
      expect(isPlotHydrated(plot, baseTime)).toBe(false);
    });

    it('returns true for empty soil with hydration expiry in the future (no till step)', () => {
      const plot = createMockPlot({
        crop: NULL_CROP,
        hydratedUntilUtcMs: baseTime + 60000,
      });
      expect(isPlotHydrated(plot, baseTime)).toBe(true);
    });
  });

  describe('isPlotHarvestable()', () => {
    it('returns false when plot has no crop', () => {
      const plot = createMockPlot({ crop: NULL_CROP });
      expect(isPlotHarvestable(plot)).toBe(false);
    });

    it('returns false when crop growth progress is below required duration', () => {
      const plot = createMockPlot({
        crop: {
          cropId: 'carrot',
          plantedAtUtcMs: baseTime,
          growthProgressSec: 44.9,
          mutation: 'none',
        },
      });
      expect(isPlotHarvestable(plot)).toBe(false);
    });

    it('returns true when crop growth progress equals or exceeds required duration', () => {
      const plot = createMockPlot({
        crop: {
          cropId: 'carrot',
          plantedAtUtcMs: baseTime,
          growthProgressSec: 45.0,
          mutation: 'none',
        },
      });
      expect(isPlotHarvestable(plot)).toBe(true);

      const matureOvergrowth = createMockPlot({
        crop: {
          cropId: 'starfruit', // 480s required
          plantedAtUtcMs: baseTime,
          growthProgressSec: 500.0,
          mutation: 'cosmic',
        },
      });
      expect(isPlotHarvestable(matureOvergrowth)).toBe(true);
    });

    it('returns false for unknown cropId', () => {
      const plot = createMockPlot({
        crop: {
          cropId: 'invalid_crop' as unknown as CropId,
          plantedAtUtcMs: baseTime,
          growthProgressSec: 1000,
          mutation: 'none',
        },
      });
      expect(isPlotHarvestable(plot)).toBe(false);
    });
  });

  describe('evaluatePlotState() - 3 Distinct Plot States', () => {
    it('evaluates "planted" state when crop is growing on dry soil', () => {
      const plot = createMockPlot({
        crop: {
          cropId: 'tomato',
          plantedAtUtcMs: baseTime,
          growthProgressSec: 30, // 30s / 90s
          mutation: 'none',
        },
        hydratedUntilUtcMs: baseTime - 1000,
      });
      expect(evaluatePlotState(plot, baseTime)).toBe('planted');
    });

    it('evaluates "watered" state when crop is growing on hydrated soil', () => {
      const plot = createMockPlot({
        crop: {
          cropId: 'tomato',
          plantedAtUtcMs: baseTime,
          growthProgressSec: 30,
          mutation: 'none',
        },
        hydratedUntilUtcMs: baseTime + 60000,
      });
      expect(evaluatePlotState(plot, baseTime)).toBe('watered');
    });

    it('evaluates "harvestable" state when crop reaches 100% progress regardless of hydration', () => {
      const dryHarvestable = createMockPlot({
        crop: {
          cropId: 'pumpkin',
          plantedAtUtcMs: baseTime,
          growthProgressSec: 180,
          mutation: 'giant',
        },
        hydratedUntilUtcMs: 0,
      });
      expect(evaluatePlotState(dryHarvestable, baseTime)).toBe('harvestable');

      const wetHarvestable = createMockPlot({
        crop: {
          cropId: 'pumpkin',
          plantedAtUtcMs: baseTime,
          growthProgressSec: 180,
          mutation: 'giant',
        },
        hydratedUntilUtcMs: baseTime + 60000,
      });
      expect(evaluatePlotState(wetHarvestable, baseTime)).toBe('harvestable');
    });
  });

  describe('getValidToolActions()', () => {
    it('returns watering_can for a dry growing plot', () => {
      const plot = createMockPlot();
      const actions = getValidToolActions(plot, baseTime);
      expect(actions.validTools).toContain('watering_can');
      expect(actions.primaryAction.toLowerCase()).toContain('water');
    });

    it('returns watering_can for growing crop', () => {
      const plot = createMockPlot({
        crop: {
          cropId: 'golden_berry',
          plantedAtUtcMs: baseTime,
          growthProgressSec: 100,
          mutation: 'none',
        },
      });
      const actions = getValidToolActions(plot, baseTime);
      expect(actions.validTools).toContain('watering_can');
    });

    it('returns scythe and hand for harvestable plot', () => {
      const plot = createMockPlot({
        crop: {
          cropId: 'carrot',
          plantedAtUtcMs: baseTime,
          growthProgressSec: 45,
          mutation: 'none',
        },
      });
      const actions = getValidToolActions(plot, baseTime);
      expect(actions.validTools).toContain('scythe');
      expect(actions.validTools).toContain('hand');
      expect(actions.primaryAction.toLowerCase()).toContain('harvest');
    });
  });

  describe('describeNextAction()', () => {
    const emptyPlot = createMockPlot({ crop: NULL_CROP });
    const growingPlot = createMockPlot({
      crop: {
        cropId: 'tomato',
        plantedAtUtcMs: baseTime,
        growthProgressSec: 40,
        mutation: 'none',
      },
    });
    const harvestablePlot = createMockPlot({
      crop: {
        cropId: 'tomato',
        plantedAtUtcMs: baseTime,
        growthProgressSec: 90,
        mutation: 'none',
      },
    });

    it('provides accurate feedback for watering_can', () => {
      expect(describeNextAction(emptyPlot, baseTime, 'watering_can').toLowerCase()).toContain(
        'water'
      );
      expect(describeNextAction(growingPlot, baseTime, 'watering_can').toLowerCase()).toContain(
        'water'
      );
      expect(describeNextAction(harvestablePlot, baseTime, 'watering_can').toLowerCase()).toContain(
        'harvest'
      );
    });

    it('provides accurate feedback for seed_bag', () => {
      expect(describeNextAction(emptyPlot, baseTime, 'seed_bag').toLowerCase()).toContain('plant');
      expect(describeNextAction(growingPlot, baseTime, 'seed_bag').toLowerCase()).toContain(
        'already'
      );
    });

    it('provides accurate feedback for scythe and hand', () => {
      const tools: ToolType[] = ['scythe', 'hand'];
      tools.forEach((tool) => {
        expect(describeNextAction(emptyPlot, baseTime, tool).toLowerCase()).toContain('no crop');
        expect(describeNextAction(growingPlot, baseTime, tool).toLowerCase()).toContain('growing');
        expect(describeNextAction(harvestablePlot, baseTime, tool).toLowerCase()).toContain(
          'harvest'
        );
      });
    });
  });
});
