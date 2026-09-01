import { describe, it, expect } from 'vitest';
import {
  CROPS_RECORD,
  getCropDefinition,
  getAllCrops,
  calculateSaleValue,
} from './cropDefinitions';
import type { CropId, MutationType } from '../../state/storeTypes';

describe('Task 10: Crop Definitions & Pricing Registry', () => {
  describe('CROPS_RECORD Registry', () => {
    it('defines all 5 required crops with exact balance parameters', () => {
      const cropKeys = Object.keys(CROPS_RECORD) as CropId[];
      expect(cropKeys).toHaveLength(5);
      expect(cropKeys).toContain('carrot');
      expect(cropKeys).toContain('tomato');
      expect(cropKeys).toContain('pumpkin');
      expect(cropKeys).toContain('golden_berry');
      expect(cropKeys).toContain('starfruit');
    });

    it('defines Carrot with 5c seed, 45s base growth, 12c sale price', () => {
      const carrot = CROPS_RECORD.carrot;
      expect(carrot).toBeDefined();
      expect(carrot.id).toBe('carrot');
      expect(carrot.name).toBe('Carrot');
      expect(carrot.seedCost).toBe(5);
      expect(carrot.baseGrowthSec).toBe(45);
      expect(carrot.baseGrowthMs).toBe(45 * 1000);
      expect(carrot.baseSalePrice).toBe(12);
      expect(carrot.visualIdentity).toContain('Orange root');
    });

    it('defines Tomato with 20c seed, 90s base growth, 48c sale price', () => {
      const tomato = CROPS_RECORD.tomato;
      expect(tomato).toBeDefined();
      expect(tomato.id).toBe('tomato');
      expect(tomato.name).toBe('Tomato');
      expect(tomato.seedCost).toBe(20);
      expect(tomato.baseGrowthSec).toBe(90);
      expect(tomato.baseGrowthMs).toBe(90 * 1000);
      expect(tomato.baseSalePrice).toBe(48);
      expect(tomato.visualIdentity).toContain('vine');
    });

    it('defines Pumpkin with 75c seed, 180s base growth, 190c sale price', () => {
      const pumpkin = CROPS_RECORD.pumpkin;
      expect(pumpkin).toBeDefined();
      expect(pumpkin.id).toBe('pumpkin');
      expect(pumpkin.name).toBe('Pumpkin');
      expect(pumpkin.seedCost).toBe(75);
      expect(pumpkin.baseGrowthSec).toBe(180);
      expect(pumpkin.baseGrowthMs).toBe(180 * 1000);
      expect(pumpkin.baseSalePrice).toBe(190);
      expect(pumpkin.visualIdentity).toContain('orange body');
    });

    it('defines Golden Berry with 200c seed, 300s base growth, 550c sale price', () => {
      const goldenBerry = CROPS_RECORD.golden_berry;
      expect(goldenBerry).toBeDefined();
      expect(goldenBerry.id).toBe('golden_berry');
      expect(goldenBerry.name).toBe('Golden Berry');
      expect(goldenBerry.seedCost).toBe(200);
      expect(goldenBerry.baseGrowthSec).toBe(300);
      expect(goldenBerry.baseGrowthMs).toBe(300 * 1000);
      expect(goldenBerry.baseSalePrice).toBe(550);
      expect(goldenBerry.visualIdentity).toContain('amber berries');
    });

    it('defines Starfruit with 500c seed, 480s base growth, 1500c sale price', () => {
      const starfruit = CROPS_RECORD.starfruit;
      expect(starfruit).toBeDefined();
      expect(starfruit.id).toBe('starfruit');
      expect(starfruit.name).toBe('Starfruit');
      expect(starfruit.seedCost).toBe(500);
      expect(starfruit.baseGrowthSec).toBe(480);
      expect(starfruit.baseGrowthMs).toBe(480 * 1000);
      expect(starfruit.baseSalePrice).toBe(1500);
      expect(starfruit.visualIdentity).toContain('Five-point');
    });
  });

  describe('getCropDefinition()', () => {
    it('returns crop definition for valid crop IDs', () => {
      expect(getCropDefinition('carrot')?.name).toBe('Carrot');
      expect(getCropDefinition('tomato')?.name).toBe('Tomato');
      expect(getCropDefinition('pumpkin')?.name).toBe('Pumpkin');
      expect(getCropDefinition('golden_berry')?.name).toBe('Golden Berry');
      expect(getCropDefinition('starfruit')?.name).toBe('Starfruit');
    });

    it('returns undefined for unknown crop ID', () => {
      expect(getCropDefinition('unknown_crop' as CropId)).toBeUndefined();
      expect(getCropDefinition('' as CropId)).toBeUndefined();
    });
  });

  describe('getAllCrops()', () => {
    it('returns array of all 5 crop definitions', () => {
      const crops = getAllCrops();
      expect(crops).toHaveLength(5);
      const names = crops.map((c) => c.name);
      expect(names).toEqual(
        expect.arrayContaining(['Carrot', 'Tomato', 'Pumpkin', 'Golden Berry', 'Starfruit'])
      );
    });
  });

  describe('calculateSaleValue()', () => {
    it('calculates single unmutated base sale values correctly', () => {
      expect(calculateSaleValue('carrot')).toBe(12);
      expect(calculateSaleValue('tomato', 'none')).toBe(48);
      expect(calculateSaleValue('pumpkin', 'none', 1)).toBe(190);
      expect(calculateSaleValue('golden_berry', 'none', 1)).toBe(550);
      expect(calculateSaleValue('starfruit', 'none', 1)).toBe(1500);
    });

    it('calculates Giant mutation (3x multiplier)', () => {
      expect(calculateSaleValue('carrot', 'giant', 1)).toBe(36); // 12 * 3
      expect(calculateSaleValue('tomato', 'giant', 1)).toBe(144); // 48 * 3
      expect(calculateSaleValue('pumpkin', 'giant', 1)).toBe(570); // 190 * 3
      expect(calculateSaleValue('golden_berry', 'giant', 1)).toBe(1650); // 550 * 3
      expect(calculateSaleValue('starfruit', 'giant', 1)).toBe(4500); // 1500 * 3
    });

    it('calculates Gold mutation (5x multiplier)', () => {
      expect(calculateSaleValue('carrot', 'gold', 1)).toBe(60); // 12 * 5
      expect(calculateSaleValue('tomato', 'gold', 1)).toBe(240); // 48 * 5
      expect(calculateSaleValue('pumpkin', 'gold', 1)).toBe(950); // 190 * 5
      expect(calculateSaleValue('golden_berry', 'gold', 1)).toBe(2750); // 550 * 5
      expect(calculateSaleValue('starfruit', 'gold', 1)).toBe(7500); // 1500 * 5
    });

    it('calculates Cosmic mutation (15x multiplier)', () => {
      expect(calculateSaleValue('carrot', 'cosmic', 1)).toBe(180); // 12 * 15
      expect(calculateSaleValue('tomato', 'cosmic', 1)).toBe(720); // 48 * 15
      expect(calculateSaleValue('pumpkin', 'cosmic', 1)).toBe(2850); // 190 * 15
      expect(calculateSaleValue('golden_berry', 'cosmic', 1)).toBe(8250); // 550 * 15
      expect(calculateSaleValue('starfruit', 'cosmic', 1)).toBe(22500); // 1500 * 15
    });

    it('scales linearly with quantity', () => {
      expect(calculateSaleValue('carrot', 'none', 5)).toBe(60);
      expect(calculateSaleValue('carrot', 'gold', 3)).toBe(180);
      expect(calculateSaleValue('starfruit', 'cosmic', 10)).toBe(225000);
      expect(calculateSaleValue('pumpkin', 'giant', 0)).toBe(0);
    });

    it('handles invalid crop ID safely by returning 0', () => {
      expect(calculateSaleValue('nonexistent' as CropId, 'none', 1)).toBe(0);
    });

    it('handles unknown mutation fallback gracefully (1x)', () => {
      expect(calculateSaleValue('carrot', 'unknown_mutation' as MutationType, 1)).toBe(12);
    });
  });
});
