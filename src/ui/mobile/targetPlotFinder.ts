import {
  MOBILE_ACTION_REACH,
  MOBILE_ACTION_CONE_DEG,
  MERCHANT_INTERACTION_RANGE,
  MERCHANT_POSITION,
} from '../../game/core/constants';
import { placementToWorldPoint } from '../../game/world/farmLayout';
import { isPlotHarvestable } from '../../game/farming/plotMachine';
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
 * Checks whether a planted crop is valid/actionable for a given tool.
 * Targets are crops only: seed_bag planting happens by tapping soil, not via this finder.
 */
export function isCropValidForTool(
  plot: PlotData,
  tool: ToolType,
  nowUtcMs: number = Date.now()
): boolean {
  if (!plot.crop) return false;

  switch (tool) {
    case 'watering_can':
      return plot.hydratedUntilUtcMs <= nowUtcMs;

    case 'scythe':
    case 'hand':
      return isPlotHarvestable(plot);

    case 'seed_bag':
    default:
      return false;
  }
}

export interface FindTargetCropOptions {
  maxDistance?: number;
  maxConeDeg?: number;
  nowUtcMs?: number;
  filterByTool?: boolean;
}

/**
 * Finds the nearest valid crop (by saved placement) within player reach and forward cone.
 */
export function findNearestTargetCrop(
  playerPosition: [number, number, number] | { x: number; z: number },
  playerYawRad: number,
  plots: Record<PlotId, PlotData> | PlotData[],
  tool: ToolType,
  options: FindTargetCropOptions = {}
): TargetPlotResult | null {
  const px = Array.isArray(playerPosition) ? playerPosition[0] : playerPosition.x;
  const pz = Array.isArray(playerPosition) ? playerPosition[2] : playerPosition.z;

  const candidates = Array.isArray(plots) ? plots : Object.values(plots);
  const nowUtcMs = options.nowUtcMs ?? Date.now();
  const filterByTool = options.filterByTool ?? false;

  return (
    candidates
      .filter(
        (plot) => plot.crop !== null && (!filterByTool || isCropValidForTool(plot, tool, nowUtcMs))
      )
      .map((plot) => {
        const point = placementToWorldPoint(plot.crop!.placement);
        const distance = Math.hypot(point.x - px, point.z - pz);
        const angleDeg = calculateAngleToTarget(px, pz, playerYawRad, point.x, point.z);
        return {
          plot,
          distance,
          angleDeg,
          worldPosition: [point.x, point.y, point.z] as [number, number, number],
        };
      })
      .filter(
        (target) =>
          target.distance <= (options.maxDistance ?? MOBILE_ACTION_REACH) &&
          target.angleDeg <= (options.maxConeDeg ?? MOBILE_ACTION_CONE_DEG) / 2
      )
      .sort(
        (a, b) =>
          a.distance - b.distance || a.plot.row - b.plot.row || a.plot.col - b.plot.col
      )[0] ?? null
  );
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
