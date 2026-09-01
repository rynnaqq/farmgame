import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SeededRNG } from '../core/rng';
import {
  MUTATION_MULTIPLIERS,
  type MutationType,
  type WeatherType,
  type PetType,
} from '../core/constants';
import {
  getMutationChance,
  rollMutation,
  advancePlotGrowth,
  tickFarmGrowth,
} from './growthSystem';
import {
  getMutationScale,
  getMutationMaterialProps,
  getCosmicMotePositions,
  calculateCosmicColor,
} from './cropMeshGenerators';
import {
  createCosmicShaderMaterial,
  createGoldShaderMaterial,
  updateCosmicShaderUniforms,
  updateGoldShaderUniforms,
  getGoldSparklePositions,
  COSMIC_SHADER_VERTEX,
  COSMIC_SHADER_FRAGMENT,
  GOLD_SHADER_VERTEX,
  GOLD_SHADER_FRAGMENT,
} from './mutationShaders';
import type { PlotData, PlotId } from '../../state/storeTypes';

describe('Task 22: Procedural Mutation Engine & Custom Shaders', () => {
  const baseTime = 1700000000000;

  const createMockPlot = (overrides?: Partial<PlotData>): PlotData => ({
    id: 'plot_0_0',
    row: 0,
    col: 0,
    tilled: true,
    crop: {
      cropId: 'carrot',
      plantedAtUtcMs: baseTime,
      growthProgressSec: 0,
      mutation: 'none',
    },
    hydratedUntilUtcMs: baseTime + 120000,
    ...overrides,
  });

  // ==========================================================================
  // 1. Mutation Odds & Weather Target Types
  // ==========================================================================
  describe('Weather Mutation Target and Base Odds', () => {
    it('Sunny gives 5% Gold mutation (x5 value)', () => {
      const result = getMutationChance('sunny', null);
      expect(result.mutationType).toBe('gold');
      expect(result.chance).toBeCloseTo(0.05, 5);
      expect(MUTATION_MULTIPLIERS[result.mutationType]).toBe(5);
    });

    it('Heavy Rain gives 8% Giant mutation (x3 value, 2x scale)', () => {
      const result = getMutationChance('heavy_rain', null);
      expect(result.mutationType).toBe('giant');
      expect(result.chance).toBeCloseTo(0.08, 5);
      expect(MUTATION_MULTIPLIERS[result.mutationType]).toBe(3);
      expect(getMutationScale(result.mutationType)).toBe(2.0);
    });

    it('Heatwave gives 8% Gold mutation (x5 value)', () => {
      const result = getMutationChance('heatwave', null);
      expect(result.mutationType).toBe('gold');
      expect(result.chance).toBeCloseTo(0.08, 5);
      expect(MUTATION_MULTIPLIERS[result.mutationType]).toBe(5);
    });

    it('Blood Moon gives 3% Cosmic mutation (x15 value, animated shader)', () => {
      const result = getMutationChance('blood_moon', null);
      expect(result.mutationType).toBe('cosmic');
      expect(result.chance).toBeCloseTo(0.03, 5);
      expect(MUTATION_MULTIPLIERS[result.mutationType]).toBe(15);
    });

    it('defaults gracefully to Sunny configuration for unrecognized weather', () => {
      const fallback = getMutationChance('invalid_weather' as WeatherType, null);
      expect(fallback.mutationType).toBe('gold');
      expect(fallback.chance).toBeCloseTo(0.05, 5);
    });
  });

  // ==========================================================================
  // 2. Pig Companion Perk (+20% Relative Modifier)
  // ==========================================================================
  describe('Pig Companion Perk (+20% Relative Chance)', () => {
    it('applies +20% relative bonus to Sunny: 5% -> 6%', () => {
      const result = getMutationChance('sunny', 'pig');
      expect(result.mutationType).toBe('gold');
      expect(result.chance).toBeCloseTo(0.05 * 1.2, 5); // 0.06
    });

    it('applies +20% relative bonus to Heavy Rain: 8% -> 9.6%', () => {
      const result = getMutationChance('heavy_rain', 'pig');
      expect(result.mutationType).toBe('giant');
      expect(result.chance).toBeCloseTo(0.08 * 1.2, 5); // 0.096
    });

    it('applies +20% relative bonus to Heatwave: 8% -> 9.6%', () => {
      const result = getMutationChance('heatwave', 'pig');
      expect(result.mutationType).toBe('gold');
      expect(result.chance).toBeCloseTo(0.08 * 1.2, 5); // 0.096
    });

    it('applies +20% relative bonus to Blood Moon: 3% -> 3.6%', () => {
      const result = getMutationChance('blood_moon', 'pig');
      expect(result.mutationType).toBe('cosmic');
      expect(result.chance).toBeCloseTo(0.03 * 1.2, 5); // 0.036
    });

    it('does not boost mutation chance for Bee, Dog, or null', () => {
      const pets: (PetType | null)[] = [null, 'dog', 'bee'];
      for (const pet of pets) {
        expect(getMutationChance('sunny', pet).chance).toBeCloseTo(0.05, 5);
        expect(getMutationChance('heavy_rain', pet).chance).toBeCloseTo(0.08, 5);
        expect(getMutationChance('heatwave', pet).chance).toBeCloseTo(0.08, 5);
        expect(getMutationChance('blood_moon', pet).chance).toBeCloseTo(0.03, 5);
      }
    });

    it('clamps final mutation chance within [0, 1]', () => {
      const result = getMutationChance('sunny', 'pig');
      expect(result.chance).toBeGreaterThanOrEqual(0);
      expect(result.chance).toBeLessThanOrEqual(1.0);
    });
  });

  // ==========================================================================
  // 3. Deterministic Seeded Outcomes & Single Roll Immutability
  // ==========================================================================
  describe('Deterministic Seeded Outcomes & Persistence', () => {
    it('consumes exactly 1 float from SeededRNG per roll', () => {
      const rng = new SeededRNG(42);
      const stateBefore = rng.getState();
      
      rollMutation('blood_moon', 'pig', rng);
      
      const expectedRng = new SeededRNG(42);
      expectedRng.nextFloat();
      expect(rng.getState()).toBe(expectedRng.getState());
      expect(rng.getState()).not.toBe(stateBefore);
    });

    it('reproduces exact identical mutation outcomes with identical RNG seed', () => {
      const seed = 987654321;
      const rng1 = new SeededRNG(seed);
      const rng2 = new SeededRNG(seed);

      const weathers: WeatherType[] = ['sunny', 'heavy_rain', 'heatwave', 'blood_moon'];
      const rolls1: MutationType[] = [];
      const rolls2: MutationType[] = [];

      for (let i = 0; i < 500; i++) {
        const w = weathers[i % weathers.length];
        const pet: PetType | null = i % 2 === 0 ? 'pig' : null;
        rolls1.push(rollMutation(w, pet, rng1));
        rolls2.push(rollMutation(w, pet, rng2));
      }

      expect(rolls1).toEqual(rolls2);
      expect(rolls1.filter((r) => r === 'gold').length).toBeGreaterThan(0);
      expect(rolls1.filter((r) => r === 'giant').length).toBeGreaterThan(0);
      expect(rolls1.filter((r) => r === 'cosmic').length).toBeGreaterThan(0);
    });

    it('rolls mutation exactly once at maturity and never rerolls on subsequent ticks', () => {
      const rng = new SeededRNG(1337);
      const maturingPlot = createMockPlot({
        crop: {
          cropId: 'carrot', // 45s
          plantedAtUtcMs: baseTime,
          growthProgressSec: 44,
          mutation: 'none',
        },
      });

      // Advance plot to 45s (mature)
      const res1 = advancePlotGrowth(maturingPlot, 2, 'sunny', 'pig', rng, baseTime);
      expect(res1.matured).toBe(true);
      const assignedMutation = res1.plot.crop?.mutation;
      expect(assignedMutation).toBeDefined();

      const rngStateAfterMaturity = rng.getState();

      // Subsequent tick on mature plot
      const res2 = advancePlotGrowth(res1.plot, 5, 'blood_moon', 'pig', rng, baseTime);
      expect(res2.matured).toBe(false);
      expect(res2.plot.crop?.mutation).toBe(assignedMutation);
      // RNG state should be untouched because rollMutation was not called
      expect(rng.getState()).toBe(rngStateAfterMaturity);

      // Third tick with different weather
      const res3 = advancePlotGrowth(res2.plot, 10, 'heavy_rain', null, rng, baseTime);
      expect(res3.plot.crop?.mutation).toBe(assignedMutation);
      expect(rng.getState()).toBe(rngStateAfterMaturity);
    });

    it('processes multi-plot farm tick with sorted deterministic RNG consumption', () => {
      const plots: Record<PlotId, PlotData> = {
        plot_1_1: createMockPlot({
          id: 'plot_1_1',
          crop: { cropId: 'carrot', plantedAtUtcMs: baseTime, growthProgressSec: 44, mutation: 'none' },
        }),
        plot_0_0: createMockPlot({
          id: 'plot_0_0',
          crop: { cropId: 'carrot', plantedAtUtcMs: baseTime, growthProgressSec: 44, mutation: 'none' },
        }),
        plot_0_1: createMockPlot({
          id: 'plot_0_1',
          crop: { cropId: 'carrot', plantedAtUtcMs: baseTime, growthProgressSec: 44, mutation: 'none' },
        }),
      };

      const rngA = new SeededRNG(8888);
      const rngB = new SeededRNG(8888);

      const resultA = tickFarmGrowth(plots, 2, 'heavy_rain', 'pig', rngA, baseTime);
      const resultB = tickFarmGrowth(plots, 2, 'heavy_rain', 'pig', rngB, baseTime);

      expect(resultA.maturedPlots.map((m) => m.plotId)).toEqual(['plot_0_0', 'plot_0_1', 'plot_1_1']);
      expect(resultA.maturedPlots).toEqual(resultB.maturedPlots);
      expect(resultA.updatedPlots).toEqual(resultB.updatedPlots);
      expect(rngA.getState()).toBe(rngB.getState());
    });
  });

  // ==========================================================================
  // 4. Statistical Accuracy Over 10,000 Trials (Monte Carlo Validation)
  // ==========================================================================
  describe('Statistical Accuracy Over 10,000 Trials (Monte Carlo)', () => {
    const TRIALS = 10000;

    const runMonteCarlo = (
      weather: WeatherType,
      pet: PetType | null,
      targetMutation: MutationType,
      seed: number
    ): number => {
      const rng = new SeededRNG(seed);
      let successCount = 0;

      for (let i = 0; i < TRIALS; i++) {
        const mutation = rollMutation(weather, pet, rng);
        if (mutation === targetMutation) {
          successCount++;
        }
      }

      return successCount / TRIALS;
    };

    it('matches Sunny 5% Gold probability within 3-sigma tolerance over 10,000 trials', () => {
      const p = 0.05;
      const sigma = Math.sqrt((p * (1 - p)) / TRIALS); // ~0.00218
      const measured = runMonteCarlo('sunny', null, 'gold', 101);
      
      // 3-sigma tolerance: p ± 3.5*sigma (~0.042 - 0.058)
      expect(measured).toBeGreaterThanOrEqual(p - 3.5 * sigma);
      expect(measured).toBeLessThanOrEqual(p + 3.5 * sigma);
    });

    it('matches Sunny + Pig 6% Gold probability within 3-sigma tolerance over 10,000 trials', () => {
      const p = 0.06;
      const sigma = Math.sqrt((p * (1 - p)) / TRIALS); // ~0.00237
      const measured = runMonteCarlo('sunny', 'pig', 'gold', 102);

      expect(measured).toBeGreaterThanOrEqual(p - 3.5 * sigma);
      expect(measured).toBeLessThanOrEqual(p + 3.5 * sigma);
    });

    it('matches Heavy Rain 8% Giant probability within 3-sigma tolerance over 10,000 trials', () => {
      const p = 0.08;
      const sigma = Math.sqrt((p * (1 - p)) / TRIALS); // ~0.00271
      const measured = runMonteCarlo('heavy_rain', null, 'giant', 103);

      expect(measured).toBeGreaterThanOrEqual(p - 3.5 * sigma);
      expect(measured).toBeLessThanOrEqual(p + 3.5 * sigma);
    });

    it('matches Heavy Rain + Pig 9.6% Giant probability within 3-sigma tolerance over 10,000 trials', () => {
      const p = 0.096;
      const sigma = Math.sqrt((p * (1 - p)) / TRIALS); // ~0.00295
      const measured = runMonteCarlo('heavy_rain', 'pig', 'giant', 104);

      expect(measured).toBeGreaterThanOrEqual(p - 3.5 * sigma);
      expect(measured).toBeLessThanOrEqual(p + 3.5 * sigma);
    });

    it('matches Heatwave 8% Gold probability within 3-sigma tolerance over 10,000 trials', () => {
      const p = 0.08;
      const sigma = Math.sqrt((p * (1 - p)) / TRIALS);
      const measured = runMonteCarlo('heatwave', null, 'gold', 105);

      expect(measured).toBeGreaterThanOrEqual(p - 3.5 * sigma);
      expect(measured).toBeLessThanOrEqual(p + 3.5 * sigma);
    });

    it('matches Heatwave + Pig 9.6% Gold probability within 3-sigma tolerance over 10,000 trials', () => {
      const p = 0.096;
      const sigma = Math.sqrt((p * (1 - p)) / TRIALS);
      const measured = runMonteCarlo('heatwave', 'pig', 'gold', 106);

      expect(measured).toBeGreaterThanOrEqual(p - 3.5 * sigma);
      expect(measured).toBeLessThanOrEqual(p + 3.5 * sigma);
    });

    it('matches Blood Moon 3% Cosmic probability within 3-sigma tolerance over 10,000 trials', () => {
      const p = 0.03;
      const sigma = Math.sqrt((p * (1 - p)) / TRIALS); // ~0.00171
      const measured = runMonteCarlo('blood_moon', null, 'cosmic', 107);

      expect(measured).toBeGreaterThanOrEqual(p - 3.5 * sigma);
      expect(measured).toBeLessThanOrEqual(p + 3.5 * sigma);
    });

    it('matches Blood Moon + Pig 3.6% Cosmic probability within 3-sigma tolerance over 10,000 trials', () => {
      const p = 0.036;
      const sigma = Math.sqrt((p * (1 - p)) / TRIALS); // ~0.00186
      const measured = runMonteCarlo('blood_moon', 'pig', 'cosmic', 108);

      expect(measured).toBeGreaterThanOrEqual(p - 3.5 * sigma);
      expect(measured).toBeLessThanOrEqual(p + 3.5 * sigma);
    });
  });

  // ==========================================================================
  // 5. Value Multipliers & Scale Multipliers Validation
  // ==========================================================================
  describe('Value Multipliers and Scale Multipliers', () => {
    it('assigns correct economy value multipliers per mutation type', () => {
      expect(MUTATION_MULTIPLIERS.none).toBe(1);
      expect(MUTATION_MULTIPLIERS.gold).toBe(5);
      expect(MUTATION_MULTIPLIERS.giant).toBe(3);
      expect(MUTATION_MULTIPLIERS.cosmic).toBe(15);
    });

    it('assigns 2.0x scale to Giant and 1.0x to all others', () => {
      expect(getMutationScale('giant')).toBe(2.0);
      expect(getMutationScale('none')).toBe(1.0);
      expect(getMutationScale('gold')).toBe(1.0);
      expect(getMutationScale('cosmic')).toBe(1.0);
    });

    it('provides high-metalness material properties for gold and emissive properties for cosmic', () => {
      const goldMat = getMutationMaterialProps('gold', '#4CAF50');
      expect(goldMat.metalness).toBe(0.85);
      expect(goldMat.roughness).toBe(0.25);
      expect(goldMat.isGold).toBe(true);

      const cosmicMat = getMutationMaterialProps('cosmic', '#4CAF50');
      expect(cosmicMat.isCosmic).toBe(true);
      expect(cosmicMat.emissive).toBeDefined();
    });
  });

  // ==========================================================================
  // 6. Procedural GLSL Shaders & Material Uniforms
  // ==========================================================================
  describe('Procedural GLSL Shaders & Uniform Management', () => {
    describe('Cosmic Procedural Shader Material', () => {
      it('creates THREE.ShaderMaterial with all required uniforms', () => {
        const material = createCosmicShaderMaterial();
        expect(material).toBeInstanceOf(THREE.ShaderMaterial);
        expect(material.uniforms.uTime).toBeDefined();
        expect(material.uniforms.uTime.value).toBe(0);
        expect(material.uniforms.uBaseColor).toBeDefined();
        expect(material.uniforms.uGlowColor).toBeDefined();
        expect(material.uniforms.uSwirlSpeed).toBeDefined();
        expect(material.uniforms.uPulseSpeed).toBeDefined();
        expect(material.uniforms.uOpacity).toBeDefined();
        expect(material.transparent).toBe(true);
      });

      it('defines valid vertex and fragment shader GLSL strings with cosmic calculations', () => {
        expect(COSMIC_SHADER_VERTEX).toContain('varying vec2 vUv;');
        expect(COSMIC_SHADER_VERTEX).toContain('varying vec3 vNormal;');
        expect(COSMIC_SHADER_VERTEX).toContain('varying vec3 vPosition;');
        expect(COSMIC_SHADER_FRAGMENT).toContain('uniform float uTime;');
        expect(COSMIC_SHADER_FRAGMENT).toContain('uniform vec3 uBaseColor;');
        expect(COSMIC_SHADER_FRAGMENT).toContain('uniform vec3 uGlowColor;');
        expect(COSMIC_SHADER_FRAGMENT).toContain('gl_FragColor');
      });

      it('progresses uTime uniform smoothly when updated', () => {
        const material = createCosmicShaderMaterial();
        expect(material.uniforms.uTime.value).toBe(0);

        updateCosmicShaderUniforms(material, 1.25);
        expect(material.uniforms.uTime.value).toBeCloseTo(1.25, 5);

        updateCosmicShaderUniforms(material, 3.5);
        expect(material.uniforms.uTime.value).toBeCloseTo(3.5, 5);
      });
    });

    describe('Gold Procedural Shader Material', () => {
      it('creates THREE.ShaderMaterial for Gold with metallic shimmer uniforms', () => {
        const material = createGoldShaderMaterial();
        expect(material).toBeInstanceOf(THREE.ShaderMaterial);
        expect(material.uniforms.uTime).toBeDefined();
        expect(material.uniforms.uGoldColor).toBeDefined();
        expect(material.uniforms.uAuraColor).toBeDefined();
        expect(material.uniforms.uPulseSpeed).toBeDefined();
        expect(material.uniforms.uShimmerIntensity).toBeDefined();
      });

      it('defines valid vertex and fragment GLSL strings for gold metallic shimmer', () => {
        expect(GOLD_SHADER_VERTEX).toContain('varying vec3 vNormal;');
        expect(GOLD_SHADER_FRAGMENT).toContain('uniform float uTime;');
        expect(GOLD_SHADER_FRAGMENT).toContain('uniform vec3 uGoldColor;');
        expect(GOLD_SHADER_FRAGMENT).toContain('gl_FragColor');
      });

      it('progresses uTime uniform for gold shader material smoothly', () => {
        const material = createGoldShaderMaterial();
        updateGoldShaderUniforms(material, 2.4);
        expect(material.uniforms.uTime.value).toBeCloseTo(2.4, 5);
      });
    });

    describe('Star Motes & Gold Sparkle Particles', () => {
      it('generates 8 orbiting star motes that rotate with elapsed time', () => {
        const motes0 = getCosmicMotePositions(0);
        const motes1 = getCosmicMotePositions(1.0);
        expect(motes0.length).toBe(8);
        expect(motes1.length).toBe(8);

        // Verify rotation along orbital path
        expect(motes0[0].position[0]).not.toBeCloseTo(motes1[0].position[0], 3);
        expect(motes0[0].position[2]).not.toBeCloseTo(motes1[0].position[2], 3);
      });

      it('generates deterministic gold sparkle motes with vertical drift and twinkling', () => {
        const sparkles0 = getGoldSparklePositions(0);
        const sparkles1 = getGoldSparklePositions(2.0);
        expect(sparkles0.length).toBeGreaterThanOrEqual(6);
        expect(sparkles1.length).toBe(sparkles0.length);

        for (const sparkle of sparkles0) {
          expect(sparkle.position.length).toBe(3);
          expect(sparkle.size).toBeGreaterThan(0);
          expect(sparkle.opacity).toBeGreaterThanOrEqual(0);
          expect(sparkle.opacity).toBeLessThanOrEqual(1.0);
          expect(sparkle.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        }

        // Sparkle vertical positions and opacities animate over time
        expect(sparkles0[0].position[1]).not.toBeCloseTo(sparkles1[0].position[1], 4);
      });

      it('cycles cosmic iridescent color palette dynamically', () => {
        const c1 = calculateCosmicColor(0);
        const c2 = calculateCosmicColor(Math.PI);
        expect(c1).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(c2).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(c1).not.toBe(c2);
      });
    });
  });
});
