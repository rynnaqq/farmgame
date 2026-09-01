import {
  PET_FOLLOW_MIN_DISTANCE,
  PET_FOLLOW_MAX_DISTANCE,
  PET_TELEPORT_DISTANCE,
} from '../core/constants';

// ==========================================
// Pet Steering & Animation Constants
// ==========================================
export {
  PET_FOLLOW_MIN_DISTANCE,
  PET_FOLLOW_MAX_DISTANCE,
  PET_TELEPORT_DISTANCE,
};

export const PET_DEFAULT_FOLLOW_DISTANCE = 1.85;
export const PET_STEERING_SPEED = 4.8; // units/s follow speed
export const PET_ROTATION_LERP_SPEED = 12.0; // rad/s orientation lerp
export const PET_STOP_DISTANCE_BUFFER = 0.2; // units deadzone around trailing target

export const BEE_WING_FLUTTER_FREQ_HZ = 30; // 30Hz high-frequency wing oscillation
export const BEE_HOVER_Y_BASE = 1.35; // Hover height around player shoulder level
export const BEE_HOVER_BOB_AMPLITUDE = 0.12; // Floating bob vertical offset
export const BEE_HOVER_BOB_FREQ = 3.0; // Floating bob cycle frequency (rad/s)

export const DOG_TAIL_WAG_FREQ = 16.0; // Fast cheerful tail wag
export const DOG_LEG_SWING_MAX = 0.6; // Max quadruped leg rotation in radians
export const DOG_RUN_SPEED_THRESHOLD = 3.0;

export const PIG_TROT_FREQ = 12.0; // Cute trot frequency
export const PIG_LEG_SWING_MAX = 0.5; // Trot leg rotation amplitude

export const EGG_WOBBLE_FREQ = 8.0; // Base incubation rock & shake

// ==========================================
// Animation State Interfaces
// ==========================================
export interface BeeAnimationState {
  wingPitchLeft: number;
  wingPitchRight: number;
  wingRollLeft: number;
  wingRollRight: number;
  hoverY: number;
  bodyBobY: number;
  antennaWobble: number;
}

export interface DogAnimationState {
  tailWagYaw: number;
  legPitchFrontLeft: number;
  legPitchFrontRight: number;
  legPitchBackLeft: number;
  legPitchBackRight: number;
  harvestBounceY: number;
  headPitch: number;
}

export interface PigAnimationState {
  legPitchFrontLeft: number;
  legPitchFrontRight: number;
  legPitchBackLeft: number;
  legPitchBackRight: number;
  snoutTwitchY: number;
  tailCurlRotation: number;
  trotBounceY: number;
}

export interface EggAnimationState {
  wobbleRollZ: number;
  wobblePitchX: number;
  isHatchingShake: boolean;
  glowIntensity: number;
  crackStage: 0 | 1 | 2 | 3;
}

// ==========================================
// 1. Distance & Teleport Math
// ==========================================

/**
 * Calculates 2D Euclidean distance on the X-Z plane.
 */
export function distance2D(
  p1: [number, number, number] | { x: number; z: number },
  p2: [number, number, number] | { x: number; z: number }
): number {
  const x1 = Array.isArray(p1) ? p1[0] : p1.x;
  const z1 = Array.isArray(p1) ? p1[2] : p1.z;
  const x2 = Array.isArray(p2) ? p2[0] : p2.x;
  const z2 = Array.isArray(p2) ? p2[2] : p2.z;

  return Math.hypot(x2 - x1, z2 - z1);
}

/**
 * Calculates 3D Euclidean distance in world space.
 */
export function distance3D(
  p1: [number, number, number],
  p2: [number, number, number]
): number {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const dz = p2[2] - p1[2];
  return Math.hypot(dx, dy, dz);
}

/**
 * Determines whether the pet has exceeded the teleport threshold (> 12.0 units) from target.
 */
export function shouldTeleport(
  currentPos: [number, number, number],
  targetPos: [number, number, number],
  threshold: number = PET_TELEPORT_DISTANCE
): boolean {
  return distance2D(currentPos, targetPos) > threshold;
}

/**
 * Clamps distance to the required [1.5, 2.2] follow distance range.
 */
export function clampFollowDistance(
  dist: number,
  min: number = PET_FOLLOW_MIN_DISTANCE,
  max: number = PET_FOLLOW_MAX_DISTANCE
): number {
  return Math.max(min, Math.min(max, dist));
}

// ==========================================
// 2. Trailing & Orientation Calculations
// ==========================================

/**
 * Computes the trailing world position offset behind the player.
 * Player forward is along (sin(yaw), 0, cos(yaw)), so trailing offset is behind:
 * (-sin(yaw) * distance, 0, -cos(yaw) * distance).
 */
export function calculateTrailingTarget(
  playerPos: [number, number, number],
  playerYaw: number,
  distance: number = PET_DEFAULT_FOLLOW_DISTANCE
): [number, number, number] {
  const clampedDistance = clampFollowDistance(distance);
  const offsetX = -Math.sin(playerYaw) * clampedDistance;
  const offsetZ = -Math.cos(playerYaw) * clampedDistance;

  return [playerPos[0] + offsetX, playerPos[1], playerPos[2] + offsetZ];
}

/**
 * Computes target yaw for the pet:
 * - If moving with notable velocity (> 0.05), faces the movement direction.
 * - When stationary, turns to look directly towards the player.
 */
export function computePetTargetYaw(
  petPos: [number, number, number],
  moveVelocity: { x: number; z: number },
  playerPos: [number, number, number],
  currentYaw: number
): number {
  const moveSpeed = Math.hypot(moveVelocity.x, moveVelocity.z);
  if (moveSpeed > 0.05) {
    return Math.atan2(moveVelocity.x, moveVelocity.z);
  }

  const dx = playerPos[0] - petPos[0];
  const dz = playerPos[2] - petPos[2];
  const distToPlayer = Math.hypot(dx, dz);

  if (distToPlayer > 0.01) {
    return Math.atan2(dx, dz);
  }

  return currentYaw;
}

/**
 * Normalizes an angle in radians to [-PI, PI].
 */
export function normalizeAngle(rad: number): number {
  let a = rad % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Interpolates between angles along the shortest arc.
 */
export function lerpPetAngle(fromRad: number, toRad: number, alpha: number): number {
  const clampedAlpha = Math.min(Math.max(alpha, 0), 1.0);
  const diff = normalizeAngle(toRad - fromRad);
  return normalizeAngle(fromRad + diff * clampedAlpha);
}

// ==========================================
// 3. Procedural Animation Math
// ==========================================

/**
 * Computes Bee procedural animation transforms:
 * - 30Hz high frequency wing fluttering
 * - Shoulder-level hovering with gentle sinusoidal bob
 * - Subtle antenna twitching
 */
export function calculateBeeAnimation(timeSec: number): BeeAnimationState {
  const flutterCycle = Math.sin(timeSec * BEE_WING_FLUTTER_FREQ_HZ * 2 * Math.PI);

  const wingPitchLeft = flutterCycle * 0.45;
  const wingPitchRight = flutterCycle * 0.45;
  const wingRollLeft = -flutterCycle * 0.6;
  const wingRollRight = flutterCycle * 0.6;

  const hoverY =
    BEE_HOVER_Y_BASE + Math.sin(timeSec * BEE_HOVER_BOB_FREQ) * BEE_HOVER_BOB_AMPLITUDE;
  const bodyBobY = Math.sin(timeSec * BEE_HOVER_BOB_FREQ * 1.5) * 0.03;
  const antennaWobble = Math.sin(timeSec * 8.0) * 0.1;

  return {
    wingPitchLeft,
    wingPitchRight,
    wingRollLeft,
    wingRollRight,
    hoverY,
    bodyBobY,
    antennaWobble,
  };
}

/**
 * Computes Dog procedural animation transforms:
 * - Alternating diagonal quadruped leg gait (FrontLeft+BackRight vs FrontRight+BackLeft)
 * - Cheerful tail wagging (accelerated when running or auto-harvesting)
 * - Auto-harvest harvest bounce & sniffing head tilt
 */
export function calculateDogAnimation(
  timeSec: number,
  speed: number,
  isAutoHarvesting: boolean = false
): DogAnimationState {
  const speedRatio = Math.min(speed / 4.0, 1.0);
  const isMoving = speed > 0.05;

  const legPhase = timeSec * (isMoving ? 12.0 : 0);
  const sinPhase = Math.sin(legPhase);

  // Quadruped trot: diagonal leg pairs synchronize
  const legPitchFrontLeft = isMoving ? sinPhase * DOG_LEG_SWING_MAX * speedRatio : 0;
  const legPitchBackRight = isMoving ? sinPhase * DOG_LEG_SWING_MAX * speedRatio : 0;
  const legPitchFrontRight = isMoving ? -sinPhase * DOG_LEG_SWING_MAX * speedRatio : 0;
  const legPitchBackLeft = isMoving ? -sinPhase * DOG_LEG_SWING_MAX * speedRatio : 0;

  // Tail wag frequency & amplitude
  const wagSpeed = isAutoHarvesting ? 24.0 : isMoving ? 18.0 : 10.0;
  const wagAmp = isAutoHarvesting ? 0.75 : isMoving ? 0.6 : 0.35;
  const tailWagYaw = Math.sin(timeSec * wagSpeed) * wagAmp;

  // Harvest celebration bounce and sniffing
  const harvestBounceY = isAutoHarvesting ? Math.abs(Math.sin(timeSec * 8.0)) * 0.15 : 0;
  const headPitch = isAutoHarvesting ? 0.2 : isMoving ? 0.05 : 0;

  return {
    tailWagYaw,
    legPitchFrontLeft,
    legPitchFrontRight,
    legPitchBackLeft,
    legPitchBackRight,
    harvestBounceY,
    headPitch,
  };
}

/**
 * Computes Pig procedural animation transforms:
 * - 4-leg trotting gait
 * - Snout twitch and body bounce
 * - Cute curly tail wiggle
 */
export function calculatePigAnimation(timeSec: number, speed: number): PigAnimationState {
  const speedRatio = Math.min(speed / 3.5, 1.0);
  const isMoving = speed > 0.05;

  const legPhase = timeSec * (isMoving ? PIG_TROT_FREQ : 0);
  const sinPhase = Math.sin(legPhase);

  const legPitchFrontLeft = isMoving ? sinPhase * PIG_LEG_SWING_MAX * speedRatio : 0;
  const legPitchBackRight = isMoving ? sinPhase * PIG_LEG_SWING_MAX * speedRatio : 0;
  const legPitchFrontRight = isMoving ? -sinPhase * PIG_LEG_SWING_MAX * speedRatio : 0;
  const legPitchBackLeft = isMoving ? -sinPhase * PIG_LEG_SWING_MAX * speedRatio : 0;

  const trotBounceY = isMoving ? Math.abs(sinPhase) * 0.04 * speedRatio : 0;
  const snoutTwitchY = Math.sin(timeSec * 6.0) * 0.02;
  const tailCurlRotation = Math.sin(timeSec * 8.0) * 0.25;

  return {
    legPitchFrontLeft,
    legPitchFrontRight,
    legPitchBackLeft,
    legPitchBackRight,
    snoutTwitchY,
    tailCurlRotation,
    trotBounceY,
  };
}

/**
 * Computes Egg procedural animation transforms:
 * - Incubation wobble & shaking based on progress ratio
 * - Crack stages (0: intact, 1: 50%+, 2: 80%+, 3: ready to hatch)
 * - Excitation hatching shake when progress reaches 100%
 */
export function calculateEggAnimation(
  timeSec: number,
  progressRatio: number,
  isIncubating: boolean
): EggAnimationState {
  if (!isIncubating) {
    return {
      wobbleRollZ: 0,
      wobblePitchX: 0,
      isHatchingShake: false,
      glowIntensity: 0,
      crackStage: 0,
    };
  }

  const clampedProgress = Math.max(0, Math.min(1.0, progressRatio));
  const isHatchingShake = clampedProgress >= 1.0;

  const crackStage: 0 | 1 | 2 | 3 =
    clampedProgress >= 1.0 ? 3 : clampedProgress >= 0.8 ? 2 : clampedProgress >= 0.5 ? 1 : 0;

  const shakeFreq = isHatchingShake ? 26.0 : EGG_WOBBLE_FREQ;
  const shakeAmp = isHatchingShake ? 0.35 : 0.05 + clampedProgress * 0.25;

  const wobbleRollZ = Math.sin(timeSec * shakeFreq) * shakeAmp;
  const wobblePitchX = Math.cos(timeSec * shakeFreq * 0.8) * shakeAmp * 0.4;

  const glowIntensity = isHatchingShake
    ? 0.8 + Math.sin(timeSec * 16.0) * 0.2
    : clampedProgress * 0.4;

  return {
    wobbleRollZ,
    wobblePitchX,
    isHatchingShake,
    glowIntensity,
    crackStage,
  };
}
