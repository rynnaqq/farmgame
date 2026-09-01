import { describe, it, expect } from 'vitest';
import {
  PLAYER_WALK_SPEED,
  PLAYER_RUN_SPEED,
  ISLAND_FALL_Y_THRESHOLD,
  PLAYER_SPAWN_POSITION,
} from '../core/constants';
import {
  normalizeAngle,
  shortestAngleDifference,
  lerpAngle,
  computeTargetYaw,
  smoothVelocity,
  calculateLimbSwings,
  calculateIdleBob,
  calculateDeltaDistance,
  shouldRespawn,
  WALK_LEG_SWING_MAX,
  RUN_LEG_SWING_MAX,
  WALK_ARM_SWING_MAX,
  RUN_ARM_SWING_MAX,
} from './playerAnimation';

describe('Player Animation & Kinematic Controller Math', () => {
  describe('Constants & Boundaries', () => {
    it('should have expected player movement and island constants', () => {
      expect(PLAYER_WALK_SPEED).toBe(3.5);
      expect(PLAYER_RUN_SPEED).toBe(5.25);
      expect(ISLAND_FALL_Y_THRESHOLD).toBe(-5);
      expect(PLAYER_SPAWN_POSITION).toEqual([0, 0, 0]);
    });
  });

  describe('Angle Math & Shortest-Path Interpolation', () => {
    describe('normalizeAngle', () => {
      it('should normalize angles into [-PI, PI]', () => {
        expect(normalizeAngle(0)).toBeCloseTo(0, 5);
        expect(normalizeAngle(Math.PI)).toBeCloseTo(Math.PI, 5);
        expect(normalizeAngle(-Math.PI)).toBeCloseTo(-Math.PI, 5);
        expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 5);
        expect(normalizeAngle(-3 * Math.PI)).toBeCloseTo(-Math.PI, 5);
        expect(normalizeAngle(2 * Math.PI)).toBeCloseTo(0, 5);
        expect(normalizeAngle(-2 * Math.PI)).toBeCloseTo(0, 5);
        expect(normalizeAngle(Math.PI / 2)).toBeCloseTo(Math.PI / 2, 5);
        expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2, 5);
        expect(normalizeAngle((5 * Math.PI) / 2)).toBeCloseTo(Math.PI / 2, 5);
      });
    });

    describe('shortestAngleDifference', () => {
      it('should calculate direct angular difference', () => {
        expect(shortestAngleDifference(0, Math.PI / 4)).toBeCloseTo(Math.PI / 4, 5);
        expect(shortestAngleDifference(Math.PI / 4, 0)).toBeCloseTo(-Math.PI / 4, 5);
        expect(shortestAngleDifference(0.5, 0.5)).toBeCloseTo(0, 5);
      });

      it('should find the shortest arc across the +-PI boundary', () => {
        const angleA = Math.PI - 0.1; // ~3.0416
        const angleB = -Math.PI + 0.1; // ~ -3.0416

        // Moving from A to B across the boundary is +0.2 rad, not -6.08 rad
        const diffAToB = shortestAngleDifference(angleA, angleB);
        expect(diffAToB).toBeCloseTo(0.2, 4);

        // Moving from B to A across the boundary is -0.2 rad
        const diffBToA = shortestAngleDifference(angleB, angleA);
        expect(diffBToA).toBeCloseTo(-0.2, 4);
      });
    });

    describe('lerpAngle', () => {
      it('should return from angle when alpha is 0 and to angle when alpha is 1', () => {
        expect(lerpAngle(1.0, 2.0, 0)).toBeCloseTo(1.0, 5);
        expect(lerpAngle(1.0, 2.0, 1)).toBeCloseTo(2.0, 5);
      });

      it('should interpolate through shortest path across +-PI seam', () => {
        const fromAngle = Math.PI - 0.1;
        const toAngle = -Math.PI + 0.1;
        // Midpoint should be +-PI
        const mid = lerpAngle(fromAngle, toAngle, 0.5);
        expect(Math.abs(normalizeAngle(mid))).toBeCloseTo(Math.PI, 4);
      });

      it('should interpolate smoothly between standard angles', () => {
        const result = lerpAngle(0, Math.PI / 2, 0.5);
        expect(result).toBeCloseTo(Math.PI / 4, 5);
      });
    });

    describe('computeTargetYaw', () => {
      it('should compute correct rotation angles from move vectors', () => {
        // Move South (+Z) -> yaw = 0
        expect(computeTargetYaw(0, 1, 0)).toBeCloseTo(0, 5);
        // Move North (-Z) -> yaw = PI or -PI
        expect(Math.abs(computeTargetYaw(0, -1, 0))).toBeCloseTo(Math.PI, 5);
        // Move East (+X) -> yaw = PI / 2
        expect(computeTargetYaw(1, 0, 0)).toBeCloseTo(Math.PI / 2, 5);
        // Move West (-X) -> yaw = -PI / 2
        expect(computeTargetYaw(-1, 0, 0)).toBeCloseTo(-Math.PI / 2, 5);
      });

      it('should maintain current yaw when move vector is zero', () => {
        const currentYaw = 1.234;
        expect(computeTargetYaw(0, 0, currentYaw)).toBeCloseTo(currentYaw, 5);
      });
    });
  });

  describe('Velocity Smoothing & Acceleration/Deceleration', () => {
    describe('smoothVelocity', () => {
      it('should remain at 0 when stationary with no target', () => {
        const result = smoothVelocity({ x: 0, z: 0 }, { x: 0, z: 0 }, 0, 0.016);
        expect(result.x).toBe(0);
        expect(result.z).toBe(0);
        expect(result.speed).toBe(0);
      });

      it('should smoothly accelerate from rest towards walk speed', () => {
        const current = { x: 0, z: 0 };
        const targetDir = { x: 0, z: 1 };
        const dt = 0.05; // 50ms
        const accel = 20.0; // 20 u/s^2

        const step1 = smoothVelocity(current, targetDir, PLAYER_WALK_SPEED, dt, accel);
        expect(step1.z).toBeGreaterThan(0);
        expect(step1.z).toBeLessThanOrEqual(PLAYER_WALK_SPEED);
        expect(step1.x).toBe(0);
        expect(step1.speed).toBeCloseTo(step1.z, 5);

        // Advance over multiple frames to reach walk speed
        let state = step1;
        for (let i = 0; i < 10; i++) {
          state = smoothVelocity(state, targetDir, PLAYER_WALK_SPEED, dt, accel);
        }
        expect(state.speed).toBeCloseTo(PLAYER_WALK_SPEED, 2);
        expect(state.z).toBeCloseTo(PLAYER_WALK_SPEED, 2);
      });

      it('should smoothly transition from walk speed to run speed', () => {
        const current = { x: 0, z: PLAYER_WALK_SPEED };
        const targetDir = { x: 0, z: 1 };
        const dt = 0.05;
        const accel = 20.0;

        const next = smoothVelocity(current, targetDir, PLAYER_RUN_SPEED, dt, accel);
        expect(next.speed).toBeGreaterThan(PLAYER_WALK_SPEED);
        expect(next.speed).toBeLessThanOrEqual(PLAYER_RUN_SPEED);

        let state = next;
        for (let i = 0; i < 10; i++) {
          state = smoothVelocity(state, targetDir, PLAYER_RUN_SPEED, dt, accel);
        }
        expect(state.speed).toBeCloseTo(PLAYER_RUN_SPEED, 2);
      });

      it('should smoothly decelerate from run speed to zero when input stops', () => {
        const current = { x: 0, z: PLAYER_RUN_SPEED };
        const targetDir = { x: 0, z: 0 };
        const dt = 0.05;
        const decel = 25.0;

        const step1 = smoothVelocity(current, targetDir, 0, dt, 20.0, decel);
        expect(step1.speed).toBeLessThan(PLAYER_RUN_SPEED);
        expect(step1.speed).toBeGreaterThan(0);

        let state = step1;
        for (let i = 0; i < 10; i++) {
          state = smoothVelocity(state, targetDir, 0, dt, 20.0, decel);
        }
        expect(state.speed).toBeCloseTo(0, 2);
        expect(state.z).toBeCloseTo(0, 2);
      });

      it('should handle diagonal movement and preserve direction vector', () => {
        const current = { x: 0, z: 0 };
        const targetDir = { x: 0.7071, z: 0.7071 };
        const res = smoothVelocity(current, targetDir, PLAYER_WALK_SPEED, 0.1, 20.0);

        expect(res.x).toBeGreaterThan(0);
        expect(res.z).toBeGreaterThan(0);
        expect(res.x).toBeCloseTo(res.z, 4);
      });

      it('should return current velocity unchanged when deltaSec is 0', () => {
        const current = { x: 2.0, z: 1.5 };
        const res = smoothVelocity(current, { x: 0, z: 0 }, 0, 0);
        expect(res.x).toBe(2.0);
        expect(res.z).toBe(1.5);
      });
    });
  });

  describe('Procedural Limb Animation Calculations', () => {
    describe('calculateLimbSwings', () => {
      it('should return zero limb rotation when speed is 0', () => {
        const swings = calculateLimbSwings(0, false, 0);
        expect(swings.leftLegPitch).toBe(0);
        expect(swings.rightLegPitch).toBe(0);
        expect(swings.leftArmPitch).toBe(0);
        expect(swings.rightArmPitch).toBe(0);
        expect(swings.stepBounce).toBe(0);
        expect(swings.bodyRoll).toBe(0);
      });

      it('should produce opposing limb swings for walk cycle', () => {
        const phase = Math.PI / 2; // Peak sine
        const swings = calculateLimbSwings(PLAYER_WALK_SPEED, false, phase);

        // Legs oppose each other
        expect(swings.leftLegPitch).toBeCloseTo(-swings.rightLegPitch, 4);
        expect(Math.abs(swings.leftLegPitch)).toBeGreaterThan(0.3);
        expect(Math.abs(swings.leftLegPitch)).toBeLessThanOrEqual(WALK_LEG_SWING_MAX);

        // Arms oppose each other
        expect(swings.leftArmPitch).toBeCloseTo(-swings.rightArmPitch, 4);
        expect(Math.abs(swings.leftArmPitch)).toBeLessThanOrEqual(WALK_ARM_SWING_MAX);

        // Arm opposes same-side leg for bipedal balance
        expect(Math.sign(swings.leftArmPitch)).not.toBe(Math.sign(swings.leftLegPitch));

        // Step bounce should be non-negative
        expect(swings.stepBounce).toBeGreaterThanOrEqual(0);
      });

      it('should produce larger swing amplitudes during run mode', () => {
        const phase = Math.PI / 2;
        const walkSwings = calculateLimbSwings(PLAYER_WALK_SPEED, false, phase);
        const runSwings = calculateLimbSwings(PLAYER_RUN_SPEED, true, phase);

        expect(Math.abs(runSwings.leftLegPitch)).toBeGreaterThan(Math.abs(walkSwings.leftLegPitch));
        expect(Math.abs(runSwings.leftArmPitch)).toBeGreaterThan(Math.abs(walkSwings.leftArmPitch));
        expect(Math.abs(runSwings.leftLegPitch)).toBeLessThanOrEqual(RUN_LEG_SWING_MAX);
        expect(Math.abs(runSwings.leftArmPitch)).toBeLessThanOrEqual(RUN_ARM_SWING_MAX);
      });
    });

    describe('calculateIdleBob', () => {
      it('should produce periodic bobbing and gentle sway when fully idle', () => {
        const time1 = 0;
        const time2 = Math.PI / (2 * 2.5); // Peak for frequency 2.5 rad/s
        const idle1 = calculateIdleBob(time1, 0);
        const idle2 = calculateIdleBob(time2, 0);

        expect(idle1.idleBobY).toBeCloseTo(0, 5);
        expect(idle2.idleBobY).toBeGreaterThan(0);
        expect(idle2.idleBobY).toBeCloseTo(0.025, 4);
      });

      it('should blend out idle bobbing when speed blend factor is 1 (moving)', () => {
        const idle = calculateIdleBob(Math.PI / 2, 1.0);
        expect(idle.idleBobY).toBeCloseTo(0, 5);
        expect(idle.idleSwayZ).toBeCloseTo(0, 5);
        expect(idle.headTiltZ).toBeCloseTo(0, 5);
      });
    });
  });

  describe('Distance Accumulation Calculation', () => {
    describe('calculateDeltaDistance', () => {
      it('should return 0 when stationary', () => {
        expect(calculateDeltaDistance(0, 0, 0.016)).toBe(0);
      });

      it('should accurately compute distance walked from velocity and dt', () => {
        // Speed = 3.5 u/s, dt = 1.0s -> distance = 3.5
        expect(calculateDeltaDistance(0, 3.5, 1.0)).toBeCloseTo(3.5, 5);
        // Speed = 5.25 u/s, dt = 0.5s -> distance = 2.625
        expect(calculateDeltaDistance(5.25, 0, 0.5)).toBeCloseTo(2.625, 5);
      });

      it('should accurately compute diagonal distance', () => {
        // vx = 3, vz = 4 -> speed = 5, dt = 0.2 -> distance = 1.0
        expect(calculateDeltaDistance(3, 4, 0.2)).toBeCloseTo(1.0, 5);
      });

      it('should return non-negative value for negative velocities', () => {
        expect(calculateDeltaDistance(-3, -4, 0.1)).toBeCloseTo(0.5, 5);
      });
    });
  });

  describe('Respawn & Fall Safety Boundary', () => {
    describe('shouldRespawn', () => {
      it('should return false for positions on or above ground', () => {
        expect(shouldRespawn(0.5)).toBe(false);
        expect(shouldRespawn(0.0)).toBe(false);
        expect(shouldRespawn(-2.0)).toBe(false);
        expect(shouldRespawn(-4.99)).toBe(false);
      });

      it('should return true for positions below island fall threshold (Y < -5)', () => {
        expect(shouldRespawn(-5.01)).toBe(true);
        expect(shouldRespawn(-6.0)).toBe(true);
        expect(shouldRespawn(-20.0)).toBe(true);
      });

      it('should respect custom threshold override if provided', () => {
        expect(shouldRespawn(-2.5, -2.0)).toBe(true);
        expect(shouldRespawn(-1.5, -2.0)).toBe(false);
      });
    });
  });
});
