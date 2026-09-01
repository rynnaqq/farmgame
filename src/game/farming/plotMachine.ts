import type { PlotData, PlotState, CropStage, ToolType } from '../../state/storeTypes';
import { CROP_STAGE_MID_MIN, CROP_STAGE_GROWN_MIN } from '../core/constants';
import { getCropDefinition } from './cropDefinitions';

export interface ValidToolActionResult {
  validTools: ToolType[];
  primaryAction: string;
  reason?: string;
}

/**
 * Evaluates the visual growth stage of a crop given its progress and target duration in seconds.
 * - Sprout: 0% - 32.99%
 * - Mid: 33% - 74.99%
 * - Grown: 75% - 100%+
 */
export function evaluateCropStage(progressSeconds: number, requiredSeconds: number): CropStage {
  if (requiredSeconds <= 0) {
    return 'grown';
  }

  const progressRatio = Math.max(0, progressSeconds) / requiredSeconds;

  if (progressRatio < CROP_STAGE_MID_MIN) {
    return 'sprout';
  }
  if (progressRatio < CROP_STAGE_GROWN_MIN) {
    return 'mid';
  }
  return 'grown';
}

/**
 * Determines whether a plot currently has active hydration.
 * Untilled soil cannot hold hydration.
 */
export function isPlotHydrated(plot: PlotData, nowMs: number): boolean {
  return plot.tilled && plot.hydratedUntilUtcMs > nowMs;
}

/**
 * Determines whether a plot's crop has reached 100% maturity and is ready for harvesting.
 */
export function isPlotHarvestable(plot: PlotData): boolean {
  if (!plot.crop) {
    return false;
  }

  const cropDef = getCropDefinition(plot.crop.cropId);
  if (!cropDef) {
    return false;
  }

  return plot.crop.growthProgressSec >= cropDef.baseGrowthSec;
}

/**
 * Computes the discrete high-level plot state based on soil preparation, crop status,
 * and hydration expiry.
 *
 * 1. Untilled: soil is not prepared and no crop exists.
 * 2. Tilled: soil is prepared, empty, and not hydrated.
 * 3. Planted: a crop exists but the plot is not currently hydrated.
 * 4. Watered: prepared soil is hydrated; a planted crop can progress.
 * 5. Harvestable: crop progress is 100%.
 */
export function evaluatePlotState(plot: PlotData, nowMs: number): PlotState {
  if (isPlotHarvestable(plot)) {
    return 'harvestable';
  }

  const hydrated = isPlotHydrated(plot, nowMs);

  if (hydrated) {
    return 'watered';
  }

  if (plot.crop !== null) {
    return 'planted';
  }

  if (plot.tilled) {
    return 'tilled';
  }

  return 'untilled';
}

/**
 * Determines valid tool interactions and the primary recommended action for the plot.
 */
export function getValidToolActions(plot: PlotData, nowMs: number): ValidToolActionResult {
  const plotState = evaluatePlotState(plot, nowMs);

  switch (plotState) {
    case 'untilled':
      return {
        validTools: ['trowel'],
        primaryAction: 'Till Soil',
      };
    case 'tilled':
      return {
        validTools: ['seed_bag', 'watering_can'],
        primaryAction: 'Plant Seed',
      };
    case 'watered':
      if (!plot.crop) {
        return {
          validTools: ['seed_bag', 'watering_can'],
          primaryAction: 'Plant Seed',
        };
      }
      return {
        validTools: ['watering_can'],
        primaryAction: 'Water Crop',
      };
    case 'planted':
      return {
        validTools: ['watering_can'],
        primaryAction: 'Water Crop',
      };
    case 'harvestable':
      return {
        validTools: ['scythe', 'hand'],
        primaryAction: 'Harvest Crop',
      };
  }
}

/**
 * Generates descriptive context feedback when aiming or hovering a tool over a plot.
 */
export function describeNextAction(plot: PlotData, _nowMs: number, selectedTool: ToolType): string {
  const isMature = isPlotHarvestable(plot);
  const hasCrop = plot.crop !== null;

  switch (selectedTool) {
    case 'trowel':
      if (!plot.tilled && !hasCrop) {
        return 'Till soil';
      }
      if (hasCrop) {
        return 'Plot already has a crop';
      }
      return 'Plot is already tilled';

    case 'watering_can':
      if (!plot.tilled) {
        return 'Till soil first';
      }
      if (isMature) {
        return 'Crop is ready to harvest';
      }
      if (hasCrop) {
        return 'Water crop';
      }
      return 'Water plot';

    case 'seed_bag':
      if (!plot.tilled) {
        return 'Till soil first';
      }
      if (hasCrop) {
        return 'Plot already has a crop';
      }
      return 'Plant seed';

    case 'scythe':
    case 'hand':
      if (isMature) {
        return 'Harvest crop';
      }
      if (hasCrop) {
        return 'Crop is still growing';
      }
      return 'No crop to harvest';
  }
}
