import { describe, it, expect, beforeEach } from 'vitest';
import { SeededRNG } from '../core/rng';
import type { PlotData, PlotId, WeatherState, WeatherType } from '../../state/storeTypes';
import {
  WEATHER_DURATION_MIN_SEC,
  WEATHER_DURATION_MAX_SEC,
  RAIN_HYDRATION_BUFFER_SEC,
  RAIN_HYDRATION_BUFFER_MS,
  WEATHER_TRANSITION_DURATION_SEC,
  WEATHER_CONFIGS,
  WEATHER_VISUAL_PRESETS,
} from './weatherDefinitions';
import {
  rollNextWeather,
  advanceWeather,
  applyWeatherHydration,
  getManualWaterDuration,
  createInitialWeatherState,
  getWeatherGrowthMultiplier,
  getWeatherMutationConfig,
} from './weatherSystem';

describe('Weather System', () => {
  let rng: SeededRNG;

  beforeEach(() => {
    rng = new SeededRNG(12345);
  });

  describe('Weather Definitions & Constants', () => {
    it('defines correct duration bounds [180s, 300s]', () => {
      expect(WEATHER_DURATION_MIN_SEC).toBe(180);
      expect(WEATHER_DURATION_MAX_SEC).toBe(300);
    });

    it('defines 20s rain hydration buffer and 2s transition duration', () => {
      expect(RAIN_HYDRATION_BUFFER_SEC).toBe(20);
      expect(RAIN_HYDRATION_BUFFER_MS).toBe(20000);
      expect(WEATHER_TRANSITION_DURATION_SEC).toBe(2);
    });

    it('has all 4 weather types with spec weights, multipliers, and mutation odds', () => {
      expect(WEATHER_CONFIGS.sunny).toMatchObject({
        id: 'sunny',
        weight: 45,
        growthMultiplier: 1.0,
        mutationType: 'gold',
        mutationChance: 0.05,
      });

      expect(WEATHER_CONFIGS.heavy_rain).toMatchObject({
        id: 'heavy_rain',
        weight: 30,
        growthMultiplier: 1.15,
        mutationType: 'giant',
        mutationChance: 0.08,
      });

      expect(WEATHER_CONFIGS.heatwave).toMatchObject({
        id: 'heatwave',
        weight: 15,
        growthMultiplier: 1.25,
        mutationType: 'gold',
        mutationChance: 0.08,
      });

      expect(WEATHER_CONFIGS.blood_moon).toMatchObject({
        id: 'blood_moon',
        weight: 10,
        growthMultiplier: 1.05,
        mutationType: 'cosmic',
        mutationChance: 0.03,
      });
    });

    it('defines visual presets for all weather states', () => {
      const weathers: WeatherType[] = ['sunny', 'heavy_rain', 'heatwave', 'blood_moon'];
      for (const w of weathers) {
        const preset = WEATHER_VISUAL_PRESETS[w];
        expect(preset).toBeDefined();
        expect(preset.skyColor).toBeDefined();
        expect(preset.dirLightColor).toBeDefined();
        expect(preset.dirLightIntensity).toBeGreaterThan(0);
        expect(preset.fogColor).toBeDefined();
      }
    });
  });

  describe('createInitialWeatherState', () => {
    it('creates initial Sunny weather with duration in [180s, 300s]', () => {
      const nowMs = 1_000_000;
      const state = createInitialWeatherState(nowMs, rng);

      expect(state.current).toBe('sunny');
      expect(state.previousWeather).toBeNull();
      expect(state.startedAtUtcMs).toBe(nowMs);
      const durationSec = (state.endsAtUtcMs - state.startedAtUtcMs) / 1000;
      expect(durationSec).toBeGreaterThanOrEqual(180);
      expect(durationSec).toBeLessThanOrEqual(300);
      expect(Number.isInteger(durationSec)).toBe(true);
    });

    it('uses a deterministic duration when rng is provided', () => {
      const state1 = createInitialWeatherState(1000, new SeededRNG(42));
      const state2 = createInitialWeatherState(1000, new SeededRNG(42));
      expect(state1).toEqual(state2);
    });
  });

  describe('rollNextWeather', () => {
    it('never rolls the current weather (strict non-repeat invariant)', () => {
      const weathers: WeatherType[] = ['sunny', 'heavy_rain', 'heatwave', 'blood_moon'];
      for (const current of weathers) {
        for (let i = 0; i < 200; i++) {
          const { nextWeather } = rollNextWeather(current, rng);
          expect(nextWeather).not.toBe(current);
        }
      }
    });

    it('always generates duration between 180 and 300 seconds inclusive', () => {
      let minObserved = Infinity;
      let maxObserved = -Infinity;

      for (let i = 0; i < 1000; i++) {
        const { durationSeconds } = rollNextWeather('sunny', rng);
        expect(durationSeconds).toBeGreaterThanOrEqual(180);
        expect(durationSeconds).toBeLessThanOrEqual(300);
        expect(Number.isInteger(durationSeconds)).toBe(true);

        minObserved = Math.min(minObserved, durationSeconds);
        maxObserved = Math.max(maxObserved, durationSeconds);
      }

      expect(minObserved).toBe(180);
      expect(maxObserved).toBe(300);
    });

    it('distributes next weather according to relative weights (statistical distribution)', () => {
      // If current is 'sunny' (weight 45 excluded):
      // heavy_rain: 30 / 55 ≈ 54.54%
      // heatwave: 15 / 55 ≈ 27.27%
      // blood_moon: 10 / 55 ≈ 18.18%
      const trials = 10000;
      const counts: Record<WeatherType, number> = {
        sunny: 0,
        heavy_rain: 0,
        heatwave: 0,
        blood_moon: 0,
      };

      const testRng = new SeededRNG(999);
      for (let i = 0; i < trials; i++) {
        const { nextWeather } = rollNextWeather('sunny', testRng);
        counts[nextWeather]++;
      }

      expect(counts.sunny).toBe(0);

      const heavyRainRatio = counts.heavy_rain / trials;
      const heatwaveRatio = counts.heatwave / trials;
      const bloodMoonRatio = counts.blood_moon / trials;

      expect(heavyRainRatio).toBeGreaterThan(0.51);
      expect(heavyRainRatio).toBeLessThan(0.58);

      expect(heatwaveRatio).toBeGreaterThan(0.24);
      expect(heatwaveRatio).toBeLessThan(0.31);

      expect(bloodMoonRatio).toBeGreaterThan(0.15);
      expect(bloodMoonRatio).toBeLessThan(0.22);
    });

    it('distributes correctly when current is heavy_rain', () => {
      // If current is 'heavy_rain' (weight 30 excluded):
      // sunny: 45 / 70 ≈ 64.28%
      // heatwave: 15 / 70 ≈ 21.43%
      // blood_moon: 10 / 70 ≈ 14.28%
      const trials = 10000;
      const counts: Record<WeatherType, number> = {
        sunny: 0,
        heavy_rain: 0,
        heatwave: 0,
        blood_moon: 0,
      };

      const testRng = new SeededRNG(777);
      for (let i = 0; i < trials; i++) {
        const { nextWeather } = rollNextWeather('heavy_rain', testRng);
        counts[nextWeather]++;
      }

      expect(counts.heavy_rain).toBe(0);

      const sunnyRatio = counts.sunny / trials;
      const heatwaveRatio = counts.heatwave / trials;
      const bloodMoonRatio = counts.blood_moon / trials;

      expect(sunnyRatio).toBeGreaterThan(0.61);
      expect(sunnyRatio).toBeLessThan(0.68);

      expect(heatwaveRatio).toBeGreaterThan(0.18);
      expect(heatwaveRatio).toBeLessThan(0.25);

      expect(bloodMoonRatio).toBeGreaterThan(0.11);
      expect(bloodMoonRatio).toBeLessThan(0.18);
    });
  });

  describe('advanceWeather', () => {
    it('does not transition if nowMs is before endsAtUtcMs', () => {
      const state: WeatherState = {
        current: 'sunny',
        startedAtUtcMs: 1000,
        endsAtUtcMs: 200_000,
        previousWeather: null,
      };

      const result = advanceWeather(state, 1, rng, 150_000);
      expect(result.transitioned).toBe(false);
      expect(result.state).toBe(state);
    });

    it('transitions to a new non-repeating weather when nowMs >= endsAtUtcMs', () => {
      const state: WeatherState = {
        current: 'sunny',
        startedAtUtcMs: 1000,
        endsAtUtcMs: 200_000,
        previousWeather: null,
      };

      const nowMs = 200_000;
      const result = advanceWeather(state, 1, rng, nowMs);

      expect(result.transitioned).toBe(true);
      expect(result.state.previousWeather).toBe('sunny');
      expect(result.state.current).not.toBe('sunny');
      expect(result.state.startedAtUtcMs).toBe(nowMs);
      expect(result.state.endsAtUtcMs).toBeGreaterThanOrEqual(nowMs + 180 * 1000);
      expect(result.state.endsAtUtcMs).toBeLessThanOrEqual(nowMs + 300 * 1000);
    });

    it('maintains non-repeat invariant over a 500-step simulation', () => {
      let state = createInitialWeatherState(0, rng);
      let simulatedTimeMs = 0;

      for (let i = 0; i < 500; i++) {
        // Step to the end of the weather
        simulatedTimeMs = state.endsAtUtcMs;
        const prevWeather = state.current;
        const result = advanceWeather(state, 1, rng, simulatedTimeMs);

        expect(result.transitioned).toBe(true);
        expect(result.state.current).not.toBe(prevWeather);
        expect(result.state.previousWeather).toBe(prevWeather);
        expect(result.state.endsAtUtcMs - result.state.startedAtUtcMs).toBeGreaterThanOrEqual(
          180_000
        );
        expect(result.state.endsAtUtcMs - result.state.startedAtUtcMs).toBeLessThanOrEqual(300_000);

        state = result.state;
      }
    });

    it('is completely deterministic with the same seed', () => {
      const runSimulation = (seed: number) => {
        const testRng = new SeededRNG(seed);
        let state = createInitialWeatherState(0, testRng);
        const history: string[] = [];
        let time = 0;

        for (let i = 0; i < 50; i++) {
          time = state.endsAtUtcMs;
          const res = advanceWeather(state, 1, testRng, time);
          history.push(`${res.state.current}-${res.state.endsAtUtcMs - res.state.startedAtUtcMs}`);
          state = res.state;
        }
        return history;
      };

      const historyA = runSimulation(42);
      const historyB = runSimulation(42);
      expect(historyA).toEqual(historyB);
    });
  });

  describe('applyWeatherHydration', () => {
    const createPlot = (id: PlotId, hydratedUntil: number): PlotData => ({
      id,
      x: 0,
      z: 0,
      crop: {
        cropId: 'carrot',
        plantedAtUtcMs: 0,
        growthProgressSec: 0,
        mutation: 'none',
      },
      hydratedUntilUtcMs: hydratedUntil,
    });

    it('extends hydration on all plots to weatherEndMs + 20s buffer during heavy_rain', () => {
      const nowMs = 100_000;
      const weatherEndMs = 280_000;
      const expectedHydration = weatherEndMs + 20_000; // 300_000

      const plots: Record<PlotId, PlotData> = {
        plot1: createPlot('plot1', 0), // dry plot
        plot2: createPlot('plot2', 150_000), // partially hydrated plot
        plot3: createPlot('plot3', 0), // dry plot
      };

      const updated = applyWeatherHydration(plots, 'heavy_rain', weatherEndMs, nowMs);

      expect(updated.plot1.hydratedUntilUtcMs).toBe(expectedHydration);
      expect(updated.plot2.hydratedUntilUtcMs).toBe(expectedHydration);
      expect(updated.plot3.hydratedUntilUtcMs).toBe(expectedHydration);
    });

    it('does not reduce existing hydration if already beyond the rain buffer', () => {
      const nowMs = 100_000;
      const weatherEndMs = 200_000;
      const farFutureHydration = 500_000;

      const plots: Record<PlotId, PlotData> = {
        plot1: createPlot('plot1', farFutureHydration),
      };

      const updated = applyWeatherHydration(plots, 'heavy_rain', weatherEndMs, nowMs);
      expect(updated.plot1.hydratedUntilUtcMs).toBe(farFutureHydration);
    });

    it('does not modify plot hydration if weather is not heavy_rain', () => {
      const nowMs = 100_000;
      const weatherEndMs = 280_000;

      const plots: Record<PlotId, PlotData> = {
        plot1: createPlot('plot1', 110_000),
        plot2: createPlot('plot2', 0),
      };

      const updatedSunny = applyWeatherHydration(plots, 'sunny', weatherEndMs, nowMs);
      expect(updatedSunny.plot1.hydratedUntilUtcMs).toBe(110_000);

      const updatedHeatwave = applyWeatherHydration(plots, 'heatwave', weatherEndMs, nowMs);
      expect(updatedHeatwave.plot1.hydratedUntilUtcMs).toBe(110_000);

      const updatedBloodMoon = applyWeatherHydration(plots, 'blood_moon', weatherEndMs, nowMs);
      expect(updatedBloodMoon.plot1.hydratedUntilUtcMs).toBe(110_000);
    });
  });

  describe('getManualWaterDuration', () => {
    it('returns 60 seconds for heatwave', () => {
      expect(getManualWaterDuration('heatwave')).toBe(60);
    });

    it('returns 120 seconds for sunny, heavy_rain, and blood_moon', () => {
      expect(getManualWaterDuration('sunny')).toBe(120);
      expect(getManualWaterDuration('heavy_rain')).toBe(120);
      expect(getManualWaterDuration('blood_moon')).toBe(120);
    });
  });

  describe('getWeatherGrowthMultiplier and getWeatherMutationConfig', () => {
    it('returns correct growth multiplier for each weather', () => {
      expect(getWeatherGrowthMultiplier('sunny')).toBe(1.0);
      expect(getWeatherGrowthMultiplier('heavy_rain')).toBe(1.15);
      expect(getWeatherGrowthMultiplier('heatwave')).toBe(1.25);
      expect(getWeatherGrowthMultiplier('blood_moon')).toBe(1.05);
    });

    it('returns correct mutation config for each weather', () => {
      expect(getWeatherMutationConfig('sunny')).toEqual({ mutationType: 'gold', chance: 0.05 });
      expect(getWeatherMutationConfig('heavy_rain')).toEqual({
        mutationType: 'giant',
        chance: 0.08,
      });
      expect(getWeatherMutationConfig('heatwave')).toEqual({ mutationType: 'gold', chance: 0.08 });
      expect(getWeatherMutationConfig('blood_moon')).toEqual({
        mutationType: 'cosmic',
        chance: 0.03,
      });
    });
  });
});
