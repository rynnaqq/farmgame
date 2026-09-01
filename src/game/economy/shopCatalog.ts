import {
  CROPS,
  EGG_CONFIGS,
  type CropId,
  type EggType,
  type PetType,
} from '../core/constants';
import { CROP_IDS } from '../farming/cropDefinitions';
import {
  UPGRADE_CONFIGS,
  type UpgradeId,
} from './economyDefinitions';
import { useGameStore } from '../../state/gameStore';

export interface SeedCatalogItem {
  cropId: CropId;
  name: string;
  seedCost: number;
  cost5x: number;
  baseGrowthSec: number;
  baseGrowthMs: number;
  baseSalePrice: number;
  visualIdentity: string;
}

export interface UpgradeCatalogItem {
  id: UpgradeId;
  name: string;
  cost: number;
  description: string;
  isAvailable: boolean;
  isOwned: boolean;
  targetGridSize?: 6 | 8;
  requiredGridSize?: 4 | 6;
}

export interface EggCatalogItem {
  eggType: EggType;
  name: string;
  cost: number;
  weights: Record<PetType, number>;
  description: string;
  perkSummary: string;
}

/**
 * Returns catalog data for all seeds purchasable in the shop.
 */
export function getSeedCatalog(): SeedCatalogItem[] {
  return CROP_IDS.map((id) => {
    const crop = CROPS[id];
    return {
      cropId: id,
      name: crop.name,
      seedCost: crop.seedCost,
      cost5x: crop.seedCost * 5,
      baseGrowthSec: crop.baseGrowthSec,
      baseGrowthMs: crop.baseGrowthMs,
      baseSalePrice: crop.baseSalePrice,
      visualIdentity: crop.visualIdentity,
    };
  });
}

/**
 * Returns catalog data for permanent farm upgrades (Golden Watering Can & Grid Expansions).
 * Dynamically computes availability and ownership based on current farm state.
 */
export function getUpgradeCatalog(
  gridSize?: 4 | 6 | 8,
  goldenCanOwned?: boolean
): UpgradeCatalogItem[] {
  const store = useGameStore.getState();
  const currentGridSize = gridSize ?? store.farm.gridSize;
  const isGoldenCanOwned = goldenCanOwned ?? store.farm.goldenWateringCanOwned;

  const goldenCanDef = UPGRADE_CONFIGS.golden_can;
  const exp6Def = UPGRADE_CONFIGS.expansion_6x6;
  const exp8Def = UPGRADE_CONFIGS.expansion_8x8;

  return [
    {
      id: goldenCanDef.id,
      name: goldenCanDef.name,
      cost: goldenCanDef.cost,
      description: goldenCanDef.description,
      isAvailable: !isGoldenCanOwned,
      isOwned: isGoldenCanOwned,
    },
    {
      id: exp6Def.id,
      name: exp6Def.name,
      cost: exp6Def.cost,
      description: exp6Def.description,
      isAvailable: currentGridSize === 4,
      isOwned: currentGridSize >= 6,
      targetGridSize: exp6Def.targetGridSize,
      requiredGridSize: exp6Def.requiredGridSize,
    },
    {
      id: exp8Def.id,
      name: exp8Def.name,
      cost: exp8Def.cost,
      description: exp8Def.description,
      isAvailable: currentGridSize === 6,
      isOwned: currentGridSize >= 8,
      targetGridSize: exp8Def.targetGridSize,
      requiredGridSize: exp8Def.requiredGridSize,
    },
  ];
}

/**
 * Returns catalog data for companion eggs in the shop.
 */
export function getEggCatalog(): EggCatalogItem[] {
  const eggTypes: EggType[] = ['common', 'rare'];

  return eggTypes.map((type) => {
    const config = EGG_CONFIGS[type];
    const perkSummary =
      type === 'common'
        ? 'Rolls Dog (60%), Bee (35%), Pig (5%)'
        : 'Rolls Pig (50%), Bee (30%), Dog (20%)';

    const description =
      type === 'common'
        ? 'A standard egg with high dog and bee hatch probability.'
        : 'A rare egg with high probability of hatching the lucky Pig companion.';

    return {
      eggType: type,
      name: config.name,
      cost: config.cost,
      weights: { ...config.weights },
      description,
      perkSummary,
    };
  });
}
