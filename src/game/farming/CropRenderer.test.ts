import { describe, it, expect } from 'vitest';
import {
  getCropStage,
  getCropProgressRatio,
  getGrowthScale,
  CROP_EMERGE_RATIO,
  getMutationScale,
  getMutationMaterialProps,
  calculateStageTransition,
  CROP_STAGE_CATALOG,
  type CropStage,
  type MutationMaterialProps,
} from './cropMeshGenerators';
import {
  CROPS,
  STAGE_TRANSITION_EASE_DURATION_MS,
  STAGE_TRANSITION_REDUCED_MOTION_MS,
  type CropId,
  type MutationType,
} from '../core/constants';
import { getCosmicMotePositions, calculateCosmicColor } from './cropMeshGenerators';

describe('CropRenderer & Procedural Mesh Systems', () => {
  const allCrops: CropId[] = ['carrot', 'tomato', 'pumpkin', 'golden_berry', 'starfruit'];
  const allStages: CropStage[] = ['sprout', 'mid', 'grown'];
  const allMutations: MutationType[] = ['none', 'gold', 'giant', 'cosmic'];

  describe('Stage Resolution (getCropStage)', () => {
    it('resolves sprout stage for progress < 33%', () => {
      for (const cropId of allCrops) {
        const baseGrowth = CROPS[cropId].baseGrowthSec;
        expect(getCropStage(0, baseGrowth)).toBe('sprout');
        expect(getCropStage(baseGrowth * 0.1, baseGrowth)).toBe('sprout');
        expect(getCropStage(baseGrowth * 0.3299, baseGrowth)).toBe('sprout');
      }
    });

    it('resolves mid stage for progress >= 33% and < 75%', () => {
      for (const cropId of allCrops) {
        const baseGrowth = CROPS[cropId].baseGrowthSec;
        expect(getCropStage(baseGrowth * 0.33, baseGrowth)).toBe('mid');
        expect(getCropStage(baseGrowth * 0.5, baseGrowth)).toBe('mid');
        expect(getCropStage(baseGrowth * 0.7499, baseGrowth)).toBe('mid');
      }
    });

    it('resolves grown stage for progress >= 75%', () => {
      for (const cropId of allCrops) {
        const baseGrowth = CROPS[cropId].baseGrowthSec;
        expect(getCropStage(baseGrowth * 0.75, baseGrowth)).toBe('grown');
        expect(getCropStage(baseGrowth * 0.9, baseGrowth)).toBe('grown');
        expect(getCropStage(baseGrowth, baseGrowth)).toBe('grown');
        expect(getCropStage(baseGrowth * 1.5, baseGrowth)).toBe('grown');
      }
    });

    it('handles zero or negative progress gracefully', () => {
      expect(getCropStage(0, 45)).toBe('sprout');
      expect(getCropStage(-10, 45)).toBe('sprout');
    });

    it('handles zero or negative base growth without crashing', () => {
      expect(getCropStage(10, 0)).toBe('grown');
      expect(getCropStage(10, -5)).toBe('grown');
    });
  });

  describe('Progress Ratio (getCropProgressRatio)', () => {
    it('calculates ratio accurately between 0 and 1', () => {
      expect(getCropProgressRatio(0, 100)).toBe(0);
      expect(getCropProgressRatio(50, 100)).toBeCloseTo(0.5, 5);
      expect(getCropProgressRatio(100, 100)).toBe(1);
    });

    it('clamps ratio between 0 and 1 for out-of-bound inputs', () => {
      expect(getCropProgressRatio(-20, 100)).toBe(0);
      expect(getCropProgressRatio(150, 100)).toBe(1);
    });

    it('returns 1 if base growth is 0 or negative', () => {
      expect(getCropProgressRatio(5, 0)).toBe(1);
      expect(getCropProgressRatio(5, -10)).toBe(1);
    });
  });

  describe('Growth Scale (getGrowthScale)', () => {
    it('starts small at emergence and reaches full size at maturity', () => {
      expect(getGrowthScale(0)).toBeCloseTo(0.25, 5);
      expect(getGrowthScale(CROP_EMERGE_RATIO)).toBeGreaterThan(0.25);
      expect(getGrowthScale(1)).toBeCloseTo(1.0, 5);
    });

    it('grows monotonically across the whole growth bar', () => {
      let prev = getGrowthScale(0);
      for (let r = 0.1; r <= 1.0; r += 0.1) {
        const next = getGrowthScale(r);
        expect(next).toBeGreaterThan(prev);
        prev = next;
      }
    });

    it('clamps out-of-range ratios', () => {
      expect(getGrowthScale(-5)).toBeCloseTo(0.25, 5);
      expect(getGrowthScale(42)).toBeCloseTo(1.0, 5);
    });

    it('defines a small positive emergence threshold', () => {
      expect(CROP_EMERGE_RATIO).toBeGreaterThan(0);
      expect(CROP_EMERGE_RATIO).toBeLessThan(0.1);
    });
  });

  describe('Mutation Scale Multipliers (getMutationScale)', () => {
    it('returns 2.0x for giant mutation', () => {
      expect(getMutationScale('giant')).toBe(2.0);
    });

    it('returns 1.0x for none, gold, and cosmic mutations', () => {
      expect(getMutationScale('none')).toBe(1.0);
      expect(getMutationScale('gold')).toBe(1.0);
      expect(getMutationScale('cosmic')).toBe(1.0);
    });
  });

  describe('Mutation Material Properties (getMutationMaterialProps)', () => {
    const defaultColor = '#4CAF50';

    it('returns standard material props for mutation "none"', () => {
      const props: MutationMaterialProps = getMutationMaterialProps('none', defaultColor);
      expect(props.color).toBe(defaultColor);
      expect(props.metalness).toBeCloseTo(0.0, 2);
      expect(props.roughness).toBeGreaterThanOrEqual(0.6);
      expect(props.isGold).toBe(false);
      expect(props.isCosmic).toBe(false);
    });

    it('returns gold metallic palette (metalness: 0.85, roughness: 0.25) for mutation "gold"', () => {
      const props = getMutationMaterialProps('gold', defaultColor);
      expect(props.metalness).toBe(0.85);
      expect(props.roughness).toBe(0.25);
      expect(props.color).toBe('#FFD700');
      expect(props.isGold).toBe(true);
      expect(props.emissive).toBeDefined();
    });

    it('returns cosmic material properties with iridescent flag for mutation "cosmic"', () => {
      const props = getMutationMaterialProps('cosmic', defaultColor);
      expect(props.isCosmic).toBe(true);
      expect(props.metalness).toBeGreaterThanOrEqual(0.3);
      expect(props.roughness).toBeLessThanOrEqual(0.4);
      expect(props.emissive).toBeDefined();
    });

    it('returns standard material props with default color for mutation "giant"', () => {
      const props = getMutationMaterialProps('giant', defaultColor);
      expect(props.color).toBe(defaultColor);
      expect(props.metalness).toBe(0.0);
      expect(props.isGold).toBe(false);
      expect(props.isCosmic).toBe(false);
    });

    it('returns valid material props for all defined mutation variants', () => {
      for (const mut of allMutations) {
        const props = getMutationMaterialProps(mut, '#123456');
        expect(props.color).toBeDefined();
        expect(props.roughness).toBeGreaterThanOrEqual(0);
        expect(props.metalness).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Stage Transition Animation (calculateStageTransition)', () => {
    it('eases scale from 0.75 to 1.0 over 250ms for standard motion', () => {
      const start = calculateStageTransition(0, STAGE_TRANSITION_EASE_DURATION_MS, false);
      expect(start.scale).toBeCloseTo(0.75, 2);
      expect(start.opacity).toBeCloseTo(0.7, 2);

      const mid = calculateStageTransition(125, STAGE_TRANSITION_EASE_DURATION_MS, false);
      expect(mid.scale).toBeGreaterThan(start.scale);
      expect(mid.scale).toBeLessThan(1.0);

      const end = calculateStageTransition(250, STAGE_TRANSITION_EASE_DURATION_MS, false);
      expect(end.scale).toBe(1.0);
      expect(end.opacity).toBe(1.0);

      const postEnd = calculateStageTransition(500, STAGE_TRANSITION_EASE_DURATION_MS, false);
      expect(postEnd.scale).toBe(1.0);
      expect(postEnd.opacity).toBe(1.0);
    });

    it('uses 100ms quick transition with full scale for reduced motion', () => {
      const start = calculateStageTransition(0, STAGE_TRANSITION_REDUCED_MOTION_MS, true);
      expect(start.scale).toBe(1.0);
      expect(start.opacity).toBeLessThan(1.0);

      const end = calculateStageTransition(100, STAGE_TRANSITION_REDUCED_MOTION_MS, true);
      expect(end.scale).toBe(1.0);
      expect(end.opacity).toBe(1.0);
    });
  });

  describe('15 Procedural Crop Mesh Configurations', () => {
    it('has all 5 crops registered in catalog', () => {
      for (const cropId of allCrops) {
        expect(CROP_STAGE_CATALOG[cropId]).toBeDefined();
      }
    });

    it('has 3 distinct stage definitions for every crop (15 total configurations)', () => {
      let totalConfigs = 0;
      for (const cropId of allCrops) {
        for (const stage of allStages) {
          const config = CROP_STAGE_CATALOG[cropId][stage];
          expect(config).toBeDefined();
          expect(config.cropId).toBe(cropId);
          expect(config.stage).toBe(stage);
          expect(config.description).toBeDefined();
          expect(config.primaryColor).toBeDefined();
          expect(config.elements.length).toBeGreaterThan(0);
          totalConfigs++;
        }
      }
      expect(totalConfigs).toBe(15);
    });

    it('defines distinct visual identities across stages for Carrot', () => {
      const carrot = CROP_STAGE_CATALOG.carrot;
      expect(carrot.sprout.description.toLowerCase()).toContain('shoot');
      expect(carrot.mid.description.toLowerCase()).toContain('shoulder');
      expect(carrot.grown.description.toLowerCase()).toContain('orange root');
    });

    it('defines distinct visual identities across stages for Tomato', () => {
      const tomato = CROP_STAGE_CATALOG.tomato;
      expect(tomato.sprout.description.toLowerCase()).toContain('twin leaves');
      expect(tomato.mid.description.toLowerCase()).toContain('green');
      expect(tomato.grown.description.toLowerCase()).toContain('red');
    });

    it('defines distinct visual identities across stages for Pumpkin', () => {
      const pumpkin = CROP_STAGE_CATALOG.pumpkin;
      expect(pumpkin.sprout.description.toLowerCase()).toContain('broad');
      expect(pumpkin.mid.description.toLowerCase()).toContain('gourd');
      expect(pumpkin.grown.description.toLowerCase()).toContain('orange pumpkin');
    });

    it('defines distinct visual identities across stages for Golden Berry', () => {
      const berry = CROP_STAGE_CATALOG.golden_berry;
      expect(berry.sprout.description.toLowerCase()).toContain('seedling');
      expect(berry.mid.description.toLowerCase()).toContain('husk');
      expect(berry.grown.description.toLowerCase()).toContain('amber');
    });

    it('defines distinct visual identities across stages for Starfruit', () => {
      const starfruit = CROP_STAGE_CATALOG.starfruit;
      expect(starfruit.sprout.description.toLowerCase()).toContain('star spire');
      expect(starfruit.mid.description.toLowerCase()).toContain('trunk');
      expect(starfruit.grown.description.toLowerCase()).toContain('starfruit');
    });

    it('ensures all geometric elements have valid positions, dimensions, and colors', () => {
      for (const cropId of allCrops) {
        for (const stage of allStages) {
          const config = CROP_STAGE_CATALOG[cropId][stage];
          for (const elem of config.elements) {
            expect(elem.type).toMatch(/^(cone|cylinder|sphere|box|dodecahedron|torus|star)$/);
            expect(elem.position.length).toBe(3);
            expect(elem.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
            // Verify mesh stays cleanly anchored above or at ground level
            expect(elem.position[1]).toBeGreaterThanOrEqual(-0.1);
          }
        }
      }
    });
  });

  describe('Cosmic Particle & Color Generators', () => {
    it('generates 8 deterministic orbiting star mote positions', () => {
      const motes = getCosmicMotePositions(0);
      expect(motes.length).toBe(8);
      for (const mote of motes) {
        expect(mote.position.length).toBe(3);
        expect(mote.size).toBeGreaterThan(0);
        expect(mote.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('updates mote positions based on elapsed time', () => {
      const t0 = getCosmicMotePositions(0);
      const t1 = getCosmicMotePositions(1.5);
      expect(t0[0].position[0]).not.toBeCloseTo(t1[0].position[0], 4);
    });

    it('calculates cosmic animated cycling colors smoothly', () => {
      const c0 = calculateCosmicColor(0);
      const c1 = calculateCosmicColor(Math.PI);
      expect(c0).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(c1).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(c0).not.toBe(c1);
    });
  });
});
