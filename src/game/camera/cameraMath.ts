import {
  CAMERA_DEFAULT_YAW_DEG,
  CAMERA_DEFAULT_PITCH_DEG,
  CAMERA_DEFAULT_DISTANCE,
  CAMERA_MIN_PITCH_DEG,
  CAMERA_MAX_PITCH_DEG,
  CAMERA_MIN_DISTANCE,
  CAMERA_MAX_DISTANCE,
  CAMERA_TARGET_HEIGHT_OFFSET,
} from '../core/constants';

export const CAMERA_DEFAULT_YAW_RAD = (CAMERA_DEFAULT_YAW_DEG * Math.PI) / 180;
export const CAMERA_DEFAULT_PITCH_RAD = (CAMERA_DEFAULT_PITCH_DEG * Math.PI) / 180;
export const CAMERA_DEFAULT_DISTANCE_VALUE = CAMERA_DEFAULT_DISTANCE;

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export type PositionInput = Vector3Like | [number, number, number];

export interface SphericalCoordinates {
  yaw: number;
  pitch: number;
  distance: number;
}

export interface RaycastHitLike {
  distance: number;
  point?: Vector3Like;
}

export const DEFAULT_ORBIT_SENSITIVITY = 0.005;
export const DEFAULT_ZOOM_SENSITIVITY = 0.01;
export const DEFAULT_POSITION_DAMPING = 8;
export const DEFAULT_ROTATION_DAMPING = 10;
export const DEFAULT_DISTANCE_DAMPING = 8;
export const DEFAULT_COLLISION_BUFFER = 0.3;

/**
 * Converts degrees to radians.
 */
export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Converts radians to degrees.
 */
export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Clamps a numeric value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Clamps pitch angle in degrees to [CAMERA_MIN_PITCH_DEG, CAMERA_MAX_PITCH_DEG] (default: [25, 65]).
 */
export function clampPitchDeg(
  pitchDeg: number,
  minDeg: number = CAMERA_MIN_PITCH_DEG,
  maxDeg: number = CAMERA_MAX_PITCH_DEG
): number {
  return clamp(pitchDeg, minDeg, maxDeg);
}

/**
 * Clamps pitch angle in radians to [minRad, maxRad] (default: [25°, 65°] in radians).
 */
export function clampPitchRad(
  pitchRad: number,
  minRad: number = degToRad(CAMERA_MIN_PITCH_DEG),
  maxRad: number = degToRad(CAMERA_MAX_PITCH_DEG)
): number {
  return clamp(pitchRad, minRad, maxRad);
}

/**
 * Clamps camera distance to [CAMERA_MIN_DISTANCE, CAMERA_MAX_DISTANCE] (default: [7, 18]).
 */
export function clampDistance(
  distance: number,
  minDist: number = CAMERA_MIN_DISTANCE,
  maxDist: number = CAMERA_MAX_DISTANCE
): number {
  return clamp(distance, minDist, maxDist);
}

/**
 * Normalizes an angle in radians to the range [-PI, PI].
 */
export function normalizeAngleRad(angleRad: number): number {
  let a = angleRad % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Extracts x, y, z components from a PositionInput.
 */
export function extractPosition(pos: PositionInput): Vector3Like {
  if (Array.isArray(pos)) {
    return { x: pos[0], y: pos[1], z: pos[2] };
  }
  return { x: pos.x, y: pos.y, z: pos.z };
}

/**
 * Calculates the camera's Cartesian world coordinates given spherical coordinates
 * (yaw in radians, pitch in radians, distance) relative to a target point.
 */
export function sphericalToCartesian(
  yawRad: number,
  pitchRad: number,
  distance: number,
  target: PositionInput
): Vector3Like {
  const t = extractPosition(target);
  const horizontalRadius = distance * Math.cos(pitchRad);

  return {
    x: t.x + horizontalRadius * Math.sin(yawRad),
    y: t.y + distance * Math.sin(pitchRad),
    z: t.z + horizontalRadius * Math.cos(yawRad),
  };
}

/**
 * Inverse transformation: computes spherical coordinates from camera Cartesian position and target point.
 */
export function cartesianToSpherical(
  camPos: PositionInput,
  targetPos: PositionInput
): SphericalCoordinates {
  const c = extractPosition(camPos);
  const t = extractPosition(targetPos);

  const dx = c.x - t.x;
  const dy = c.y - t.y;
  const dz = c.z - t.z;
  const distance = Math.hypot(dx, dy, dz);

  if (distance === 0) {
    return { yaw: 0, pitch: 0, distance: 0 };
  }

  const pitch = Math.asin(clamp(dy / distance, -1, 1));
  const yaw = Math.atan2(dx, dz);

  return {
    yaw,
    pitch,
    distance,
  };
}

/**
 * Applies orbit deltas (from mouse drag or touch movement) to yaw and pitch,
 * taking into account sensitivity multiplier, invertY preference, and pitch clamps.
 */
export function applyOrbitDelta(
  currentYawRad: number,
  currentPitchRad: number,
  deltaX: number,
  deltaY: number,
  sensitivity: number = 1.0,
  invertY: boolean = false,
  minPitchRad: number = degToRad(CAMERA_MIN_PITCH_DEG),
  maxPitchRad: number = degToRad(CAMERA_MAX_PITCH_DEG)
): { yaw: number; pitch: number } {
  const effectiveSens = DEFAULT_ORBIT_SENSITIVITY * sensitivity;
  const newYaw = normalizeAngleRad(currentYawRad - deltaX * effectiveSens);

  const pitchDirection = invertY ? -1 : 1;
  const newPitch = clampPitchRad(
    currentPitchRad + deltaY * effectiveSens * pitchDirection,
    minPitchRad,
    maxPitchRad
  );

  return {
    yaw: newYaw,
    pitch: newPitch,
  };
}

/**
 * Applies zoom delta (from mouse wheel or pinch gesture) to distance,
 * clamping the result within [minDist, maxDist].
 */
export function applyZoomDelta(
  currentDistance: number,
  deltaDistance: number,
  zoomSensitivity: number = 1.0,
  minDist: number = CAMERA_MIN_DISTANCE,
  maxDist: number = CAMERA_MAX_DISTANCE
): number {
  const nextDistance = currentDistance + deltaDistance * zoomSensitivity;
  return clampDistance(nextDistance, minDist, maxDist);
}

/**
 * Exponential decay scalar damping function (frame-rate independent).
 */
export function dampValue(current: number, target: number, decay: number, dt: number): number {
  const factor = 1 - Math.exp(-decay * Math.max(0, dt));
  return current + (target - current) * Math.min(1, Math.max(0, factor));
}

/**
 * Damps an angle in radians using the shortest arc across the [-PI, PI] boundary.
 */
export function dampAngle(
  currentRad: number,
  targetRad: number,
  decay: number,
  dt: number
): number {
  let diff = (targetRad - currentRad) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;

  const factor = 1 - Math.exp(-decay * Math.max(0, dt));
  return currentRad + diff * Math.min(1, Math.max(0, factor));
}

/**
 * Exponential decay 3D vector damping.
 */
export function dampVector3(
  current: Vector3Like,
  target: Vector3Like,
  decay: number,
  dt: number
): Vector3Like {
  return {
    x: dampValue(current.x, target.x, decay, dt),
    y: dampValue(current.y, target.y, decay, dt),
    z: dampValue(current.z, target.z, decay, dt),
  };
}

/**
 * Computes the lookAt target vector for the camera from a player base position,
 * applying the standard Y + 1.2 height offset.
 */
export function computeCameraTarget(
  playerPos: PositionInput,
  heightOffset: number = CAMERA_TARGET_HEIGHT_OFFSET
): Vector3Like {
  const p = extractPosition(playerPos);
  return {
    x: p.x,
    y: p.y + heightOffset,
    z: p.z,
  };
}

/**
 * Checks raycast obstacle hits between target and desired camera position.
 * If an obstruction is detected closer than desired distance, shortens camera distance
 * to hit distance minus a buffer, clamped to minDistance.
 */
export function calculateCollisionOffsetDistance(
  desiredDistance: number,
  hits: RaycastHitLike[],
  collisionBuffer: number = DEFAULT_COLLISION_BUFFER,
  minDist: number = CAMERA_MIN_DISTANCE
): number {
  if (!hits || hits.length === 0) {
    return desiredDistance;
  }

  let minHitDist = Infinity;
  for (const hit of hits) {
    if (hit && typeof hit.distance === 'number' && hit.distance > 0 && hit.distance < minHitDist) {
      minHitDist = hit.distance;
    }
  }

  if (minHitDist === Infinity || minHitDist >= desiredDistance) {
    return desiredDistance;
  }

  const safeDistance = minHitDist - collisionBuffer;
  return Math.max(minDist, Math.min(desiredDistance, safeDistance));
}

export interface ObstacleCandidate {
  visible: boolean;
  name?: string;
  parent?: ObstacleCandidate | null;
  isMesh?: boolean;
}

/**
 * Checks if a Three.js Object3D should act as an optical obstacle for camera collision avoidance.
 * Ignores player meshes, boundary trigger volumes, sensors, and invisible objects.
 */
export function isCameraObstacle(obj: ObstacleCandidate): boolean {
  if (!obj.visible) return false;
  if (!obj.isMesh) return false;

  let current: ObstacleCandidate | null | undefined = obj;
  while (current) {
    const name = current.name || '';
    if (
      name.includes('Player') ||
      name.includes('Sensor') ||
      name.includes('Boundary') ||
      name.includes('Killzone') ||
      name.includes('Trigger') ||
      name.includes('Helper') ||
      name.includes('Gizmo')
    ) {
      return false;
    }
    current = current.parent;
  }
  return true;
}
