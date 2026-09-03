import { describe, it, expect } from 'vitest';
import {
  evaluateCropStage,
  isPlotHydrated,
  isPlotHarvestable,
  getPlotState,
  getValidToolActions,
  describeNextAction,
} from './plotMachine';
import { createTestCrop, DEFAULT_TEST_PLACEMENT } from '../../test/farmFixtures';
import type { PlotData, ToolType } from '../../state/storeTypes';

describe('Farming State Machine & Evaluator', () => {
  const baseTime = 1700000000000;

  const createMockPlot = (overrides?: Partial<PlotData>): PlotData => ({
    id: 'plot-0-0',
    row: 0,
    col: 0,
    crop: null,
    hydratedUntilUtcMs: 0,
    ...overrides,
  });

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
      expect(evaluateCropStage(0, 45)).toBe('sprout');
      expect(evaluateCropStage(14.84, 45)).toBe('sprout');
      expect(evaluateCropStage(14.85, 45)).toBe('mid');
      expect(evaluateCropStage(33.74, 45)).toBe('mid');
      expect(evaluateCropStage(33.75, 45)).toBe('grown');
      expect(evaluateCropStage(45, 45)).toBe('grown');
    });
  });

  describe('isPlotHydrated()', () => {
    it('returns true when a planted crop has hydration expiry in the future', () => {
      const plot = createMockPlot({
        crop: createTestCrop(),
        hydratedUntilUtcMs: baseTime + 60000,
      });
      expect(isPlotHydrated(plot, baseTime)).toBe(true);
    });

    it('returns false when hydration expiry is in the past', () => {
      const plot = createMockPlot({
        crop: createTestCrop(),
        hydratedUntilUtcMs: baseTime - 1000,
      });
      expect(isPlotHydrated(plot, baseTime)).toBe(false);
    });

    it('returns false when hydration expiry equals current time', () => {
      const plot = createMockPlot({
        crop: createTestCrop(),
        hydratedUntilUtcMs: baseTime,
      });
      expect(isPlotHydrated(plot, baseTime)).toBe(false);
    });

    it('returns false for an empty slot even if hydratedUntilUtcMs is in the future', () => {
      const plot = createMockPlot({
        crop: null,
        hydratedUntilUtcMs: baseTime + 60000,
      });
      expect(isPlotHydrated(plot, baseTime)).toBe(false);
    });
  });

  describe('isPlotHarvestable()', () => {
    it('returns false when plot has no crop', () => {
      const plot = createMockPlot({ crop: null });
      expect(isPlotHarvestable(plot)).toBe(false);
    });

    it('returns false when crop growth progress is below required duration', () => {
      const plot = createMockPlot({
        crop: createTestCrop({ growthProgressSec: 44.9 }),
      });
      expect(isPlotHarvestable(plot)).toBe(false);
    });

    it('returns true when crop growth progress equals or exceeds required duration', () => {
      const plot = createMockPlot({
        crop: createTestCrop({ growthProgressSec: 45.0 }),
      });
      expect(isPlotHarvestable(plot)).toBe(true);

      const matureOvergrowth = createMockPlot({
        crop: createTestCrop({
          cropId: 'starfruit', // 480s required
          growthProgressSec: 500.0,
          mutation: 'cosmic',
        }),
      });
      expect(isPlotHarvestable(matureOvergrowth)).toBe(true);
    });

    it('returns false for unknown cropId', () => {
      const plot = createMockPlot({
        crop: createTestCrop({
          cropId: 'invalid_crop' as never,
          growthProgressSec: 1000,
        }),
      });
      expect(isPlotHarvestable(plot)).toBe(false);
    });
  });

  describe('getPlotState() - 4 Distinct Plot States', () => {
    it('evaluates "empty" state when the slot has no crop', () => {
      const plot = createMockPlot({ crop: null });
      expect(getPlotState(plot, baseTime)).toBe('empty');
    });

    it('evaluates "planted" state when crop is growing on dry soil', () => {
      const plot = createMockPlot({
        crop: createTestCrop({
          cropId: 'tomato',
          growthProgressSec: 30, // 30s / 90s
        }),
        hydratedUntilUtcMs: baseTime - 1000,
      });
      expect(getPlotState(plot, baseTime)).toBe('planted');
    });

    it('evaluates "watered" state when crop is growing on hydrated soil', () => {
      const plot = createMockPlot({
        crop: createTestCrop({ cropId: 'tomato', growthProgressSec: 30 }),
        hydratedUntilUtcMs: baseTime + 60000,
      });
      expect(getPlotState(plot, baseTime)).toBe('watered');
    });

    it('evaluates "empty" (never watered) for an empty slot with stale hydration', () => {
      const plot = createMockPlot({
        crop: null,
        hydratedUntilUtcMs: baseTime + 60000,
      });
      expect(getPlotState(plot, baseTime)).toBe('empty');
    });

    it('evaluates "harvestable" state when crop reaches 100% progress regardless of hydration', () => {
      const dryHarvestable = createMockPlot({
        crop: createTestCrop({
          cropId: 'pumpkin',
          growthProgressSec: 180,
          mutation: 'giant',
        }),
        hydratedUntilUtcMs: 0,
      });
      expect(getPlotState(dryHarvestable, baseTime)).toBe('harvestable');

      const wetHarvestable = createMockPlot({
        crop: createTestCrop({
          cropId: 'pumpkin',
          growthProgressSec: 180,
          mutation: 'giant',
        }),
        hydratedUntilUtcMs: baseTime + 60000,
      });
      expect(getPlotState(wetHarvestable, baseTime)).toBe('harvestable');
    });

    it('default nowMs uses Date.now and behaves consistently', () => {
      const plot = createMockPlot({ crop: createTestCrop() });
      expect(['planted', 'watered', 'harvestable', 'empty']).toContain(getPlotState(plot));
    });
  });

  describe('getValidToolActions()', () => {
    it('returns seed_bag for an empty slot (direct planting, no till)', () => {
      const plot = createMockPlot({ crop: null });
      const actions = getValidToolActions(plot, baseTime);
      expect(actions.validTools).toEqual(['seed_bag']);
      expect(actions.primaryAction.toLowerCase()).toContain('plant');
    });

    it('returns watering_can for a growing crop', () => {
      const plot = createMockPlot({
        crop: createTestCrop({ cropId: 'golden_berry', growthProgressSec: 100 }),
      });
      const actions = getValidToolActions(plot, baseTime);
      expect(actions.validTools).toContain('watering_can');
    });

    it('returns scythe and hand for a harvestable crop', () => {
      const plot = createMockPlot({
        crop: createTestCrop({ growthProgressSec: 45 }),
      });
      const actions = getValidToolActions(plot, baseTime);
      expect(actions.validTools).toContain('scythe');
      expect(actions.validTools).toContain('hand');
      expect(actions.primaryAction.toLowerCase()).toContain('harvest');
    });
  });

  describe('describeNextAction()', () => {
    const emptyPlot = createMockPlot({ crop: null });
    const growingPlot = createMockPlot({
      crop: createTestCrop({ cropId: 'tomato', growthProgressSec: 40 }),
    });
    const harvestablePlot = createMockPlot({
      crop: createTestCrop({ cropId: 'tomato', growthProgressSec: 90 }),
    });

    it('provides accurate feedback for watering_can', () => {
      expect(
        describeNextAction(emptyPlot, baseTime, 'watering_can').toLowerCase()
      ).toContain('plant');
      expect(
        describeNextAction(growingPlot, baseTime, 'watering_can').toLowerCase()
      ).toContain('water');
      expect(
        describeNextAction(harvestablePlot, baseTime, 'watering_can').toLowerCase()
      ).toContain('harvest');
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

    it('covers every runtime tool without trowel', () => {
      const tools: ToolType[] = ['watering_can', 'seed_bag', 'scythe', 'hand'];
      for (const tool of tools) {
        expect(
          describeNextAction(emptyPlot, baseTime, tool).length,
        ).toBeGreaterThan(0);
      }
    });
  });

  describe('fixture sanity', () => {
    it('DEFAULT_TEST_PLACEMENT points inside north-west bed bounds', () => {
      expect(DEFAULT_TEST_PLACEMENT.bedId).toBe('north-west');
      expect(DEFAULT_TEST_PLACEMENT.localX).toBe(0);
      expect(DEFAULT_TEST_PLACEMENT.localZ).toBe(0);
    });
  });
});
