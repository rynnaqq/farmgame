import { describe, it, expect } from 'vitest';
import {
  PARTICLE_POOL_SPHERE,
  DECOR_CULL_DISTANCE,
  SPARKLE_CULL_DISTANCE,
  distance3d,
  computeCullVisibility,
} from './culling';

describe('Culling helpers', () => {
  it('exposes sane tuning constants', () => {
    expect(PARTICLE_POOL_SPHERE.radius).toBeGreaterThan(20);
    expect(PARTICLE_POOL_SPHERE.centerY).toBe(8);
    expect(DECOR_CULL_DISTANCE).toBeGreaterThan(SPARKLE_CULL_DISTANCE);
  });

  it('computes 3D euclidean distance', () => {
    expect(distance3d(0, 0, 0, 3, 4, 0)).toBeCloseTo(5);
    expect(distance3d(1, 2, 3, 1, 2, 3)).toBe(0);
  });

  it('keeps visible objects visible inside the range', () => {
    expect(computeCullVisibility(10, 32, true)).toBe(true);
    expect(computeCullVisibility(32, 32, true)).toBe(true);
  });

  it('hides visible objects only past the hysteresis band', () => {
    // 32 * 1.15 = 36.8 → still visible at 35, hidden at 37
    expect(computeCullVisibility(35, 32, true)).toBe(true);
    expect(computeCullVisibility(37, 32, true)).toBe(false);
  });

  it('shows hidden objects again once back inside maxDistance', () => {
    expect(computeCullVisibility(40, 32, false)).toBe(false);
    expect(computeCullVisibility(31.9, 32, false)).toBe(true);
  });

  it('fails safe (visible) on non-finite or invalid input', () => {
    expect(computeCullVisibility(NaN, 32, false)).toBe(true);
    expect(computeCullVisibility(10, 0, false)).toBe(true);
    expect(computeCullVisibility(10, -5, false)).toBe(true);
    expect(computeCullVisibility(10, 32, true, -1)).toBe(true);
  });
});
