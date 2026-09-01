import {
  MOBILE_ACTION_REACH,
  MOBILE_ACTION_CONE_DEG,
  MERCHANT_INTERACTION_RANGE,
  MERCHANT_POSITION,
  MAX_GRID_SIZE,
  STARTING_GRID_SIZE,
} from '../../game/core/constants';
import { getPlotPosition, isPlotUnlocked } from '../../game/world/gridCoordinates';
import type { PlotData, ToolType, PlotId } from '../../state/storeTypes';

export interface TargetPlotResult {
  plot: PlotData;
  distance: number;
  angleDeg: number;
  worldPosition: [number, number, number];
}

/**
 * Calculates angle in degrees [0, 180] between player facing direction (yaw) and target position in X-Z plane.
 * 0 deg means target is directly in front of player.
 */
export function calculateAngleToTarget(
  playerX: number,
  playerZ: number,
  playerYawRad: number,
  targetX: number,
  targetZ: number
): number {
  const dx = targetX - playerX;
  const dz = targetZ - playerZ;
  const dist = Math.hypot(dx, dz);

  if (dist === 0) {
    return 0;
  }

  // Player forward vector (yaw 0 points to +Z in Three space)
  const fx = Math.sin(playerYawRad);
  const fz = Math.cos(playerYawRad);

  // Normalized direction from player to target
  const nx = dx / dist;
  const nz = dz / dist;

  // Dot product
  const dot = fx * nx + fz * nz;
  const clampedDot = Math.max(-1.0, Math.min(1.0, dot));
  const angleRad = Math.acos(clampedDot);

  return (angleRad * 180) / Math.PI;
}

/**
 * Checks if a 2D world position is within interaction reach and forward cone.
 */
export function isTargetInCone(
  playerX: number,
  playerZ: number,
  playerYawRad: number,
  targetX: number,
  targetZ: number,
  maxDistance: number = MOBILE_ACTION_REACH,
  maxConeDeg: number = MOBILE_ACTION_CONE_DEG
): boolean {
  const dx = targetX - playerX;
  const dz = targetZ - playerZ;
  const dist = Math.hypot(dx, dz);

  if (dist > maxDistance) {
    return false;
  }

  const angleDeg = calculateAngleToTarget(playerX, playerZ, playerYawRad, targetX, targetZ);
  return angleDeg <= maxConeDeg / 2;
}

/**
 * Checks whether a plot is valid/actionable for a given tool.
 */
export function isPlotValidForTool(
  plot: PlotData,
  tool: ToolType,
  nowUtcMs: number = Date.now()
): boolean {
  switch (tool) {
    case 'trowel':
      // Untilled soil can be tilled
      return !plot.tilled;

    case 'watering_can':
      // Tilled soil that is not hydrated (or hydration expired) can be watered
      return plot.tilled && plot.hydratedUntilUtcMs <= nowUtcMs;

    case 'seed_bag':
      // Tilled soil without a crop can be planted
      return plot.tilled && plot.crop === null;

    case 'scythe':
      // Plot with mature crop (growthProgressSec >= 1.0) can be harvested
      return plot.crop !== null && plot.crop.growthProgressSec >= 1.0;

    case 'hand':
    default:
      return true;
  }
}

export interface FindTargetPlotOptions {
  maxDistance?: number;
  maxConeDeg?: number;
  nowUtcMs?: number;
  filterByTool?: boolean;
}

/**
 * Finds the nearest valid unlocked plot within player reach and forward cone.
 */
export function findNearestTargetPlot(
  playerPosition: [number, number, number] | { x: number; z: number },
  playerYawRad: number,
  plots: Record<PlotId, PlotData> | PlotData[],
  currentGridSize: number = STARTING_GRID_SIZE,
  tool?: ToolType,
  options?: FindTargetPlotOptions
): TargetPlotResult | null {
  const px = Array.isArray(playerPosition) ? playerPosition[0] : playerPosition.x;
  const pz = Array.isArray(playerPosition) ? playerPosition[2] : playerPosition.z;

  const maxDist = options?.maxDistance ?? MOBILE_ACTION_REACH;
  const maxCone = options?.maxConeDeg ?? MOBILE_ACTION_CONE_DEG;
  const now = options?.nowUtcMs ?? Date.now();
  const filterByTool = options?.filterByTool ?? false;

  const plotsList = Array.isArray(plots) ? plots : Object.values(plots);

  let closestCandidate: TargetPlotResult | null = null;
  let minDistance = Infinity;

  for (const plot of plotsList) {
    // Only check unlocked plots within current grid size
    if (!isPlotUnlocked(plot.row, plot.col, currentGridSize)) {
      continue;
    }

    if (filterByTool && tool && !isPlotValidForTool(plot, tool, now)) {
      continue;
    }

    const worldPos = getPlotPosition(plot.row, plot.col, MAX_GRID_SIZE);
    const plotX = worldPos[0];
    const plotZ = worldPos[2];

    const dx = plotX - px;
    const dz = plotZ - pz;
    const dist = Math.hypot(dx, dz);

    if (dist > maxDist) {
      continue;
    }

    const angleDeg = calculateAngleToTarget(px, pz, playerYawRad, plotX, plotZ);
    if (angleDeg > maxCone / 2) {
      continue;
    }

    if (dist < minDistance) {
      minDistance = dist;
      closestCandidate = {
        plot,
        distance: dist,
        angleDeg,
        worldPosition: worldPos,
      };
    }
  }

  return closestCandidate;
}

/**
 * Checks if the player is within range of the merchant stall.
 */
export function isMerchantInRange(
  playerPosition: [number, number, number] | { x: number; z: number },
  merchantPosition: readonly [number, number, number] | [number, number, number] = MERCHANT_POSITION,
  range: number = MERCHANT_INTERACTION_RANGE
): boolean {
  const px = Array.isArray(playerPosition) ? playerPosition[0] : playerPosition.x;
  const pz = Array.isArray(playerPosition) ? playerPosition[2] : playerPosition.z;
  const mx = merchantPosition[0];
  const mz = merchantPosition[2];

  const dist = Math.hypot(px - mx, pz - mz);
  return dist <= range;
}
