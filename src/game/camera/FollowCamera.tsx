import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  CAMERA_DEFAULT_YAW_DEG,
  CAMERA_DEFAULT_PITCH_DEG,
  CAMERA_DEFAULT_DISTANCE,
  CAMERA_MIN_PITCH_DEG,
  CAMERA_MAX_PITCH_DEG,
  CAMERA_MIN_DISTANCE,
  CAMERA_MAX_DISTANCE,
  CAMERA_TARGET_HEIGHT_OFFSET,
  CAMERA_EYE_HEIGHT_OFFSET,
  FIRST_PERSON_DISTANCE_THRESHOLD,
} from '../core/constants';
import { useSettingsStore } from '../../state/settingsStore';
import { useGameStore } from '../../state/gameStore';
import { useUiStore } from '../../state/uiStore';
import type { InputManager } from '../input/InputManager';
import {
  degToRad,
  sphericalToCartesian,
  applyOrbitDelta,
  applyZoomDelta,
  dampValue,
  dampAngle,
  dampVector3,
  computeCameraTarget,
  calculateCollisionOffsetDistance,
  isCameraObstacle,
  DEFAULT_POSITION_DAMPING,
  DEFAULT_ROTATION_DAMPING,
  DEFAULT_DISTANCE_DAMPING,
  DEFAULT_COLLISION_BUFFER,
  DEFAULT_TOUCH_ORBIT_MULTIPLIER,
  type Vector3Like,
  type PositionInput,
} from './cameraMath';

export interface FollowCameraProps {
  inputManager?: InputManager;
  targetPosition?: [number, number, number] | Vector3Like;
  targetRef?: React.RefObject<THREE.Object3D | THREE.Vector3 | null>;
  initialYawDeg?: number;
  initialPitchDeg?: number;
  initialDistance?: number;
  minDistance?: number;
  maxDistance?: number;
  minPitchDeg?: number;
  maxPitchDeg?: number;
  enableCollisionAvoidance?: boolean;
  enableControls?: boolean;
}

/**
 * FollowCamera Component:
 * - Controls the active Three.js PerspectiveCamera in R3F.
 * - Follows target entity (Player + Y=1.2 height offset) with smooth exponential damping.
 * - Supports orbit (right-mouse drag / 1-finger touch) and zoom (scroll wheel / pinch gesture).
 * - Enforces pitch limits [25°, 65°] and distance bounds [7, 18].
 * - Raycasts scene geometry to avoid camera clipping behind island terrain and props.
 * - Syncs camera yaw to InputManager for seamless camera-relative character movement.
 */
export const FollowCamera: React.FC<FollowCameraProps> = ({
  inputManager,
  targetPosition,
  targetRef,
  initialYawDeg = CAMERA_DEFAULT_YAW_DEG,
  initialPitchDeg = CAMERA_DEFAULT_PITCH_DEG,
  initialDistance = CAMERA_DEFAULT_DISTANCE,
  minDistance = CAMERA_MIN_DISTANCE,
  maxDistance = CAMERA_MAX_DISTANCE,
  minPitchDeg = CAMERA_MIN_PITCH_DEG,
  maxPitchDeg = CAMERA_MAX_PITCH_DEG,
  enableCollisionAvoidance = true,
  enableControls = true,
}) => {
  const { camera, gl, scene } = useThree();

  const minPitchRad = degToRad(minPitchDeg);
  const maxPitchRad = degToRad(maxPitchDeg);

  // Target desired spherical state
  const targetYawRef = useRef<number>(degToRad(initialYawDeg));
  const targetPitchRef = useRef<number>(degToRad(initialPitchDeg));
  const targetDistanceRef = useRef<number>(initialDistance);

  // Current smoothed spherical & target position state
  const currentYawRef = useRef<number>(degToRad(initialYawDeg));
  const currentPitchRef = useRef<number>(degToRad(initialPitchDeg));
  const currentDistanceRef = useRef<number>(initialDistance);
  const smoothedTargetPosRef = useRef<Vector3Like>({
    x: 0,
    y: CAMERA_TARGET_HEIGHT_OFFSET,
    z: 0,
  });

  // Desktop right-click drag state
  const isRightDraggingRef = useRef<boolean>(false);
  const lastPointerPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Reusable Three.js math primitives to avoid garbage collection churn
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const rayOriginRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const rayDirectionRef = useRef<THREE.Vector3>(new THREE.Vector3());

  // 1. Connect InputManager touch / orbit / zoom callbacks
  useEffect(() => {
    if (!inputManager || !enableControls) return;

    const prevOrbit = inputManager.onCameraOrbit;
    const prevZoom = inputManager.onCameraZoom;

    inputManager.onCameraOrbit = (deltaX, deltaY) => {
      const { cameraSensitivity, invertY } = useSettingsStore.getState();
      const isFirstPerson = currentDistanceRef.current < FIRST_PERSON_DISTANCE_THRESHOLD;
      const effectiveMinPitch = isFirstPerson ? degToRad(-75) : minPitchRad;
      const effectiveMaxPitch = isFirstPerson ? degToRad(85) : maxPitchRad;
      const touchMultiplier = DEFAULT_TOUCH_ORBIT_MULTIPLIER;

      const { yaw, pitch } = applyOrbitDelta(
        targetYawRef.current,
        targetPitchRef.current,
        deltaX,
        deltaY,
        cameraSensitivity,
        invertY,
        effectiveMinPitch,
        effectiveMaxPitch,
        touchMultiplier
      );
      targetYawRef.current = yaw;
      targetPitchRef.current = pitch;
      currentYawRef.current = yaw;
      currentPitchRef.current = pitch;
    };

    inputManager.onCameraZoom = (deltaDist) => {
      // Touch pinch: deltaDist > 0 (fingers spreading) -> zoom in (- distance)
      targetDistanceRef.current = applyZoomDelta(
        targetDistanceRef.current,
        -deltaDist * 0.15,
        1.0,
        minDistance,
        maxDistance
      );
    };

    return () => {
      inputManager.onCameraOrbit = prevOrbit;
      inputManager.onCameraZoom = prevZoom;
    };
  }, [inputManager, enableControls, minDistance, maxDistance, minPitchRad, maxPitchRad]);

  // 2. Desktop Mouse Orbit (Right Drag) & Mouse Wheel Zoom Event Listeners
  useEffect(() => {
    if (!enableControls) return;
    const domElement = gl.domElement;
    if (!domElement) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button === 2) {
        // Right-click drag start
        isRightDraggingRef.current = true;
        lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
        try {
          domElement.setPointerCapture(e.pointerId);
        } catch {
          // Ignore in headless/test environments
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isRightDraggingRef.current) return;

      const deltaX = e.clientX - lastPointerPosRef.current.x;
      const deltaY = e.clientY - lastPointerPosRef.current.y;
      lastPointerPosRef.current = { x: e.clientX, y: e.clientY };

      const { cameraSensitivity, invertY } = useSettingsStore.getState();
      const isFirstPerson = currentDistanceRef.current < FIRST_PERSON_DISTANCE_THRESHOLD;
      const effectiveMinPitch = isFirstPerson ? degToRad(-75) : minPitchRad;
      const effectiveMaxPitch = isFirstPerson ? degToRad(85) : maxPitchRad;

      const { yaw, pitch } = applyOrbitDelta(
        targetYawRef.current,
        targetPitchRef.current,
        deltaX,
        deltaY,
        cameraSensitivity,
        invertY,
        effectiveMinPitch,
        effectiveMaxPitch,
        1.0
      );
      targetYawRef.current = yaw;
      targetPitchRef.current = pitch;
      currentYawRef.current = yaw;
      currentPitchRef.current = pitch;
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.button === 2) {
        isRightDraggingRef.current = false;
        try {
          domElement.releasePointerCapture(e.pointerId);
        } catch {
          // Ignore
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      // Prevent browser context menu on right-click orbit drag
      e.preventDefault();
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Scroll down (deltaY > 0) zooms out (+distance), scroll up (deltaY < 0) zooms in (-distance)
      const zoomAmount = Math.sign(e.deltaY) * Math.min(3.5, Math.max(1.2, Math.abs(e.deltaY) * 0.025));
      targetDistanceRef.current = applyZoomDelta(
        targetDistanceRef.current,
        zoomAmount,
        1.0,
        minDistance,
        maxDistance
      );
    };

    const handleBlur = () => {
      isRightDraggingRef.current = false;
    };

    domElement.addEventListener('pointerdown', handlePointerDown);
    domElement.addEventListener('pointermove', handlePointerMove);
    domElement.addEventListener('pointerup', handlePointerUp);
    domElement.addEventListener('pointercancel', handlePointerUp);
    domElement.addEventListener('contextmenu', handleContextMenu);
    domElement.addEventListener('wheel', handleWheel, { passive: false });

    if (typeof window !== 'undefined') {
      window.addEventListener('blur', handleBlur);
    }

    return () => {
      domElement.removeEventListener('pointerdown', handlePointerDown);
      domElement.removeEventListener('pointermove', handlePointerMove);
      domElement.removeEventListener('pointerup', handlePointerUp);
      domElement.removeEventListener('pointercancel', handlePointerUp);
      domElement.removeEventListener('contextmenu', handleContextMenu);
      domElement.removeEventListener('wheel', handleWheel);

      if (typeof window !== 'undefined') {
        window.removeEventListener('blur', handleBlur);
      }
    };
  }, [gl, enableControls, minDistance, maxDistance, minPitchRad, maxPitchRad]);

  // 3. Frame Update Loop: Smooth Camera Follow, Orbit Damping & Raycast Collision Avoidance
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    if (dt <= 0) return;

    const { reducedMotion } = useSettingsStore.getState();

    // Determine current player base position
    let basePos: PositionInput = [0, 0, 0];
    if (targetPosition) {
      basePos = targetPosition;
    } else if (targetRef && targetRef.current) {
      const obj = targetRef.current;
      if ('x' in obj && 'y' in obj && 'z' in obj) {
        basePos = { x: obj.x, y: obj.y, z: obj.z };
      } else if ('position' in obj && obj.position) {
        basePos = { x: obj.position.x, y: obj.position.y, z: obj.position.z };
      }
    } else {
      basePos = useGameStore.getState().player.position;
    }

    // First person state detection and look target calculation
    const isFirstPerson = currentDistanceRef.current < FIRST_PERSON_DISTANCE_THRESHOLD;
    useUiStore.getState().setIsFirstPerson(isFirstPerson);

    const firstPersonBlend = Math.max(0, Math.min(1, (1.2 - currentDistanceRef.current) / 0.8));
    const targetHeight =
      CAMERA_TARGET_HEIGHT_OFFSET +
      (CAMERA_EYE_HEIGHT_OFFSET - CAMERA_TARGET_HEIGHT_OFFSET) * firstPersonBlend;
    const goalTarget = computeCameraTarget(basePos, targetHeight);

    // Apply damping to target lookAt and spherical coordinates
    const posDamping = reducedMotion ? 30 : DEFAULT_POSITION_DAMPING;
    const rotDamping = reducedMotion ? 30 : DEFAULT_ROTATION_DAMPING;
    const distDamping = reducedMotion ? 30 : DEFAULT_DISTANCE_DAMPING;

    smoothedTargetPosRef.current = dampVector3(
      smoothedTargetPosRef.current,
      goalTarget,
      posDamping,
      dt
    );

    currentYawRef.current = dampAngle(currentYawRef.current, targetYawRef.current, rotDamping, dt);

    currentPitchRef.current = dampValue(
      currentPitchRef.current,
      targetPitchRef.current,
      rotDamping,
      dt
    );

    currentDistanceRef.current = dampValue(
      currentDistanceRef.current,
      targetDistanceRef.current,
      distDamping,
      dt
    );

    let effectiveDistance = currentDistanceRef.current;

    // Raycast scene geometry to avoid obstacle clipping behind island props
    if (enableCollisionAvoidance && effectiveDistance > 0.5 && scene && scene.children.length > 0) {
      const desiredPos = sphericalToCartesian(
        currentYawRef.current,
        currentPitchRef.current,
        currentDistanceRef.current,
        smoothedTargetPosRef.current
      );

      const targetVec = smoothedTargetPosRef.current;
      rayOriginRef.current.set(targetVec.x, targetVec.y, targetVec.z);
      rayDirectionRef.current
        .set(desiredPos.x - targetVec.x, desiredPos.y - targetVec.y, desiredPos.z - targetVec.z)
        .normalize();

      const raycaster = raycasterRef.current;
      raycaster.set(rayOriginRef.current, rayDirectionRef.current);
      raycaster.near = 0.2;
      raycaster.far = currentDistanceRef.current;

      const rawHits = raycaster.intersectObjects(scene.children, true);
      const validHits = rawHits.filter((hit) => isCameraObstacle(hit.object));

      effectiveDistance = calculateCollisionOffsetDistance(
        currentDistanceRef.current,
        validHits,
        DEFAULT_COLLISION_BUFFER,
        minDistance
      );
    }

    if (effectiveDistance <= 0.25) {
      // First Person: Camera positioned directly at eye level looking in pitch/yaw direction
      camera.position.set(
        smoothedTargetPosRef.current.x,
        smoothedTargetPosRef.current.y,
        smoothedTargetPosRef.current.z
      );
      const forwardX =
        smoothedTargetPosRef.current.x -
        10 * Math.cos(currentPitchRef.current) * Math.sin(currentYawRef.current);
      const forwardY =
        smoothedTargetPosRef.current.y - 10 * Math.sin(currentPitchRef.current);
      const forwardZ =
        smoothedTargetPosRef.current.z -
        10 * Math.cos(currentPitchRef.current) * Math.cos(currentYawRef.current);
      camera.lookAt(forwardX, forwardY, forwardZ);
    } else {
      // Third Person: Camera orbiting target
      const finalCameraPos = sphericalToCartesian(
        currentYawRef.current,
        currentPitchRef.current,
        effectiveDistance,
        smoothedTargetPosRef.current
      );

      camera.position.set(finalCameraPos.x, finalCameraPos.y, finalCameraPos.z);
      camera.lookAt(
        smoothedTargetPosRef.current.x,
        smoothedTargetPosRef.current.y,
        smoothedTargetPosRef.current.z
      );
    }

    // Sync camera yaw to InputManager for directional movement
    if (inputManager) {
      inputManager.setCameraYaw(currentYawRef.current);
    }
  });

  return null;
};
