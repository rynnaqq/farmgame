import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  advanceGameTime,
  setTestWeather,
  getTestGameState,
  resetTestGame,
  installTestClock,
  uninstallTestClock,
} from './testClock';
import { useGameStore, resetGameStore } from '../state/gameStore';
import { useUiStore, resetUiStore } from '../state/uiStore';
import { saveService } from '../persistence/saveService';
import { CROPS } from '../game/core/constants';
import { createTestCrop, DEFAULT_TEST_PLACEMENT } from './farmFixtures';

describe('src/test/testClock.ts Unit Tests', () => {
  beforeEach(() => {
    resetGameStore();
    resetUiStore();
    uninstallTestClock();
    vi.clearAllMocks();
  });

  afterEach(() => {
    uninstallTestClock();
  });

  describe('advanceGameTime()', () => {
    it('advances crop growth deterministically in the store', () => {
      const store = useGameStore.getState();
      const baseTime = 1_000_000;
      // Setup a tilled and watered plot with a planted carrot
      store.setPlot({
        id: 'plot-0-0',
        row: 0,
        col: 0,
        crop: {
          cropId: 'carrot',
          plantedAtUtcMs: baseTime,
          growthProgressSec: 0,
          mutation: 'none',
          placement: DEFAULT_TEST_PLACEMENT,
        },
        hydratedUntilUtcMs: baseTime + 120_000,
      });

      // Save initial envelope at baseTime
      const env = store.toSaveEnvelope(baseTime);
      store.loadSaveEnvelope(env);

      // Advance by 45s (45,000 ms)
      const { updatedEnvelope, summary } = advanceGameTime(45_000, false);

      expect(updatedEnvelope.farm.plots[0].crop?.growthProgressSec).toBe(
        CROPS.carrot.baseGrowthSec
      );
      expect(useGameStore.getState().farm.plots['plot-0-0'].crop?.growthProgressSec).toBe(
        CROPS.carrot.baseGrowthSec
      );
      expect(summary.totalMaturedCount).toBe(1);
      expect(useUiStore.getState().activeModal).toBeNull();
    });

    it('opens offline_summary modal when showModal=true and summary.shouldDisplay is true', () => {
      const store = useGameStore.getState();
      const baseTime = 1_000_000;
      store.setPlot({
        id: 'plot-0-0',
        row: 0,
        col: 0,
        crop: {
          cropId: 'carrot',
          plantedAtUtcMs: baseTime,
          growthProgressSec: 0,
          mutation: 'none',
          placement: DEFAULT_TEST_PLACEMENT,
        },
        hydratedUntilUtcMs: baseTime + 120_000,
      });

      const env = store.toSaveEnvelope(baseTime);
      store.loadSaveEnvelope(env);

      // Advance by 60s with showModal=true
      const { summary } = advanceGameTime(60_000, true);

      expect(summary.shouldDisplay).toBe(true);
      expect(useUiStore.getState().activeModal).toBe('offline_summary');
    });

    it('does not open modal when showModal=false even if shouldDisplay is true', () => {
      const store = useGameStore.getState();
      const baseTime = 1_000_000;
      store.setPlot({
        id: 'plot-0-0',
        row: 0,
        col: 0,
        crop: {
          cropId: 'carrot',
          plantedAtUtcMs: baseTime,
          growthProgressSec: 0,
          mutation: 'none',
          placement: DEFAULT_TEST_PLACEMENT,
        },
        hydratedUntilUtcMs: baseTime + 120_000,
      });

      const env = store.toSaveEnvelope(baseTime);
      store.loadSaveEnvelope(env);

      advanceGameTime(60_000, false);
      expect(useUiStore.getState().activeModal).toBeNull();
    });
  });

  describe('setTestWeather()', () => {
    it('sets the active weather and computes expiration timestamp', () => {
      const weatherState = setTestWeather('heatwave', 180);
      expect(weatherState.current).toBe('heatwave');
      expect(useGameStore.getState().weather.current).toBe('heatwave');
      expect(weatherState.endsAtUtcMs).toBeGreaterThan(Date.now());
    });

    it('hydrates all planted crops when weather is heavy_rain', () => {
      const store = useGameStore.getState();
      store.setPlot({
        id: 'plot-0-0',
        row: 0,
        col: 0,
        crop: createTestCrop(),
        hydratedUntilUtcMs: 0,
      });
      store.setPlot({
        id: 'plot-0-1',
        row: 0,
        col: 1,
        crop: null,
        hydratedUntilUtcMs: 0,
      });

      setTestWeather('heavy_rain', 120);

      const plots = useGameStore.getState().farm.plots;
      expect(plots['plot-0-0'].hydratedUntilUtcMs).toBeGreaterThan(Date.now());
      // Empty slot remains unhydrated
      expect(plots['plot-0-1'].hydratedUntilUtcMs).toBe(0);
    });
  });

  describe('getTestGameState() and resetTestGame()', () => {
    it('getTestGameState returns valid current snapshot', () => {
      useGameStore.getState().setCoins(777);
      const snapshot = getTestGameState();
      expect(snapshot.player.coins).toBe(777);
      expect(snapshot.schemaVersion).toBe(2);
    });

    it('resetTestGame resets store to initial conditions with optional seed', () => {
      useGameStore.getState().setCoins(999);
      resetTestGame(12345);
      expect(useGameStore.getState().player.coins).toBe(100);
      expect(useGameStore.getState().rngState).toBe(12345);
    });
  });

  describe('installTestClock() and uninstallTestClock()', () => {
    it('attaches all helpers to window and supports test interactions', async () => {
      installTestClock();

      expect(typeof window.__advanceGameTime).toBe('function');
      expect(typeof window.__setWeather).toBe('function');
      expect(typeof window.__getGameState).toBe('function');
      expect(typeof window.__resetGame).toBe('function');
      expect(typeof window.__plantCropAt).toBe('function');
      expect(typeof window.__waterCrop).toBe('function');
      expect(typeof window.__harvestCrop).toBe('function');
      expect(typeof window.__addCoins).toBe('function');
      expect(typeof window.__setPlayerPosition).toBe('function');
      expect(typeof window.__incubateEgg).toBe('function');
      expect(typeof window.__hatchEgg).toBe('function');
      expect(typeof window.__openModal).toBe('function');
      expect(typeof window.__closeModal).toBe('function');
      expect(typeof window.__saveGame).toBe('function');
      expect(typeof window.__loadGame).toBe('function');
      expect(window.__saveService).toBe(saveService);
      expect(window.__DEBUG__).toBe(true);

      // Test window helpers execution
      window.__addCoins!(50);
      expect(useGameStore.getState().player.coins).toBe(150);

      window.__setPlayerPosition!([1, 2, 3]);
      expect(useGameStore.getState().player.position).toEqual([1, 2, 3]);

      window.__openModal!('settings');
      expect(useUiStore.getState().activeModal).toBe('settings');

      window.__closeModal!();
      expect(useUiStore.getState().activeModal).toBeNull();

      // Plant, water, harvest helpers (exact placement API)
      const plantRes = window.__plantCropAt!(
        { bedId: 'north-west', localX: 0, localZ: 0 },
        'carrot'
      );
      expect(plantRes?.ok).toBe(true);
      const slotId = plantRes?.ok ? plantRes.value.slotId : 'plot-0-0';
      expect(useGameStore.getState().farm.plots[slotId].crop?.cropId).toBe('carrot');

      const waterRes = window.__waterCrop!(slotId);
      expect(waterRes?.ok).toBe(true);
      expect(useGameStore.getState().farm.plots[slotId].hydratedUntilUtcMs).toBeGreaterThan(0);

      // Save and load
      const saveSpy = vi.spyOn(saveService, 'saveImmediate').mockResolvedValue(true);
      const loadSpy = vi.spyOn(saveService, 'load').mockResolvedValue({
        envelope: getTestGameState(),
        status: 'loaded',
      });

      await window.__saveGame!();
      expect(saveSpy).toHaveBeenCalled();

      const loaded = await window.__loadGame!();
      expect(loadSpy).toHaveBeenCalled();
      expect(loaded.player.coins).toBe(150);

      // Egg helpers
      useGameStore.getState().addEgg({
        id: 'egg-test',
        type: 'common',
        purchasedAtUtcMs: Date.now(),
        outcome: 'dog',
        incubating: false,
        elapsedIncubationSec: 90,
        distanceTraveled: 0,
      });

      window.__incubateEgg!('egg-test');
      expect(useGameStore.getState().inventory.eggs[0].incubating).toBe(true);

      const hatchRes = window.__hatchEgg!('egg-test');
      expect(hatchRes?.ok).toBe(true);
      expect(useGameStore.getState().inventory.pets.length).toBe(1);

      // Harvest immature crop fails
      const harvestRes = window.__harvestCrop!(slotId);
      expect(harvestRes?.ok).toBe(false);

      // Uninstall test clock
      uninstallTestClock();
      expect(window.__advanceGameTime).toBeUndefined();
      expect(window.__setWeather).toBeUndefined();
      expect(window.__getGameState).toBeUndefined();
      expect(window.__resetGame).toBeUndefined();
    });
  });
});
