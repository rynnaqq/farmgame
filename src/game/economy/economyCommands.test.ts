import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, resetGameStore } from '../../state/gameStore';
import { SeededRNG } from '../core/rng';
import {
  buySeed,
  sellProduce,
  sellAllProduce,
  buyGoldenWateringCan,
  buyUpgrade,
  buyEgg,
} from './economyCommands';
import {
  rollEggOutcome,
  getEggDefinition,
  calculateProduceSaleValue,
  UPGRADE_CONFIGS,
} from './economyDefinitions';
import { getSeedCatalog, getUpgradeCatalog, getEggCatalog } from './shopCatalog';
import { CROPS, GOLDEN_WATERING_CAN_COST, MAX_PET_INVENTORY, type CropId } from '../core/constants';
import type { EggData, PetData } from '../../state/storeTypes';

describe('Task 15: Economy Definitions, Catalog & Commands', () => {
  beforeEach(() => {
    resetGameStore(42);
  });

  describe('1. Seed Purchasing (buySeed)', () => {
    it('buys 1 seed, deducts exact coins, and credits seed inventory', () => {
      useGameStore.getState().setCoins(100);
      const initialCarrots = useGameStore.getState().inventory.seeds.carrot;

      const result = buySeed('carrot', 1);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          cropId: 'carrot',
          quantity: 1,
          cost: CROPS.carrot.seedCost,
        });
      }

      expect(useGameStore.getState().player.coins).toBe(100 - CROPS.carrot.seedCost);
      expect(useGameStore.getState().inventory.seeds.carrot).toBe(initialCarrots + 1);
    });

    it('buys 5 seeds in a batch purchase with 5x cost calculation', () => {
      useGameStore.getState().setCoins(500);
      const initialTomatoes = useGameStore.getState().inventory.seeds.tomato;
      const cost5x = CROPS.tomato.seedCost * 5;

      const result = buySeed('tomato', 5);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          cropId: 'tomato',
          quantity: 5,
          cost: cost5x,
        });
      }

      expect(useGameStore.getState().player.coins).toBe(500 - cost5x);
      expect(useGameStore.getState().inventory.seeds.tomato).toBe(initialTomatoes + 5);
    });

    it('rejects purchase with insufficient_coins when player cannot afford seeds', () => {
      useGameStore.getState().setCoins(10); // Starfruit costs 500c
      const initialStarfruit = useGameStore.getState().inventory.seeds.starfruit;

      const result = buySeed('starfruit', 1);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('insufficient_coins');
      }

      // State remains unchanged
      expect(useGameStore.getState().player.coins).toBe(10);
      expect(useGameStore.getState().inventory.seeds.starfruit).toBe(initialStarfruit);
    });

    it('rejects invalid quantities (0, negative, non-integer)', () => {
      useGameStore.getState().setCoins(1000);

      const zeroRes = buySeed('carrot', 0);
      expect(zeroRes.ok).toBe(false);

      const negRes = buySeed('carrot', -5);
      expect(negRes.ok).toBe(false);

      const floatRes = buySeed('carrot', 1.5);
      expect(floatRes.ok).toBe(false);
    });

    it('rejects unknown crop types', () => {
      // @ts-expect-error testing runtime validation with unknown crop
      const result = buySeed('unknown_fruit', 1);
      expect(result.ok).toBe(false);
    });
  });

  describe('2. Produce Selling (sellProduce)', () => {
    it('sells single produce item with base price calculation', () => {
      useGameStore.getState().setCoins(0);
      useGameStore.getState().addProduce('carrot', 'none', 3);

      const result = sellProduce('carrot', 'none', 1);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.coinsEarned).toBe(CROPS.carrot.baseSalePrice);
      }

      expect(useGameStore.getState().player.coins).toBe(CROPS.carrot.baseSalePrice);
      const produce = useGameStore.getState().inventory.produce;
      const carrotStack = produce.find((p) => p.cropId === 'carrot' && p.mutation === 'none');
      expect(carrotStack?.quantity).toBe(2);
    });

    it('sells entire stack when quantity parameter is omitted', () => {
      useGameStore.getState().setCoins(50);
      useGameStore.getState().addProduce('tomato', 'none', 4);

      const result = sellProduce('tomato', 'none');

      expect(result.ok).toBe(true);
      const expectedCoins = CROPS.tomato.baseSalePrice * 4;
      if (result.ok) {
        expect(result.value.coinsEarned).toBe(expectedCoins);
      }

      expect(useGameStore.getState().player.coins).toBe(50 + expectedCoins);
      const tomatoStack = useGameStore
        .getState()
        .inventory.produce.find((p) => p.cropId === 'tomato' && p.mutation === 'none');
      expect(tomatoStack).toBeUndefined();
    });

    it('calculates correct multiplier values for all mutation variants', () => {
      // Base: pumpkin = 190
      // Giant: 3x -> 570
      // Gold: 5x -> 950
      // Cosmic: 15x -> 2850
      useGameStore.getState().setCoins(0);
      useGameStore.getState().addProduce('pumpkin', 'giant', 1);
      useGameStore.getState().addProduce('pumpkin', 'gold', 1);
      useGameStore.getState().addProduce('pumpkin', 'cosmic', 1);

      const resGiant = sellProduce('pumpkin', 'giant', 1);
      expect(resGiant.ok).toBe(true);
      if (resGiant.ok) expect(resGiant.value.coinsEarned).toBe(190 * 3);

      const resGold = sellProduce('pumpkin', 'gold', 1);
      expect(resGold.ok).toBe(true);
      if (resGold.ok) expect(resGold.value.coinsEarned).toBe(190 * 5);

      const resCosmic = sellProduce('pumpkin', 'cosmic', 1);
      expect(resCosmic.ok).toBe(true);
      if (resCosmic.ok) expect(resCosmic.value.coinsEarned).toBe(190 * 15);

      expect(useGameStore.getState().player.coins).toBe(190 * 3 + 190 * 5 + 190 * 15);
    });

    it('rejects selling produce not in inventory', () => {
      const result = sellProduce('starfruit', 'none', 1);
      expect(result.ok).toBe(false);
    });

    it('rejects selling more quantity than available in stack', () => {
      useGameStore.getState().addProduce('golden_berry', 'gold', 2);

      const result = sellProduce('golden_berry', 'gold', 5);
      expect(result.ok).toBe(false);
    });

    it('rejects invalid sell quantities (0, negative, float)', () => {
      useGameStore.getState().addProduce('carrot', 'none', 5);

      expect(sellProduce('carrot', 'none', 0).ok).toBe(false);
      expect(sellProduce('carrot', 'none', -2).ok).toBe(false);
      expect(sellProduce('carrot', 'none', 1.2).ok).toBe(false);
    });
  });

  describe('3. Sell All Produce (sellAllProduce)', () => {
    it('sells all diverse produce stacks and clears produce inventory', () => {
      useGameStore.getState().setCoins(100);
      useGameStore.getState().addProduce('carrot', 'none', 5); // 5 * 12 = 60
      useGameStore.getState().addProduce('tomato', 'giant', 2); // 2 * 48 * 3 = 288
      useGameStore.getState().addProduce('starfruit', 'cosmic', 1); // 1 * 1500 * 15 = 22500

      const totalExpected = 60 + 288 + 22500; // 22848

      const result = sellAllProduce();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.totalCoinsEarned).toBe(totalExpected);
        expect(result.value.itemsSold).toBe(8);
      }

      expect(useGameStore.getState().player.coins).toBe(100 + totalExpected);
      expect(useGameStore.getState().inventory.produce).toEqual([]);
    });

    it('handles empty produce inventory cleanly with 0 coins earned', () => {
      useGameStore.getState().setCoins(200);

      const result = sellAllProduce();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.totalCoinsEarned).toBe(0);
        expect(result.value.itemsSold).toBe(0);
      }

      expect(useGameStore.getState().player.coins).toBe(200);
    });
  });

  describe('4. Upgrades - Golden Watering Can', () => {
    it('buys Golden Watering Can for 1200 coins and updates state', () => {
      useGameStore.getState().setCoins(1500);
      expect(useGameStore.getState().farm.goldenWateringCanOwned).toBe(false);

      const result = buyGoldenWateringCan();

      expect(result.ok).toBe(true);
      expect(useGameStore.getState().farm.goldenWateringCanOwned).toBe(true);
      expect(useGameStore.getState().player.coins).toBe(1500 - GOLDEN_WATERING_CAN_COST);
    });

    it('rejects Golden Watering Can purchase when insufficient coins', () => {
      useGameStore.getState().setCoins(1199);

      const result = buyGoldenWateringCan();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('insufficient_coins');
      }
      expect(useGameStore.getState().farm.goldenWateringCanOwned).toBe(false);
      expect(useGameStore.getState().player.coins).toBe(1199);
    });

    it('rejects Golden Watering Can purchase when already owned', () => {
      useGameStore.getState().setCoins(5000);
      useGameStore.getState().setGoldenWateringCan(true);

      const result = buyGoldenWateringCan();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('already_owned');
      }
      expect(useGameStore.getState().player.coins).toBe(5000);
    });

    it('supports buyUpgrade("golden_can") alias', () => {
      useGameStore.getState().setCoins(2000);

      const result = buyUpgrade('golden_can');
      expect(result.ok).toBe(true);
      expect(useGameStore.getState().farm.goldenWateringCanOwned).toBe(true);
      expect(useGameStore.getState().player.coins).toBe(2000 - GOLDEN_WATERING_CAN_COST);
    });
  });

  describe('5. Upgrades - Golden Can only (no grid expansions)', () => {
    it('rejects unknown expansion upgrade ids', () => {
      useGameStore.getState().setCoins(5000);

      const res = buyUpgrade('expansion_6x6' as unknown as 'golden_can');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('unknown');
      }
      expect(useGameStore.getState().player.coins).toBe(5000);
    });
  });

  describe('6. Egg Purchases & Deterministic Rolls (buyEgg)', () => {
    it('buys Common Egg (450c), deducts coins, adds egg to inventory with rolled outcome', () => {
      useGameStore.getState().setCoins(1000);
      const rng = new SeededRNG(12345);

      const result = buyEgg('common', rng, 1700000000000);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.eggId).toBeDefined();
        expect(['dog', 'bee', 'pig']).toContain(result.value.outcomePetType);
      }

      expect(useGameStore.getState().player.coins).toBe(1000 - 450);
      const eggs = useGameStore.getState().inventory.eggs;
      expect(eggs.length).toBe(1);
      expect(eggs[0]).toMatchObject({
        type: 'common',
        purchasedAtUtcMs: 1700000000000,
        incubating: false,
        elapsedIncubationSec: 0,
        distanceTraveled: 0,
      });
      expect(eggs[0].outcome).toBe(result.ok ? result.value.outcomePetType : null);
    });

    it('buys Rare Egg (1500c), deducts coins, adds egg to inventory', () => {
      useGameStore.getState().setCoins(2000);
      const rng = new SeededRNG(99999);

      const result = buyEgg('rare', rng);

      expect(result.ok).toBe(true);
      expect(useGameStore.getState().player.coins).toBe(2000 - 1500);
      expect(useGameStore.getState().inventory.eggs.length).toBe(1);
      expect(useGameStore.getState().inventory.eggs[0].type).toBe('rare');
    });

    it('rejects egg purchase when player has insufficient coins', () => {
      useGameStore.getState().setCoins(400); // Common egg is 450
      const rng = new SeededRNG(1);

      const result = buyEgg('common', rng);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('insufficient_coins');
      }
      expect(useGameStore.getState().player.coins).toBe(400);
      expect(useGameStore.getState().inventory.eggs).toEqual([]);
    });

    it('enforces 12-slot pet & egg inventory cap', () => {
      useGameStore.getState().setCoins(50000);
      const rng = new SeededRNG(777);

      // Pre-fill inventory with 7 pets and 4 eggs = 11 total slots
      for (let i = 0; i < 7; i++) {
        const pet: PetData = { id: `pet-${i}`, type: 'dog', acquiredAtUtcMs: 1000 };
        useGameStore.getState().addPet(pet);
      }
      for (let i = 0; i < 4; i++) {
        const egg: EggData = {
          id: `egg-${i}`,
          type: 'common',
          purchasedAtUtcMs: 1000,
          outcome: 'bee',
          incubating: false,
          elapsedIncubationSec: 0,
          distanceTraveled: 0,
        };
        useGameStore.getState().addEgg(egg);
      }

      expect(useGameStore.getState().inventory.pets.length).toBe(7);
      expect(useGameStore.getState().inventory.eggs.length).toBe(4);

      // 12th slot purchase should succeed
      const egg12Res = buyEgg('common', rng);
      expect(egg12Res.ok).toBe(true);
      expect(
        useGameStore.getState().inventory.pets.length +
          useGameStore.getState().inventory.eggs.length
      ).toBe(12);

      // 13th slot purchase must fail with max_pets_reached
      const egg13Res = buyEgg('common', rng);
      expect(egg13Res.ok).toBe(false);
      if (!egg13Res.ok) {
        expect(egg13Res.reason).toBe('max_pets_reached');
      }
      // No coins deducted on failed cap check
      expect(useGameStore.getState().inventory.eggs.length).toBe(5);
    });

    it('deterministic outcome roll matches Common Egg weights (Dog 60%, Bee 35%, Pig 5%)', () => {
      const counts: Record<string, number> = { dog: 0, bee: 0, pig: 0 };
      const trials = 10000;
      const rng = new SeededRNG(42);

      for (let i = 0; i < trials; i++) {
        const outcome = rollEggOutcome('common', rng);
        counts[outcome]++;
      }

      // 60% dog = ~6000 (within +-3%)
      expect(counts.dog / trials).toBeGreaterThan(0.57);
      expect(counts.dog / trials).toBeLessThan(0.63);

      // 35% bee = ~3500 (within +-3%)
      expect(counts.bee / trials).toBeGreaterThan(0.32);
      expect(counts.bee / trials).toBeLessThan(0.38);

      // 5% pig = ~500 (within +-1.5%)
      expect(counts.pig / trials).toBeGreaterThan(0.035);
      expect(counts.pig / trials).toBeLessThan(0.065);
    });

    it('deterministic outcome roll matches Rare Egg weights (Pig 50%, Bee 30%, Dog 20%)', () => {
      const counts: Record<string, number> = { dog: 0, bee: 0, pig: 0 };
      const trials = 10000;
      const rng = new SeededRNG(999);

      for (let i = 0; i < trials; i++) {
        const outcome = rollEggOutcome('rare', rng);
        counts[outcome]++;
      }

      // 50% pig = ~5000 (within +-3%)
      expect(counts.pig / trials).toBeGreaterThan(0.47);
      expect(counts.pig / trials).toBeLessThan(0.53);

      // 30% bee = ~3000 (within +-3%)
      expect(counts.bee / trials).toBeGreaterThan(0.27);
      expect(counts.bee / trials).toBeLessThan(0.33);

      // 20% dog = ~2000 (within +-3%)
      expect(counts.dog / trials).toBeGreaterThan(0.17);
      expect(counts.dog / trials).toBeLessThan(0.23);
    });
  });

  describe('7. Shop Catalog Helpers', () => {
    it('getSeedCatalog returns all 5 crops with metadata', () => {
      const catalog = getSeedCatalog();
      expect(catalog.length).toBe(5);
      expect(catalog.map((c) => c.cropId)).toEqual([
        'carrot',
        'tomato',
        'pumpkin',
        'golden_berry',
        'starfruit',
      ]);
      expect(catalog[0]).toMatchObject({
        cropId: 'carrot',
        name: 'Carrot',
        seedCost: 5,
        baseSalePrice: 12,
      });
    });

    it('getUpgradeCatalog reflects availability and owned status', () => {
      // Without golden can
      const catalog1 = getUpgradeCatalog(false);
      const goldenCanItem = catalog1.find((u) => u.id === 'golden_can');

      expect(catalog1).toHaveLength(1);
      expect(goldenCanItem?.isOwned).toBe(false);
      expect(goldenCanItem?.isAvailable).toBe(true);

      // With golden can
      const catalog2 = getUpgradeCatalog(true);
      const goldenCan2 = catalog2.find((u) => u.id === 'golden_can');

      expect(goldenCan2?.isOwned).toBe(true);
      expect(goldenCan2?.isAvailable).toBe(false);
    });

    it('getEggCatalog returns Common and Rare egg items with costs and perk notes', () => {
      const catalog = getEggCatalog();
      expect(catalog.length).toBe(2);
      expect(catalog[0]).toMatchObject({
        eggType: 'common',
        name: 'Common Egg',
        cost: 450,
      });
      expect(catalog[1]).toMatchObject({
        eggType: 'rare',
        name: 'Rare Egg',
        cost: 1500,
      });
    });
  });

  describe('8. Economy Definitions & Price Math', () => {
    it('calculateProduceSaleValue handles all multipliers and quantities correctly', () => {
      expect(calculateProduceSaleValue('carrot', 'none', 1)).toBe(12);
      expect(calculateProduceSaleValue('carrot', 'giant', 2)).toBe(12 * 3 * 2);
      expect(calculateProduceSaleValue('carrot', 'gold', 3)).toBe(12 * 5 * 3);
      expect(calculateProduceSaleValue('starfruit', 'cosmic', 4)).toBe(1500 * 15 * 4);
      expect(calculateProduceSaleValue('unknown' as unknown as CropId, 'none', 1)).toBe(0);
      expect(calculateProduceSaleValue('carrot', 'none', 0)).toBe(0);
    });

    it('getEggDefinition retrieves correct egg config', () => {
      const common = getEggDefinition('common');
      expect(common.cost).toBe(450);
      expect(common.weights.dog).toBe(60);

      const rare = getEggDefinition('rare');
      expect(rare.cost).toBe(1500);
      expect(rare.weights.pig).toBe(50);
    });

    it('UPGRADE_CONFIGS contains valid configuration constants', () => {
      expect(UPGRADE_CONFIGS.golden_can.cost).toBe(GOLDEN_WATERING_CAN_COST);
      expect(MAX_PET_INVENTORY).toBe(12);
    });
  });
});
