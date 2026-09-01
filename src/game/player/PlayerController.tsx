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
import type { InputManager } from '../input/InputManager';
import { PlayerModel } from './PlayerModel';
import {
  smoothVelocity,
  lerpAngle,
  computeTargetYaw,
  calculateLimbSwings,
  calculateIdleBob,
  calculateDeltaDistance,
  shouldRespawn,
  DEFAULT_ROTATION_SPEED,
} from './playerAnimation';

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

    // 3. Shortest-path facing rotation
    if (smoothed.speed > 0.05) {
      const targetYaw = computeTargetYaw(smoothed.x, smoothed.z, yawRef.current);
      yawRef.current = lerpAngle(
        yawRef.current,
        targetYaw,
        Math.min(1.0, DEFAULT_ROTATION_SPEED * dt)
      );
    }

    // 4. Procedural limb & idle animations
    if (smoothed.speed > 0.05) {
      const strideFreq = smoothed.speed * 2.8;
      walkPhaseRef.current += strideFreq * dt;
      const swings = calculateLimbSwings(smoothed.speed, isRunning, walkPhaseRef.current);

      if (leftLegRef.current) leftLegRef.current.rotation.x = swings.leftLegPitch;
      if (rightLegRef.current) rightLegRef.current.rotation.x = swings.rightLegPitch;
      if (leftArmRef.current) leftArmRef.current.rotation.x = swings.leftArmPitch;
      if (rightArmRef.current) rightArmRef.current.rotation.x = swings.rightArmPitch;
      if (rootModelRef.current) {
        rootModelRef.current.position.y = swings.stepBounce;
        rootModelRef.current.rotation.z = swings.bodyRoll;
      }
      if (headRef.current) headRef.current.rotation.z = 0;
    } else {
      idlePhaseRef.current += 2.5 * dt;
      const idle = calculateIdleBob(idlePhaseRef.current, 0);

      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
      if (leftArmRef.current) leftArmRef.current.rotation.x = 0;
      if (rightArmRef.current) rightArmRef.current.rotation.x = 0;
      if (rootModelRef.current) {
        rootModelRef.current.position.y = idle.idleBobY;
        rootModelRef.current.rotation.z = idle.idleSwayZ;
      }
      if (headRef.current) headRef.current.rotation.z = idle.headTiltZ;
    }

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

        // Distance accumulator & Store position synchronization
        const deltaDist = calculateDeltaDistance(smoothed.x, smoothed.z, dt);
        if (deltaDist > 0) {
          useGameStore.getState().addDistance(deltaDist);
        }
        useGameStore.getState().setPlayerPosition([nextX, nextY, nextZ]);
      }
    }
  });

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
      <group position={[0, 0.47, 0]}>
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
