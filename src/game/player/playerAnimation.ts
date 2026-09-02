import { PLAYER_WALK_SPEED, PLAYER_RUN_SPEED, ISLAND_FALL_Y_THRESHOLD } from '../core/constants';

// ==========================================
// Animation Constants
// ==========================================
export const IDLE_BOB_FREQUENCY = 2.5; // rad/s (~0.4 Hz breathing bob)
export const IDLE_BOB_AMPLITUDE = 0.025; // world units vertical displacement
export const IDLE_SWAY_FREQUENCY = 1.8; // rad/s gentle body sway
export const IDLE_SWAY_AMPLITUDE = 0.02; // radians tilt

export const WALK_SWING_FREQUENCY = 9.0; // rad/s walk stride cycle
export const RUN_SWING_FREQUENCY = 14.0; // rad/s run stride cycle

export const WALK_LEG_SWING_MAX = 0.55; // ~31.5 degrees max leg rotation
export const RUN_LEG_SWING_MAX = 0.78; // ~44.7 degrees max leg rotation
export const WALK_ARM_SWING_MAX = 0.5; // ~28.6 degrees max arm rotation
export const RUN_ARM_SWING_MAX = 0.72; // ~41.2 degrees max arm rotation

export const DEFAULT_ACCELERATION = 20.0; // units/s²
export const DEFAULT_DECELERATION = 25.0; // units/s²
export const DEFAULT_ROTATION_SPEED = 14.0; // rad/s (legacy linear mode)

/**
 * Exponential smoothing factor per second for yaw rotation. Chosen so a 90°
 * turn settles in ~0.2s with no frame-rate dependence and no final-frame snap
 * (the classic cause of "jerky" character turning).
 */
export const DEFAULT_ROTATION_DAMPING = 18.0;
/** Exponential smoothing for the walk/run stride-blend and limb amplitudes. */
export const DEFAULT_STRIDE_BLEND_DAMPING = 10.0;

export interface Vector2D {
  x: number;
  z: number;
}

export interface SmoothedVelocityResult {
  x: number;
  z: number;
  speed: number;
}

export interface LimbSwingState {
  leftLegPitch: number;
  rightLegPitch: number;
  leftArmPitch: number;
  rightArmPitch: number;
  stepBounce: number;
  bodyRoll: number;
}

export interface IdleBobState {
  idleBobY: number;
  idleSwayZ: number;
  headTiltZ: number;
}

// ==========================================
// 1. Angle & Shortest-Path Interpolation Math
// ==========================================

/**
 * Normalizes any angle in radians to the range [-PI, PI].
 */
export function normalizeAngle(rad: number): number {
  let a = rad % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Calculates the shortest signed angular difference (to - from) in radians.
 * Result is strictly in [-PI, PI].
 */
export function shortestAngleDifference(fromRad: number, toRad: number): number {
  return normalizeAngle(toRad - fromRad);
}

/**
 * Linearly interpolates between two angles along the shortest arc.
 * Alpha is clamped to [0, 1].
 */
export function lerpAngle(currentRad: number, targetRad: number, alpha: number): number {
  const clampedAlpha = Math.min(Math.max(alpha, 0), 1);
  const diff = shortestAngleDifference(currentRad, targetRad);
  return normalizeAngle(currentRad + diff * clampedAlpha);
}

/**
 * Frame-rate independent exponential damping for angles (shortest arc).
 * Unlike the legacy linear lerpAngle, the turn rate decelerates as the target
 * is approached, which removes the last-frame snap that made rotation look
 * jerky at fluctuating frame rates.
 */
export function dampAngle(
  currentRad: number,
  targetRad: number,
  damping: number = DEFAULT_ROTATION_DAMPING,
  deltaSec: number = 0
): number {
  if (deltaSec <= 0) return currentRad;
  const factor = 1 - Math.exp(-damping * deltaSec);
  const diff = shortestAngleDifference(currentRad, targetRad);
  return normalizeAngle(currentRad + diff * factor);
}

/**
 * Frame-rate independent exponential damping for scalars (stride blends).
 */
export function dampScalar(current: number, target: number, damping: number, deltaSec: number): number {
  if (deltaSec <= 0) return current;
  const factor = 1 - Math.exp(-damping * deltaSec);
  return current + (target - current) * factor;
}

/**
 * Computes target yaw angle from a 2D movement vector (X, Z).
 * Preserves current yaw if movement magnitude is zero.
 */
export function computeTargetYaw(moveX: number, moveZ: number, currentYaw: number): number {
  const lenSq = moveX * moveX + moveZ * moveZ;
  if (lenSq < 0.0001) {
    return currentYaw;
  }
  return Math.atan2(moveX, moveZ);
}

// ==========================================
// 2. Velocity Smoothing & Kinematics
// ==========================================

/**
 * Computes smoothed velocity transitioning smoothly towards the target velocity
 * using acceleration and deceleration rates.
 */
export function smoothVelocity(
  current: Vector2D,
  targetDir: Vector2D,
  targetSpeed: number,
  deltaSec: number,
  acceleration: number = DEFAULT_ACCELERATION,
  deceleration: number = DEFAULT_DECELERATION
): SmoothedVelocityResult {
  if (deltaSec <= 0) {
    return {
      x: current.x,
      z: current.z,
      speed: Math.hypot(current.x, current.z),
    };
  }

  const dirLen = Math.hypot(targetDir.x, targetDir.z);
  const targetVx = dirLen > 0.0001 ? (targetDir.x / dirLen) * targetSpeed : 0;
  const targetVz = dirLen > 0.0001 ? (targetDir.z / dirLen) * targetSpeed : 0;

  const diffX = targetVx - current.x;
  const diffZ = targetVz - current.z;
  const diffLen = Math.hypot(diffX, diffZ);

  if (diffLen < 0.0001) {
    return {
      x: targetVx,
      z: targetVz,
      speed: Math.hypot(targetVx, targetVz),
    };
  }

  const currentSpeed = Math.hypot(current.x, current.z);
  const rate = targetSpeed < 0.001 || targetSpeed < currentSpeed ? deceleration : acceleration;

  const maxStep = rate * deltaSec;
  const step = Math.min(diffLen, maxStep);

  const nextX = current.x + (diffX / diffLen) * step;
  const nextZ = current.z + (diffZ / diffLen) * step;
  const nextSpeed = Math.hypot(nextX, nextZ);

  return {
    x: nextX,
    z: nextZ,
    speed: nextSpeed,
  };
}

// ==========================================
// 3. Procedural Limb & Idle Animations
// ==========================================

/**
 * Calculates sinusoidal opposing limb rotations, step bounce, and body roll
 * for locomotion.
 *
 * All amplitudes are driven by the actual movement speed so the pose blends
 * continuously through walk and run (no discrete mode snapping):
 * - `strideBlend` (0..1) fades swings in/out with acceleration.
 * - The walk->run amplitude range interpolates by speed via `runRatio`.
 */
export function calculateLimbSwings(
  speed: number,
  _isRunning: boolean,
  phase: number,
  strideBlend: number = 1.0
): LimbSwingState {
  if (speed <= 0.001) {
    return {
      leftLegPitch: 0,
      rightLegPitch: 0,
      leftArmPitch: 0,
      rightArmPitch: 0,
      stepBounce: 0,
      bodyRoll: 0,
    };
  }

  // Amplitudes blend CONTINUOUSLY across the walk->run speed range instead of
  // snapping between two discrete poses when the run flag flips. Below walk
  // speed the walk pose is used; at/above run speed the run pose is used;
  // between them the amplitudes interpolate, so sprinting no longer pops.
  const runRatio = Math.max(
    0,
    Math.min(1, (speed - PLAYER_WALK_SPEED) / (PLAYER_RUN_SPEED - PLAYER_WALK_SPEED))
  );
  const maxLeg = WALK_LEG_SWING_MAX + (RUN_LEG_SWING_MAX - WALK_LEG_SWING_MAX) * runRatio;
  const maxArm = WALK_ARM_SWING_MAX + (RUN_ARM_SWING_MAX - WALK_ARM_SWING_MAX) * runRatio;
  const bounceAmp = 0.03 + (0.045 - 0.03) * runRatio;
  const rollAmp = 0.02 + (0.035 - 0.02) * runRatio;
  const baseSpeed = PLAYER_WALK_SPEED + (PLAYER_RUN_SPEED - PLAYER_WALK_SPEED) * runRatio;

  const speedRatio = Math.min(speed / baseSpeed, 1.0);
  // Continuous blend: fades swings in/out with the smoothed speed so limbs
  // never snap between idle and walk poses.
  const blend = Math.max(0, Math.min(1, strideBlend)) * speedRatio;

  const sinPhase = Math.sin(phase);

  // Legs swing with opposite phase
  const leftLegPitch = sinPhase * maxLeg * blend;
  const rightLegPitch = -sinPhase * maxLeg * blend;

  // Arms counterbalance legs (left arm swings with right leg)
  const leftArmPitch = -sinPhase * maxArm * blend;
  const rightArmPitch = sinPhase * maxArm * blend;

  // Vertical step bounce and lateral body roll
  const stepBounce = Math.abs(sinPhase) * bounceAmp * blend;
  const bodyRoll = Math.sin(phase) * rollAmp * blend;

  return {
    leftLegPitch,
    rightLegPitch,
    leftArmPitch,
    rightArmPitch,
    stepBounce,
    bodyRoll,
  };
}

/**
 * Calculates gentle breathing bob and idle sway when stationary.
 */
export function calculateIdleBob(timeSec: number, speedBlend: number = 0): IdleBobState {
  const blend = Math.max(0, 1.0 - Math.min(speedBlend, 1.0));

  const idleBobY = Math.sin(timeSec * IDLE_BOB_FREQUENCY) * IDLE_BOB_AMPLITUDE * blend;
  const idleSwayZ = Math.sin(timeSec * IDLE_SWAY_FREQUENCY) * IDLE_SWAY_AMPLITUDE * blend;
  const headTiltZ = Math.sin(timeSec * (IDLE_SWAY_FREQUENCY * 0.5)) * 0.015 * blend;

  return {
    idleBobY,
    idleSwayZ,
    headTiltZ,
  };
}

// ==========================================
// 4. Distance & Fall Safety
// ==========================================

/**
 * Calculates Euclidean displacement in world units for distance tracking.
 */
export function calculateDeltaDistance(vx: number, vz: number, deltaSec: number): number {
  if (deltaSec <= 0) return 0;
  return Math.hypot(vx, vz) * deltaSec;
}

/**
 * Determines whether the player has fallen below the safety killzone threshold.
 */
export function shouldRespawn(posY: number, thresholdY: number = ISLAND_FALL_Y_THRESHOLD): boolean {
  return posY < thresholdY;
}
