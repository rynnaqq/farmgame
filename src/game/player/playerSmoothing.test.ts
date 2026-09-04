import { describe, it, expect } from 'vitest';
import {
  dampAngle,
  dampScalar,
  calculateLimbSwings,
  DEFAULT_ROTATION_DAMPING,
  DEFAULT_STRIDE_BLEND_DAMPING,
} from './playerAnimation';
import { PLAYER_WALK_SPEED } from '../core/constants';
import { WALK_LEG_SWING_MAX } from './playerAnimation';

describe('dampAngle (frame-rate independent rotation smoothing)', () => {
  it('returns the current angle when deltaSec is 0', () => {
    expect(dampAngle(1.2, 2.0, 18, 0)).toBe(1.2);
  });

  it('never snaps: moves only part of the way toward the target', () => {
    const next = dampAngle(0, Math.PI / 2, DEFAULT_ROTATION_DAMPING, 1 / 60);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(Math.PI / 2);
  });

  it('is frame-rate independent: two small steps equal one big step', () => {
    const dtBig = 1 / 30;
    const dtSmall = 1 / 60;
    const oneBig = dampAngle(0.3, 1.5, DEFAULT_ROTATION_DAMPING, dtBig);
    const twoSmall = dampAngle(
      dampAngle(0.3, 1.5, DEFAULT_ROTATION_DAMPING, dtSmall),
      1.5,
      DEFAULT_ROTATION_DAMPING,
      dtSmall
    );
    expect(twoSmall).toBeCloseTo(oneBig, 5);
  });

  it('takes the shortest arc across the +-PI seam', () => {
    const from = Math.PI - 0.1;
    const to = -Math.PI + 0.1;
    const next = dampAngle(from, to, DEFAULT_ROTATION_DAMPING, 1 / 60);
    // Must move +0.2 direction (toward PI), not the long way around.
    const diff = next - from;
    expect(diff).toBeGreaterThan(0);
    expect(Math.abs(next)).toBeGreaterThan(Math.abs(from) - 0.05);
  });

  it('converges to the target over repeated steps', () => {
    let yaw = 0;
    for (let i = 0; i < 240; i++) {
      yaw = dampAngle(yaw, Math.PI / 2, DEFAULT_ROTATION_DAMPING, 1 / 60);
    }
    expect(yaw).toBeCloseTo(Math.PI / 2, 3);
  });
});

describe('dampScalar (stride blend smoothing)', () => {
  it('returns the current value when deltaSec is 0', () => {
    expect(dampScalar(0.4, 1.0, 10, 0)).toBe(0.4);
  });

  it('moves toward the target without overshooting', () => {
    const next = dampScalar(0.2, 1.0, DEFAULT_STRIDE_BLEND_DAMPING, 1 / 60);
    expect(next).toBeGreaterThan(0.2);
    expect(next).toBeLessThan(1.0);
  });

  it('is frame-rate independent', () => {
    const a = dampScalar(0.0, 1.0, 10, 1 / 30);
    const b = dampScalar(dampScalar(0.0, 1.0, 10, 1 / 60), 1.0, 10, 1 / 60);
    expect(b).toBeCloseTo(a, 5);
  });
});

describe('calculateLimbSwings stride blend (continuous idle/walk transition)', () => {
  it('scales amplitude smoothly with the blend factor', () => {
    const full = calculateLimbSwings(PLAYER_WALK_SPEED, false, Math.PI / 2, 1.0);
    const half = calculateLimbSwings(PLAYER_WALK_SPEED, false, Math.PI / 2, 0.5);
    expect(Math.abs(half.leftLegPitch)).toBeCloseTo(Math.abs(full.leftLegPitch) * 0.5, 6);
  });

  it('fades swings to zero as the blend fades (no hard cut)', () => {
    const faded = calculateLimbSwings(PLAYER_WALK_SPEED, false, Math.PI / 2, 0.0);
    expect(faded.leftLegPitch).toBe(0);
    expect(faded.stepBounce).toBe(0);
    expect(faded.bodyRoll).toBe(0);
  });

  it('clamps out-of-range blends safely', () => {
    const over = calculateLimbSwings(PLAYER_WALK_SPEED, false, Math.PI / 2, 5);
    const under = calculateLimbSwings(PLAYER_WALK_SPEED, false, Math.PI / 2, -1);
    expect(Math.abs(over.leftLegPitch)).toBeLessThanOrEqual(WALK_LEG_SWING_MAX);
    expect(under.leftLegPitch).toBe(0);
  });

  it('keeps the default (blend 1) identical to the legacy amplitude', () => {
    const legacy = calculateLimbSwings(PLAYER_WALK_SPEED, false, Math.PI / 2, 1.0);
    expect(Math.abs(legacy.leftLegPitch)).toBeCloseTo(WALK_LEG_SWING_MAX, 4);
  });

  it('rolls the body in quadrature with the leg swing (not synchronized)', () => {
    // At phase 0 the legs are neutral but the roll peaks (cosine vs sine).
    const atZero = calculateLimbSwings(PLAYER_WALK_SPEED, false, 0, 1.0);
    expect(atZero.leftLegPitch).toBeCloseTo(0, 6);
    expect(Math.abs(atZero.bodyRoll)).toBeGreaterThan(0.01);
    // At phase PI/2 the legs peak while the roll crosses zero.
    const atPeak = calculateLimbSwings(PLAYER_WALK_SPEED, false, Math.PI / 2, 1.0);
    expect(Math.abs(atPeak.leftLegPitch)).toBeCloseTo(WALK_LEG_SWING_MAX, 4);
    expect(Math.abs(atPeak.bodyRoll)).toBeLessThan(0.001);
  });

  it('offsets the arms from the legs with a phase lead', () => {
    // With a +0.5 rad lead the arms never exactly mirror the legs.
    const swings = calculateLimbSwings(PLAYER_WALK_SPEED, false, 0.3, 1.0);
    const mirrored = -Math.sin(0.3);
    expect(Math.abs(swings.leftArmPitch - mirrored)).toBeGreaterThan(0.01);
    // Torso counter-rotates and feet lift mid-swing.
    expect(Math.abs(swings.torsoYaw)).toBeGreaterThan(0);
    expect(swings.legLift).toBeGreaterThanOrEqual(0);
  });

  it('tucks limbs into a jump pose when airborne and suppresses stepping', () => {
    const air = calculateLimbSwings(PLAYER_WALK_SPEED, false, 1.2, 1.0, true);
    expect(air.leftLegPitch).toBeCloseTo(0.45, 6);
    expect(air.rightLegPitch).toBeCloseTo(-0.25, 6);
    expect(air.stepBounce).toBe(0);
    expect(air.bodyRoll).toBe(0);
    expect(air.legLift).toBe(0);
  });

  it('damps secondary layers under reduced motion but keeps leg swings', () => {
    const full = calculateLimbSwings(PLAYER_WALK_SPEED, false, 1.0, 1.0, false, false);
    const calm = calculateLimbSwings(PLAYER_WALK_SPEED, false, 1.0, 1.0, false, true);
    expect(calm.leftLegPitch).toBeCloseTo(full.leftLegPitch, 6);
    expect(Math.abs(calm.stepBounce)).toBeLessThanOrEqual(Math.abs(full.stepBounce));
    expect(Math.abs(calm.bodyRoll)).toBeLessThanOrEqual(Math.abs(full.bodyRoll));
  });
});
