import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, resetGameStore } from '../../state/gameStore';
import {
  plantCropAt,
  waterPlot,
  harvestCrop,
  executePlantAt,
  executePlotAction,
} from './farmingCommands';
import {
  HYDRATION_DURATION_BASIC_MS,
  HYDRATION_DURATION_HEATWAVE_MS,
  CROPS,
  MUTATION_MULTIPLIERS,
} from '../core/constants';
import type { PlotId, CropId } from '../../state/storeTypes';

describe('Task 11: Free-Placement Farming Commands & Atomic Validation', () => {
  const baseNow = 1700000000000;

  beforeEach(() => {
    resetGameStore(12345);
  });

  describe('plantCropAt()', () => {
    it('successfully plants a seed at a free position and deducts 1 seed', () => {
      const initialCarrotSeeds = useGameStore.getState().inventory.seeds.carrot; // 5
      expect(initialCarrotSeeds).toBeGreaterThan(0);

      const res = plantCropAt(0, 0, 'carrot', baseNow);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.value.plotId).toBe('crop-1');

      const plot = useGameStore.getState().farm.plots['crop-1'];
      expect(plot.x).toBe(0);
      expect(plot.z).toBe(0);
      expect(plot.crop.cropId).toBe('carrot');
      expect(plot.crop.plantedAtUtcMs).toBe(baseNow);
      expect(plot.crop.growthProgressSec).toBe(0);
      expect(plot.crop.mutation).toBe('none');

      expect(useGameStore.getState().inventory.seeds.carrot).toBe(initialCarrotSeeds - 1);
      expect(useGameStore.getState().farm.nextPlotNumber).toBe(2);
    });

    it('assigns incrementing ids to successive plantings', () => {
      const first = plantCropAt(-5, -5, 'carrot', baseNow);
      const second = plantCropAt(5, 5, 'carrot', baseNow);
      expect(first.ok && first.value.plotId).toBe('crop-1');
      expect(second.ok && second.value.plotId).toBe('crop-2');
    });

    it('fails outside the farm land with outside_planting_area', () => {
      const res = plantCropAt(50, 50, 'carrot', baseNow);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('outside_planting_area');
      }
      // No seed deducted
      expect(useGameStore.getState().inventory.seeds.carrot).toBe(5);
    });

    it('fails too close to another crop with too_close', () => {
      const first = plantCropAt(0, 0, 'carrot', baseNow);
      expect(first.ok).toBe(true);

      const res = plantCropAt(0.5, 0, 'carrot', baseNow);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('too_close');
        expect(res.message).toMatch(/close/i);
      }
    });

    it('fails when player has insufficient seeds', () => {
      expect(useGameStore.getState().inventory.seeds.tomato).toBe(0);

      const res = plantCropAt(0, 0, 'tomato', baseNow);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('insufficient_seeds');
      }

      expect(Object.keys(useGameStore.getState().farm.plots).length).toBe(0);
    });

    it('fails for unknown crop id without consuming a seed', () => {
      const res = plantCropAt(0, 0, 'dragonfruit' as unknown as CropId, baseNow);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('unknown');
      }
    });
  });

  describe('waterPlot()', () => {
    it('successfully waters a planted crop with standard duration (120s)', () => {
      const planted = plantCropAt(0, 0, 'carrot', baseNow);
      expect(planted.ok).toBe(true);
      if (!planted.ok) return;

      const res = waterPlot(planted.value.plotId, false, 'sunny', baseNow);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.hydratedPlotIds).toEqual([planted.value.plotId]);
      }

      const plot = useGameStore.getState().farm.plots[planted.value.plotId];
      expect(plot.hydratedUntilUtcMs).toBe(baseNow + HYDRATION_DURATION_BASIC_MS);
    });

    it('uses 60s hydration during heatwave weather', () => {
      const planted = plantCropAt(0, 0, 'carrot', baseNow);
      if (!planted.ok) return;

      const res = waterPlot(planted.value.plotId, false, 'heatwave', baseNow);
      expect(res.ok).toBe(true);

      const plot = useGameStore.getState().farm.plots[planted.value.plotId];
      expect(plot.hydratedUntilUtcMs).toBe(baseNow + HYDRATION_DURATION_HEATWAVE_MS);
    });

    it('resets hydration expiry without stacking time when rewatered', () => {
      const planted = plantCropAt(0, 0, 'carrot', baseNow);
      if (!planted.ok) return;
      const plotId = planted.value.plotId;

      waterPlot(plotId, false, 'sunny', baseNow);
      const firstExpiry = useGameStore.getState().farm.plots[plotId].hydratedUntilUtcMs;
      expect(firstExpiry).toBe(baseNow + HYDRATION_DURATION_BASIC_MS);

      const laterNow = baseNow + 30000;
      waterPlot(plotId, false, 'sunny', laterNow);
      const secondExpiry = useGameStore.getState().farm.plots[plotId].hydratedUntilUtcMs;
      expect(secondExpiry).toBe(laterNow + HYDRATION_DURATION_BASIC_MS);
    });

    it('Golden Watering Can hydrates every plot within radius', () => {
      const center = plantCropAt(0, 0, 'carrot', baseNow);
      const near = plantCropAt(2.0, 0, 'carrot', baseNow);
      const far = plantCropAt(6.0, 0, 'carrot', baseNow);
      expect(center.ok && near.ok && far.ok).toBe(true);
      if (!center.ok || !near.ok || !far.ok) return;

      const res = waterPlot(center.value.plotId, true, 'sunny', baseNow);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.hydratedPlotIds).toEqual(
          expect.arrayContaining([center.value.plotId, near.value.plotId])
        );
        expect(res.value.hydratedPlotIds).not.toContain(far.value.plotId);
      }
    });

    it('automatically uses golden watering can when owned in store', () => {
      useGameStore.getState().setGoldenWateringCan(true);
      const center = plantCropAt(0, 0, 'carrot', baseNow);
      const near = plantCropAt(1.5, 0, 'carrot', baseNow);
      expect(center.ok && near.ok).toBe(true);
      if (!center.ok || !near.ok) return;

      const res = waterPlot(center.value.plotId, undefined, 'sunny', baseNow);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.hydratedPlotIds).toEqual(
          expect.arrayContaining([center.value.plotId, near.value.plotId])
        );
      }
    });

    it('fails for a removed plot id', () => {
      const res = waterPlot('crop-999', false, 'sunny', baseNow);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('invalid_plot_state');
      }
    });
  });

  describe('harvestCrop()', () => {
    function plantAndMature(
      x: number,
      z: number,
      cropId: CropId = 'carrot',
      mutation: 'none' = 'none'
    ): PlotId {
      const planted = plantCropAt(x, z, cropId, baseNow);
      if (!planted.ok) throw new Error('setup planting failed');
      const plot = useGameStore.getState().farm.plots[planted.value.plotId];
      useGameStore.getState().setPlot({
        ...plot,
        crop: {
          ...plot.crop,
          growthProgressSec: CROPS[cropId].baseGrowthSec,
          mutation,
        },
      });
      return planted.value.plotId;
    }

    it('successfully harvests mature crop, adds produce, and removes the plot', () => {
      const plotId = plantAndMature(0, 0);

      const res = harvestCrop(plotId);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.cropId).toBe('carrot');
        expect(res.value.mutation).toBe('none');
        expect(res.value.saleValue).toBe(CROPS.carrot.baseSalePrice);
      }

      // Plot is removed, freeing the soil
      expect(useGameStore.getState().farm.plots[plotId]).toBeUndefined();

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
      useGameStore.getState().addSeeds('starfruit', 1);
      const planted = plantCropAt(1.5, 1.5, 'starfruit', baseNow);
      if (!planted.ok) return;
      const plot = useGameStore.getState().farm.plots[planted.value.plotId];
      useGameStore.getState().setPlot({
        ...plot,
        crop: {
          ...plot.crop,
          growthProgressSec: CROPS.starfruit.baseGrowthSec,
          mutation: 'cosmic',
        },
      });

      const res = harvestCrop(planted.value.plotId);
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
      const planted = plantCropAt(0, 0, 'carrot', baseNow);
      if (!planted.ok) return;
      const plot = useGameStore.getState().farm.plots[planted.value.plotId];
      useGameStore.getState().setPlot({
        ...plot,
        crop: {
          ...plot.crop,
          growthProgressSec: 20, // Carrot needs 45s
        },
      });

      const res = harvestCrop(planted.value.plotId);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('not_mature');
        expect(res.message).toMatch(/not ready/i);
      }

      // Crop remains on plot, no produce added
      expect(useGameStore.getState().farm.plots[planted.value.plotId]).toBeDefined();
      expect(useGameStore.getState().inventory.produce.length).toBe(0);
    });

    it('harvestCrop handles over-mature crops (progress > required baseGrowthSec)', () => {
      useGameStore.getState().addSeeds('pumpkin', 1);
      const planted = plantCropAt(-2, 2, 'pumpkin', baseNow);
      if (!planted.ok) return;

      const plot = useGameStore.getState().farm.plots[planted.value.plotId];
      useGameStore.getState().setPlot({
        ...plot,
        crop: {
          ...plot.crop,
          growthProgressSec: 9999, // Way past 180s
          mutation: 'giant',
        },
      });

      const res = harvestCrop(planted.value.plotId);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.saleValue).toBe(CROPS.pumpkin.baseSalePrice * MUTATION_MULTIPLIERS.giant);
      }
    });
  });

  describe('executePlantAt() / executePlotAction() dispatchers', () => {
    it('dispatches planting at soil point via executePlantAt', () => {
      const res = executePlantAt(1, 1, 'carrot', baseNow);
      expect(res.ok).toBe(true);
      expect(useGameStore.getState().farm.plots['crop-1'].crop.cropId).toBe('carrot');
    });

    it('dispatches watering_can to waterPlot with options', () => {
      const planted = plantCropAt(0, 0, 'carrot', baseNow);
      if (!planted.ok) return;
      const res = executePlotAction(planted.value.plotId, 'watering_can', {
        weather: 'heatwave',
        nowMs: baseNow,
      });
      expect(res.ok).toBe(true);
      expect(useGameStore.getState().farm.plots[planted.value.plotId].hydratedUntilUtcMs).toBe(
        baseNow + HYDRATION_DURATION_HEATWAVE_MS
      );
    });

    it('dispatches hand to harvestCrop and frees soil for replanting', () => {
      const planted = plantCropAt(0, 0, 'carrot', baseNow);
      if (!planted.ok) return;
      const plot = useGameStore.getState().farm.plots[planted.value.plotId];
      useGameStore.getState().setPlot({
        ...plot,
        crop: { ...plot.crop, growthProgressSec: 45 },
      });

      const resHarvest = executePlotAction(planted.value.plotId, 'hand');
      expect(resHarvest.ok).toBe(true);
      expect(useGameStore.getState().inventory.produce.length).toBe(1);

      // Same spot is plantable again immediately
      const replant = executePlantAt(0, 0, 'carrot', baseNow);
      expect(replant.ok).toBe(true);
    });

    it('seed_bag on a planted plot explains it is already planted', () => {
      const planted = plantCropAt(0, 0, 'carrot', baseNow);
      if (!planted.ok) return;
      const res = executePlotAction(planted.value.plotId, 'seed_bag');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('invalid_plot_state');
      }
    });

    it('returns wrong_tool for unrecognized tool', () => {
      const planted = plantCropAt(0, 0, 'carrot', baseNow);
      if (!planted.ok) return;
      const res = executePlotAction(
        planted.value.plotId,
        'invalid_tool' as unknown as Parameters<typeof executePlotAction>[1]
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('wrong_tool');
      }
    });
  });

  describe('Rapid Click Deduplication & Idempotency', () => {
    it('rapid click double-harvest yields exactly one crop', () => {
      const planted = plantCropAt(0, 0, 'carrot', baseNow);
      if (!planted.ok) return;
      const plot = useGameStore.getState().farm.plots[planted.value.plotId];
      useGameStore.getState().setPlot({
        ...plot,
        crop: { ...plot.crop, growthProgressSec: 45 },
      });

      const firstClick = harvestCrop(planted.value.plotId);
      const secondClick = harvestCrop(planted.value.plotId);

      expect(firstClick.ok).toBe(true);
      expect(secondClick.ok).toBe(false);

      const produce = useGameStore.getState().inventory.produce;
      expect(produce.length).toBe(1);
      expect(produce[0].quantity).toBe(1);
    });

    it('rapid click double-plant only consumes one seed', () => {
      const seedsBefore = useGameStore.getState().inventory.seeds.carrot;

      const firstClick = plantCropAt(3, 3, 'carrot', baseNow);
      const secondClick = plantCropAt(3, 3, 'carrot', baseNow);

      expect(firstClick.ok).toBe(true);
      expect(secondClick.ok).toBe(false);

      const seedsAfter = useGameStore.getState().inventory.seeds.carrot;
      expect(seedsAfter).toBe(seedsBefore - 1);
    });

    it('plantCropAt fails when given an invalid crop ID', () => {
      const res = plantCropAt(0, 0, 'dragonfruit' as unknown as CropId, baseNow);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('unknown');
      }
    });
  });
});
