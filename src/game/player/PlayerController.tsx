import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import {
  PLAYER_WALK_SPEED,
  PLAYER_RUN_SPEED,
  PLAYER_JUMP_VELOCITY,
  PLAYER_FALL_EXTRA_GRAVITY,
  JUMP_BUFFER_MS,
  COYOTE_MS,
  ISLAND_FALL_Y_THRESHOLD,
  PLAYER_SPAWN_POSITION,
} from '../core/constants';
import { useGameStore } from '../../state/gameStore';
import { useSettingsStore } from '../../state/settingsStore';
import { useUiStore } from '../../state/uiStore';
import { useNetStore } from '../multiplayer/netStore';
import { getRoomConnection } from '../multiplayer/RoomConnection';
import type { InputManager } from '../input/InputManager';
import { audioManager } from '../audio/AudioManager';
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
  WALK_SWING_FREQUENCY,
  RUN_SWING_FREQUENCY,
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
  const torsoRef = useRef<THREE.Group | null>(null);
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
  /** Jump input buffer: last Space/tap press timestamp (ms). */
  const lastJumpPressMsRef = useRef<number>(-Infinity);
  /** Coyote timer: last grounded timestamp (ms). */
  const lastGroundedMsRef = useRef<number>(-Infinity);
  /** Previous-frame grounded flag for landing detection. */
  const wasGroundedRef = useRef<boolean>(true);
  /** Landing timestamp (ms) for the touchdown dip. */
  const landDipStartMsRef = useRef<number>(-Infinity);
  /** Grounded flag from the previous physics read (1 frame lag, imperceptible). */
  const groundedRef = useRef<boolean>(true);

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
    // Cadence follows the walk/run swing frequencies scaled by actual speed
    // so footsteps match ground movement instead of sliding.
    const runRatio = Math.max(
      0,
      Math.min(1, (smoothed.speed - PLAYER_WALK_SPEED) / (PLAYER_RUN_SPEED - PLAYER_WALK_SPEED))
    );
    const baseSpeed = PLAYER_WALK_SPEED + (PLAYER_RUN_SPEED - PLAYER_WALK_SPEED) * runRatio;
    const speedRatio = baseSpeed > 0.001 ? Math.min(smoothed.speed / baseSpeed, 1.0) : 0;
    const strideFreq =
      (WALK_SWING_FREQUENCY + (RUN_SWING_FREQUENCY - WALK_SWING_FREQUENCY) * runRatio) * speedRatio;
    walkPhaseRef.current += strideFreq * dt;
    // Idle clock runs in plain seconds — calculateIdleBob applies its own
    // per-layer frequencies (previously double-scaled, making idle frantic).
    idlePhaseRef.current += dt;

    const reducedMotion = useSettingsStore.getState().reducedMotion;
    // Airborne pose uses the previous frame's grounded flag (1 frame lag).
    const swings = calculateLimbSwings(
      smoothed.speed,
      isRunning,
      walkPhaseRef.current,
      strideBlend,
      !groundedRef.current,
      reducedMotion
    );
    const idle = calculateIdleBob(idlePhaseRef.current, strideBlend, reducedMotion);

    // Blend limb poses: swing amplitude scales with the blend, idle sway
    // scales with (1 - blend); sum is continuous at every speed.
    // Arm roll combines the walk lateral swing with the asymmetric idle drift.
    const nowMs = performance.now();
    const dipAgeSec = (nowMs - landDipStartMsRef.current) / 1000;
    const landDip = dipAgeSec < 0.18 && !reducedMotion ? 0.06 * (1 - dipAgeSec / 0.18) : 0;
    if (leftLegRef.current) leftLegRef.current.rotation.x = swings.leftLegPitch;
    if (rightLegRef.current) rightLegRef.current.rotation.x = swings.rightLegPitch;
    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = swings.leftArmPitch;
      leftArmRef.current.rotation.z = 0.08 + swings.leftArmRoll + idle.leftArmSwayZ;
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = swings.rightArmPitch;
      rightArmRef.current.rotation.z = -0.08 + swings.rightArmRoll - idle.rightArmSwayZ;
    }
    if (rootModelRef.current) {
      rootModelRef.current.position.y =
        swings.stepBounce + swings.legLift + idle.idleBobY - landDip;
      rootModelRef.current.rotation.z = swings.bodyRoll + idle.idleSwayZ;
      rootModelRef.current.rotation.y = swings.torsoYaw;
    }
    if (torsoRef.current) {
      // Chest breathes on its own pivot instead of nodding the whole avatar.
      torsoRef.current.rotation.x = idle.torsoPitch;
      const breathe = 1 + idle.breatheScale;
      torsoRef.current.scale.set(breathe, 1, breathe);
    }
    if (headRef.current) {
      headRef.current.rotation.z = idle.headTiltZ + idle.headRollZ;
      headRef.current.rotation.y = idle.headYaw;
    }

    // 5. Rapier RigidBody: dynamic body, moved by velocity so fixed colliders
    // (fences, walls, props) actually block the player. Gravity handles Y;
    // rotations are locked so the visual yaw stays authoritative.
    const rb = rigidBodyRef.current;
    if (rb) {
      const pos = rb.translation();

      // Check Fall Safety Respawn (Y < -5)
      if (shouldRespawn(pos.y, ISLAND_FALL_Y_THRESHOLD)) {
        const spawnX = initialPosition[0];
        const spawnY = initialPosition[1];
        const spawnZ = initialPosition[2];

        rb.setTranslation({ x: spawnX, y: spawnY, z: spawnZ }, true);
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        velocityRef.current = { x: 0, z: 0 };
        playerTransform.x = spawnX;
        playerTransform.y = spawnY;
        playerTransform.z = spawnZ;
        playerTransform.speed = 0;
        useGameStore.getState().setPlayerPosition([spawnX, spawnY, spawnZ]);
        onFall?.();
      } else {
        // Jump input buffer: Space/tap presses are captured into a timestamp
        // so presses slightly before landing are not swallowed while moving.
        if (inputManager?.consumeJump() ?? false) {
          lastJumpPressMsRef.current = nowMs;
        }
        const vyRead = rb.linvel().y;
        const grounded = pos.y <= 0.08 && vyRead <= 0.5;
        if (grounded) {
          lastGroundedMsRef.current = nowMs;
        }
        // Touchdown dip on landing.
        if (grounded && !wasGroundedRef.current) {
          landDipStartMsRef.current = nowMs;
        }
        wasGroundedRef.current = grounded;
        groundedRef.current = grounded;

        // Buffered jump + coyote time: fires while walking, shortly after
        // leaving a ledge, or slightly before touchdown.
        let vy = vyRead;
        const pressAgeMs = nowMs - lastJumpPressMsRef.current;
        const groundAgeMs = nowMs - lastGroundedMsRef.current;
        if (pressAgeMs < JUMP_BUFFER_MS && groundAgeMs < COYOTE_MS) {
          vy = PLAYER_JUMP_VELOCITY;
          lastJumpPressMsRef.current = -Infinity;
          lastGroundedMsRef.current = -Infinity;
          groundedRef.current = false;
          audioManager.playSfx('jump');
        } else if (!grounded && vy < 0) {
          // Extra fall gravity for a snappy, non-floaty landing.
          vy -= PLAYER_FALL_EXTRA_GRAVITY * dt;
        }
        rb.setLinvel({ x: smoothed.x, y: vy, z: smoothed.z }, true);

        quaternionRef.current.setFromAxisAngle(upAxisRef.current, yawRef.current);
        rb.setRotation(quaternionRef.current, true);

        const nextX = pos.x;
        const nextY = pos.y;
        const nextZ = pos.z;

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
      type="dynamic"
      colliders={false}
      name="PlayerCharacter"
      linearDamping={0.0}
      friction={0.0}
      restitution={0.0}
      lockRotations
      ccd
    >
      <CapsuleCollider args={[0.35, 0.3]} position={[0, 0.65, 0]} mass={1} />
      <group position={[0, 0.475, 0]} visible={!isFirstPerson}>
        <PlayerModel
          rootRef={rootModelRef}
          headRef={headRef}
          torsoRef={torsoRef}
          leftArmRef={leftArmRef}
          rightArmRef={rightArmRef}
          leftLegRef={leftLegRef}
          rightLegRef={rightLegRef}
        />
      </group>
    </RigidBody>
  );
};
