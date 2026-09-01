import {
  CROPS,
  MUTATION_MULTIPLIERS,
  type CropId,
  type CropDefinition,
  type MutationType,
} from '../core/constants';

export type { CropId, CropDefinition, MutationType };

/**
 * Fixed ordered list of all crop identifiers in the game.
 */
export const CROP_IDS: readonly CropId[] = [
  'carrot',
  'tomato',
  'pumpkin',
  'golden_berry',
  'starfruit',
] as const;

/**
 * Global registry of crop configurations and balance values.
 */
export const CROPS_RECORD: Record<CropId, CropDefinition> = CROPS;

/**
 * Look up a crop definition by its identifier.
 * Returns undefined if the cropId is not recognized.
 */
export function getCropDefinition(cropId: CropId | string): CropDefinition | undefined {
  if (!cropId || !(cropId in CROPS_RECORD)) {
    return undefined;
  }
  return CROPS_RECORD[cropId as CropId];
}

/**
 * Returns a list of all active crop definitions in the game.
 */
export function getAllCrops(): CropDefinition[] {
  return Object.values(CROPS_RECORD);
}

/**
 * Calculates the total sell value for a given crop type, mutation variant, and quantity.
 * Multipliers: None: 1x, Giant: 3x, Gold: 5x, Cosmic: 15x.
 */
export function calculateSaleValue(
  cropId: CropId | string,
  mutation: MutationType = 'none',
  quantity: number = 1
): number {
  const crop = getCropDefinition(cropId);
  if (!crop || quantity <= 0) {
    return 0;
  }

  const multiplier = MUTATION_MULTIPLIERS[mutation] ?? 1;
  return crop.baseSalePrice * multiplier * quantity;
}
