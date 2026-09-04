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
  leftArmRoll: number;
  rightArmRoll: number;
  stepBounce: number;
  bodyRoll: number;
  /** Counter-rotation of the torso against the legs. */
  torsoYaw: number;
  /** Extra foot-lift height added to the root while stepping. */
  legLift: number;
}

export interface IdleBobState {
  idleBobY: number;
  idleSwayZ: number;
  headTiltZ: number;
  /** Softer secondary motion layers for a natural, non-robotic idle. */
  torsoPitch: number;
  headYaw: number;
  headRollZ: number;
  armSwayZ: number;
  leftArmSwayZ: number;
  rightArmSwayZ: number;
  breatheScale: number;
}

// ==========================================
// 3. Procedural Limb & Idle Animations
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
export function dampScalar(
  current: number,
  target: number,
  damping: number,
  deltaSec: number
): number {
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
 * - Arms lead the legs by a small phase offset and the torso counter-rotates,
 *   so the gait reads as a walk instead of four synchronized pendulums.
 * - `airborne` tucks the limbs into a jump pose and suppresses stepping.
 * - `reducedMotion` damps secondary layers (bounce/roll/lift) for comfort.
 */
export function calculateLimbSwings(
  speed: number,
  _isRunning: boolean,
  phase: number,
  strideBlend: number = 1.0,
  airborne: boolean = false,
  reducedMotion: boolean = false
): LimbSwingState {
  const still = {
    leftLegPitch: 0,
    rightLegPitch: 0,
    leftArmPitch: 0,
    rightArmPitch: 0,
    leftArmRoll: 0,
    rightArmRoll: 0,
    stepBounce: 0,
    bodyRoll: 0,
    torsoYaw: 0,
    legLift: 0,
  };
  if (airborne) {
    return {
      ...still,
      // Jump tuck: front leg forward, back leg trailing, arms slightly raised.
      leftLegPitch: 0.45,
      rightLegPitch: -0.25,
      leftArmPitch: -0.4,
      rightArmPitch: 0.25,
      leftArmRoll: 0.25,
      rightArmRoll: -0.25,
    };
  }
  if (speed <= 0.001) {
    return still;
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
  const cosPhase = Math.cos(phase);

  // Legs swing with opposite phase
  const leftLegPitch = sinPhase * maxLeg * blend;
  const rightLegPitch = -sinPhase * maxLeg * blend;

  // Arms counterbalance legs with a small phase lead so limbs do not move
  // as one synchronized block (left arm swings with right leg).
  const armPhase = phase + 0.5;
  const leftArmPitch = -Math.sin(armPhase) * maxArm * blend;
  const rightArmPitch = Math.sin(armPhase) * maxArm * blend;

  // Arms also sway outward laterally, in quadrature with the stride.
  const secondary = reducedMotion ? 0.3 : 1.0;
  const leftArmRoll = (0.05 + cosPhase * 0.03) * blend;
  const rightArmRoll = -(0.05 + cosPhase * 0.03) * blend;

  // Vertical step bounce and lateral body roll (quadrature: roll peaks as
  // the weight shifts, not in sync with the leg swing).
  const stepBounce = Math.abs(sinPhase) * bounceAmp * blend * secondary;
  const bodyRoll = cosPhase * rollAmp * blend * secondary;

  // Torso counter-rotates against the hips; feet lift mid-swing.
  const torsoYaw = sinPhase * 0.04 * blend * secondary;
  const legLift = Math.max(0, Math.sin(phase + Math.PI / 2)) * 0.06 * blend * secondary;

  return {
    leftLegPitch,
    rightLegPitch,
    leftArmPitch,
    rightArmPitch,
    leftArmRoll,
    rightArmRoll,
    stepBounce,
    bodyRoll,
    torsoYaw,
    legLift,
  };
}

// Secondary idle motion tuning: layered, out-of-phase frequencies so the
// character never looks like a metronome.
const IDLE_BREATH_FREQUENCY = 1.1; // rad/s chest breathing (~0.18 Hz)
const IDLE_BREATH_AMPLITUDE = 0.02; // radians torso pitch
const IDLE_GLANCE_FREQUENCY = 0.35; // rad/s slow occasional look-around
const IDLE_GLANCE_AMPLITUDE = 0.28; // radians head yaw (left/right peek)
const IDLE_GLANCE_WOBBLE = 0.04; // small yaw noise so peeks are not square-wave
const IDLE_ARM_SWAY_FREQUENCY = 0.9; // rad/s relaxed arm drift
const IDLE_ARM_SWAY_AMPLITUDE = 0.05; // radians arm roll
const IDLE_SCALE_AMPLITUDE = 0.008; // subtle chest scale on breath
const IDLE_HEAD_ROLL_FREQUENCY = 0.53; // rad/s incommensurate head roll (de-metronome)
const IDLE_HEAD_ROLL_AMPLITUDE = 0.01; // radians head roll

/**
 * Calculates gentle breathing bob and idle sway when stationary.
 *
 * Layered secondary motion — chest breathing, torso pitch, occasional
 * look-around glances, relaxed asymmetric arm drift, and a subtle breath
 * scale — runs on out-of-phase frequencies so the idle never reads as a
 * stiff two-sine loop.
 * All layers fade out with `speedBlend` (1 = moving, 0 = fully idle).
 * `reducedMotion` damps every layer to a calm minimum for comfort.
 */
export function calculateIdleBob(
  timeSec: number,
  speedBlend: number = 0,
  reducedMotion: boolean = false
): IdleBobState {
  const motionScale = reducedMotion ? 0.25 : 1.0;
  const blend = Math.max(0, 1.0 - Math.min(speedBlend, 1.0)) * motionScale;

  const idleBobY = Math.sin(timeSec * IDLE_BOB_FREQUENCY) * IDLE_BOB_AMPLITUDE * blend;
  const idleSwayZ = Math.sin(timeSec * IDLE_SWAY_FREQUENCY) * IDLE_SWAY_AMPLITUDE * blend;
  const headTiltZ = Math.sin(timeSec * (IDLE_SWAY_FREQUENCY * 0.5)) * 0.015 * blend;

  // Chest breathing: torso leans almost imperceptibly with each breath.
  const torsoPitch = Math.sin(timeSec * IDLE_BREATH_FREQUENCY) * IDLE_BREATH_AMPLITUDE * blend;

  // Occasional glance: a slow sinusoid quantized softly with a wobble so the
  // head mostly holds a direction, then eases to a new one (no snapping).
  const glanceRaw = Math.sin(timeSec * IDLE_GLANCE_FREQUENCY);
  const glanceHeld = Math.sign(glanceRaw) * Math.pow(Math.abs(glanceRaw), 0.6);
  const headYaw =
    (glanceHeld + Math.sin(timeSec * 6.1) * IDLE_GLANCE_WOBBLE * Math.abs(glanceHeld)) *
    IDLE_GLANCE_AMPLITUDE *
    blend;

  // Relaxed arm drift, truly asymmetric per side (different frequencies
  // and phases so the arms never mirror each other mechanically).
  const leftArmSwayZ =
    Math.sin(timeSec * IDLE_ARM_SWAY_FREQUENCY) * IDLE_ARM_SWAY_AMPLITUDE * blend;
  const rightArmSwayZ = Math.sin(timeSec * 0.73 + 1.3) * IDLE_ARM_SWAY_AMPLITUDE * blend;
  const armSwayZ = (leftArmSwayZ + rightArmSwayZ) / 2;

  // Slow incommensurate head roll breaks the last metronome regularity.
  const headRollZ =
    Math.sin(timeSec * IDLE_HEAD_ROLL_FREQUENCY + 0.7) * IDLE_HEAD_ROLL_AMPLITUDE * blend;

  // Subtle chest expansion synced to breathing.
  const breatheScale = Math.sin(timeSec * IDLE_BREATH_FREQUENCY) * IDLE_SCALE_AMPLITUDE * blend;

  return {
    idleBobY,
    idleSwayZ,
    headTiltZ,
    torsoPitch,
    headYaw,
    headRollZ,
    armSwayZ,
    leftArmSwayZ,
    rightArmSwayZ,
    breatheScale,
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
