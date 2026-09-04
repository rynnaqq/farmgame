import { useGameStore } from '../../state/gameStore';
import {
  HYDRATION_DURATION_BASIC_MS,
  HYDRATION_DURATION_HEATWAVE_MS,
  GOLDEN_WATERING_CAN_RADIUS,
  type CropId,
  type MutationType,
  type WeatherType,
} from '../core/constants';
import type { PlotId, PlotData, ToolType, CommandResult } from '../../state/storeTypes';
import { getCropDefinition, calculateSaleValue } from './cropDefinitions';
import { isPlotHarvestable } from './plotMachine';
import { isInsidePlantingArea, findSpacingViolation, findPlotsInRadius } from '../world/farmLayout';
import { audioManager } from '../audio/AudioManager';

/**
 * Plants a seed at a free world position inside the farm land.
 * Validation runs entirely before any state change so failed attempts
 * never consume seeds. There is no tile grid and no plot count limit.
 */
export function plantCropAt(
  x: number,
  z: number,
  cropId: CropId,
  nowMs: number = Date.now()
): CommandResult<{ plotId: PlotId }> {
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return {
      ok: false,
      reason: 'invalid_plot_state',
      message: 'Invalid planting position',
    };
  }

  if (!isInsidePlantingArea(x, z)) {
    return {
      ok: false,
      reason: 'outside_planting_area',
      message: 'Plant inside the farm land',
    };
  }

  const store = useGameStore.getState();

  const blockingPlotId = findSpacingViolation(x, z, store.farm.plots);
  if (blockingPlotId) {
    return {
      ok: false,
      reason: 'too_close',
      message: 'Too close to another crop',
    };
  }

  const cropDef = getCropDefinition(cropId);
  if (!cropDef) {
    return {
      ok: false,
      reason: 'unknown',
      message: `Unknown crop type: ${cropId}`,
    };
  }

  const seedCount = store.inventory.seeds[cropId] ?? 0;
  if (seedCount < 1) {
    return {
      ok: false,
      reason: 'insufficient_seeds',
      message: `No ${cropDef.name} seeds in inventory`,
    };
  }

  const deducted = store.deductSeed(cropId, 1);
  if (!deducted) {
    return {
      ok: false,
      reason: 'insufficient_seeds',
      message: `Failed to deduct ${cropDef.name} seed`,
    };
  }

  const plot = store.addPlot(x, z, {
    cropId,
    plantedAtUtcMs: nowMs,
    growthProgressSec: 0,
    mutation: 'none',
  });

  audioManager.playSfx('plant');

  return {
    ok: true,
    value: { plotId: plot.id },
    message: `Planted ${cropDef.name}`,
  };
}

function getPlotOrFail(
  plotId: PlotId
): { ok: true; plot: PlotData } | { ok: false; result: CommandResult<never> } {
  const plot = useGameStore.getState().farm.plots[plotId];
  if (!plot) {
    return {
      ok: false,
      result: {
        ok: false,
        reason: 'invalid_plot_state',
        message: 'Crop no longer exists',
      },
    };
  }
  return { ok: true, plot };
}

/**
 * Waters a planted crop. Golden Watering Can hydrates every plot within
 * radius. Duration depends on weather (60s in Heatwave, 120s basic).
 * Rewatering resets expiry without stacking.
 */
export function waterPlot(
  plotId: PlotId,
  isGoldenCan?: boolean,
  weather?: WeatherType,
  nowMs: number = Date.now()
): CommandResult<{ hydratedPlotIds: PlotId[] }> {
  const validation = getPlotOrFail(plotId);
  if (!validation.ok) {
    return validation.result;
  }

  const { plot } = validation;
  const store = useGameStore.getState();

  const effectiveWeather = weather ?? store.weather.current;
  const durationMs =
    effectiveWeather === 'heatwave' ? HYDRATION_DURATION_HEATWAVE_MS : HYDRATION_DURATION_BASIC_MS;
  const targetHydratedUntil = nowMs + durationMs;

  const effectiveGoldenCan = isGoldenCan ?? store.farm.goldenWateringCanOwned;
  const hydratedPlotIds: PlotId[] = [];
  const plotUpdates: Record<PlotId, Partial<PlotData>> = {};

  if (effectiveGoldenCan) {
    const neighbors = findPlotsInRadius(
      plot.x,
      plot.z,
      store.farm.plots,
      GOLDEN_WATERING_CAN_RADIUS
    );
    for (const neighbor of neighbors) {
      hydratedPlotIds.push(neighbor.id);
      plotUpdates[neighbor.id] = {
        hydratedUntilUtcMs: targetHydratedUntil,
      };
    }
  } else {
    hydratedPlotIds.push(plot.id);
    plotUpdates[plot.id] = {
      hydratedUntilUtcMs: targetHydratedUntil,
    };
  }

  store.updatePlots(plotUpdates);
  audioManager.playSfx('water');

  return {
    ok: true,
    value: { hydratedPlotIds },
    message: 'Crop watered',
  };
}

/**
 * Harvests a mature crop. Atomically moves produce to inventory and removes
 * the plot, freeing the soil for new planting.
 */
export function harvestCrop(
  plotId: PlotId
): CommandResult<{ cropId: CropId; mutation: MutationType; saleValue: number }> {
  const validation = getPlotOrFail(plotId);
  if (!validation.ok) {
    return validation.result;
  }

  const { plot } = validation;
  const store = useGameStore.getState();

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
  store.removePlot(plotId);

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

export interface PlotActionOptions {
  isGoldenCan?: boolean;
  weather?: WeatherType;
  nowMs?: number;
}

/**
 * Applies a tool to an existing crop plot (watering can, harvest hand).
 * Seed bag has no effect on planted plots — plant on empty soil instead.
 */
export function executePlotAction(
  plotId: PlotId,
  tool: ToolType,
  options?: PlotActionOptions
): CommandResult<unknown> {
  switch (tool) {
    case 'watering_can':
      return waterPlot(plotId, options?.isGoldenCan, options?.weather, options?.nowMs);
    case 'seed_bag':
      return {
        ok: false,
        reason: 'invalid_plot_state',
        message: 'Plot is already planted',
      };
    case 'scythe':
    case 'hand':
      return harvestCrop(plotId);
    default:
      return {
        ok: false,
        reason: 'wrong_tool',
        message: `Unknown or invalid tool: ${tool}`,
      };
  }
}

/**
 * Plants the selected seed at a free world position.
 */
export function executePlantAt(
  x: number,
  z: number,
  cropId: CropId,
  nowMs: number = Date.now()
): CommandResult<{ plotId: PlotId }> {
  return plantCropAt(x, z, cropId, nowMs);
}
