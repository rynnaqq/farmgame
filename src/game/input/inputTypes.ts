import { JOYSTICK_DEADZONE_RATIO } from '../core/constants';
import type { ToolType } from '../../state/storeTypes';

// ==========================================
// 1. Types & Interfaces
// ==========================================

export interface Vector2D {
  x: number;
  y: number;
}

export interface Vector3DXZ {
  x: number;
  z: number;
}

export interface JoystickDeadzoneResult {
  x: number;
  y: number;
  magnitude: number;
  rawMagnitude: number;
}

export interface ProcessedMovementState {
  moveVector: Vector3DXZ;
  rawVector: Vector3DXZ;
  magnitude: number;
  isRunning: boolean;
}

export interface TouchGestureState {
  activePointers: number;
  isOrbiting: boolean;
  isPinching: boolean;
}

export type ToolSelectCallback = (tool: ToolType) => void;
export type CycleSeedCallback = (direction: -1 | 1) => void;
export type InteractCallback = () => void;
export type EscapeCallback = () => void;
export type CameraOrbitCallback = (deltaYaw: number, deltaPitch: number) => void;
export type CameraZoomCallback = (deltaDistance: number) => void;

// ==========================================
// 2. Pure Calculation Helpers
// ==========================================

/**
 * Applies a radial deadzone and linear remapping to raw joystick input coordinates.
 * Clamps output magnitude to [0, 1].
 */
export function processJoystickDeadzone(
  rawX: number,
  rawY: number,
  deadzoneRatio: number = JOYSTICK_DEADZONE_RATIO
): JoystickDeadzoneResult {
  const rawMagnitude = Math.hypot(rawX, rawY);

  if (rawMagnitude <= deadzoneRatio || rawMagnitude === 0) {
    return {
      x: 0,
      y: 0,
      magnitude: 0,
      rawMagnitude,
    };
  }

  const clampedRaw = Math.min(rawMagnitude, 1.0);
  const remappedMag = (clampedRaw - deadzoneRatio) / (1.0 - deadzoneRatio);
  const magnitude = Math.max(0, Math.min(1.0, remappedMag));

  const unitX = rawX / rawMagnitude;
  const unitY = rawY / rawMagnitude;

  return {
    x: unitX * magnitude,
    y: unitY * magnitude,
    magnitude,
    rawMagnitude,
  };
}

/**
 * Merges keyboard (dx, dz) and joystick (jx, jz) input vectors,
 * ensuring total magnitude is clamped to [0, 1].
 */
export function mergeInputVectors(
  keyboardVec: Vector3DXZ,
  joystickVec: Vector3DXZ
): { x: number; z: number; magnitude: number } {
  const combinedX = keyboardVec.x + joystickVec.x;
  const combinedZ = keyboardVec.z + joystickVec.z;
  const mag = Math.hypot(combinedX, combinedZ);

  if (mag === 0) {
    return { x: 0, z: 0, magnitude: 0 };
  }

  if (mag > 1.0) {
    return {
      x: combinedX / mag,
      z: combinedZ / mag,
      magnitude: 1.0,
    };
  }

  return {
    x: combinedX,
    z: combinedZ,
    magnitude: mag,
  };
}

/**
 * Translates an input vector (where x is right, z is forward/backward in screen space)
 * into world space relative to the camera's azimuth/yaw angle.
 */
export function transformCameraRelative(
  inputX: number,
  inputZ: number,
  cameraYawRad: number
): Vector3DXZ {
  if (inputX === 0 && inputZ === 0) {
    return { x: 0, z: 0 };
  }

  const cos = Math.cos(cameraYawRad);
  const sin = Math.sin(cameraYawRad);

  const worldX = inputX * cos + inputZ * sin;
  const worldZ = -inputX * sin + inputZ * cos;

  return {
    x: worldX,
    z: worldZ,
  };
}
