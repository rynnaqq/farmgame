import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import {
  PLAYER_WALK_SPEED,
  PLAYER_RUN_SPEED,
  ISLAND_FALL_Y_THRESHOLD,
  PLAYER_SPAWN_POSITION,
} from '../core/constants';
import { useGameStore } from '../../state/gameStore';
import { useUiStore } from '../../state/uiStore';
import { useNetStore } from '../multiplayer/netStore';
import { getRoomConnection } from '../multiplayer/RoomConnection';
import type { InputManager } from '../input/InputManager';
import { PlayerModel } from './PlayerModel';
import {
  smoothVelocity,
  computeTargetYaw,
  calculateLimbSwings,
  calculateIdleBob,
  calculateDeltaDistance,
  shouldRespawn,
  dampAngle,
  dampScalar,
  DEFAULT_ROTATION_DAMPING,
  DEFAULT_STRIDE_BLEND_DAMPING,
} from './playerAnimation';
import { playerTransform } from './playerTransformStore';

/** Store sync cadence: UI/gameplay consumers do not need 60 Hz positions. */
const STORE_SYNC_INTERVAL_MS = 100;

export interface PlayerControllerProps {
  initialPosition?: [number, number, number];
  inputManager?: InputManager;
  onFall?: () => void;
}

/**
 * Kinematic Rapier Player Character Controller:
 * - Reads processed camera-relative inputs from InputManager
 * - Applies velocity smoothing with acceleration and friction
 * - Smoothly interpolates orientation using shortest-arc angle lerp
 * - Directly drives procedural humanoid model bones (limbs, bob, roll, head tilt)
 * - Tracks Euclidean distance traveled and updates gameStore
 * - Enforces safety respawn if player drops below Y = -5
 */
export const PlayerController: React.FC<PlayerControllerProps> = ({
  initialPosition = [PLAYER_SPAWN_POSITION[0], PLAYER_SPAWN_POSITION[1], PLAYER_SPAWN_POSITION[2]],
  inputManager,
  onFall,
}) => {
  const rigidBodyRef = useRef<RapierRigidBody | null>(null);

  // Animation bone group references for zero-re-render 60fps updates
  const rootModelRef = useRef<THREE.Group | null>(null);
  const headRef = useRef<THREE.Group | null>(null);
  const leftArmRef = useRef<THREE.Group | null>(null);
  const rightArmRef = useRef<THREE.Group | null>(null);
  const leftLegRef = useRef<THREE.Group | null>(null);
  const rightLegRef = useRef<THREE.Group | null>(null);

  // Kinematic state
  const velocityRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const yawRef = useRef<number>(0);
  const walkPhaseRef = useRef<number>(0);
  const idlePhaseRef = useRef<number>(0);
  /** Smoothed 0..1 locomotion blend: 0 = idle pose, 1 = full stride. */
  const smoothedSpeedRef = useRef<number>(0);
  /** Throttle timestamp for zustand store position syncs. */
  const lastStoreSyncRef = useRef<number>(0);

  // Reusable Three math primitives to avoid GC allocations
  const quaternionRef = useRef<THREE.Quaternion>(new THREE.Quaternion());
  const upAxisRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1, 0));

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    if (dt <= 0) return;

    // 1. Read input state
    let moveX = 0;
    let moveZ = 0;
    let magnitude = 0;
    let isRunning = false;

    if (inputManager) {
      const movement = inputManager.update(dt * 1000);
      moveX = movement.moveVector.x;
      moveZ = movement.moveVector.z;
      magnitude = movement.magnitude;
      isRunning = movement.isRunning;
    }

    // 2. Velocity smoothing with walk (3.5) / run (5.25) speed
    const targetSpeed = magnitude > 0.01 ? (isRunning ? PLAYER_RUN_SPEED : PLAYER_WALK_SPEED) : 0;
    const targetDir = magnitude > 0.01 ? { x: moveX, z: moveZ } : { x: 0, z: 0 };

    const smoothed = smoothVelocity(velocityRef.current, targetDir, targetSpeed, dt);
    velocityRef.current = { x: smoothed.x, z: smoothed.z };

    // 3. Shortest-path facing rotation — exponential damping is frame-rate
    // independent and never snaps on the final frame.
    if (smoothed.speed > 0.05) {
      const targetYaw = computeTargetYaw(smoothed.x, smoothed.z, yawRef.current);
      yawRef.current = dampAngle(yawRef.current, targetYaw, DEFAULT_ROTATION_DAMPING, dt);
    }

    // 3.1 Continuous locomotion blend (idle 0 <-> stride 1). Blending here —
    // instead of a hard if/else — removes pose snapping at the walk threshold.
    const speedNorm = Math.min(smoothed.speed / PLAYER_WALK_SPEED, 1);
    smoothedSpeedRef.current = dampScalar(
      smoothedSpeedRef.current,
      speedNorm,
      DEFAULT_STRIDE_BLEND_DAMPING,
      dt
    );
    const strideBlend = smoothedSpeedRef.current;

    // 4. Procedural limb & idle animations, blended continuously.
    // Stride phase advances with the blended speed so steps stay continuous
    // while accelerating or decelerating (no visible stepping/skipping).
    const strideFreq = smoothed.speed * 2.8;
    walkPhaseRef.current += strideFreq * dt;
    idlePhaseRef.current += 2.5 * dt;

    const swings = calculateLimbSwings(
      smoothed.speed,
      isRunning,
      walkPhaseRef.current,
      strideBlend
    );
    const idle = calculateIdleBob(idlePhaseRef.current, strideBlend);

    // Blend limb poses: swing amplitude scales with the blend, idle sway
    // scales with (1 - blend); sum is continuous at every speed.
    if (leftLegRef.current) leftLegRef.current.rotation.x = swings.leftLegPitch;
    if (rightLegRef.current) rightLegRef.current.rotation.x = swings.rightLegPitch;
    if (leftArmRef.current) leftArmRef.current.rotation.x = swings.leftArmPitch;
    if (rightArmRef.current) rightArmRef.current.rotation.x = swings.rightArmPitch;
    if (rootModelRef.current) {
      rootModelRef.current.position.y = swings.stepBounce + idle.idleBobY;
      rootModelRef.current.rotation.z = swings.bodyRoll + idle.idleSwayZ;
    }
    if (headRef.current) headRef.current.rotation.z = idle.headTiltZ;

    // 5. Rapier RigidBody translation and store synchronization
    const rb = rigidBodyRef.current;
    if (rb) {
      const pos = rb.translation();

      // Check Fall Safety Respawn (Y < -5)
      if (shouldRespawn(pos.y, ISLAND_FALL_Y_THRESHOLD)) {
        const spawnX = initialPosition[0];
        const spawnY = initialPosition[1];
        const spawnZ = initialPosition[2];

        rb.setTranslation({ x: spawnX, y: spawnY, z: spawnZ }, true);
        velocityRef.current = { x: 0, z: 0 };
        playerTransform.x = spawnX;
        playerTransform.y = spawnY;
        playerTransform.z = spawnZ;
        playerTransform.speed = 0;
        useGameStore.getState().setPlayerPosition([spawnX, spawnY, spawnZ]);
        onFall?.();
      } else {
        const dx = smoothed.x * dt;
        const dz = smoothed.z * dt;
        const nextX = pos.x + dx;
        const nextZ = pos.z + dz;
        const nextY = pos.y;

        rb.setNextKinematicTranslation({ x: nextX, y: nextY, z: nextZ });

        quaternionRef.current.setFromAxisAngle(upAxisRef.current, yawRef.current);
        rb.setNextKinematicRotation(quaternionRef.current);

        // Render-frequency channel: the camera and any per-frame consumer read
        // this mutable object directly — no zustand notification, no re-render.
        playerTransform.x = nextX;
        playerTransform.y = nextY;
        playerTransform.z = nextZ;
        playerTransform.yaw = yawRef.current;
        playerTransform.speed = smoothed.speed;

        // Distance accumulator (pet egg incubation progress).
        const deltaDist = calculateDeltaDistance(smoothed.x, smoothed.z, dt);
        if (deltaDist > 0) {
          useGameStore.getState().addDistance(deltaDist);
        }

        // Throttled store sync: gameplay UI (mobile target highlight, merchant
        // proximity) needs ~10 Hz, not 60 Hz. This removes the per-frame React
        // re-render storm that made movement feel jerky on mobile.
        const nowMs = performance.now();
        if (nowMs - lastStoreSyncRef.current >= STORE_SYNC_INTERVAL_MS) {
          lastStoreSyncRef.current = nowMs;
          useGameStore.getState().setPlayerPosition([nextX, nextY, nextZ]);
        }

        // Multiplayer: publish local transform; RoomConnection batches at 20 Hz.
        if (useNetStore.getState().roomId) {
          getRoomConnection().publishLocalTransform({
            x: nextX,
            y: nextY,
            z: nextZ,
            yaw: yawRef.current,
            speed: smoothed.speed,
            anim: smoothed.speed < 0.05 ? 0 : isRunning ? 2 : 1,
          });
        }
      }
    }
  });

  const isFirstPerson = useUiStore((state) => state.isFirstPerson);

  return (
    <RigidBody
      ref={rigidBodyRef}
      position={initialPosition}
      type="kinematicPosition"
      colliders={false}
      name="PlayerCharacter"
      enabledRotations={[false, false, false]}
    >
      <CapsuleCollider args={[0.35, 0.3]} position={[0, 0.65, 0]} />
      <group position={[0, 0.475, 0]} visible={!isFirstPerson}>
        <PlayerModel
          rootRef={rootModelRef}
          headRef={headRef}
          leftArmRef={leftArmRef}
          rightArmRef={rightArmRef}
          leftLegRef={leftLegRef}
          rightLegRef={rightLegRef}
        />
      </group>
    </RigidBody>
  );
};
