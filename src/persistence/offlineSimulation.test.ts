import { describe, it, expect } from 'vitest';
import { simulateOfflineProgression, formatOfflineDuration } from './offlineSimulation';
import { createDefaultSaveEnvelope } from './saveSchema';
import type { EggData, WeatherType } from '../state/storeTypes';
import { SeededRNG } from '../game/core/rng';

import { CROPS, MAX_OFFLINE_PROGRESSION_MS } from '../game/core/constants';
import { rollNextWeather } from '../game/weather/weatherSystem';

describe('offlineSimulation - Deterministic Offline Progression Engine', () => {
  const BASE_TIME = 1_700_000_000_000; // Fixed epoch timestamp

  describe('formatOfflineDuration()', () => {
    it('formats seconds correctly', () => {
      expect(formatOfflineDuration(45_000)).toBe('45s');
      expect(formatOfflineDuration(0)).toBe('0s');
    });

    it('formats minutes and seconds correctly', () => {
      expect(formatOfflineDuration(90_000)).toBe('1m 30s');
      expect(formatOfflineDuration(120_000)).toBe('2m');
      expect(formatOfflineDuration(125_000)).toBe('2m 5s');
    });

    it('formats hours and minutes correctly', () => {
      expect(formatOfflineDuration(3_600_000)).toBe('1h');
      expect(formatOfflineDuration(5_400_000)).toBe('1h 30m');
      expect(formatOfflineDuration(86_400_000)).toBe('24h');
    });

    it('handles negative or invalid values safely', () => {
      expect(formatOfflineDuration(-5000)).toBe('0s');
    });
  });

  describe('Clock Protection & Time Clamping', () => {
    it('handles backward clock (nowMs < savedAtUtcMs) with 0ms elapsed and warning', () => {
      const envelope = createDefaultSaveEnvelope(BASE_TIME, 100);
      const pastTime = BASE_TIME - 60_000; // 1 minute in the past

      const result = simulateOfflineProgression(envelope, pastTime);

      expect(result.summary.elapsedMs).toBe(0);
      expect(result.summary.shouldDisplay).toBe(false);
      expect(result.summary.clockMovedBackward).toBe(true);
      expect(result.updatedEnvelope.savedAtUtcMs).toBe(pastTime);
      expect(result.updatedEnvelope.rngState).toBe(envelope.rngState);
    });

    it('handles zero elapsed time idempotently', () => {
      const envelope = createDefaultSaveEnvelope(BASE_TIME, 100);

      const result = simulateOfflineProgression(envelope, BASE_TIME);

      expect(result.summary.elapsedMs).toBe(0);
      expect(result.summary.shouldDisplay).toBe(false);
      expect(result.updatedEnvelope.savedAtUtcMs).toBe(BASE_TIME);
    });

    it('clamps elapsed time exceeding 24 hours to MAX_OFFLINE_PROGRESSION_MS', () => {
      const envelope = createDefaultSaveEnvelope(BASE_TIME, 100);
      const thirtyHoursLater = BASE_TIME + 30 * 60 * 60 * 1000; // 30 hours

      const result = simulateOfflineProgression(envelope, thirtyHoursLater);

      expect(result.summary.elapsedMs).toBe(MAX_OFFLINE_PROGRESSION_MS);
      expect(result.updatedEnvelope.savedAtUtcMs).toBe(thirtyHoursLater);
    });
  });

  describe('Deterministic Weather Replay', () => {
    it('reconstructs weather transitions across multiple periods using SeededRNG', () => {
      const initialSeed = 42;
      const envelope = createDefaultSaveEnvelope(BASE_TIME, initialSeed);
      envelope.weather = {
        current: 'sunny',
        startedAtUtcMs: BASE_TIME,
        endsAtUtcMs: BASE_TIME + 100_000, // ends in 100s
        previousWeather: null,
      };

      const offlineDurationMs = 600_000; // 10 minutes (multiple weather cycles)
      const nowMs = BASE_TIME + offlineDurationMs;

      // Replay weather independently using identical SeededRNG
      const expectedRng = new SeededRNG(initialSeed);
      let expectedWeather: WeatherType = 'sunny';
      let nextEnd = envelope.weather.endsAtUtcMs;

      while (nextEnd <= nowMs) {
        const roll = rollNextWeather(expectedWeather, expectedRng);
        expectedWeather = roll.nextWeather;
        nextEnd = nextEnd + roll.durationSeconds * 1000;
      }

      const result = simulateOfflineProgression(envelope, nowMs);

      expect(result.updatedEnvelope.weather.current).toBe(expectedWeather);
      expect(result.updatedEnvelope.rngState).toBe(expectedRng.getState());
    });
  });

  describe('Crop Growth & Hydration Windows', () => {
    it('does not advance crop growth on untilled or unwatered dry plots', () => {
      const envelope = createDefaultSaveEnvelope(BASE_TIME, 1);
      // Untilled plot with crop (invalid state, should not grow)
      envelope.farm.plots[0] = {
        ...envelope.farm.plots[0],
        tilled: false,
        crop: {
          cropId: 'carrot',
          plantedAtUtcMs: BASE_TIME,
          growthProgressSec: 0,
          mutation: 'none',
        },
        hydratedUntilUtcMs: 0,
      };

      // Tilled plot but dry
      envelope.farm.plots[1] = {
        ...envelope.farm.plots[1],
        tilled: true,
        crop: {
          cropId: 'carrot',
          plantedAtUtcMs: BASE_TIME,
          growthProgressSec: 10,
          mutation: 'none',
        },
        hydratedUntilUtcMs: 0,
      };

      const result = simulateOfflineProgression(envelope, BASE_TIME + 60_000);

      expect(result.updatedEnvelope.farm.plots[0].crop?.growthProgressSec).toBe(0);
      expect(result.updatedEnvelope.farm.plots[1].crop?.growthProgressSec).toBe(10);
      expect(result.summary.totalMaturedCount).toBe(0);
    });

    it('advances growth only until plot hydration expires', () => {
      const envelope = createDefaultSaveEnvelope(BASE_TIME, 1);
      // Carrot needs 45s. Hydrated for only 20s.
      envelope.farm.plots[0] = {
        ...envelope.farm.plots[0],
        tilled: true,
        crop: {
          cropId: 'carrot',
          plantedAtUtcMs: BASE_TIME,
          growthProgressSec: 0,
          mutation: 'none',
        },
        hydratedUntilUtcMs: BASE_TIME + 20_000,
      };

      // Sunny multiplier = 1.0. In 20s hydration, growth advances by 20s.
      const result = simulateOfflineProgression(envelope, BASE_TIME + 120_000);

      const plot = result.updatedEnvelope.farm.plots[0];
      expect(plot.crop?.growthProgressSec).toBeCloseTo(20, 1);
      expect(plot.crop?.growthProgressSec).toBeLessThan(CROPS.carrot.baseGrowthSec);
      expect(result.summary.totalMaturedCount).toBe(0);
    });

    it('automatically hydrates all tilled plots during Heavy Rain weather', () => {
      const envelope = createDefaultSaveEnvelope(BASE_TIME, 1);
      // Heavy rain for 100s
      envelope.weather = {
        current: 'heavy_rain',
        startedAtUtcMs: BASE_TIME,
        endsAtUtcMs: BASE_TIME + 100_000,
        previousWeather: null,
      };

      // Dry tilled plot with tomato (needs 90s)
      envelope.farm.plots[0] = {
        ...envelope.farm.plots[0],
        tilled: true,
        crop: {
          cropId: 'tomato',
          plantedAtUtcMs: BASE_TIME,
          growthProgressSec: 0,
          mutation: 'none',
        },
        hydratedUntilUtcMs: 0, // initially dry!
      };

      // Heavy rain multiplier = 1.15. 90s / 1.15 = ~78.26s to mature.
      // Offline for 85s -> crop will mature!
      const result = simulateOfflineProgression(envelope, BASE_TIME + 85_000);

      const plot = result.updatedEnvelope.farm.plots[0];
      expect(plot.crop?.growthProgressSec).toBe(CROPS.tomato.baseGrowthSec);
      expect(result.summary.totalMaturedCount).toBe(1);
      expect(result.summary.maturedCrops[0].cropId).toBe('tomato');
    });

    it('applies Bee companion perk (1.15x growth speed) during offline simulation', () => {
      const envelope = createDefaultSaveEnvelope(BASE_TIME, 1);
      envelope.inventory.pets = [{ id: 'pet-bee', type: 'bee', acquiredAtUtcMs: BASE_TIME }];
      envelope.inventory.equippedPetId = 'pet-bee';

      // Carrot needs 45s. With Sunny (1.0x) and Bee (1.15x) -> growth speed is 1.15x.
      // In 30 seconds of hydration, growth progress = 30 * 1.15 = 34.5s.
      envelope.farm.plots[0] = {
        ...envelope.farm.plots[0],
        tilled: true,
        crop: {
          cropId: 'carrot',
          plantedAtUtcMs: BASE_TIME,
          growthProgressSec: 0,
          mutation: 'none',
        },
        hydratedUntilUtcMs: BASE_TIME + 60_000,
      };

      const result = simulateOfflineProgression(envelope, BASE_TIME + 30_000);

      const plot = result.updatedEnvelope.farm.plots[0];
      expect(plot.crop?.growthProgressSec).toBeCloseTo(34.5, 1);
    });
  });

  describe('Mutation Rolls at Maturity', () => {
    it('rolls mutation at the exact moment of maturity using deterministic RNG', () => {
      const seed = 9999;
      const envelope = createDefaultSaveEnvelope(BASE_TIME, seed);

      // Carrot needs 45s. Hydrated for 60s.
      envelope.farm.plots[0] = {
        ...envelope.farm.plots[0],
        tilled: true,
        crop: {
          cropId: 'carrot',
          plantedAtUtcMs: BASE_TIME,
          growthProgressSec: 40, // 5s remaining
          mutation: 'none',
        },
        hydratedUntilUtcMs: BASE_TIME + 60_000,
      };

      const result = simulateOfflineProgression(envelope, BASE_TIME + 10_000);

      const plot = result.updatedEnvelope.farm.plots[0];
      expect(plot.crop?.growthProgressSec).toBe(45);
      expect(result.summary.totalMaturedCount).toBe(1);
      expect(plot.crop?.mutation).toBeDefined();
    });

    it('does not re-roll mutation for crops that were already mature at save time', () => {
      const envelope = createDefaultSaveEnvelope(BASE_TIME, 50);
      envelope.farm.plots[0] = {
        ...envelope.farm.plots[0],
        tilled: true,
        crop: {
          cropId: 'carrot',
          plantedAtUtcMs: BASE_TIME - 100_000,
          growthProgressSec: 45,
          mutation: 'gold',
        },
        hydratedUntilUtcMs: BASE_TIME + 60_000,
      };

      const result = simulateOfflineProgression(envelope, BASE_TIME + 60_000);

      const plot = result.updatedEnvelope.farm.plots[0];
      expect(plot.crop?.mutation).toBe('gold');
      // Already mature at start does not count as newly matured offline
      expect(result.summary.totalMaturedCount).toBe(0);
    });
  });

  describe('Dog Companion Auto-Harvest', () => {
    it('harvests mature crops 30 seconds after maturity when Dog is equipped', () => {
      const envelope = createDefaultSaveEnvelope(BASE_TIME, 1);
      envelope.inventory.pets = [{ id: 'pet-dog', type: 'dog', acquiredAtUtcMs: BASE_TIME }];
      envelope.inventory.equippedPetId = 'pet-dog';

      // Carrot needs 45s. Starts at 0s progress.
      // Reaches maturity at t = 45s.
      // Dog harvests at t = 45s + 30s = 75s.
      envelope.farm.plots[0] = {
        ...envelope.farm.plots[0],
        tilled: true,
        crop: {
          cropId: 'carrot',
          plantedAtUtcMs: BASE_TIME,
          growthProgressSec: 0,
          mutation: 'none',
        },
        hydratedUntilUtcMs: BASE_TIME + 100_000,
      };

      // 1. At 60s (after maturity at 45s, but before 75s harvest): crop is mature on plot, not harvested yet
      const midResult = simulateOfflineProgression(envelope, BASE_TIME + 60_000);
      expect(midResult.updatedEnvelope.farm.plots[0].crop).not.toBeNull();
      expect(midResult.updatedEnvelope.farm.plots[0].crop?.growthProgressSec).toBe(45);
      expect(midResult.summary.dogHarvestsCount).toBe(0);
      expect(midResult.updatedEnvelope.inventory.produce.length).toBe(0);

      // 2. At 80s (after 75s): Dog has harvested the crop into inventory
      const finalResult = simulateOfflineProgression(envelope, BASE_TIME + 80_000);
      expect(finalResult.updatedEnvelope.farm.plots[0].crop).toBeNull();
      expect(finalResult.summary.dogHarvestsCount).toBe(1);
      expect(finalResult.updatedEnvelope.inventory.produce).toEqual([
        expect.objectContaining({
          cropId: 'carrot',
          quantity: 1,
        }),
      ]);
    });

    it('harvests already-mature crops 30s after save time if Dog is equipped', () => {
      const envelope = createDefaultSaveEnvelope(BASE_TIME, 1);
      envelope.inventory.pets = [{ id: 'pet-dog', type: 'dog', acquiredAtUtcMs: BASE_TIME }];
      envelope.inventory.equippedPetId = 'pet-dog';

      // Crop is already mature at save time
      envelope.farm.plots[0] = {
        ...envelope.farm.plots[0],
        tilled: true,
        crop: {
          cropId: 'pumpkin',
          plantedAtUtcMs: BASE_TIME - 200_000,
          growthProgressSec: 180,
          mutation: 'giant',
        },
        hydratedUntilUtcMs: 0,
      };

      // At 35s offline: Dog harvests it
      const result = simulateOfflineProgression(envelope, BASE_TIME + 35_000);
      expect(result.updatedEnvelope.farm.plots[0].crop).toBeNull();
      expect(result.summary.dogHarvestsCount).toBe(1);
      expect(result.updatedEnvelope.inventory.produce).toEqual([
        { cropId: 'pumpkin', mutation: 'giant', quantity: 1 },
      ]);
    });

    it('does not auto-harvest when Dog is not equipped', () => {
      const envelope = createDefaultSaveEnvelope(BASE_TIME, 1);
      envelope.inventory.equippedPetId = null; // No pet equipped

      envelope.farm.plots[0] = {
        ...envelope.farm.plots[0],
        tilled: true,
        crop: {
          cropId: 'carrot',
          plantedAtUtcMs: BASE_TIME,
          growthProgressSec: 0,
          mutation: 'none',
        },
        hydratedUntilUtcMs: BASE_TIME + 100_000,
      };

      const result = simulateOfflineProgression(envelope, BASE_TIME + 120_000);

      expect(result.updatedEnvelope.farm.plots[0].crop?.growthProgressSec).toBe(45);
      expect(result.summary.dogHarvestsCount).toBe(0);
      expect(result.updatedEnvelope.inventory.produce.length).toBe(0);
    });
  });

  describe('Egg Incubation & Hatching', () => {
    it('advances incubation time towards 90s and hatches egg when complete', () => {
      const envelope = createDefaultSaveEnvelope(BASE_TIME, 1);
      const egg: EggData = {
        id: 'egg-1',
        type: 'common',
        purchasedAtUtcMs: BASE_TIME,
        outcome: 'pig',
        incubating: true,
        elapsedIncubationSec: 30, // 60s remaining
        distanceTraveled: 0,
      };
      envelope.inventory.eggs = [egg];
      envelope.inventory.incubatingEggId = 'egg-1';

      // Offline for 70s -> reaches 100s (> 90s threshold) -> hatches
      const result = simulateOfflineProgression(envelope, BASE_TIME + 70_000);

      expect(result.updatedEnvelope.inventory.eggs.length).toBe(0);
      expect(result.updatedEnvelope.inventory.incubatingEggId).toBeNull();
      expect(result.updatedEnvelope.inventory.pets.length).toBe(1);
      expect(result.updatedEnvelope.inventory.pets[0].type).toBe('pig');
      expect(result.summary.hatchedPets).toEqual([expect.objectContaining({ type: 'pig' })]);
      // Auto-equipped since slot was empty
      expect(result.updatedEnvelope.inventory.equippedPetId).toBe(
        result.updatedEnvelope.inventory.pets[0].id
      );
    });

    it('does not hatch egg if elapsed incubation time has not reached 90s', () => {
      const envelope = createDefaultSaveEnvelope(BASE_TIME, 1);
      const egg: EggData = {
        id: 'egg-1',
        type: 'common',
        purchasedAtUtcMs: BASE_TIME,
        outcome: 'bee',
        incubating: true,
        elapsedIncubationSec: 20,
        distanceTraveled: 0,
      };
      envelope.inventory.eggs = [egg];
      envelope.inventory.incubatingEggId = 'egg-1';

      // Offline for 30s -> elapsed = 50s (< 90s)
      const result = simulateOfflineProgression(envelope, BASE_TIME + 30_000);

      expect(result.updatedEnvelope.inventory.eggs.length).toBe(1);
      expect(result.updatedEnvelope.inventory.eggs[0].elapsedIncubationSec).toBe(50);
      expect(result.updatedEnvelope.inventory.pets.length).toBe(0);
      expect(result.summary.hatchedPets.length).toBe(0);
    });

    it('hatched Dog immediately starts harvesting subsequent mature crops', () => {
      const envelope = createDefaultSaveEnvelope(BASE_TIME, 1);
      // Egg has 10s left to hatch into a Dog
      const egg: EggData = {
        id: 'egg-1',
        type: 'common',
        purchasedAtUtcMs: BASE_TIME,
        outcome: 'dog',
        incubating: true,
        elapsedIncubationSec: 80,
        distanceTraveled: 0,
      };
      envelope.inventory.eggs = [egg];
      envelope.inventory.incubatingEggId = 'egg-1';
      envelope.inventory.equippedPetId = null;

      // Crop matures at t = 20s.
      // Egg hatches into Dog at t = 10s and auto-equips!
      // Therefore, Dog is equipped when crop matures at t = 20s.
      // Dog harvests crop at t = 20s + 30s = 50s.
      envelope.farm.plots[0] = {
        ...envelope.farm.plots[0],
        tilled: true,
        crop: {
          cropId: 'carrot',
          plantedAtUtcMs: BASE_TIME,
          growthProgressSec: 25, // 20s to mature
          mutation: 'none',
        },
        hydratedUntilUtcMs: BASE_TIME + 100_000,
      };

      // Offline for 60s (past 50s Dog harvest)
      const result = simulateOfflineProgression(envelope, BASE_TIME + 60_000);

      expect(result.summary.hatchedPets.length).toBe(1);
      expect(result.summary.hatchedPets[0].type).toBe('dog');
      expect(result.summary.dogHarvestsCount).toBe(1);
      expect(result.updatedEnvelope.farm.plots[0].crop).toBeNull();
      expect(result.updatedEnvelope.inventory.produce.length).toBe(1);
    });
  });

  describe('Idempotency & State Commitment', () => {
    it('guarantees idempotency: running simulation twice does not grant double progression', () => {
      const envelope = createDefaultSaveEnvelope(BASE_TIME, 77);
      envelope.farm.plots[0] = {
        ...envelope.farm.plots[0],
        tilled: true,
        crop: {
          cropId: 'carrot',
          plantedAtUtcMs: BASE_TIME,
          growthProgressSec: 0,
          mutation: 'none',
        },
        hydratedUntilUtcMs: BASE_TIME + 100_000,
      };

      const offlineTimeMs = BASE_TIME + 60_000;

      // First run: simulates 60s
      const firstRun = simulateOfflineProgression(envelope, offlineTimeMs);
      expect(firstRun.summary.elapsedMs).toBe(60_000);
      expect(firstRun.summary.totalMaturedCount).toBe(1);

      // Second run using updatedEnvelope at same timestamp: 0ms elapsed, 0 events
      const secondRun = simulateOfflineProgression(firstRun.updatedEnvelope, offlineTimeMs);
      expect(secondRun.summary.elapsedMs).toBe(0);
      expect(secondRun.summary.totalMaturedCount).toBe(0);
      expect(secondRun.summary.shouldDisplay).toBe(false);
      expect(secondRun.updatedEnvelope.farm.plots[0].crop?.growthProgressSec).toBe(45);
    });
  });

  describe('OfflineSummary shouldDisplay threshold', () => {
    it('sets shouldDisplay = true only when elapsed >= 30s AND has events', () => {
      const envelope = createDefaultSaveEnvelope(BASE_TIME, 1);

      // 1. Elapsed >= 30s but 0 events (no crops, no eggs) -> shouldDisplay = false
      const noEventsResult = simulateOfflineProgression(envelope, BASE_TIME + 60_000);
      expect(noEventsResult.summary.elapsedMs).toBe(60_000);
      expect(noEventsResult.summary.shouldDisplay).toBe(false);

      // 2. Elapsed < 30s (e.g. 10s) with mature crop -> shouldDisplay = false
      envelope.farm.plots[0] = {
        ...envelope.farm.plots[0],
        tilled: true,
        crop: {
          cropId: 'carrot',
          plantedAtUtcMs: BASE_TIME,
          growthProgressSec: 42,
          mutation: 'none',
        },
        hydratedUntilUtcMs: BASE_TIME + 20_000,
      };
      const shortTimeResult = simulateOfflineProgression(envelope, BASE_TIME + 10_000);
      expect(shortTimeResult.summary.elapsedMs).toBe(10_000);
      expect(shortTimeResult.summary.totalMaturedCount).toBe(1);
      expect(shortTimeResult.summary.shouldDisplay).toBe(false); // < 30s

      // 3. Elapsed >= 30s with mature crop -> shouldDisplay = true
      const fullResult = simulateOfflineProgression(envelope, BASE_TIME + 35_000);
      expect(fullResult.summary.elapsedMs).toBe(35_000);
      expect(fullResult.summary.totalMaturedCount).toBe(1);
      expect(fullResult.summary.shouldDisplay).toBe(true);
    });
  });
});
