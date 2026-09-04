import {
  EGG_CONFIGS,
  GOLDEN_WATERING_CAN_COST,
  type CropId,
  type CropDefinition,
  type EggType,
  type EggDefinition,
  type PetType,
  type MutationType,
} from '../core/constants';
import type { SeededRNG } from '../core/rng';
import { calculateSaleValue } from '../farming/cropDefinitions';

export type UpgradeId = 'golden_can';

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  cost: number;
  description: string;
}

export const UPGRADE_CONFIGS: Record<'golden_can', UpgradeDefinition> = {
  golden_can: {
    id: 'golden_can',
    name: 'Golden Watering Can',
    cost: GOLDEN_WATERING_CAN_COST,
    description: 'Waters every crop in a wide area at once',
  },
} as const;

/**
 * Retrieves the configuration for a given egg type.
 */
export function getEggDefinition(eggType: EggType | string): EggDefinition {
  if (eggType === 'rare') {
    return EGG_CONFIGS.rare;
  }
  return EGG_CONFIGS.common;
}

/**
 * Performs a deterministic outcome roll for an egg purchase using SeededRNG.
 * - Common: Dog 60%, Bee 35%, Pig 5%
 * - Rare: Pig 50%, Bee 30%, Dog 20%
 */
export function rollEggOutcome(eggType: EggType, rng: SeededRNG): PetType {
  const eggDef = getEggDefinition(eggType);
  const entries: [PetType, number][] = Object.entries(eggDef.weights) as [PetType, number][];
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);

  const roll = rng.nextFloat() * totalWeight;
  let cumulative = 0;

  for (const [petType, weight] of entries) {
    cumulative += weight;
    if (roll < cumulative) {
      return petType;
    }
  }

  return entries[entries.length - 1][0];
}

/**
 * Calculates produce sale value given crop, mutation, and quantity.
 */
export function calculateProduceSaleValue(
  cropId: CropId | string,
  mutation: MutationType = 'none',
  quantity: number = 1
): number {
  return calculateSaleValue(cropId, mutation, quantity);
}

export type { CropId, CropDefinition, EggType, EggDefinition, PetType, MutationType };
