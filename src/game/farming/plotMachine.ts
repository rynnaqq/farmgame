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
 */
export function isPlotHydrated(plot: PlotData, nowMs: number): boolean {
  return plot.hydratedUntilUtcMs > nowMs;
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
 * Computes the discrete high-level plot state based on crop status
 * and hydration expiry. Plots only exist while a crop grows on them:
 * there is no till step and no empty soil entity.
 *
 * 1. Planted: a crop exists but the plot is not currently hydrated.
 * 2. Watered: soil is hydrated; the planted crop can progress.
 * 3. Harvestable: crop progress is 100%.
 */
export function evaluatePlotState(plot: PlotData, nowMs: number): PlotState {
  if (isPlotHarvestable(plot)) {
    return 'harvestable';
  }

  if (isPlotHydrated(plot, nowMs)) {
    return 'watered';
  }

  return 'planted';
}

/**
 * Determines valid tool interactions and the primary recommended action for the plot.
 */
export function getValidToolActions(plot: PlotData, nowMs: number): ValidToolActionResult {
  const plotState = evaluatePlotState(plot, nowMs);

  switch (plotState) {
    case 'watered':
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
    case 'watering_can':
      if (isMature) {
        return 'Crop is ready to harvest';
      }
      if (hasCrop) {
        return 'Water crop';
      }
      return 'Water plot';

    case 'seed_bag':
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
