import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, resetGameStore } from '../../state/gameStore';
import { SeededRNG } from '../core/rng';
import {
  EGG_HATCH_SECONDS,
  EGG_HATCH_DISTANCE,
  MAX_PET_INVENTORY,
  DOG_AUTO_HARVEST_RANGE,
  DOG_AUTO_HARVEST_INTERVAL_MS,
  getPetDefinition,
  calculatePigMutationChance,
} from './petDefinitions';
import {
  advanceEggIncubation,
  hatchEgg,
  equipPet,
  unequipPet,
  setIncubatingEgg,
  findDogHarvestTarget,
  tickDogAutoHarvest,
} from './petSystem';
import type { EggData, PetData, PlotData, PlotId } from '../../state/storeTypes';
import { buyEgg } from '../economy/economyCommands';
import { rollEggOutcome } from '../economy/economyDefinitions';
import { getPlotPosition } from '../world/gridCoordinates';

describe('Pet & Egg Domain Logic', () => {
  beforeEach(() => {
    resetGameStore(1);
  });

  describe('Pet Definitions & Perks Metadata', () => {
    it('defines 3 distinct pets with correct perk properties', () => {
      const bee = getPetDefinition('bee');
      const dog = getPetDefinition('dog');
      const pig = getPetDefinition('pig');

      expect(bee.id).toBe('bee');
      expect(bee.growthMultiplier).toBe(1.15);
      expect(bee.perkType).toBe('growth_speed');

      expect(dog.id).toBe('dog');
      expect(dog.autoHarvestRange).toBe(DOG_AUTO_HARVEST_RANGE);
      expect(dog.autoHarvestIntervalSec).toBe(1);
      expect(dog.perkType).toBe('auto_harvest');

      expect(pig.id).toBe('pig');
      expect(pig.mutationMultiplier).toBe(1.2);
      expect(pig.perkType).toBe('mutation_chance');
    });

    it('calculates Pig mutation bonus correctly (+20% relative)', () => {
      expect(calculatePigMutationChance(0.05)).toBeCloseTo(0.06, 5);
      expect(calculatePigMutationChance(0.08)).toBeCloseTo(0.096, 5);
      expect(calculatePigMutationChance(0.03)).toBeCloseTo(0.036, 5);
    });

    it('exports key constants matching specification', () => {
      expect(EGG_HATCH_SECONDS).toBe(90);
      expect(EGG_HATCH_DISTANCE).toBe(120);
      expect(MAX_PET_INVENTORY).toBe(12);
      expect(DOG_AUTO_HARVEST_RANGE).toBe(1.75);
      expect(DOG_AUTO_HARVEST_INTERVAL_MS).toBe(1000);
    });
  });

  describe('Egg Roll Distribution & Purchase Outcomes', () => {
    it('rolls Common Egg outcome with ~60% Dog, ~35% Bee, ~5% Pig over 10,000 rolls', () => {
      const rng = new SeededRNG(12345);
      const counts = { dog: 0, bee: 0, pig: 0 };
      const totalRolls = 10000;

      for (let i = 0; i < totalRolls; i++) {
        const pet = rollEggOutcome('common', rng);
        counts[pet]++;
      }

      const dogPct = counts.dog / totalRolls;
      const beePct = counts.bee / totalRolls;
      const pigPct = counts.pig / totalRolls;

      expect(dogPct).toBeGreaterThan(0.57);
      expect(dogPct).toBeLessThan(0.63);

      expect(beePct).toBeGreaterThan(0.32);
      expect(beePct).toBeLessThan(0.38);

      expect(pigPct).toBeGreaterThan(0.035);
      expect(pigPct).toBeLessThan(0.065);
    });

    it('rolls Rare Egg outcome with ~50% Pig, ~30% Bee, ~20% Dog over 10,000 rolls', () => {
      const rng = new SeededRNG(98765);
      const counts = { dog: 0, bee: 0, pig: 0 };
      const totalRolls = 10000;

      for (let i = 0; i < totalRolls; i++) {
        const pet = rollEggOutcome('rare', rng);
        counts[pet]++;
      }

      const pigPct = counts.pig / totalRolls;
      const beePct = counts.bee / totalRolls;
      const dogPct = counts.dog / totalRolls;

      expect(pigPct).toBeGreaterThan(0.47);
      expect(pigPct).toBeLessThan(0.53);

      expect(beePct).toBeGreaterThan(0.27);
      expect(beePct).toBeLessThan(0.33);

      expect(dogPct).toBeGreaterThan(0.17);
      expect(dogPct).toBeLessThan(0.23);
    });

    it('persists rolled outcome to EggData when buying an egg', () => {
      useGameStore.getState().setCoins(2000);
      const rng = new SeededRNG(42);

      const result = buyEgg('rare', rng, 1000);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const eggInStore = useGameStore.getState().inventory.eggs[0];
        expect(eggInStore).toBeDefined();
        expect(eggInStore.outcome).toBe(result.value.outcomePetType);
        expect(eggInStore.purchasedAtUtcMs).toBe(1000);
        expect(eggInStore.incubating).toBe(false);
      }
    });
  });

  describe('Egg Incubation Progress Calculation (advanceEggIncubation)', () => {
    const baseEgg: EggData = {
      id: 'egg-test-1',
      type: 'common',
      purchasedAtUtcMs: 1000,
      outcome: 'dog',
      incubating: true,
      elapsedIncubationSec: 0,
      distanceTraveled: 0,
    };

    it('advances elapsed time and calculates time progress ratio', () => {
      const result = advanceEggIncubation(baseEgg, 45, 0);
      expect(result.updatedEgg.elapsedIncubationSec).toBe(45);
      expect(result.updatedEgg.distanceTraveled).toBe(0);
      expect(result.progressRatio).toBeCloseTo(0.5, 3);
      expect(result.isReadyToHatch).toBe(false);
    });

    it('advances distance traveled and calculates distance progress ratio', () => {
      const result = advanceEggIncubation(baseEgg, 0, 60);
      expect(result.updatedEgg.elapsedIncubationSec).toBe(0);
      expect(result.updatedEgg.distanceTraveled).toBe(60);
      expect(result.progressRatio).toBeCloseTo(0.5, 3);
      expect(result.isReadyToHatch).toBe(false);
    });

    it('reaches 100% when 90 seconds elapse', () => {
      const result = advanceEggIncubation(baseEgg, 90, 0);
      expect(result.updatedEgg.elapsedIncubationSec).toBe(90);
      expect(result.progressRatio).toBe(1.0);
      expect(result.isReadyToHatch).toBe(true);
    });

    it('reaches 100% when 120 distance units traveled', () => {
      const result = advanceEggIncubation(baseEgg, 0, 120);
      expect(result.updatedEgg.distanceTraveled).toBe(120);
      expect(result.progressRatio).toBe(1.0);
      expect(result.isReadyToHatch).toBe(true);
    });

    it('uses whichever progress ratio is greater', () => {
      // 45s / 90s = 50%, 96 distance / 120 = 80% -> progress should be 0.8
      const result = advanceEggIncubation(baseEgg, 45, 96);
      expect(result.progressRatio).toBeCloseTo(0.8, 3);
      expect(result.isReadyToHatch).toBe(false);

      // 90s (100%) with 30 distance (25%) -> ready
      const timeFirst = advanceEggIncubation(baseEgg, 90, 30);
      expect(timeFirst.progressRatio).toBe(1.0);
      expect(timeFirst.isReadyToHatch).toBe(true);

      // 10s (11%) with 120 distance (100%) -> ready
      const distFirst = advanceEggIncubation(baseEgg, 10, 120);
      expect(distFirst.progressRatio).toBe(1.0);
      expect(distFirst.isReadyToHatch).toBe(true);
    });

    it('clamps progress ratio to 1.0 when thresholds exceeded', () => {
      const result = advanceEggIncubation(baseEgg, 180, 240);
      expect(result.progressRatio).toBe(1.0);
      expect(result.isReadyToHatch).toBe(true);
    });

    it('does not advance incubation when egg is not incubating', () => {
      const idleEgg: EggData = {
        ...baseEgg,
        incubating: false,
        elapsedIncubationSec: 10,
        distanceTraveled: 20,
      };
      const result = advanceEggIncubation(idleEgg, 30, 40);
      expect(result.updatedEgg.elapsedIncubationSec).toBe(10);
      expect(result.updatedEgg.distanceTraveled).toBe(20);
      expect(result.isReadyToHatch).toBe(false);
    });

    it('safely handles negative deltas', () => {
      const result = advanceEggIncubation(baseEgg, -10, -5);
      expect(result.updatedEgg.elapsedIncubationSec).toBe(0);
      expect(result.updatedEgg.distanceTraveled).toBe(0);
      expect(result.progressRatio).toBe(0);
      expect(result.isReadyToHatch).toBe(false);
    });
  });

  describe('Egg Hatching (hatchEgg)', () => {
    it('fails to hatch a non-existent egg', () => {
      const result = hatchEgg('non-existent-egg');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('unknown');
      }
    });

    it('fails to hatch an egg that has not met incubation thresholds', () => {
      const egg: EggData = {
        id: 'egg-immature',
        type: 'common',
        purchasedAtUtcMs: Date.now(),
        outcome: 'bee',
        incubating: true,
        elapsedIncubationSec: 40,
        distanceTraveled: 50,
      };
      useGameStore.getState().addEgg(egg);

      const result = hatchEgg('egg-immature');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('not_mature');
      }
    });

    it('hatches ready egg: removes egg, creates pet with rolled outcome, and auto-equips if no pet equipped', () => {
      const egg: EggData = {
        id: 'egg-ready-1',
        type: 'common',
        purchasedAtUtcMs: 1000,
        outcome: 'pig',
        incubating: true,
        elapsedIncubationSec: 90,
        distanceTraveled: 0,
      };
      useGameStore.getState().addEgg(egg);
      useGameStore.getState().setIncubatingEgg('egg-ready-1');

      expect(useGameStore.getState().inventory.equippedPetId).toBeNull();

      const result = hatchEgg('egg-ready-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.pet.type).toBe('pig');
        expect(result.value.pet.id).toBeDefined();

        const stateAfter = useGameStore.getState();
        expect(stateAfter.inventory.eggs.find((e) => e.id === 'egg-ready-1')).toBeUndefined();
        expect(stateAfter.inventory.incubatingEggId).toBeNull();
        expect(stateAfter.inventory.pets.length).toBe(1);
        expect(stateAfter.inventory.pets[0].type).toBe('pig');
        // Auto-equipped because no pet was previously equipped
        expect(stateAfter.inventory.equippedPetId).toBe(result.value.pet.id);
      }
    });

    it('does not replace currently equipped pet when hatching a new egg', () => {
      const existingPet: PetData = {
        id: 'pet-dog-existing',
        type: 'dog',
        acquiredAtUtcMs: 1000,
      };
      useGameStore.getState().addPet(existingPet);
      useGameStore.getState().setEquippedPet(existingPet.id);

      const egg: EggData = {
        id: 'egg-ready-2',
        type: 'rare',
        purchasedAtUtcMs: 1000,
        outcome: 'bee',
        incubating: true,
        elapsedIncubationSec: 0,
        distanceTraveled: 125,
      };
      useGameStore.getState().addEgg(egg);

      const result = hatchEgg('egg-ready-2');
      expect(result.ok).toBe(true);

      const stateAfter = useGameStore.getState();
      expect(stateAfter.inventory.pets.length).toBe(2);
      expect(stateAfter.inventory.equippedPetId).toBe('pet-dog-existing');
    });
  });

  describe('Pet Equip & Unequip (equipPet, unequipPet)', () => {
    it('equips an existing pet from inventory', () => {
      const pet1: PetData = { id: 'pet-1', type: 'bee', acquiredAtUtcMs: 1000 };
      const pet2: PetData = { id: 'pet-2', type: 'dog', acquiredAtUtcMs: 1000 };
      useGameStore.getState().addPet(pet1);
      useGameStore.getState().addPet(pet2);

      const equipRes = equipPet('pet-2');
      expect(equipRes.ok).toBe(true);
      expect(useGameStore.getState().inventory.equippedPetId).toBe('pet-2');

      const switchRes = equipPet('pet-1');
      expect(switchRes.ok).toBe(true);
      expect(useGameStore.getState().inventory.equippedPetId).toBe('pet-1');
    });

    it('fails to equip a non-existent pet', () => {
      const result = equipPet('pet-unknown');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('unknown');
      }
      expect(useGameStore.getState().inventory.equippedPetId).toBeNull();
    });

    it('unequips active pet', () => {
      const pet: PetData = { id: 'pet-1', type: 'bee', acquiredAtUtcMs: 1000 };
      useGameStore.getState().addPet(pet);
      useGameStore.getState().setEquippedPet('pet-1');

      const unequipRes = unequipPet();
      expect(unequipRes.ok).toBe(true);
      expect(useGameStore.getState().inventory.equippedPetId).toBeNull();
    });
  });

  describe('Incubating Egg Assignment (setIncubatingEgg)', () => {
    it('sets specified egg as incubating and unsets others', () => {
      const egg1: EggData = {
        id: 'egg-1',
        type: 'common',
        purchasedAtUtcMs: 1000,
        outcome: 'dog',
        incubating: false,
        elapsedIncubationSec: 0,
        distanceTraveled: 0,
      };
      const egg2: EggData = {
        id: 'egg-2',
        type: 'rare',
        purchasedAtUtcMs: 1000,
        outcome: 'pig',
        incubating: false,
        elapsedIncubationSec: 0,
        distanceTraveled: 0,
      };
      useGameStore.getState().addEgg(egg1);
      useGameStore.getState().addEgg(egg2);

      const result = setIncubatingEgg('egg-1');
      expect(result.ok).toBe(true);

      const stateAfter = useGameStore.getState();
      expect(stateAfter.inventory.incubatingEggId).toBe('egg-1');
      expect(stateAfter.inventory.eggs.find((e) => e.id === 'egg-1')?.incubating).toBe(true);
      expect(stateAfter.inventory.eggs.find((e) => e.id === 'egg-2')?.incubating).toBe(false);
    });

    it('allows clearing active incubating egg with null', () => {
      const egg: EggData = {
        id: 'egg-1',
        type: 'common',
        purchasedAtUtcMs: 1000,
        outcome: 'dog',
        incubating: true,
        elapsedIncubationSec: 0,
        distanceTraveled: 0,
      };
      useGameStore.getState().addEgg(egg);
      useGameStore.getState().setIncubatingEgg('egg-1');

      const result = setIncubatingEgg(null);
      expect(result.ok).toBe(true);
      expect(useGameStore.getState().inventory.incubatingEggId).toBeNull();
      expect(useGameStore.getState().inventory.eggs[0].incubating).toBe(false);
    });

    it('fails when setting non-existent egg ID', () => {
      const result = setIncubatingEgg('non-existent');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('unknown');
      }
    });
  });

  describe('Inventory Capacity Cap (12 total pets + eggs)', () => {
    it('prevents egg purchases when pets + eggs reaches MAX_PET_INVENTORY (12)', () => {
      useGameStore.getState().setCoins(50000);
      const rng = new SeededRNG(42);

      // Add 8 pets and 3 eggs (11 total)
      for (let i = 0; i < 8; i++) {
        useGameStore.getState().addPet({ id: `pet-${i}`, type: 'bee', acquiredAtUtcMs: 1000 });
      }
      for (let i = 0; i < 3; i++) {
        useGameStore.getState().addEgg({
          id: `egg-${i}`,
          type: 'common',
          purchasedAtUtcMs: 1000,
          outcome: 'dog',
          incubating: false,
          elapsedIncubationSec: 0,
          distanceTraveled: 0,
        });
      }

      // Slot 12 purchase succeeds
      const res12 = buyEgg('common', rng);
      expect(res12.ok).toBe(true);
      const stateAfter12 = useGameStore.getState();
      expect(stateAfter12.inventory.pets.length + stateAfter12.inventory.eggs.length).toBe(12);

      // Slot 13 purchase fails
      const res13 = buyEgg('common', rng);
      expect(res13.ok).toBe(false);
      if (!res13.ok) {
        expect(res13.reason).toBe('max_pets_reached');
      }
    });
  });

  describe('Dog Auto-Harvest Logic (findDogHarvestTarget & tickDogAutoHarvest)', () => {
    const setupPlot = (
      plotId: PlotId,
      options: {
        tilled?: boolean;
        cropId?: 'carrot' | 'tomato' | 'pumpkin';
        progress?: number;
        mutation?: 'none' | 'gold';
      }
    ) => {
      const current = useGameStore.getState().farm.plots[plotId];
      if (!current) return;

      const plot: PlotData = {
        ...current,
        tilled: options.tilled ?? true,
        crop: options.cropId
          ? {
              cropId: options.cropId,
              plantedAtUtcMs: 1000,
              growthProgressSec: options.progress ?? 45,
              mutation: options.mutation ?? 'none',
            }
          : null,
      };
      useGameStore.getState().setPlot(plot);
    };

    it('finds mature plot within 1.75 units and ignores plots farther away', () => {
      const gridSize = 4;
      // Plot (1, 1) position
      const plot11Pos = getPlotPosition(1, 1, gridSize);
      // Mature carrot on plot-1-1 (Carrot needs 45s)
      setupPlot('plot-1-1', { cropId: 'carrot', progress: 45 });

      // Dog position 1.0 unit away from plot-1-1
      const dogPosNear: [number, number, number] = [
        plot11Pos[0] + 1.0,
        plot11Pos[1],
        plot11Pos[2],
      ];
      const targetNear = findDogHarvestTarget(dogPosNear, useGameStore.getState().farm.plots, gridSize);
      expect(targetNear).toBe('plot-1-1');

      // Dog position 2.5 units away from plot-1-1 (> 1.75 limit)
      const dogPosFar: [number, number, number] = [
        plot11Pos[0] + 2.5,
        plot11Pos[1],
        plot11Pos[2],
      ];
      const targetFar = findDogHarvestTarget(dogPosFar, useGameStore.getState().farm.plots, gridSize);
      expect(targetFar).toBeNull();
    });

    it('ignores locked plots beyond current grid size', () => {
      const gridSize = 4;
      // Create a mature plot at (5, 5) which is locked on a 4x4 grid
      const plot55Pos = getPlotPosition(5, 5, 8);
      const plot: PlotData = {
        id: 'plot-5-5',
        row: 5,
        col: 5,
        tilled: true,
        crop: {
          cropId: 'carrot',
          plantedAtUtcMs: 1000,
          growthProgressSec: 45,
          mutation: 'none',
        },
        hydratedUntilUtcMs: 0,
      };
      useGameStore.getState().setPlot(plot);

      // Place dog right on top of (5,5)
      const target = findDogHarvestTarget(plot55Pos, useGameStore.getState().farm.plots, gridSize);
      expect(target).toBeNull();
    });

    it('ignores immature crops within range', () => {
      const gridSize = 4;
      const plot11Pos = getPlotPosition(1, 1, gridSize);
      // Immature carrot (only 20s of 45s)
      setupPlot('plot-1-1', { cropId: 'carrot', progress: 20 });

      const dogPos: [number, number, number] = [plot11Pos[0], plot11Pos[1], plot11Pos[2]];
      const target = findDogHarvestTarget(dogPos, useGameStore.getState().farm.plots, gridSize);
      expect(target).toBeNull();
    });

    it('selects closest mature plot when multiple are in range', () => {
      const gridSize = 4;
      setupPlot('plot-1-1', { cropId: 'carrot', progress: 45 });
      setupPlot('plot-1-2', { cropId: 'carrot', progress: 45 });

      const plot11Pos = getPlotPosition(1, 1, gridSize);
      // Dog placed 0.2 units from plot-1-1 and 1.35 units from plot-1-2 (both < 1.75)
      const dogPos: [number, number, number] = [
        plot11Pos[0] + 0.2,
        plot11Pos[1],
        plot11Pos[2],
      ];

      const target = findDogHarvestTarget(dogPos, useGameStore.getState().farm.plots, gridSize);
      expect(target).toBe('plot-1-1');
    });

    it('ticks dog auto-harvest: rate limited to max 1 harvest per second', () => {
      const dogPet: PetData = { id: 'dog-pet-1', type: 'dog', acquiredAtUtcMs: 1000 };
      useGameStore.getState().addPet(dogPet);
      useGameStore.getState().setEquippedPet('dog-pet-1');

      setupPlot('plot-1-1', { cropId: 'carrot', progress: 45 });
      setupPlot('plot-1-2', { cropId: 'carrot', progress: 45 });

      const plot11Pos = getPlotPosition(1, 1, 4);
      const dogPos: [number, number, number] = [plot11Pos[0], plot11Pos[1], plot11Pos[2]];

      const lastHarvestTimeRef = { current: 0 };
      const nowMs = 10000;

      // First harvest tick at 10,000ms
      const tick1 = tickDogAutoHarvest(dogPos, nowMs, lastHarvestTimeRef);
      expect(tick1).not.toBeNull();
      expect(tick1?.ok).toBe(true);
      expect(lastHarvestTimeRef.current).toBe(nowMs);

      // Verify plot-1-1 harvested into produce
      expect(useGameStore.getState().farm.plots['plot-1-1'].crop).toBeNull();
      expect(useGameStore.getState().inventory.produce.length).toBe(1);

      // Second harvest tick 500ms later (at 10,500ms) -> rate-limited, returns null
      const tick2 = tickDogAutoHarvest(dogPos, nowMs + 500, lastHarvestTimeRef);
      expect(tick2).toBeNull();
      expect(useGameStore.getState().farm.plots['plot-1-2'].crop).not.toBeNull();

      // Third harvest tick 1000ms later (at 11,000ms) -> succeeds
      const plot12Pos = getPlotPosition(1, 2, 4);
      const dogPos2: [number, number, number] = [plot12Pos[0], plot12Pos[1], plot12Pos[2]];
      const tick3 = tickDogAutoHarvest(dogPos2, nowMs + 1000, lastHarvestTimeRef);
      expect(tick3).not.toBeNull();
      expect(tick3?.ok).toBe(true);
      expect(lastHarvestTimeRef.current).toBe(nowMs + 1000);
      expect(useGameStore.getState().farm.plots['plot-1-2'].crop).toBeNull();
    });

    it('does nothing when equipped pet is not Dog', () => {
      const beePet: PetData = { id: 'bee-pet-1', type: 'bee', acquiredAtUtcMs: 1000 };
      useGameStore.getState().addPet(beePet);
      useGameStore.getState().setEquippedPet('bee-pet-1');

      setupPlot('plot-1-1', { cropId: 'carrot', progress: 45 });
      const plot11Pos = getPlotPosition(1, 1, 4);
      const dogPos: [number, number, number] = [plot11Pos[0], plot11Pos[1], plot11Pos[2]];

      const lastHarvestTimeRef = { current: 0 };
      const tick = tickDogAutoHarvest(dogPos, 5000, lastHarvestTimeRef);

      expect(tick).toBeNull();
      expect(useGameStore.getState().farm.plots['plot-1-1'].crop).not.toBeNull();
    });

    it('protects against race conditions when plot is already harvested concurrently', () => {
      const dogPet: PetData = { id: 'dog-pet-1', type: 'dog', acquiredAtUtcMs: 1000 };
      useGameStore.getState().addPet(dogPet);
      useGameStore.getState().setEquippedPet('dog-pet-1');

      setupPlot('plot-1-1', { cropId: 'carrot', progress: 45 });
      const plot11Pos = getPlotPosition(1, 1, 4);
      const dogPos: [number, number, number] = [plot11Pos[0], plot11Pos[1], plot11Pos[2]];

      // Clear plot crop right before dog ticks (simulating player harvesting at the same moment)
      useGameStore.getState().setPlot({
        ...useGameStore.getState().farm.plots['plot-1-1'],
        crop: null,
      });

      const lastHarvestTimeRef = { current: 0 };
      const tick = tickDogAutoHarvest(dogPos, 5000, lastHarvestTimeRef);

      expect(tick).toBeNull();
      expect(lastHarvestTimeRef.current).toBe(0);
    });
  });
});
