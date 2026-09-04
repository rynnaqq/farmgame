import type { PlotData, PlotId } from '../../state/storeTypes';

/**
 * Free-placement farm layout: single source of truth for where crops may grow.
 * There is no tile grid — crops can be planted at any point inside the farm
 * land rectangle as long as they keep a minimum spacing from other crops.
 */

// Farm land bounds in world units (matches the raised-bed footprint).
export const FARM_BOUNDS = {
  minX: -7.4,
  maxX: 7.4,
  minZ: -6.4,
  maxZ: 6.4,
} as const;

/** Minimum XZ distance between two crop spots. */
export const MIN_CROP_SPACING = 1.1;

/** Golden watering can area radius in world units. */
export const GOLDEN_WATERING_CAN_RADIUS_WORLD = 2.4;

/** Quantize a world coordinate to 3 decimals for stable ids and saves. */
export function roundCoord(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Deterministic plot id from the farm counter. */
export function createPlotId(plotNumber: number): PlotId {
  return `crop-${plotNumber}`;
}

export function isInsidePlantingArea(x: number, z: number): boolean {
  return (
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    x >= FARM_BOUNDS.minX &&
    x <= FARM_BOUNDS.maxX &&
    z >= FARM_BOUNDS.minZ &&
    z <= FARM_BOUNDS.maxZ
  );
}

function distanceXZ(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Returns the id of the existing plot violating the spacing rule, or null.
 */
export function findSpacingViolation(
  x: number,
  z: number,
  plots: Record<PlotId, PlotData>,
  minSpacing: number = MIN_CROP_SPACING
): PlotId | null {
  for (const plot of Object.values(plots)) {
    if (distanceXZ(x, z, plot.x, plot.z) < minSpacing) {
      return plot.id;
    }
  }
  return null;
}

/**
 * All plots within `radius` of a world point (for area watering / dog harvest).
 */
export function findPlotsInRadius(
  x: number,
  z: number,
  plots: Record<PlotId, PlotData>,
  radius: number
): PlotData[] {
  const result: PlotData[] = [];
  for (const plot of Object.values(plots)) {
    if (distanceXZ(x, z, plot.x, plot.z) <= radius) {
      result.push(plot);
    }
  }
  return result;
}
