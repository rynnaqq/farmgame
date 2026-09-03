import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, resetGameStore } from './gameStore';
import {
  selectCoins,
  selectCanAfford,
  selectSeedCount,
  selectTotalProduceCount,
  selectTotalProduceValue,
  selectHarvestablePlots,
  selectHarvestableCount,
  selectEquippedPet,
  selectActivePerks,
  selectPetCount,
  selectIsPetLimitReached,
  selectPlotById,
  selectProduceStacks,
} from './selectors';
import { DEFAULT_TEST_PLACEMENT } from '../test/farmFixtures';
import type { EggData, PetData, PlotData } from './storeTypes';

describe('useGameStore', () => {
  beforeEach(() => {
    resetGameStore();
  });

  describe('Initial State', () => {
    it('has standard starting parameters with 64 logical slots', () => {
      const state = useGameStore.getState();
      expect(state.player.coins).toBe(100);
      expect(state.player.position).toEqual([0, 0, 0]);
      expect(state.player.totalDistance).toBe(0);

      expect(state.farm.gridSize).toBe(8);
      expect(state.farm.goldenWateringCanOwned).toBe(false);
      expect(Object.keys(state.farm.plots)).toHaveLength(64);

      expect(state.farm.plots['plot-0-0']).toBeDefined();
      expect(state.farm.plots['plot-0-0'].crop).toBeNull();
      expect(state.farm.plots['plot-0-0'].hydratedUntilUtcMs).toBe(0);
      expect('tilled' in state.farm.plots['plot-0-0']).toBe(false);

      expect(state.farm.plots['plot-7-7']).toBeDefined();
      expect(state.farm.plots['plot-7-7'].crop).toBeNull();

      expect(state.inventory.seeds.carrot).toBe(5);
      expect(state.inventory.seeds.tomato).toBe(0);
      expect(state.inventory.produce).toEqual([]);
      expect(state.inventory.eggs).toEqual([]);
      expect(state.inventory.pets).toEqual([]);
      expect(state.inventory.equippedPetId).toBeNull();
      expect(state.inventory.incubatingEggId).toBeNull();

      expect(state.weather.current).toBe('sunny');
      expect(state.tutorial.completedSteps).toEqual([]);
      expect(state.tutorial.dismissed).toBe(false);
      expect(state.isDirty).toBe(false);
    });
  });

  describe('Plot Actions', () => {
    it('updates a single plot atomically with setPlot', () => {
      const updatedPlot: PlotData = {
        id: 'plot-1-2',
        row: 1,
        col: 2,
        crop: {
          cropId: 'carrot',
          growthProgressSec: 15,
          mutation: 'none',
          plantedAtUtcMs: 1000,
          placement: DEFAULT_TEST_PLACEMENT,
        },
        hydratedUntilUtcMs: 5000,
      };

      useGameStore.getState().setPlot(updatedPlot);

      const state = useGameStore.getState();
      expect(state.farm.plots['plot-1-2']).toEqual(updatedPlot);
      expect(state.isDirty).toBe(true);
    });

    it('updates multiple plots with updatePlots', () => {
      const plots = useGameStore.getState().farm.plots;
      const plot1 = { ...plots['plot-0-0'], hydratedUntilUtcMs: 111 };
      const plot2 = { ...plots['plot-0-1'], hydratedUntilUtcMs: 222 };

      useGameStore.getState().updatePlots([plot1, plot2]);

      const state = useGameStore.getState();
      expect(state.farm.plots['plot-0-0'].hydratedUntilUtcMs).toBe(111);
      expect(state.farm.plots['plot-0-1'].hydratedUntilUtcMs).toBe(222);
      expect(state.farm.plots['plot-0-2'].hydratedUntilUtcMs).toBe(0);
    });

    it('sets plot hydration timestamp with setPlotHydration', () => {
      useGameStore.getState().setPlotHydration('plot-0-0', 12345678);

      const plot = useGameStore.getState().farm.plots['plot-0-0'];
      expect(plot.hydratedUntilUtcMs).toBe(12345678);
    });

    it('always exposes all 64 logical slots regardless of save payload', () => {
      const partial: PlotData[] = [
        { id: 'plot-3-3', row: 3, col: 3, crop: null, hydratedUntilUtcMs: 0 },
      ];
      useGameStore.getState().loadSaveEnvelope({
        ...useGameStore.getState().toSaveEnvelope(1000),
        farm: {
          gridSize: 8,
          plots: partial,
          goldenWateringCanOwned: false,
        },
      });
      const state = useGameStore.getState();
      expect(Object.keys(state.farm.plots)).toHaveLength(64);
      expect(state.farm.plots['plot-0-0']).toBeDefined();
    });
  });

  describe('Coin & Economy Actions', () => {
    it('adds coins correctly', () => {
      useGameStore.getState().addCoins(50);
      expect(useGameStore.getState().player.coins).toBe(150);
    });

    it('deducts coins atomically when sufficient funds exist', () => {
      const success = useGameStore.getState().deductCoins(40);
      expect(success).toBe(true);
      expect(useGameStore.getState().player.coins).toBe(60);
    });

    it('rejects deduction and does not change coins when insufficient funds', () => {
      const success = useGameStore.getState().deductCoins(200);
      expect(success).toBe(false);
      expect(useGameStore.getState().player.coins).toBe(100);
    });

    it('sets golden watering can ownership', () => {
      useGameStore.getState().setGoldenWateringCan(true);
      expect(useGameStore.getState().farm.goldenWateringCanOwned).toBe(true);
    });
  });

  describe('Inventory Actions', () => {
    it('adds and deducts seeds safely', () => {
      useGameStore.getState().addSeeds('pumpkin', 3);
      expect(useGameStore.getState().inventory.seeds.pumpkin).toBe(3);

      const successDeduct = useGameStore.getState().deductSeed('pumpkin', 1);
      expect(successDeduct).toBe(true);
      expect(useGameStore.getState().inventory.seeds.pumpkin).toBe(2);

      const failDeduct = useGameStore.getState().deductSeed('starfruit', 1);
      expect(failDeduct).toBe(false);
      expect(useGameStore.getState().inventory.seeds.starfruit).toBe(0);
    });

    it('stacks produce by cropId and mutation correctly', () => {
      useGameStore.getState().addProduce('carrot', 'none', 3);
      useGameStore.getState().addProduce('carrot', 'gold', 1);
      useGameStore.getState().addProduce('carrot', 'none', 2);

      const produce = useGameStore.getState().inventory.produce;
      expect(produce).toHaveLength(2);

      const normalCarrots = produce.find((p) => p.cropId === 'carrot' && p.mutation === 'none');
      const goldCarrots = produce.find((p) => p.cropId === 'carrot' && p.mutation === 'gold');

      expect(normalCarrots?.quantity).toBe(5);
      expect(goldCarrots?.quantity).toBe(1);
    });

    it('removes produce stack quantities correctly', () => {
      useGameStore.getState().addProduce('tomato', 'giant', 4);

      const success = useGameStore.getState().removeProduce('tomato', 'giant', 2);
      expect(success).toBe(true);
      expect(
        useGameStore
          .getState()
          .inventory.produce.find((p) => p.cropId === 'tomato' && p.mutation === 'giant')?.quantity
      ).toBe(2);

      const removeAll = useGameStore.getState().removeProduce('tomato', 'giant', 2);
      expect(removeAll).toBe(true);
      expect(
        useGameStore
          .getState()
          .inventory.produce.find((p) => p.cropId === 'tomato' && p.mutation === 'giant')
      ).toBeUndefined();

      const failRemove = useGameStore.getState().removeProduce('tomato', 'giant', 1);
      expect(failRemove).toBe(false);
    });

    it('clears all produce and returns harvested stacks', () => {
      useGameStore.getState().addProduce('carrot', 'none', 5);
      useGameStore.getState().addProduce('starfruit', 'cosmic', 1);

      const cleared = useGameStore.getState().clearAllProduce();
      expect(cleared).toHaveLength(2);
      expect(useGameStore.getState().inventory.produce).toEqual([]);
    });

    it('manages egg inventory and incubation', () => {
      const egg: EggData = {
        id: 'egg-1',
        type: 'common',
        purchasedAtUtcMs: 1000,
        outcome: 'dog',
        incubating: false,
        elapsedIncubationSec: 0,
        distanceTraveled: 0,
      };

      useGameStore.getState().addEgg(egg);
      expect(useGameStore.getState().inventory.eggs).toHaveLength(1);

      useGameStore.getState().setIncubatingEgg('egg-1');
      expect(useGameStore.getState().inventory.incubatingEggId).toBe('egg-1');
      expect(useGameStore.getState().inventory.eggs[0].incubating).toBe(true);

      useGameStore
        .getState()
        .updateEgg('egg-1', { elapsedIncubationSec: 45, distanceTraveled: 60 });
      expect(useGameStore.getState().inventory.eggs[0].elapsedIncubationSec).toBe(45);
      expect(useGameStore.getState().inventory.eggs[0].distanceTraveled).toBe(60);

      useGameStore.getState().removeEgg('egg-1');
      expect(useGameStore.getState().inventory.eggs).toHaveLength(0);
      expect(useGameStore.getState().inventory.incubatingEggId).toBeNull();
    });

    it('manages pet inventory and equipped pet', () => {
      const pet: PetData = {
        id: 'pet-1',
        type: 'bee',
        acquiredAtUtcMs: 2000,
      };

      useGameStore.getState().addPet(pet);
      expect(useGameStore.getState().inventory.pets).toHaveLength(1);

      useGameStore.getState().setEquippedPet('pet-1');
      expect(useGameStore.getState().inventory.equippedPetId).toBe('pet-1');

      useGameStore.getState().setEquippedPet(null);
      expect(useGameStore.getState().inventory.equippedPetId).toBeNull();
    });
  });

  describe('Player & Movement Accumulation', () => {
    it('sets player position and accumulates distance on incubating eggs', () => {
      const egg: EggData = {
        id: 'egg-1',
        type: 'common',
        purchasedAtUtcMs: 1000,
        outcome: 'pig',
        incubating: true,
        elapsedIncubationSec: 0,
        distanceTraveled: 10,
      };

      useGameStore.getState().addEgg(egg);
      useGameStore.getState().setIncubatingEgg('egg-1');

      useGameStore.getState().setPlayerPosition([1.5, 0.5, 2.0]);
      expect(useGameStore.getState().player.position).toEqual([1.5, 0.5, 2.0]);

      useGameStore.getState().addDistance(25.5);
      expect(useGameStore.getState().player.totalDistance).toBe(25.5);
      expect(useGameStore.getState().inventory.eggs[0].distanceTraveled).toBe(35.5);
    });
  });

  describe('Weather & RNG Actions', () => {
    it('updates weather and RNG state', () => {
      useGameStore.getState().setWeather('heavy_rain', 10000, 200000);

      const weather = useGameStore.getState().weather;
      expect(weather.current).toBe('heavy_rain');
      expect(weather.startedAtUtcMs).toBe(10000);
      expect(weather.endsAtUtcMs).toBe(200000);
      expect(weather.previousWeather).toBe('sunny');

      useGameStore.getState().setRngState(987654321);
      expect(useGameStore.getState().rngState).toBe(987654321);
    });
  });

  describe('Tutorial Actions', () => {
    it('tracks tutorial progress idempotently', () => {
      useGameStore.getState().completeTutorialStep('movement');
      useGameStore.getState().completeTutorialStep('planting');
      useGameStore.getState().completeTutorialStep('movement');

      expect(useGameStore.getState().tutorial.completedSteps).toEqual([
        'movement',
        'planting',
      ]);

      useGameStore.getState().dismissTutorial();
      expect(useGameStore.getState().tutorial.dismissed).toBe(true);
    });
  });

  describe('Persistence Serialization & Loading', () => {
    it('serializes to SaveEnvelope v2 and restores completely', () => {
      useGameStore.getState().addCoins(250);
      useGameStore.getState().addSeeds('starfruit', 2);
      useGameStore.getState().setGoldenWateringCan(true);

      const envelope = useGameStore.getState().toSaveEnvelope(500000);
      expect(envelope.schemaVersion).toBe(2);
      expect(envelope.savedAtUtcMs).toBe(500000);
      expect(envelope.player.coins).toBe(350);
      expect(envelope.farm.gridSize).toBe(8);
      expect(envelope.farm.goldenWateringCanOwned).toBe(true);
      expect(envelope.farm.plots).toHaveLength(64);

      // Reset and reload envelope
      resetGameStore();
      expect(useGameStore.getState().player.coins).toBe(100);

      useGameStore.getState().loadSaveEnvelope(envelope);
      const state = useGameStore.getState();
      expect(state.player.coins).toBe(350);
      expect(state.farm.gridSize).toBe(8);
      expect(state.farm.goldenWateringCanOwned).toBe(true);
      expect(state.inventory.seeds.starfruit).toBe(2);
      expect(state.isDirty).toBe(false);
    });

    it('never serializes the legacy tilled flag and resets empty-slot hydration', () => {
      const state = useGameStore.getState();
      state.setPlotHydration('plot-1-1', 999);

      const envelope = state.toSaveEnvelope(1000);
      for (const plot of envelope.farm.plots) {
        expect('tilled' in plot).toBe(false);
        expect(plot.hydratedUntilUtcMs).toBe(0);
      }
    });

    it('preserves crop placement exactly through toSaveEnvelope/loadSaveEnvelope', () => {
      const placement = { bedId: 'south-east' as const, localX: 1.234, localZ: -2.111 };
      const state = useGameStore.getState();
      state.setPlot({
        id: 'plot-4-4',
        row: 4,
        col: 4,
        crop: {
          cropId: 'tomato',
          plantedAtUtcMs: 1000,
          growthProgressSec: 10,
          mutation: 'none',
          placement,
        },
        hydratedUntilUtcMs: 40000,
      });

      const envelope = state.toSaveEnvelope(2000);
      expect(envelope.farm.plots.find((p) => p.id === 'plot-4-4')?.crop?.placement).toEqual(
        placement
      );

      resetGameStore();
      useGameStore.getState().loadSaveEnvelope(envelope);
      expect(useGameStore.getState().farm.plots['plot-4-4'].crop?.placement).toEqual(placement);
    });
  });

  describe('Selectors Integration', () => {
    it('computes selector values correctly', () => {
      const state = useGameStore.getState();
      expect(selectCoins(state)).toBe(100);
      expect(selectCanAfford(50)(state)).toBe(true);
      expect(selectCanAfford(150)(state)).toBe(false);

      expect(selectSeedCount('carrot')(state)).toBe(5);
      expect(selectSeedCount('tomato')(state)).toBe(0);

      // Total produce count and value
      useGameStore.getState().addProduce('carrot', 'none', 2); // 2 * 12 = 24
      useGameStore.getState().addProduce('carrot', 'gold', 1); // 1 * 12 * 5 = 60
      const updatedState = useGameStore.getState();

      expect(selectTotalProduceCount(updatedState)).toBe(3);
      expect(selectTotalProduceValue(updatedState)).toBe(84);
      expect(selectProduceStacks(updatedState)).toHaveLength(2);

      // Harvestable plots
      useGameStore.getState().setPlot({
        id: 'plot-0-0',
        row: 0,
        col: 0,
        crop: {
          cropId: 'carrot',
          growthProgressSec: 45, // Carrot baseGrowthSec = 45 -> 100%
          mutation: 'none',
          plantedAtUtcMs: 1000,
          placement: DEFAULT_TEST_PLACEMENT,
        },
        hydratedUntilUtcMs: 0,
      });

      const harvestState = useGameStore.getState();
      expect(selectHarvestableCount(harvestState)).toBe(1);
      expect(selectHarvestablePlots(harvestState)).toHaveLength(1);
      expect(selectPlotById('plot-0-0')(harvestState)?.id).toBe('plot-0-0');

      // Pets and Perks
      const pet: PetData = { id: 'p1', type: 'bee', acquiredAtUtcMs: 1 };
      useGameStore.getState().addPet(pet);
      useGameStore.getState().setEquippedPet('p1');

      const petState = useGameStore.getState();
      expect(selectEquippedPet(petState)?.type).toBe('bee');
      expect(selectPetCount(petState)).toBe(1);
      expect(selectIsPetLimitReached(petState)).toBe(false);
      expect(selectActivePerks(petState)).toEqual({
        growthSpeedMultiplier: 1.15,
        autoHarvest: false,
        mutationChanceMultiplier: 1.0,
      });
    });
  });
});
