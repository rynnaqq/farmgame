import { useGameStore } from '../../state/gameStore';
import {
  FARMING_REACH,
  HYDRATION_DURATION_BASIC_MS,
  HYDRATION_DURATION_HEATWAVE_MS,
  type CropId,
  type MutationType,
  type WeatherType,
} from '../core/constants';
import type { PlotId, ToolType, CommandResult } from '../../state/storeTypes';
import { getCropDefinition, calculateSaleValue } from './cropDefinitions';
import { isPlotHarvestable } from './plotMachine';
import {
  findFirstEmptySlot,
  findNearestPlacedSlots,
  validatePlantPlacement,
  type PlacementSlot,
} from './plantPlacement';
import { placementToWorldPoint, type CropPlacement } from '../world/farmLayout';
import { audioManager } from '../audio/AudioManager';

const PLACEMENT_MESSAGES = {
  invalid_placement: 'Posisi tanam tidak valid',
  outside_planting_area: 'Tanam di area tanah',
  occupied_position: 'Terlalu dekat dengan tanaman lain',
  farm_full: 'Kebun penuh (64/64)',
} as const;

function getSlots(): PlacementSlot[] {
  return Object.values(useGameStore.getState().farm.plots);
}

/**
 * Plants a seed directly at the exact validated free position within a farm bed.
 * Validation (bounds, capacity, spacing, seeds) runs entirely before any state
 * change so failed attempts never consume seeds.
 */
export function plantCropAt(
  placement: CropPlacement,
  cropId: CropId,
  playerPos?: [number, number, number],
  nowMs: number = Date.now()
): CommandResult<{ cropId: CropId; slotId: PlotId }> {
  const store = useGameStore.getState();
  const slots = Object.values(store.farm.plots);
  const validation = validatePlantPlacement(placement, slots);
  if (!validation.ok) {
    return {
      ok: false,
      reason: validation.reason,
      message: PLACEMENT_MESSAGES[validation.reason],
    };
  }

  const world = placementToWorldPoint(placement);
  if (playerPos && Math.hypot(playerPos[0] - world.x, playerPos[2] - world.z) > FARMING_REACH) {
    return { ok: false, reason: 'out_of_range', message: 'Move closer to the crop' };
  }

  const slot = findFirstEmptySlot(slots);
  if (!slot) return { ok: false, reason: 'farm_full', message: PLACEMENT_MESSAGES.farm_full };

  const cropDef = getCropDefinition(cropId);
  if (!cropDef) {
    return { ok: false, reason: 'unknown', message: 'Unknown crop type: ' + cropId };
  }
  if ((store.inventory.seeds[cropId] ?? 0) < 1) {
    return {
      ok: false,
      reason: 'insufficient_seeds',
      message: `No ${cropDef.name} seeds in inventory`,
    };
  }

  if (!store.deductSeed(cropId, 1)) {
    return {
      ok: false,
      reason: 'insufficient_seeds',
      message: `No ${cropDef.name} seeds in inventory`,
    };
  }

  store.setPlot({
    id: slot.id,
    row: slot.row,
    col: slot.col,
    crop: {
      cropId,
      plantedAtUtcMs: nowMs,
      growthProgressSec: 0,
      mutation: 'none',
      placement,
    },
    hydratedUntilUtcMs: 0,
  });

  audioManager.playSfx('plant');

  return {
    ok: true,
    value: { cropId, slotId: slot.id },
    message: `${cropDef.name} ditanam`,
  };
}

/**
 * Waters a planted crop slot.
 * The Golden Watering Can hydrates the source crop plus up to eight more of the
 * closest crops within a 2.4 world-unit radius.
 */
export function waterCrop(
  plotId: PlotId,
  options: {
    playerPos?: [number, number, number];
    isGoldenCan?: boolean;
    weather?: WeatherType;
    nowMs?: number;
  } = {}
): CommandResult<{ hydratedPlotIds: PlotId[] }> {
  const store = useGameStore.getState();
  const source = store.farm.plots[plotId];
  if (!source) {
    return { ok: false, reason: 'plot_locked', message: 'Plot is locked or does not exist' };
  }
  if (!source.crop) {
    return {
      ok: false,
      reason: 'invalid_plot_state',
      message: 'Tidak ada tanaman untuk disiram',
    };
  }

  if (options.playerPos) {
    const world = placementToWorldPoint(source.crop.placement);
    const distance = Math.hypot(
      options.playerPos[0] - world.x,
      options.playerPos[2] - world.z
    );
    if (distance > FARMING_REACH) {
      return { ok: false, reason: 'out_of_range', message: 'Move closer to the crop' };
    }
  }

  const nowMs = options.nowMs ?? Date.now();
  const duration =
    (options.weather ?? store.weather.current) === 'heatwave'
      ? HYDRATION_DURATION_HEATWAVE_MS
      : HYDRATION_DURATION_BASIC_MS;
  const targetHydratedUntil = nowMs + duration;

  const effectiveGoldenCan = options.isGoldenCan ?? store.farm.goldenWateringCanOwned;
  const targets = effectiveGoldenCan
    ? [
        source,
        ...findNearestPlacedSlots(
          source.crop.placement,
          getSlots(),
          8,
          2.4,
          source.id
        ).map((slot) => useGameStore.getState().farm.plots[slot.id]),
      ]
    : [source];

  const updates = Object.fromEntries(
    targets.map((target) => [target.id, { hydratedUntilUtcMs: targetHydratedUntil }])
  );
  store.updatePlots(updates);
  audioManager.playSfx('water');

  return {
    ok: true,
    value: { hydratedPlotIds: targets.map((target) => target.id) },
    message: 'Tanaman disiram',
  };
}

/**
 * Harvests a mature crop from a plot.
 * Atomically removes the crop (and its placement) and credits produce to inventory.
 */
export function harvestCrop(
  plotId: PlotId,
  playerPos?: [number, number, number]
): CommandResult<{ cropId: CropId; mutation: MutationType; saleValue: number }> {
  const store = useGameStore.getState();
  const plot = store.farm.plots[plotId];
  if (!plot) {
    return { ok: false, reason: 'plot_locked', message: 'Plot is locked or does not exist' };
  }

  if (!plot.crop) {
    return {
      ok: false,
      reason: 'invalid_plot_state',
      message: 'No crop to harvest on this plot',
    };
  }

  if (playerPos) {
    const world = placementToWorldPoint(plot.crop.placement);
    const distance = Math.hypot(playerPos[0] - world.x, playerPos[2] - world.z);
    if (distance > FARMING_REACH) {
      return { ok: false, reason: 'out_of_range', message: 'Move closer to the crop' };
    }
  }

  if (!isPlotHarvestable(plot)) {
    return {
      ok: false,
      reason: 'not_mature',
      message: 'Crop is not ready for harvest',
    };
  }

  const { cropId, mutation } = plot.crop;
  const saleValue = calculateSaleValue(cropId, mutation, 1);

  store.addProduce(cropId, mutation, 1);
  store.setPlot({
    ...plot,
    crop: null,
    hydratedUntilUtcMs: 0,
  });

  audioManager.playSfx('harvest');
  if (mutation !== 'none') {
    audioManager.playSfx('mutation', { mutationType: mutation });
  }

  return {
    ok: true,
    value: { cropId, mutation, saleValue },
    message: 'Crop harvested',
  };
}

/**
 * Unified plant dispatcher used when the player taps/clicks farm soil with the
 * seed bag equipped.
 */
export function executePlantAction(
  placement: CropPlacement,
  cropId: CropId,
  options: { playerPos?: [number, number, number]; nowMs?: number } = {}
) {
  return plantCropAt(placement, cropId, options.playerPos, options.nowMs);
}

/**
 * Unified crop interaction dispatcher (Water / Harvest) based on the equipped tool.
 */
export function executeCropAction(
  plotId: PlotId,
  tool: ToolType,
  options: {
    playerPos?: [number, number, number];
    isGoldenCan?: boolean;
    weather?: WeatherType;
    nowMs?: number;
  } = {}
): CommandResult<unknown> {
  if (tool === 'watering_can') {
    return waterCrop(plotId, options);
  }
  if (tool === 'hand' || tool === 'scythe') {
    return harvestCrop(plotId, options.playerPos);
  }
  return { ok: false, reason: 'wrong_tool', message: 'Pilih Water atau Harvest' };
}
