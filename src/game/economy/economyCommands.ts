import { useGameStore } from '../../state/gameStore';
import {
  CROPS,
  EGG_CONFIGS,
  GOLDEN_WATERING_CAN_COST,
  EXPANSION_1_COST,
  EXPANSION_2_COST,
  MAX_PET_INVENTORY,
  type CropId,
  type EggType,
  type MutationType,
  type PetType,
} from '../core/constants';
import type { CommandResult, EggData } from '../../state/storeTypes';
import type { SeededRNG } from '../core/rng';
import {
  calculateProduceSaleValue,
  rollEggOutcome,
  type UpgradeId,
} from './economyDefinitions';

/**
 * Purchases a batch of seeds for a given crop type.
 * Deducts coins and adds seeds atomically.
 */
export function buySeed(
  cropId: CropId,
  quantity: number
): CommandResult<{ cropId: CropId; quantity: number; cost: number }> {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return {
      ok: false,
      reason: 'unknown',
      message: 'Quantity must be a positive integer',
    };
  }

  const crop = CROPS[cropId];
  if (!crop) {
    return {
      ok: false,
      reason: 'unknown',
      message: `Invalid crop type: ${cropId}`,
    };
  }

  const totalCost = crop.seedCost * quantity;
  const store = useGameStore.getState();

  if (store.player.coins < totalCost) {
    return {
      ok: false,
      reason: 'insufficient_coins',
      message: `Insufficient coins to buy ${quantity}x ${crop.name} seeds (need ${totalCost}c, have ${store.player.coins}c)`,
    };
  }

  const deducted = store.deductCoins(totalCost);
  if (!deducted) {
    return {
      ok: false,
      reason: 'insufficient_coins',
      message: `Failed to deduct ${totalCost} coins`,
    };
  }

  store.addSeeds(cropId, quantity);

  return {
    ok: true,
    value: { cropId, quantity, cost: totalCost },
    message: `Purchased ${quantity}x ${crop.name} seeds`,
  };
}

/**
 * Sells produce from inventory (either a specified quantity or entire stack).
 * Credits coins and removes produce atomically.
 */
export function sellProduce(
  cropId: CropId,
  mutation: MutationType = 'none',
  quantity?: number
): CommandResult<{ coinsEarned: number; itemsSold: number }> {
  const crop = CROPS[cropId];
  if (!crop) {
    return {
      ok: false,
      reason: 'unknown',
      message: `Invalid crop type: ${cropId}`,
    };
  }

  const store = useGameStore.getState();
  const stack = store.inventory.produce.find(
    (p) => p.cropId === cropId && p.mutation === mutation
  );

  if (!stack || stack.quantity <= 0) {
    return {
      ok: false,
      reason: 'unknown',
      message: `No ${crop.name} (${mutation}) produce in inventory`,
    };
  }

  let qtyToSell = stack.quantity;
  if (quantity !== undefined) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return {
        ok: false,
        reason: 'unknown',
        message: 'Sell quantity must be a positive integer',
      };
    }
    if (quantity > stack.quantity) {
      return {
        ok: false,
        reason: 'unknown',
        message: `Cannot sell ${quantity} items; only ${stack.quantity} available`,
      };
    }
    qtyToSell = quantity;
  }

  const coinsEarned = calculateProduceSaleValue(cropId, mutation, qtyToSell);
  const removed = store.removeProduce(cropId, mutation, qtyToSell);
  if (!removed) {
    return {
      ok: false,
      reason: 'unknown',
      message: 'Failed to remove produce from inventory',
    };
  }

  store.addCoins(coinsEarned);

  return {
    ok: true,
    value: { coinsEarned, itemsSold: qtyToSell },
    message: `Sold ${qtyToSell}x ${crop.name} (${mutation}) for ${coinsEarned} coins`,
  };
}

/**
 * Sells all produce currently in inventory in a single atomic transaction.
 */
export function sellAllProduce(): CommandResult<{ totalCoinsEarned: number; itemsSold: number }> {
  const store = useGameStore.getState();
  const produceStacks = store.inventory.produce;

  if (produceStacks.length === 0) {
    return {
      ok: true,
      value: { totalCoinsEarned: 0, itemsSold: 0 },
      message: 'No produce to sell',
    };
  }

  const totalCoinsEarned = produceStacks.reduce(
    (sum, stack) => sum + calculateProduceSaleValue(stack.cropId, stack.mutation, stack.quantity),
    0
  );
  const itemsSold = produceStacks.reduce((sum, stack) => sum + stack.quantity, 0);

  store.clearAllProduce();
  store.addCoins(totalCoinsEarned);

  return {
    ok: true,
    value: { totalCoinsEarned, itemsSold },
    message: `Sold ${itemsSold} items for ${totalCoinsEarned} coins`,
  };
}

/**
 * Buys the permanent Golden Watering Can upgrade (1200 coins).
 */
export function buyGoldenWateringCan(): CommandResult<{ cost: number }> {
  const store = useGameStore.getState();

  if (store.farm.goldenWateringCanOwned) {
    return {
      ok: false,
      reason: 'already_owned',
      message: 'Golden Watering Can is already owned',
    };
  }

  const cost = GOLDEN_WATERING_CAN_COST;
  if (store.player.coins < cost) {
    return {
      ok: false,
      reason: 'insufficient_coins',
      message: `Insufficient coins for Golden Watering Can (need ${cost}c, have ${store.player.coins}c)`,
    };
  }

  const deducted = store.deductCoins(cost);
  if (!deducted) {
    return {
      ok: false,
      reason: 'insufficient_coins',
      message: `Failed to deduct ${cost} coins`,
    };
  }

  store.setGoldenWateringCan(true);

  return {
    ok: true,
    value: { cost },
    message: 'Purchased Golden Watering Can',
  };
}

/**
 * Buys the next available farm grid expansion (4x4 -> 6x6 for 750c, or 6x6 -> 8x8 for 3500c).
 */
export function buyGridExpansion(): CommandResult<{ newGridSize: 6 | 8; cost: number }> {
  const store = useGameStore.getState();
  const currentSize = store.farm.gridSize;

  let targetSize: 6 | 8;
  let cost: number;

  if (currentSize === 4) {
    targetSize = 6;
    cost = EXPANSION_1_COST;
  } else if (currentSize === 6) {
    targetSize = 8;
    cost = EXPANSION_2_COST;
  } else {
    return {
      ok: false,
      reason: 'already_owned',
      message: 'Farm is already at maximum grid size (8x8)',
    };
  }

  if (store.player.coins < cost) {
    return {
      ok: false,
      reason: 'insufficient_coins',
      message: `Insufficient coins for grid expansion (need ${cost}c, have ${store.player.coins}c)`,
    };
  }

  const deducted = store.deductCoins(cost);
  if (!deducted) {
    return {
      ok: false,
      reason: 'insufficient_coins',
      message: `Failed to deduct ${cost} coins`,
    };
  }

  store.setGridSize(targetSize);

  return {
    ok: true,
    value: { newGridSize: targetSize, cost },
    message: `Expanded farm grid to ${targetSize}x${targetSize}`,
  };
}

/**
 * Unified upgrade purchase dispatcher.
 */
export function buyUpgrade(
  upgradeId: UpgradeId | 'expansion_6x6' | 'expansion_8x8' | 'golden_can' | 'grid_expansion'
): CommandResult<unknown> {
  const store = useGameStore.getState();

  switch (upgradeId) {
    case 'golden_can':
      return buyGoldenWateringCan();

    case 'grid_expansion':
      return buyGridExpansion();

    case 'expansion_6x6':
      if (store.farm.gridSize >= 6) {
        return {
          ok: false,
          reason: 'already_owned',
          message: 'Farm is already 6x6 or larger',
        };
      }
      return buyGridExpansion();

    case 'expansion_8x8':
      if (store.farm.gridSize === 4) {
        return {
          ok: false,
          reason: 'unknown',
          message: 'Must purchase 6x6 expansion before 8x8 expansion',
        };
      }
      if (store.farm.gridSize >= 8) {
        return {
          ok: false,
          reason: 'already_owned',
          message: 'Farm is already at maximum 8x8 size',
        };
      }
      return buyGridExpansion();

    default:
      return {
        ok: false,
        reason: 'unknown',
        message: `Unknown upgrade: ${upgradeId}`,
      };
  }
}

/**
 * Purchases a companion egg and determines its deterministic pet outcome at purchase time.
 * Enforces the 12-slot pet & egg inventory capacity cap.
 */
export function buyEgg(
  eggType: EggType,
  rng: SeededRNG,
  nowMs: number = Date.now()
): CommandResult<{ eggId: string; outcomePetType: PetType }> {
  const eggDef = EGG_CONFIGS[eggType];
  if (!eggDef) {
    return {
      ok: false,
      reason: 'unknown',
      message: `Invalid egg type: ${eggType}`,
    };
  }

  const store = useGameStore.getState();
  const totalOccupiedSlots = store.inventory.pets.length + store.inventory.eggs.length;

  if (totalOccupiedSlots >= MAX_PET_INVENTORY) {
    return {
      ok: false,
      reason: 'max_pets_reached',
      message: `Pet and egg inventory full (maximum ${MAX_PET_INVENTORY} slots)`,
    };
  }

  if (store.player.coins < eggDef.cost) {
    return {
      ok: false,
      reason: 'insufficient_coins',
      message: `Insufficient coins to buy ${eggDef.name} (need ${eggDef.cost}c, have ${store.player.coins}c)`,
    };
  }

  const outcomePetType = rollEggOutcome(eggType, rng);
  store.setRngState(rng.getState());

  const deducted = store.deductCoins(eggDef.cost);
  if (!deducted) {
    return {
      ok: false,
      reason: 'insufficient_coins',
      message: `Failed to deduct ${eggDef.cost} coins`,
    };
  }

  const eggId = `egg-${nowMs}-${store.inventory.eggs.length + 1}-${Math.floor(rng.nextFloat() * 1000000)}`;
  const newEgg: EggData = {
    id: eggId,
    type: eggType,
    purchasedAtUtcMs: nowMs,
    outcome: outcomePetType,
    incubating: false,
    elapsedIncubationSec: 0,
    distanceTraveled: 0,
  };

  store.addEgg(newEgg);

  return {
    ok: true,
    value: { eggId, outcomePetType },
    message: `Purchased ${eggDef.name}`,
  };
}
