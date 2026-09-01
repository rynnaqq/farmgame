import {
  CROPS,
  MUTATION_MULTIPLIERS,
  PET_PERKS,
  EXPANSION_1_COST,
  EXPANSION_2_COST,
  MAX_PET_INVENTORY,
} from '../game/core/constants';
import type { GameStoreState } from './gameStore';
import type {
  CropId,
  PlotId,
  PlotData,
  ProduceStack,
  PetData,
  EggData,
} from './storeTypes';

export const selectCoins = (state: GameStoreState): number => state.player.coins;

export const selectCanAfford =
  (cost: number) =>
  (state: GameStoreState): boolean =>
    state.player.coins >= cost;

export const selectSeedCount =
  (cropId: CropId) =>
  (state: GameStoreState): number =>
    state.inventory.seeds[cropId] ?? 0;

export const selectProduceStacks = (state: GameStoreState): ProduceStack[] =>
  state.inventory.produce;

export const selectTotalProduceCount = (state: GameStoreState): number =>
  state.inventory.produce.reduce((sum, stack) => sum + stack.quantity, 0);

export const selectTotalProduceValue = (state: GameStoreState): number =>
  state.inventory.produce.reduce((sum, stack) => {
    const crop = CROPS[stack.cropId];
    if (!crop) return sum;
    const multiplier = MUTATION_MULTIPLIERS[stack.mutation] ?? 1;
    return sum + crop.baseSalePrice * multiplier * stack.quantity;
  }, 0);

export const selectPlotById =
  (plotId: PlotId) =>
  (state: GameStoreState): PlotData | undefined =>
    state.farm.plots[plotId];

export const selectPlotsList = (state: GameStoreState): PlotData[] =>
  Object.values(state.farm.plots);

export const selectHarvestablePlots = (state: GameStoreState): PlotData[] =>
  Object.values(state.farm.plots).filter((plot) => {
    if (!plot.crop) return false;
    const def = CROPS[plot.crop.cropId];
    if (!def) return false;
    return plot.crop.growthProgressSec >= def.baseGrowthSec;
  });

export const selectHarvestableCount = (state: GameStoreState): number =>
  selectHarvestablePlots(state).length;

export const selectEquippedPet = (state: GameStoreState): PetData | null => {
  const id = state.inventory.equippedPetId;
  if (!id) return null;
  return state.inventory.pets.find((pet) => pet.id === id) ?? null;
};

export const selectIncubatingEgg = (state: GameStoreState): EggData | null => {
  const id = state.inventory.incubatingEggId;
  if (!id) return null;
  return state.inventory.eggs.find((egg) => egg.id === id) ?? null;
};

export interface ActivePerks {
  growthSpeedMultiplier: number;
  autoHarvest: boolean;
  mutationChanceMultiplier: number;
}

export const selectActivePerks = (state: GameStoreState): ActivePerks => {
  const pet = selectEquippedPet(state);
  if (!pet) {
    return {
      growthSpeedMultiplier: 1.0,
      autoHarvest: false,
      mutationChanceMultiplier: 1.0,
    };
  }

  return {
    growthSpeedMultiplier:
      pet.type === 'bee' ? PET_PERKS.bee.growthSpeedMultiplier : 1.0,
    autoHarvest: pet.type === 'dog',
    mutationChanceMultiplier:
      pet.type === 'pig' ? PET_PERKS.pig.mutationChanceMultiplier : 1.0,
  };
};

export interface CanExpandResult {
  canExpand: boolean;
  nextSize?: 6 | 8;
  cost?: number;
}

export const selectCanExpand = (state: GameStoreState): CanExpandResult => {
  const current = state.farm.gridSize;
  if (current === 4) {
    return { canExpand: true, nextSize: 6, cost: EXPANSION_1_COST };
  }
  if (current === 6) {
    return { canExpand: true, nextSize: 8, cost: EXPANSION_2_COST };
  }
  return { canExpand: false };
};

export const selectPetCount = (state: GameStoreState): number =>
  state.inventory.pets.length + state.inventory.eggs.length;

export const selectIsPetLimitReached = (state: GameStoreState): boolean =>
  selectPetCount(state) >= MAX_PET_INVENTORY;

export const selectGridDimensions = (
  state: GameStoreState
): { gridSize: 4 | 6 | 8; totalPlots: number } => ({
  gridSize: state.farm.gridSize,
  totalPlots: Object.keys(state.farm.plots).length,
});
