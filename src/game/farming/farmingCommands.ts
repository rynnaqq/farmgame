import { useGameStore } from '../../state/gameStore';
import {
  FARMING_REACH,
  HYDRATION_DURATION_BASIC_MS,
  HYDRATION_DURATION_HEATWAVE_MS,
  type CropId,
  type MutationType,
  type WeatherType,
} from '../core/constants';
import type {
  PlotId,
  PlotData,
  ToolType,
  CommandResult,
} from '../../state/storeTypes';
import {
  getPlotPosition,
  getPlotDistance,
  isPlotUnlocked,
  getPlotId,
} from '../world/gridCoordinates';
import { getCropDefinition, calculateSaleValue } from './cropDefinitions';
import { isPlotHarvestable } from './plotMachine';

/**
 * Validates that a target plot exists, is unlocked within current farm bounds,
 * and is within physical player interaction reach if playerPos is provided.
 */
function getPlotAndValidateRange(
  plotId: PlotId,
  playerPos?: [number, number, number]
):
  | { ok: true; plot: PlotData; gridSize: 4 | 6 | 8 }
  | { ok: false; result: CommandResult<never> } {
  const store = useGameStore.getState();
  const plot = store.farm.plots[plotId];
  const gridSize = store.farm.gridSize;

  if (!plot || !isPlotUnlocked(plot.row, plot.col, gridSize)) {
    return {
      ok: false,
      result: {
        ok: false,
        reason: 'plot_locked',
        message: 'Plot is locked or does not exist',
      },
    };
  }

  if (playerPos) {
    const plotPos = getPlotPosition(plot.row, plot.col, gridSize);
    const distance = getPlotDistance(playerPos, plotPos);
    if (distance > FARMING_REACH) {
      return {
        ok: false,
        result: {
          ok: false,
          reason: 'out_of_range',
          message: 'Move closer to the plot',
        },
      };
    }
  }

  return { ok: true, plot, gridSize };
}

/**
 * Tills an untilled plot if empty and in reach.
 */
export function tillPlot(
  plotId: PlotId,
  playerPos?: [number, number, number]
): CommandResult<{ plotId: PlotId }> {
  const validation = getPlotAndValidateRange(plotId, playerPos);
  if (!validation.ok) {
    return validation.result;
  }

  const { plot } = validation;

  if (plot.crop !== null) {
    return {
      ok: false,
      reason: 'invalid_plot_state',
      message: 'Plot already has a crop',
    };
  }

  if (plot.tilled) {
    return {
      ok: false,
      reason: 'invalid_plot_state',
      message: 'Plot is already tilled',
    };
  }

  useGameStore.getState().setPlot({
    ...plot,
    tilled: true,
  });

  return {
    ok: true,
    value: { plotId },
    message: 'Soil tilled',
  };
}

/**
 * Waters a tilled plot.
 * Supports Golden Watering Can (3x3 grid hydration of unlocked tilled neighbor plots)
 * and adjusts hydration duration based on current weather (60s in Heatwave, 120s basic).
 * Rewatering resets expiry without stacking.
 */
export function waterPlot(
  plotId: PlotId,
  playerPos?: [number, number, number],
  isGoldenCan?: boolean,
  weather?: WeatherType,
  nowMs: number = Date.now()
): CommandResult<{ hydratedPlotIds: PlotId[] }> {
  const validation = getPlotAndValidateRange(plotId, playerPos);
  if (!validation.ok) {
    return validation.result;
  }

  const { plot, gridSize } = validation;
  const store = useGameStore.getState();

  if (!plot.tilled) {
    return {
      ok: false,
      reason: 'invalid_plot_state',
      message: 'Till soil first before watering',
    };
  }

  const effectiveWeather = weather ?? store.weather.current;
  const durationMs =
    effectiveWeather === 'heatwave'
      ? HYDRATION_DURATION_HEATWAVE_MS
      : HYDRATION_DURATION_BASIC_MS;
  const targetHydratedUntil = nowMs + durationMs;

  const effectiveGoldenCan = isGoldenCan ?? store.farm.goldenWateringCanOwned;
  const hydratedPlotIds: PlotId[] = [];
  const plotUpdates: Record<PlotId, Partial<PlotData>> = {};

  if (effectiveGoldenCan) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = plot.row + dr;
        const c = plot.col + dc;

        if (isPlotUnlocked(r, c, gridSize)) {
          const neighborId = getPlotId(r, c);
          const neighborPlot = store.farm.plots[neighborId];
          if (neighborPlot && neighborPlot.tilled) {
            hydratedPlotIds.push(neighborId);
            plotUpdates[neighborId] = {
              hydratedUntilUtcMs: targetHydratedUntil,
            };
          }
        }
      }
    }
  } else {
    hydratedPlotIds.push(plot.id);
    plotUpdates[plot.id] = {
      hydratedUntilUtcMs: targetHydratedUntil,
    };
  }

  store.updatePlots(plotUpdates);

  return {
    ok: true,
    value: { hydratedPlotIds },
    message: 'Plot watered',
  };
}

/**
 * Plants a seed on a tilled, unoccupied plot.
 * Atomically deducts 1 seed from inventory and creates a 0-progress sprout crop.
 */
export function plantCrop(
  plotId: PlotId,
  cropId: CropId,
  playerPos?: [number, number, number],
  nowMs: number = Date.now()
): CommandResult<{ cropId: CropId }> {
  const validation = getPlotAndValidateRange(plotId, playerPos);
  if (!validation.ok) {
    return validation.result;
  }

  const { plot } = validation;
  const store = useGameStore.getState();

  const cropDef = getCropDefinition(cropId);
  if (!cropDef) {
    return {
      ok: false,
      reason: 'unknown',
      message: `Unknown crop type: ${cropId}`,
    };
  }

  if (!plot.tilled) {
    return {
      ok: false,
      reason: 'invalid_plot_state',
      message: 'Till soil first before planting',
    };
  }

  if (plot.crop !== null) {
    return {
      ok: false,
      reason: 'invalid_plot_state',
      message: 'Plot already has a crop',
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

  store.setPlot({
    ...plot,
    crop: {
      cropId,
      plantedAtUtcMs: nowMs,
      growthProgressSec: 0,
      mutation: 'none',
    },
  });

  return {
    ok: true,
    value: { cropId },
    message: `Planted ${cropDef.name}`,
  };
}

/**
 * Harvests a mature crop from a plot.
 * Atomically removes the crop from the plot and credits produce to player inventory.
 */
export function harvestCrop(
  plotId: PlotId,
  playerPos?: [number, number, number]
): CommandResult<{ cropId: CropId; mutation: MutationType; saleValue: number }> {
  const validation = getPlotAndValidateRange(plotId, playerPos);
  if (!validation.ok) {
    return validation.result;
  }

  const { plot } = validation;
  const store = useGameStore.getState();

  if (!plot.crop) {
    return {
      ok: false,
      reason: 'invalid_plot_state',
      message: 'No crop to harvest on this plot',
    };
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
  });

  return {
    ok: true,
    value: { cropId, mutation, saleValue },
    message: 'Crop harvested',
  };
}

/**
 * Unified action dispatcher based on the equipped tool.
 */
export function executeToolAction(
  plotId: PlotId,
  tool: ToolType,
  selectedSeedId: CropId,
  playerPos?: [number, number, number],
  options?: {
    isGoldenCan?: boolean;
    weather?: WeatherType;
    nowMs?: number;
  }
): CommandResult<unknown> {
  switch (tool) {
    case 'trowel':
      return tillPlot(plotId, playerPos);
    case 'watering_can':
      return waterPlot(
        plotId,
        playerPos,
        options?.isGoldenCan,
        options?.weather,
        options?.nowMs
      );
    case 'seed_bag':
      return plantCrop(plotId, selectedSeedId, playerPos, options?.nowMs);
    case 'scythe':
    case 'hand':
      return harvestCrop(plotId, playerPos);
    default:
      return {
        ok: false,
        reason: 'wrong_tool',
        message: `Unknown or invalid tool: ${tool}`,
      };
  }
}
