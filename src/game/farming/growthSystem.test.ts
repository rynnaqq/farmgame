import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../core/rng';
import type { PlotData, PlotId, WeatherType } from '../../state/storeTypes';
import {
  getWeatherGrowthMultiplier,
  getPetGrowthMultiplier,
  getEffectiveGrowthMultiplier,
  isPlotHydratedForGrowth,
  getMutationChance,
  rollMutation,
  advancePlotGrowth,
  tickFarmGrowth,
} from './growthSystem';

describe('Task 12: Growth Simulation System', () => {
  const baseTime = 1700000000000;

  const createMockPlot = (overrides?: Partial<PlotData>): PlotData => ({
    id: 'plot_0_0',
    row: 0,
    col: 0,
    tilled: true,
    crop: {
      cropId: 'carrot', // 45s base growth
      plantedAtUtcMs: baseTime,
      growthProgressSec: 0,
      mutation: 'none',
    },
    hydratedUntilUtcMs: baseTime + 120000,
    ...overrides,
  });

  describe('Multiplicative Growth Multipliers', () => {
    it('returns correct weather growth multipliers', () => {
      expect(getWeatherGrowthMultiplier('sunny')).toBe(1.0);
      expect(getWeatherGrowthMultiplier('heavy_rain')).toBe(1.15);
      expect(getWeatherGrowthMultiplier('heatwave')).toBe(1.25);
      expect(getWeatherGrowthMultiplier('blood_moon')).toBe(1.05);
    });

    it('returns correct pet growth multipliers', () => {
      expect(getPetGrowthMultiplier('bee')).toBe(1.15);
      expect(getPetGrowthMultiplier('dog')).toBe(1.0);
      expect(getPetGrowthMultiplier('pig')).toBe(1.0);
      expect(getPetGrowthMultiplier(null)).toBe(1.0);
    });

    it('computes effective growth multiplier as weatherGrowthMultiplier * petGrowthMultiplier', () => {
      // Sunny (1.0)
      expect(getEffectiveGrowthMultiplier('sunny', null)).toBeCloseTo(1.0, 5);
      expect(getEffectiveGrowthMultiplier('sunny', 'bee')).toBeCloseTo(1.15, 5);
      expect(getEffectiveGrowthMultiplier('sunny', 'dog')).toBeCloseTo(1.0, 5);

      // Heavy Rain (1.15)
      expect(getEffectiveGrowthMultiplier('heavy_rain', null)).toBeCloseTo(1.15, 5);
      expect(getEffectiveGrowthMultiplier('heavy_rain', 'bee')).toBeCloseTo(1.15 * 1.15, 5); // 1.3225

      // Heatwave (1.25)
      expect(getEffectiveGrowthMultiplier('heatwave', null)).toBeCloseTo(1.25, 5);
      expect(getEffectiveGrowthMultiplier('heatwave', 'bee')).toBeCloseTo(1.25 * 1.15, 5); // 1.4375

      // Blood Moon (1.05)
      expect(getEffectiveGrowthMultiplier('blood_moon', null)).toBeCloseTo(1.05, 5);
      expect(getEffectiveGrowthMultiplier('blood_moon', 'bee')).toBeCloseTo(1.05 * 1.15, 5); // 1.2075
    });
  });

  describe('Hydration During Growth', () => {
    it('considers tilled plot hydrated when hydratedUntilUtcMs > nowMs in sunny weather', () => {
      const plot = createMockPlot({ tilled: true, hydratedUntilUtcMs: baseTime + 10000 });
      expect(isPlotHydratedForGrowth(plot, 'sunny', baseTime)).toBe(true);
    });

    it('considers tilled plot not hydrated when hydratedUntilUtcMs <= nowMs in sunny weather', () => {
      const plotExpired = createMockPlot({ tilled: true, hydratedUntilUtcMs: baseTime - 1000 });
      const plotEqual = createMockPlot({ tilled: true, hydratedUntilUtcMs: baseTime });
      expect(isPlotHydratedForGrowth(plotExpired, 'sunny', baseTime)).toBe(false);
      expect(isPlotHydratedForGrowth(plotEqual, 'sunny', baseTime)).toBe(false);
    });

    it('considers all tilled plots hydrated during heavy_rain even if hydratedUntilUtcMs is in the past', () => {
      const dryPlot = createMockPlot({ tilled: true, hydratedUntilUtcMs: 0 });
      expect(isPlotHydratedForGrowth(dryPlot, 'heavy_rain', baseTime)).toBe(true);
    });

    it('considers untilled plots never hydrated even in heavy_rain', () => {
      const untilledPlot = createMockPlot({ tilled: false, hydratedUntilUtcMs: baseTime + 60000 });
      expect(isPlotHydratedForGrowth(untilledPlot, 'heavy_rain', baseTime)).toBe(false);
      expect(isPlotHydratedForGrowth(untilledPlot, 'sunny', baseTime)).toBe(false);
    });

    it('does not advance growth on dry plots in sunny or heatwave weather', () => {
      const rng = new SeededRNG(42);
      const dryPlot = createMockPlot({
        hydratedUntilUtcMs: baseTime - 5000,
        crop: {
          cropId: 'carrot',
          plantedAtUtcMs: baseTime,
          growthProgressSec: 10,
          mutation: 'none',
        },
      });

      const resultSunny = advancePlotGrowth(dryPlot, 5, 'sunny', null, rng, baseTime);
      expect(resultSunny.plot.crop?.growthProgressSec).toBe(10);
      expect(resultSunny.matured).toBe(false);

      const resultHeatwave = advancePlotGrowth(dryPlot, 5, 'heatwave', null, rng, baseTime);
      expect(resultHeatwave.plot.crop?.growthProgressSec).toBe(10);
      expect(resultHeatwave.matured).toBe(false);
    });

    it('advances growth on dry tilled plots when weather is heavy_rain', () => {
      const rng = new SeededRNG(42);
      const dryPlot = createMockPlot({
        tilled: true,
        hydratedUntilUtcMs: baseTime - 5000,
        crop: {
          cropId: 'carrot',
          plantedAtUtcMs: baseTime,
          growthProgressSec: 10,
          mutation: 'none',
        },
      });

      const result = advancePlotGrowth(dryPlot, 10, 'heavy_rain', null, rng, baseTime);
      // 10s * 1.15 = 11.5s added -> 21.5s
      expect(result.plot.crop?.growthProgressSec).toBeCloseTo(21.5, 5);
      expect(result.matured).toBe(false);
    });
  });

  describe('Mutation Odds and Pig Perk Modifier', () => {
    it('returns correct base mutation chances per weather without Pig', () => {
      // Sunny: 5% Gold
      const sunny = getMutationChance('sunny', null);
      expect(sunny.mutationType).toBe('gold');
      expect(sunny.chance).toBeCloseTo(0.05, 5);

      // Heavy Rain: 8% Giant
      const rain = getMutationChance('heavy_rain', null);
      expect(rain.mutationType).toBe('giant');
      expect(rain.chance).toBeCloseTo(0.08, 5);

      // Heatwave: 8% Gold
      const heatwave = getMutationChance('heatwave', null);
      expect(heatwave.mutationType).toBe('gold');
      expect(heatwave.chance).toBeCloseTo(0.08, 5);

      // Blood Moon: 3% Cosmic
      const bloodMoon = getMutationChance('blood_moon', null);
      expect(bloodMoon.mutationType).toBe('cosmic');
      expect(bloodMoon.chance).toBeCloseTo(0.03, 5);
    });

    it('applies +20% relative mutation chance when Pig is equipped', () => {
      // Sunny: 5% * 1.2 = 6% Gold
      const sunny = getMutationChance('sunny', 'pig');
      expect(sunny.mutationType).toBe('gold');
      expect(sunny.chance).toBeCloseTo(0.06, 5);

      // Heavy Rain: 8% * 1.2 = 9.6% Giant
      const rain = getMutationChance('heavy_rain', 'pig');
      expect(rain.mutationType).toBe('giant');
      expect(rain.chance).toBeCloseTo(0.096, 5);

      // Heatwave: 8% * 1.2 = 9.6% Gold
      const heatwave = getMutationChance('heatwave', 'pig');
      expect(heatwave.mutationType).toBe('gold');
      expect(heatwave.chance).toBeCloseTo(0.096, 5);

      // Blood Moon: 3% * 1.2 = 3.6% Cosmic
      const bloodMoon = getMutationChance('blood_moon', 'pig');
      expect(bloodMoon.mutationType).toBe('cosmic');
      expect(bloodMoon.chance).toBeCloseTo(0.036, 5);
    });

    it('does not boost mutation chance for Bee or Dog', () => {
      expect(getMutationChance('sunny', 'bee').chance).toBeCloseTo(0.05, 5);
      expect(getMutationChance('sunny', 'dog').chance).toBeCloseTo(0.05, 5);
    });

    it('rollMutation consumes exactly one float from RNG', () => {
      const rng = new SeededRNG(999);
      
      // Call rollMutation
      rollMutation('sunny', null, rng);

      // Compare with single nextFloat() call from identical initial seed
      const checkRng = new SeededRNG(999);
      checkRng.nextFloat();
      expect(rng.getState()).toBe(checkRng.getState());
    });

    it('rollMutation rolls success when nextFloat is below chance threshold', () => {
      // Mock RNG where nextFloat returns controlled values
      const mockRngSuccess = {
        nextFloat: () => 0.04, // 0.04 < 0.05 (sunny chance)
      } as SeededRNG;
      expect(rollMutation('sunny', null, mockRngSuccess)).toBe('gold');

      const mockRngFail = {
        nextFloat: () => 0.06, // 0.06 >= 0.05
      } as SeededRNG;
      expect(rollMutation('sunny', null, mockRngFail)).toBe('none');
    });

    it('rollMutation with Pig enables mutation for rolls in the boosted margin', () => {
      // 0.055 is >= 0.05 (fails without pig), but < 0.06 (succeeds with pig)
      const mockRng = {
        nextFloat: () => 0.055,
      } as SeededRNG;
      expect(rollMutation('sunny', null, mockRng)).toBe('none');
      expect(rollMutation('sunny', 'pig', mockRng)).toBe('gold');
    });
  });

  describe('advancePlotGrowth() - Single Plot Growth Simulation', () => {
    it('advances growth progress by effective delta seconds', () => {
      const rng = new SeededRNG(1);
      const plot = createMockPlot({
        crop: {
          cropId: 'carrot',
          plantedAtUtcMs: baseTime,
          growthProgressSec: 10,
          mutation: 'none',
        },
      });

      // Sunny (1.0) + Bee (1.15) for 10 seconds -> +11.5s
      const result = advancePlotGrowth(plot, 10, 'sunny', 'bee', rng, baseTime);
      expect(result.plot.crop?.growthProgressSec).toBeCloseTo(21.5, 5);
      expect(result.matured).toBe(false);
      expect(result.plot.crop?.mutation).toBe('none');
    });

    it('triggers maturity exactly once when progress reaches baseGrowthSec', () => {
      // Carrot requires 45s
      const rng = new SeededRNG(12345);
      const plot = createMockPlot({
        crop: {
          cropId: 'carrot',
          plantedAtUtcMs: baseTime,
          growthProgressSec: 40,
          mutation: 'none',
        },
      });

      // Advance by 10s -> total 50s, clamped to 45s
      const result = advancePlotGrowth(plot, 10, 'sunny', null, rng, baseTime);
      expect(result.plot.crop?.growthProgressSec).toBe(45);
      expect(result.matured).toBe(true);

      // Verify that another tick on the mature crop does NOT re-trigger maturity
      const stateBeforeSecondTick = rng.getState();
      const secondResult = advancePlotGrowth(result.plot, 10, 'sunny', null, rng, baseTime);
      expect(secondResult.plot.crop?.growthProgressSec).toBe(45);
      expect(secondResult.matured).toBe(false);
      // RNG state should not have changed because rollMutation was not called
      expect(rng.getState()).toBe(stateBeforeSecondTick);
      // Mutation is preserved
      expect(secondResult.plot.crop?.mutation).toBe(result.plot.crop?.mutation);
    });

    it('clamps progress exactly at baseGrowthSec and does not overshoot', () => {
      const rng = new SeededRNG(1);
      const plot = createMockPlot({
        crop: {
          cropId: 'tomato', // 90s base growth
          plantedAtUtcMs: baseTime,
          growthProgressSec: 85,
          mutation: 'none',
        },
      });

      // Advance by 100 seconds
      const result = advancePlotGrowth(plot, 100, 'sunny', null, rng, baseTime);
      expect(result.plot.crop?.growthProgressSec).toBe(90);
      expect(result.matured).toBe(true);
    });

    it('returns unmodified plot and matured=false for empty or untilled plots', () => {
      const rng = new SeededRNG(1);
      const emptyPlot = createMockPlot({ crop: null });
      expect(advancePlotGrowth(emptyPlot, 10, 'sunny', null, rng, baseTime)).toEqual({
        plot: emptyPlot,
        matured: false,
      });

      const untilledPlot = createMockPlot({ tilled: false, crop: null });
      expect(advancePlotGrowth(untilledPlot, 10, 'sunny', null, rng, baseTime)).toEqual({
        plot: untilledPlot,
        matured: false,
      });
    });

    it('returns unmodified plot if deltaSeconds <= 0', () => {
      const rng = new SeededRNG(1);
      const plot = createMockPlot();
      expect(advancePlotGrowth(plot, 0, 'sunny', null, rng, baseTime)).toEqual({
        plot,
        matured: false,
      });
      expect(advancePlotGrowth(plot, -5, 'sunny', null, rng, baseTime)).toEqual({
        plot,
        matured: false,
      });
    });

    it('does not mutate original plot object (immutability)', () => {
      const rng = new SeededRNG(1);
      const plot = createMockPlot({
        crop: {
          cropId: 'pumpkin',
          plantedAtUtcMs: baseTime,
          growthProgressSec: 50,
          mutation: 'none',
        },
      });

      const result = advancePlotGrowth(plot, 10, 'sunny', null, rng, baseTime);
      expect(plot.crop?.growthProgressSec).toBe(50);
      expect(result.plot.crop?.growthProgressSec).toBe(60);
      expect(result.plot).not.toBe(plot);
    });
  });

  describe('tickFarmGrowth() - Batch Farm Growth Processor', () => {
    it('advances all growing plots deterministically and collects matured plots', () => {
      const rng = new SeededRNG(42);

      const plots: Record<PlotId, PlotData> = {
        plot_0_0: createMockPlot({
          id: 'plot_0_0',
          crop: {
            cropId: 'carrot', // 45s
            plantedAtUtcMs: baseTime,
            growthProgressSec: 40,
            mutation: 'none',
          },
        }),
        plot_0_1: createMockPlot({
          id: 'plot_0_1',
          crop: {
            cropId: 'tomato', // 90s
            plantedAtUtcMs: baseTime,
            growthProgressSec: 20,
            mutation: 'none',
          },
        }),
        plot_0_2: createMockPlot({
          id: 'plot_0_2',
          crop: null, // Empty plot
        }),
        plot_0_3: createMockPlot({
          id: 'plot_0_3',
          hydratedUntilUtcMs: baseTime - 1000, // Dry plot
          crop: {
            cropId: 'pumpkin',
            plantedAtUtcMs: baseTime,
            growthProgressSec: 30,
            mutation: 'none',
          },
        }),
      };

      // 10s tick under sunny weather, no pet
      const { updatedPlots, maturedPlots } = tickFarmGrowth(
        plots,
        10,
        'sunny',
        null,
        rng,
        baseTime
      );

      // plot_0_0: 40 + 10 = 50 -> clamped to 45 (matured)
      expect(updatedPlots.plot_0_0.crop?.growthProgressSec).toBe(45);
      expect(maturedPlots).toHaveLength(1);
      expect(maturedPlots[0].plotId).toBe('plot_0_0');
      expect(maturedPlots[0].cropId).toBe('carrot');

      // plot_0_1: 20 + 10 = 30
      expect(updatedPlots.plot_0_1.crop?.growthProgressSec).toBe(30);

      // plot_0_2: empty
      expect(updatedPlots.plot_0_2.crop).toBeNull();

      // plot_0_3: dry, unadvanced
      expect(updatedPlots.plot_0_3.crop?.growthProgressSec).toBe(30);
    });

    it('handles multiple crops maturing in the same tick deterministically', () => {
      const rng1 = new SeededRNG(777);
      const rng2 = new SeededRNG(777);

      const makePlots = (): Record<PlotId, PlotData> => ({
        plot_0_0: createMockPlot({
          id: 'plot_0_0',
          crop: { cropId: 'carrot', plantedAtUtcMs: baseTime, growthProgressSec: 44, mutation: 'none' },
        }),
        plot_0_1: createMockPlot({
          id: 'plot_0_1',
          crop: { cropId: 'carrot', plantedAtUtcMs: baseTime, growthProgressSec: 44, mutation: 'none' },
        }),
      });

      const res1 = tickFarmGrowth(makePlots(), 2, 'sunny', 'pig', rng1, baseTime);
      const res2 = tickFarmGrowth(makePlots(), 2, 'sunny', 'pig', rng2, baseTime);

      expect(res1.maturedPlots).toHaveLength(2);
      expect(res2.maturedPlots).toHaveLength(2);
      expect(res1.maturedPlots).toEqual(res2.maturedPlots);
      expect(res1.updatedPlots.plot_0_0.crop?.mutation).toBe(res2.updatedPlots.plot_0_0.crop?.mutation);
      expect(res1.updatedPlots.plot_0_1.crop?.mutation).toBe(res2.updatedPlots.plot_0_1.crop?.mutation);
    });

    it('returns empty maturedPlots when no crops mature during tick', () => {
      const rng = new SeededRNG(1);
      const plots: Record<PlotId, PlotData> = {
        plot_0_0: createMockPlot({
          id: 'plot_0_0',
          crop: { cropId: 'pumpkin', plantedAtUtcMs: baseTime, growthProgressSec: 10, mutation: 'none' },
        }),
      };

      const result = tickFarmGrowth(plots, 5, 'sunny', null, rng, baseTime);
      expect(result.maturedPlots).toEqual([]);
      expect(result.updatedPlots.plot_0_0.crop?.growthProgressSec).toBe(15);
    });
  });

  describe('Deterministic Mutation Fixtures with SeededRNG', () => {
    it('produces identical mutation sequence across seeded runs', () => {
      const seed = 54321;

      const runSequence = (rngSeed: number) => {
        const rng = new SeededRNG(rngSeed);
        const results: string[] = [];
        const weathers: WeatherType[] = ['sunny', 'heavy_rain', 'heatwave', 'blood_moon'];

        for (let i = 0; i < 50; i++) {
          const w = weathers[i % weathers.length];
          const mut = rollMutation(w, i % 2 === 0 ? 'pig' : null, rng);
          results.push(`${w}:${mut}`);
        }
        return results;
      };

      const runA = runSequence(seed);
      const runB = runSequence(seed);
      expect(runA).toEqual(runB);
      expect(runA.some((r) => r.includes('gold') || r.includes('giant') || r.includes('cosmic'))).toBe(true);
    });
  });
});
