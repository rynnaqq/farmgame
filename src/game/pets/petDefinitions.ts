import {
  EGG_CONFIGS,
  MAX_PET_INVENTORY,
  EGG_HATCH_TIME_SEC,
  EGG_HATCH_DISTANCE,
  PET_FOLLOW_MIN_DISTANCE,
  PET_FOLLOW_MAX_DISTANCE,
  PET_TELEPORT_DISTANCE,
  PET_PERKS,
  type PetType,
  type EggType,
  type EggDefinition,
} from '../core/constants';

// Re-export core constants and types with explicit naming
export const EGG_HATCH_SECONDS = EGG_HATCH_TIME_SEC;
export {
  EGG_HATCH_DISTANCE,
  MAX_PET_INVENTORY,
  PET_FOLLOW_MIN_DISTANCE,
  PET_FOLLOW_MAX_DISTANCE,
  PET_TELEPORT_DISTANCE,
  EGG_CONFIGS,
  type PetType,
  type EggType,
  type EggDefinition,
};

export const DOG_AUTO_HARVEST_RANGE = PET_PERKS.dog.harvestRange; // 1.75
export const DOG_AUTO_HARVEST_INTERVAL_MS = PET_PERKS.dog.checkIntervalSec * 1000; // 1000ms
export const DOG_AUTO_HARVEST_INTERVAL_SEC = PET_PERKS.dog.checkIntervalSec; // 1s
export const BEE_GROWTH_SPEED_MULTIPLIER = PET_PERKS.bee.growthSpeedMultiplier; // 1.15
export const PIG_MUTATION_CHANCE_MULTIPLIER = PET_PERKS.pig.mutationChanceMultiplier; // 1.20
export const DOG_OFFLINE_HARVEST_DELAY_SEC = PET_PERKS.dog.offlineHarvestDelaySec; // 30s

export type PerkType = 'growth_speed' | 'auto_harvest' | 'mutation_chance';

export interface PetDefinition {
  id: PetType;
  name: string;
  description: string;
  perkDescription: string;
  perkType: PerkType;
  growthMultiplier?: number;
  autoHarvestIntervalSec?: number;
  autoHarvestRange?: number;
  mutationMultiplier?: number;
}

export const PET_DEFINITIONS: Record<PetType, PetDefinition> = {
  bee: {
    id: 'bee',
    name: 'Bee',
    description: 'A busy buzzing companion that speeds up crop growth across your garden.',
    perkDescription: 'x1.15 crop growth speed',
    perkType: 'growth_speed',
    growthMultiplier: BEE_GROWTH_SPEED_MULTIPLIER,
  },
  dog: {
    id: 'dog',
    name: 'Dog',
    description: 'A loyal helper that automatically harvests mature crops close to it.',
    perkDescription: 'Auto-harvests 1 mature crop/sec within 1.75 units',
    perkType: 'auto_harvest',
    autoHarvestIntervalSec: DOG_AUTO_HARVEST_INTERVAL_SEC,
    autoHarvestRange: DOG_AUTO_HARVEST_RANGE,
  },
  pig: {
    id: 'pig',
    name: 'Pig',
    description: 'A lucky pig with a refined snout for sniffing out rare crop mutations.',
    perkDescription: '+20% relative mutation chance',
    perkType: 'mutation_chance',
    mutationMultiplier: PIG_MUTATION_CHANCE_MULTIPLIER,
  },
} as const;

/**
 * Retrieves the PetDefinition configuration for a given PetType.
 */
export function getPetDefinition(petType: PetType): PetDefinition {
  return PET_DEFINITIONS[petType] ?? PET_DEFINITIONS.dog;
}

/**
 * Calculates the modified mutation chance when the Pig pet is equipped (+20% relative).
 */
export function calculatePigMutationChance(baseChance: number): number {
  return Math.max(0, Math.min(1.0, baseChance * PIG_MUTATION_CHANCE_MULTIPLIER));
}
