/**
 * View-frustum & distance culling helpers.
 *
 * Three.js already frustum-culls regular meshes automatically. The gaps this
 * module closes:
 * 1. GPU-instanced pools that move every frame (rain, motes, bursts) ship
 *    with `frustumCulled={false}` because an auto-computed bounds would go
 *    stale as instances fly around. A static sphere covering the whole spawn
 *    volume restores correct — and free — frustum culling.
 * 2. Tiny detail meshes (flower heads, grass blades, mutation sparkles) stay
 *    visible at any distance by default. Beyond a threshold they are subpixel
 *    noise, so distance culling them saves draw calls with no visible change.
 */

/** Static bounds covering every particle pool spawn volume (island ±14, y 0–16). */
export const PARTICLE_POOL_SPHERE = {
  centerX: 0,
  centerY: 8,
  centerZ: 0,
  radius: 24,
} as const;

/** Camera distance beyond which flower/grass detail is hidden. */
export const DECOR_CULL_DISTANCE = 32;

/** Camera distance beyond which mutation sparkles/motes are hidden. */
export const SPARKLE_CULL_DISTANCE = 24;

/** Hysteresis band (fraction of maxDistance) preventing visible flicker. */
export const DEFAULT_CULL_HYSTERESIS = 0.15;

export function distance3d(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number
): number {
  const dx = ax - bx;
  const dy = ay - by;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Hysteresis visibility switch for distance culling.
 * - Currently visible → hides only past maxDistance * (1 + hysteresis).
 * - Currently hidden → shows again once closer than maxDistance.
 * Returns the next visibility state (pure, unit-testable).
 */
export function computeCullVisibility(
  distance: number,
  maxDistance: number,
  currentlyVisible: boolean,
  hysteresis: number = DEFAULT_CULL_HYSTERESIS
): boolean {
  if (!Number.isFinite(distance) || !Number.isFinite(maxDistance) || maxDistance <= 0) {
    return true;
  }
  const safeHysteresis = Math.max(0, hysteresis);
  if (currentlyVisible) {
    return distance <= maxDistance * (1 + safeHysteresis);
  }
  return distance < maxDistance;
}
