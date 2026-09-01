import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, resetGameStore } from '../../state/gameStore';
import {
  tillPlot,
  waterPlot,
  plantCrop,
  harvestCrop,
  executeToolAction,
} from './farmingCommands';
import {
  FARMING_REACH,
  HYDRATION_DURATION_BASIC_MS,
  HYDRATION_DURATION_HEATWAVE_MS,
  CROPS,
  MUTATION_MULTIPLIERS,
} from '../core/constants';
import { getPlotPosition } from '../world/gridCoordinates';
import type { PlotId, ToolType, CropId } from '../../state/storeTypes';

describe('Task 11: Farming Commands & Atomic Validation', () => {
  const baseNow = 1700000000000;

  beforeEach(() => {
    resetGameStore(12345);
  });

  describe('tillPlot()', () => {
    it('successfully tills an untilled empty plot within reach', () => {
      const plotId: PlotId = 'plot-0-0';
      const plotPos = getPlotPosition(0, 0, 4);
      const playerPos: [number, number, number] = [plotPos[0], plotPos[1], plotPos[2]];

      const res = tillPlot(plotId, playerPos);
      expect(res.ok).toBe(true);

      const plot = useGameStore.getState().farm.plots[plotId];
      expect(plot.tilled).toBe(true);
      expect(plot.crop).toBeNull();
    });

    it('successfully tills when playerPos is omitted (e.g. internal / debug call)', () => {
      const plotId: PlotId = 'plot-1-1';
      const res = tillPlot(plotId);
      expect(res.ok).toBe(true);

      const plot = useGameStore.getState().farm.plots[plotId];
      expect(plot.tilled).toBe(true);
    });

    it('fails with out_of_range when player is too far (> FARMING_REACH)', () => {
      const plotId: PlotId = 'plot-0-0';
      const plotPos = getPlotPosition(0, 0, 4);
      const playerPos: [number, number, number] = [
        plotPos[0] + FARMING_REACH + 1.0,
        plotPos[1],
        plotPos[2],
      ];

      const res = tillPlot(plotId, playerPos);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('out_of_range');
        expect(res.message).toMatch(/closer/i);
      }

      const plot = useGameStore.getState().farm.plots[plotId];
      expect(plot.tilled).toBe(false);
    });

    it('fails when plot is already tilled', () => {
      const plotId: PlotId = 'plot-0-0';
      tillPlot(plotId); // First till

      const res2 = tillPlot(plotId); // Second till
      expect(res2.ok).toBe(false);
      if (!res2.ok) {
        expect(res2.reason).toBe('invalid_plot_state');
        expect(res2.message).toMatch(/already tilled/i);
      }
    });

    it('fails when plot already contains a crop', () => {
      const plotId: PlotId = 'plot-0-0';
      tillPlot(plotId);
      plantCrop(plotId, 'carrot');

      const res = tillPlot(plotId);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('invalid_plot_state');
        expect(res.message).toMatch(/crop/i);
      }
    });

    it('fails with plot_locked for out-of-bounds or non-existent plots', () => {
      const lockedPlotId: PlotId = 'plot-5-5'; // Default grid size is 4
      const res = tillPlot(lockedPlotId);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('plot_locked');
      }

      const invalidId: PlotId = 'plot-nonexistent';
      const resInvalid = tillPlot(invalidId);
      expect(resInvalid.ok).toBe(false);
      if (!resInvalid.ok) {
        expect(resInvalid.reason).toBe('plot_locked');
      }
    });
  });

  describe('waterPlot()', () => {
    it('successfully waters a tilled plot with standard watering can (120s duration)', () => {
      const plotId: PlotId = 'plot-0-0';
      tillPlot(plotId);

      const res = waterPlot(plotId, undefined, false, 'sunny', baseNow);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.hydratedPlotIds).toEqual(['plot-0-0']);
      }

      const plot = useGameStore.getState().farm.plots[plotId];
      expect(plot.hydratedUntilUtcMs).toBe(baseNow + HYDRATION_DURATION_BASIC_MS);
    });

    it('uses 60s hydration during heatwave weather', () => {
      const plotId: PlotId = 'plot-0-0';
      tillPlot(plotId);

      const res = waterPlot(plotId, undefined, false, 'heatwave', baseNow);
      expect(res.ok).toBe(true);

      const plot = useGameStore.getState().farm.plots[plotId];
      expect(plot.hydratedUntilUtcMs).toBe(baseNow + HYDRATION_DURATION_HEATWAVE_MS);
    });

    it('resets hydration expiry without stacking time when rewatered', () => {
      const plotId: PlotId = 'plot-0-0';
      tillPlot(plotId);

      waterPlot(plotId, undefined, false, 'sunny', baseNow);
      const firstExpiry = useGameStore.getState().farm.plots[plotId].hydratedUntilUtcMs;
      expect(firstExpiry).toBe(baseNow + HYDRATION_DURATION_BASIC_MS);

      // Re-water 30 seconds later
      const laterNow = baseNow + 30000;
      waterPlot(plotId, undefined, false, 'sunny', laterNow);
      const secondExpiry = useGameStore.getState().farm.plots[plotId].hydratedUntilUtcMs;
      expect(secondExpiry).toBe(laterNow + HYDRATION_DURATION_BASIC_MS);
    });

    it('fails when target plot is untilled', () => {
      const plotId: PlotId = 'plot-0-0';
      const res = waterPlot(plotId, undefined, false, 'sunny', baseNow);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('invalid_plot_state');
        expect(res.message).toMatch(/till/i);
      }
    });

    it('fails when player is out of range', () => {
      const plotId: PlotId = 'plot-0-0';
      tillPlot(plotId);
      const plotPos = getPlotPosition(0, 0, 4);
      const playerPos: [number, number, number] = [plotPos[0] + 5.0, plotPos[1], plotPos[2]];

      const res = waterPlot(plotId, playerPos, false, 'sunny', baseNow);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('out_of_range');
      }
    });

    it('Golden Watering Can: hydrates 3x3 surrounding unlocked tilled plots', () => {
      // Till 3x3 grid around center plot (1,1) in 4x4 grid:
      // (0,0), (0,1), (0,2), (1,0), (1,1), (1,2), (2,0), (2,1), (2,2)
      for (let r = 0; r <= 2; r++) {
        for (let c = 0; c <= 2; c++) {
          tillPlot(`plot-${r}-${c}`);
        }
      }

      const res = waterPlot('plot-1-1', undefined, true, 'sunny', baseNow);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.hydratedPlotIds.length).toBe(9);
        expect(res.value.hydratedPlotIds).toContain('plot-0-0');
        expect(res.value.hydratedPlotIds).toContain('plot-1-1');
        expect(res.value.hydratedPlotIds).toContain('plot-2-2');
      }

      for (let r = 0; r <= 2; r++) {
        for (let c = 0; c <= 2; c++) {
          const plot = useGameStore.getState().farm.plots[`plot-${r}-${c}`];
          expect(plot.hydratedUntilUtcMs).toBe(baseNow + HYDRATION_DURATION_BASIC_MS);
        }
      }
    });

    it('Golden Watering Can: skips untilled plots in the 3x3 radius', () => {
      // Only till center (1,1) and top neighbor (0,1)
      tillPlot('plot-1-1');
      tillPlot('plot-0-1');

      const res = waterPlot('plot-1-1', undefined, true, 'sunny', baseNow);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.hydratedPlotIds).toEqual(
          expect.arrayContaining(['plot-1-1', 'plot-0-1'])
        );
        expect(res.value.hydratedPlotIds.length).toBe(2);
      }

      // Untilled neighbor remains 0
      const untilledPlot = useGameStore.getState().farm.plots['plot-0-0'];
      expect(untilledPlot.hydratedUntilUtcMs).toBe(0);
      expect(untilledPlot.tilled).toBe(false);
    });

    it('Golden Watering Can: respects grid bounds on corner plot (0,0)', () => {
      // Corner (0,0) in 4x4 grid: neighbors within 1 offset are (0,0), (0,1), (1,0), (1,1) -> 4 plots max
      tillPlot('plot-0-0');
      tillPlot('plot-0-1');
      tillPlot('plot-1-0');
      tillPlot('plot-1-1');

      const res = waterPlot('plot-0-0', undefined, true, 'sunny', baseNow);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.hydratedPlotIds.length).toBe(4);
        expect(res.value.hydratedPlotIds).toEqual(
          expect.arrayContaining(['plot-0-0', 'plot-0-1', 'plot-1-0', 'plot-1-1'])
        );
      }
    });

    it('Golden Watering Can: never hydrates locked plots outside current gridSize', () => {
      // In 4x4 grid, plot (3,3) is bottom right. Neighbor (4,3) would be row 4 which is locked.
      tillPlot('plot-3-3');
      tillPlot('plot-2-3');
      tillPlot('plot-3-2');
      tillPlot('plot-2-2');

      const res = waterPlot('plot-3-3', undefined, true, 'sunny', baseNow);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.hydratedPlotIds.length).toBe(4);
        expect(res.value.hydratedPlotIds).not.toContain('plot-4-3');
        expect(res.value.hydratedPlotIds).not.toContain('plot-3-4');
      }
    });

    it('automatically uses golden watering can when owned in store', () => {
      useGameStore.getState().setGoldenWateringCan(true);
      tillPlot('plot-1-1');
      tillPlot('plot-1-2');

      // isGoldenCan parameter omitted
      const res = waterPlot('plot-1-1', undefined, undefined, 'sunny', baseNow);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.hydratedPlotIds).toEqual(
          expect.arrayContaining(['plot-1-1', 'plot-1-2'])
        );
      }
    });
  });

  describe('plantCrop()', () => {
    it('successfully plants seed on tilled empty plot and deducts 1 seed', () => {
      const plotId: PlotId = 'plot-0-0';
      tillPlot(plotId);

      const initialCarrotSeeds = useGameStore.getState().inventory.seeds.carrot; // 5
      expect(initialCarrotSeeds).toBeGreaterThan(0);

      const res = plantCrop(plotId, 'carrot', undefined, baseNow);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.cropId).toBe('carrot');
      }

      // Check plot state
      const plot = useGameStore.getState().farm.plots[plotId];
      expect(plot.crop).not.toBeNull();
      expect(plot.crop?.cropId).toBe('carrot');
      expect(plot.crop?.plantedAtUtcMs).toBe(baseNow);
      expect(plot.crop?.growthProgressSec).toBe(0);
      expect(plot.crop?.mutation).toBe('none');

      // Check seed deducted
      expect(useGameStore.getState().inventory.seeds.carrot).toBe(initialCarrotSeeds - 1);
    });

    it('fails when plot is untilled', () => {
      const plotId: PlotId = 'plot-0-0';
      const res = plantCrop(plotId, 'carrot', undefined, baseNow);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('invalid_plot_state');
        expect(res.message).toMatch(/till/i);
      }
    });

    it('fails when plot is already planted', () => {
      const plotId: PlotId = 'plot-0-0';
      tillPlot(plotId);
      plantCrop(plotId, 'carrot', undefined, baseNow);

      const initialSeeds = useGameStore.getState().inventory.seeds.carrot;
      const res2 = plantCrop(plotId, 'carrot', undefined, baseNow);
      expect(res2.ok).toBe(false);
      if (!res2.ok) {
        expect(res2.reason).toBe('invalid_plot_state');
        expect(res2.message).toMatch(/already/i);
      }
      // Seed was not deducted for failed action
      expect(useGameStore.getState().inventory.seeds.carrot).toBe(initialSeeds);
    });

    it('fails when player has insufficient seeds', () => {
      const plotId: PlotId = 'plot-0-0';
      tillPlot(plotId);

      // Tomato starts with 0 seeds
      expect(useGameStore.getState().inventory.seeds.tomato).toBe(0);

      const res = plantCrop(plotId, 'tomato', undefined, baseNow);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('insufficient_seeds');
      }

      const plot = useGameStore.getState().farm.plots[plotId];
      expect(plot.crop).toBeNull();
    });

    it('fails when player is out of reach (> 3.0 units)', () => {
      const plotId: PlotId = 'plot-0-0';
      tillPlot(plotId);
      const plotPos = getPlotPosition(0, 0, 4);
      const playerPos: [number, number, number] = [plotPos[0] + 4.0, plotPos[1], plotPos[2]];

      const res = plantCrop(plotId, 'carrot', playerPos, baseNow);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('out_of_range');
      }
    });
  });

  describe('harvestCrop()', () => {
    it('successfully harvests mature crop, adds produce stack, and empties plot crop', () => {
      const plotId: PlotId = 'plot-0-0';
      tillPlot(plotId);
      plantCrop(plotId, 'carrot', undefined, baseNow);

      // Mature the carrot (45s base growth)
      const currentPlot = useGameStore.getState().farm.plots[plotId];
      useGameStore.getState().setPlot({
        ...currentPlot,
        crop: {
          ...currentPlot.crop!,
          growthProgressSec: CROPS.carrot.baseGrowthSec,
          mutation: 'none',
        },
      });

      const res = harvestCrop(plotId);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.cropId).toBe('carrot');
        expect(res.value.mutation).toBe('none');
        expect(res.value.saleValue).toBe(CROPS.carrot.baseSalePrice);
      }

      // Plot remains tilled but crop is null
      const afterPlot = useGameStore.getState().farm.plots[plotId];
      expect(afterPlot.tilled).toBe(true);
      expect(afterPlot.crop).toBeNull();

      // Produce added to inventory
      const produce = useGameStore.getState().inventory.produce;
      expect(produce).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            cropId: 'carrot',
            mutation: 'none',
            quantity: 1,
          }),
        ])
      );
    });

    it('correctly computes sale value for mutated crops (e.g. Cosmic Starfruit 15x)', () => {
      const plotId: PlotId = 'plot-0-0';
      tillPlot(plotId);
      useGameStore.getState().addSeeds('starfruit', 1);
      plantCrop(plotId, 'starfruit', undefined, baseNow);

      const currentPlot = useGameStore.getState().farm.plots[plotId];
      useGameStore.getState().setPlot({
        ...currentPlot,
        crop: {
          ...currentPlot.crop!,
          growthProgressSec: CROPS.starfruit.baseGrowthSec,
          mutation: 'cosmic',
        },
      });

      const res = harvestCrop(plotId);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.cropId).toBe('starfruit');
        expect(res.value.mutation).toBe('cosmic');
        expect(res.value.saleValue).toBe(
          CROPS.starfruit.baseSalePrice * MUTATION_MULTIPLIERS.cosmic
        );
      }
    });

    it('fails when crop is not mature (< required growth time)', () => {
      const plotId: PlotId = 'plot-0-0';
      tillPlot(plotId);
      plantCrop(plotId, 'carrot', undefined, baseNow);

      const currentPlot = useGameStore.getState().farm.plots[plotId];
      useGameStore.getState().setPlot({
        ...currentPlot,
        crop: {
          ...currentPlot.crop!,
          growthProgressSec: 20, // Carrot needs 45s
        },
      });

      const res = harvestCrop(plotId);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('not_mature');
        expect(res.message).toMatch(/not ready/i);
      }

      // Crop remains on plot
      expect(useGameStore.getState().farm.plots[plotId].crop).not.toBeNull();
      // No produce added
      expect(useGameStore.getState().inventory.produce.length).toBe(0);
    });

    it('fails when plot has no crop', () => {
      const plotId: PlotId = 'plot-0-0';
      tillPlot(plotId);

      const res = harvestCrop(plotId);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('invalid_plot_state');
        expect(res.message).toMatch(/no crop/i);
      }
    });

    it('fails when player is out of range', () => {
      const plotId: PlotId = 'plot-0-0';
      tillPlot(plotId);
      plantCrop(plotId, 'carrot', undefined, baseNow);
      const currentPlot = useGameStore.getState().farm.plots[plotId];
      useGameStore.getState().setPlot({
        ...currentPlot,
        crop: { ...currentPlot.crop!, growthProgressSec: 45 },
      });

      const plotPos = getPlotPosition(0, 0, 4);
      const playerPos: [number, number, number] = [plotPos[0] + 5.0, plotPos[1], plotPos[2]];

      const res = harvestCrop(plotId, playerPos);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('out_of_range');
      }
    });
  });

  describe('executeToolAction() dispatcher', () => {
    it('dispatches trowel to tillPlot', () => {
      const res = executeToolAction('plot-0-0', 'trowel', 'carrot');
      expect(res.ok).toBe(true);
      expect(useGameStore.getState().farm.plots['plot-0-0'].tilled).toBe(true);
    });

    it('dispatches watering_can to waterPlot with options', () => {
      tillPlot('plot-0-0');
      const res = executeToolAction('plot-0-0', 'watering_can', 'carrot', undefined, {
        weather: 'heatwave',
        nowMs: baseNow,
      });
      expect(res.ok).toBe(true);
      expect(useGameStore.getState().farm.plots['plot-0-0'].hydratedUntilUtcMs).toBe(
        baseNow + HYDRATION_DURATION_HEATWAVE_MS
      );
    });

    it('dispatches seed_bag to plantCrop', () => {
      tillPlot('plot-0-0');
      const res = executeToolAction('plot-0-0', 'seed_bag', 'carrot', undefined, {
        nowMs: baseNow,
      });
      expect(res.ok).toBe(true);
      expect(useGameStore.getState().farm.plots['plot-0-0'].crop?.cropId).toBe('carrot');
    });

    it('dispatches scythe and hand to harvestCrop', () => {
      tillPlot('plot-0-0');
      plantCrop('plot-0-0', 'carrot', undefined, baseNow);
      const currentPlot = useGameStore.getState().farm.plots['plot-0-0'];
      useGameStore.getState().setPlot({
        ...currentPlot,
        crop: { ...currentPlot.crop!, growthProgressSec: 45 },
      });

      const resScythe = executeToolAction('plot-0-0', 'scythe', 'carrot');
      expect(resScythe.ok).toBe(true);
      expect(useGameStore.getState().inventory.produce.length).toBe(1);
    });

    it('returns wrong_tool for unrecognized tool', () => {
      const res = executeToolAction(
        'plot-0-0',
        'invalid_tool' as unknown as ToolType,
        'carrot'
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('wrong_tool');
      }
    });
  });

  describe('Rapid Click Deduplication & Idempotency', () => {
    it('rapid click double-harvest yields exactly one crop', () => {
      const plotId: PlotId = 'plot-0-0';
      tillPlot(plotId);
      plantCrop(plotId, 'carrot', undefined, baseNow);
      const plot = useGameStore.getState().farm.plots[plotId];
      useGameStore.getState().setPlot({
        ...plot,
        crop: { ...plot.crop!, growthProgressSec: 45 },
      });

      const firstClick = harvestCrop(plotId);
      const secondClick = harvestCrop(plotId);

      expect(firstClick.ok).toBe(true);
      expect(secondClick.ok).toBe(false);

      const produce = useGameStore.getState().inventory.produce;
      expect(produce.length).toBe(1);
      expect(produce[0].quantity).toBe(1);
    });

    it('rapid click double-plant only consumes one seed', () => {
      const plotId: PlotId = 'plot-0-0';
      tillPlot(plotId);
      const seedsBefore = useGameStore.getState().inventory.seeds.carrot;

      const firstClick = plantCrop(plotId, 'carrot', undefined, baseNow);
      const secondClick = plantCrop(plotId, 'carrot', undefined, baseNow);

      expect(firstClick.ok).toBe(true);
      expect(secondClick.ok).toBe(false);

      const seedsAfter = useGameStore.getState().inventory.seeds.carrot;
      expect(seedsAfter).toBe(seedsBefore - 1);
    });

    it('Golden Watering Can fails on untilled target plot and does not water neighbor plots', () => {
      // Till neighbor (0,1) but leave center (0,0) untilled
      tillPlot('plot-0-1');

      const res = waterPlot('plot-0-0', undefined, true, 'sunny', baseNow);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('invalid_plot_state');
      }

      // Neighbor remains unhydrated
      const neighbor = useGameStore.getState().farm.plots['plot-0-1'];
      expect(neighbor.hydratedUntilUtcMs).toBe(0);
    });

    it('works seamlessly across 6x6 expanded grid', () => {
      useGameStore.getState().setGridSize(6);

      // (5,5) is now unlocked in 6x6 grid
      const resTill = tillPlot('plot-5-5');
      expect(resTill.ok).toBe(true);

      const resWater = waterPlot('plot-5-5', undefined, false, 'sunny', baseNow);
      expect(resWater.ok).toBe(true);

      // (6,6) is still locked in 6x6 grid
      const resLocked = tillPlot('plot-6-6');
      expect(resLocked.ok).toBe(false);
      if (!resLocked.ok) {
        expect(resLocked.reason).toBe('plot_locked');
      }
    });

    it('plantCrop fails when given an invalid crop ID', () => {
      tillPlot('plot-0-0');
      const res = plantCrop('plot-0-0', 'dragonfruit' as unknown as CropId, undefined, baseNow);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('unknown');
      }
    });

    it('harvestCrop handles over-mature crops (progress > required baseGrowthSec)', () => {
      tillPlot('plot-0-0');
      useGameStore.getState().addSeeds('pumpkin', 1);
      plantCrop('plot-0-0', 'pumpkin', undefined, baseNow);

      const plot = useGameStore.getState().farm.plots['plot-0-0'];
      useGameStore.getState().setPlot({
        ...plot,
        crop: {
          ...plot.crop!,
          growthProgressSec: 9999, // Way past 180s
          mutation: 'giant',
        },
      });

      const res = harvestCrop('plot-0-0');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.saleValue).toBe(
          CROPS.pumpkin.baseSalePrice * MUTATION_MULTIPLIERS.giant
        );
      }
    });
  });
});
