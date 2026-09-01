import { useGameStore } from '../../state/gameStore';
import { selectEquippedPet } from '../../state/selectors';
import type {
  EggData,
  PetData,
  PlotData,
  PlotId,
  CommandResult,
  CropId,
  MutationType,
} from '../../state/storeTypes';
import {
  EGG_HATCH_SECONDS,
  EGG_HATCH_DISTANCE,
  DOG_AUTO_HARVEST_RANGE,
  DOG_AUTO_HARVEST_INTERVAL_MS,
} from './petDefinitions';
import { getPlotPosition, getPlotDistance, isPlotUnlocked } from '../world/gridCoordinates';
import { isPlotHarvestable } from '../farming/plotMachine';
import { harvestCrop } from '../farming/farmingCommands';
import { audioManager } from '../audio/AudioManager';

export interface AdvanceEggResult {
  updatedEgg: EggData;
  isReadyToHatch: boolean;
  progressRatio: number;
}

/**
 * Calculates updated egg incubation progress based on elapsed time and walked distance.
 * Incubation advances only when the egg is actively marked as incubating.
 * Whichever threshold (90s time or 120 distance) reaches 1.0 (100%) first marks the egg ready to hatch.
 */
export function advanceEggIncubation(
  egg: EggData,
  deltaSeconds: number,
  distanceDelta: number
): AdvanceEggResult {
  if (!egg.incubating) {
    const timeRatio = egg.elapsedIncubationSec / EGG_HATCH_SECONDS;
    const distRatio = egg.distanceTraveled / EGG_HATCH_DISTANCE;
    const progressRatio = Math.min(1.0, Math.max(timeRatio, distRatio));
    return {
      updatedEgg: { ...egg },
      isReadyToHatch: progressRatio >= 1.0,
      progressRatio,
    };
  }

  const safeDeltaSec = Math.max(0, deltaSeconds);
  const safeDeltaDist = Math.max(0, distanceDelta);

  const newElapsed = egg.elapsedIncubationSec + safeDeltaSec;
  const newDistance = egg.distanceTraveled + safeDeltaDist;

  const timeRatio = newElapsed / EGG_HATCH_SECONDS;
  const distRatio = newDistance / EGG_HATCH_DISTANCE;
  const progressRatio = Math.min(1.0, Math.max(timeRatio, distRatio));
  const isReadyToHatch = progressRatio >= 1.0;

  const updatedEgg: EggData = {
    ...egg,
    elapsedIncubationSec: newElapsed,
    distanceTraveled: newDistance,
  };

  return {
    updatedEgg,
    isReadyToHatch,
    progressRatio,
  };
}

/**
 * Hatches an incubating egg that has met either the time or distance requirement.
 * - Removes egg from inventory.
 * - Adds new companion PetData with the pre-determined outcome.
 * - Automatically equips new pet if no pet is currently equipped.
 * - Plays egg hatch sound effect.
 */
export function hatchEgg(
  eggId: string,
  nowMs: number = Date.now()
): CommandResult<{ pet: PetData }> {
  const store = useGameStore.getState();
  const egg = store.inventory.eggs.find((e) => e.id === eggId);

  if (!egg) {
    return {
      ok: false,
      reason: 'unknown',
      message: 'Egg not found in inventory',
    };
  }

  const isReady =
    egg.elapsedIncubationSec >= EGG_HATCH_SECONDS ||
    egg.distanceTraveled >= EGG_HATCH_DISTANCE;

  if (!isReady) {
    return {
      ok: false,
      reason: 'not_mature',
      message: 'Egg has not reached incubation threshold',
    };
  }

  const petId = `pet-${egg.outcome}-${nowMs}-${store.inventory.pets.length + 1}-${store.rngState}`;
  const newPet: PetData = {
    id: petId,
    type: egg.outcome,
    acquiredAtUtcMs: nowMs,
  };

  store.removeEgg(eggId);
  store.addPet(newPet);

  // Auto-equip if no pet is currently equipped
  if (!store.inventory.equippedPetId) {
    store.setEquippedPet(newPet.id);
  }

  audioManager.playSfx('egg_hatch');

  return {
    ok: true,
    value: { pet: newPet },
    message: `Hatched a ${newPet.type}!`,
  };
}

/**
 * Equips a companion pet from the player inventory.
 * Exactly 1 pet can be equipped at any time.
 */
export function equipPet(petId: string): CommandResult<{ equippedPetId: string }> {
  const store = useGameStore.getState();
  const pet = store.inventory.pets.find((p) => p.id === petId);

  if (!pet) {
    return {
      ok: false,
      reason: 'unknown',
      message: 'Pet not found in inventory',
    };
  }

  store.setEquippedPet(petId);
  audioManager.playSfx('ui_click');

  return {
    ok: true,
    value: { equippedPetId: petId },
    message: `Equipped ${pet.type}`,
  };
}

/**
 * Unequips the currently equipped companion pet.
 */
export function unequipPet(): CommandResult<undefined> {
  useGameStore.getState().setEquippedPet(null);
  audioManager.playSfx('ui_click');

  return {
    ok: true,
    value: undefined,
    message: 'Pet unequipped',
  };
}

/**
 * Sets an egg in inventory as actively incubating, or clears active incubation when null.
 */
export function setIncubatingEgg(eggId: string | null): CommandResult<undefined> {
  const store = useGameStore.getState();

  if (eggId === null) {
    store.setIncubatingEgg(null);
    return {
      ok: true,
      value: undefined,
      message: 'Incubation stopped',
    };
  }

  const egg = store.inventory.eggs.find((e) => e.id === eggId);
  if (!egg) {
    return {
      ok: false,
      reason: 'unknown',
      message: 'Egg not found in inventory',
    };
  }

  store.setIncubatingEgg(eggId);

  return {
    ok: true,
    value: undefined,
    message: 'Egg is now incubating',
  };
}

/**
 * Finds the closest unlocked mature harvestable crop within the Dog's 1.75 unit harvest radius.
 */
export function findDogHarvestTarget(
  dogPos: [number, number, number],
  plots: Record<PlotId, PlotData>,
  gridSize: 4 | 6 | 8
): PlotId | null {
  let closestPlotId: PlotId | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const plot of Object.values(plots)) {
    if (!isPlotUnlocked(plot.row, plot.col, gridSize)) {
      continue;
    }

    if (!plot.crop || !isPlotHarvestable(plot)) {
      continue;
    }

    const plotPos = getPlotPosition(plot.row, plot.col, gridSize);
    const distance = getPlotDistance(dogPos, plotPos);

    if (distance <= DOG_AUTO_HARVEST_RANGE) {
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPlotId = plot.id;
      }
    }
  }

  return closestPlotId;
}

/**
 * Rate-limited Dog auto-harvest simulation tick.
 * - Only runs if equipped pet is Dog.
 * - Enforces max 1 harvest per 1.0 second (1000ms).
 * - Executes atomic harvestCrop to prevent race conditions with player actions.
 */
export function tickDogAutoHarvest(
  dogPos: [number, number, number],
  nowMs: number,
  lastHarvestTimeRef: { current: number }
): CommandResult<{ cropId: CropId; mutation: MutationType; saleValue: number }> | null {
  const store = useGameStore.getState();
  const equippedPet = selectEquippedPet(store);

  if (!equippedPet || equippedPet.type !== 'dog') {
    return null;
  }

  if (nowMs - lastHarvestTimeRef.current < DOG_AUTO_HARVEST_INTERVAL_MS) {
    return null;
  }

  const targetPlotId = findDogHarvestTarget(dogPos, store.farm.plots, store.farm.gridSize);
  if (!targetPlotId) {
    return null;
  }

  const result = harvestCrop(targetPlotId);
  if (result.ok) {
    lastHarvestTimeRef.current = nowMs;
    return result;
  }

  return null;
}
