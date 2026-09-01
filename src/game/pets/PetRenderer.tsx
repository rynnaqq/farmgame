import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../state/gameStore';
import { selectEquippedPet, selectIncubatingEgg } from '../../state/selectors';
import { PetModel } from './PetModel';
import { EggRenderer } from './EggRenderer';
import {
  distance2D,
  shouldTeleport,
  calculateTrailingTarget,
  computePetTargetYaw,
  lerpPetAngle,
  calculateBeeAnimation,
  calculateDogAnimation,
  calculatePigAnimation,
  calculateEggAnimation,
  PET_DEFAULT_FOLLOW_DISTANCE,
  PET_STEERING_SPEED,
  PET_ROTATION_LERP_SPEED,
  PET_STOP_DISTANCE_BUFFER,
  PET_TELEPORT_DISTANCE,
} from './petSteeringMath';
import { findDogHarvestTarget, tickDogAutoHarvest } from './petSystem';
import { getPlotPosition } from '../world/gridCoordinates';
import type { PlotId } from '../../state/storeTypes';

export interface PetRendererProps {
  // Optional custom target hook or overrides for testing
  forcePetType?: 'dog' | 'bee' | 'pig' | null;
  forcePlayerPos?: [number, number, number];
}

/**
 * PetRenderer:
 * R3F Scene Component managing 3D companion pets and incubating eggs:
 * - Reads equipped pet and incubating egg from Zustand gameStore
 * - Smooth follow steering behind player (1.5 - 2.2 units trailing distance)
 * - Teleports instantly to trailing distance if distance > 12 units
 * - Smooth yaw rotation to face travel direction, or player when stationary
 * - Drives 60fps zero-allocation procedural animations (Bee 30Hz flutter, Dog tail wag/legs, Pig trot)
 * - Autonomous Dog crop harvesting: steers to mature plots and triggers atomic harvest
 * - Dynamic Incubating Egg 3D display with incubation wobbles and crack indicators
 */
export const PetRenderer: React.FC<PetRendererProps> = ({
  forcePetType,
  forcePlayerPos,
}) => {
  const storeEquippedPet = useGameStore(selectEquippedPet);
  const storeIncubatingEgg = useGameStore(selectIncubatingEgg);

  const equippedPetType = forcePetType !== undefined
    ? forcePetType
    : storeEquippedPet?.type ?? null;

  // Root Transforms
  const petRootRef = useRef<THREE.Group | null>(null);
  const eggRootRef = useRef<THREE.Group | null>(null);

  // Dynamic kinematic state
  const petPosRef = useRef<[number, number, number]>([0, 0, 0]);
  const petYawRef = useRef<number>(0);
  const velocityRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const isInitializedRef = useRef<boolean>(false);

  // Dog Auto-Harvest State
  const lastHarvestTimeRef = useRef<number>(0);
  const activeHarvestTargetRef = useRef<PlotId | null>(null);

  // Bone Animation Group Refs
  // Bee Refs
  const beeLeftWingRef = useRef<THREE.Group | null>(null);
  const beeRightWingRef = useRef<THREE.Group | null>(null);
  const beeAntennaeRef = useRef<THREE.Group | null>(null);
  // Dog Refs
  const dogHeadRef = useRef<THREE.Group | null>(null);
  const dogTailRef = useRef<THREE.Group | null>(null);
  const dogFrontLeftLegRef = useRef<THREE.Group | null>(null);
  const dogFrontRightLegRef = useRef<THREE.Group | null>(null);
  const dogBackLeftLegRef = useRef<THREE.Group | null>(null);
  const dogBackRightLegRef = useRef<THREE.Group | null>(null);
  // Pig Refs
  const pigSnoutRef = useRef<THREE.Group | null>(null);
  const pigTailRef = useRef<THREE.Group | null>(null);
  const pigFrontLeftLegRef = useRef<THREE.Group | null>(null);
  const pigFrontRightLegRef = useRef<THREE.Group | null>(null);
  const pigBackLeftLegRef = useRef<THREE.Group | null>(null);
  const pigBackRightLegRef = useRef<THREE.Group | null>(null);

  // Reset or initialize position when equipped pet changes
  useEffect(() => {
    isInitializedRef.current = false;
  }, [equippedPetType]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    if (dt <= 0) return;

    const nowMs = Date.now();
    const store = useGameStore.getState();
    const playerPos: [number, number, number] = forcePlayerPos ?? store.player.position;

    // ========================================================
    // 1. EQUIPPED PET SIMULATION & STEERING
    // ========================================================
    if (equippedPetType) {
      // 1.1 Initial placement
      if (!isInitializedRef.current) {
        const initialTrailing = calculateTrailingTarget(
          playerPos,
          0,
          PET_DEFAULT_FOLLOW_DISTANCE
        );
        petPosRef.current = [initialTrailing[0], initialTrailing[1], initialTrailing[2]];
        isInitializedRef.current = true;
      }

      let targetPos: [number, number, number] = calculateTrailingTarget(
        playerPos,
        petYawRef.current,
        PET_DEFAULT_FOLLOW_DISTANCE
      );
      let isAutoHarvesting = false;

      // 1.2 Dog Auto-Harvest Steering Behavior
      if (equippedPetType === 'dog') {
        const targetPlotId = findDogHarvestTarget(
          petPosRef.current,
          store.farm.plots,
          store.farm.gridSize
        );

        if (targetPlotId) {
          activeHarvestTargetRef.current = targetPlotId;
          const targetPlot = store.farm.plots[targetPlotId];
          if (targetPlot) {
            const plotWorldPos = getPlotPosition(
              targetPlot.row,
              targetPlot.col,
              store.farm.gridSize
            );
            targetPos = [plotWorldPos[0], playerPos[1], plotWorldPos[2]];
            isAutoHarvesting = true;

            // If close enough to harvest plot, trigger atomic harvest tick
            const distToPlot = distance2D(petPosRef.current, targetPos);
            if (distToPlot < 0.6) {
              tickDogAutoHarvest(petPosRef.current, nowMs, lastHarvestTimeRef);
            }
          }
        } else {
          activeHarvestTargetRef.current = null;
        }
      }

      // 1.3 Teleportation Threshold Check (> 12.0 units)
      if (shouldTeleport(petPosRef.current, playerPos, PET_TELEPORT_DISTANCE)) {
        const defaultTrailing = calculateTrailingTarget(
          playerPos,
          0,
          PET_DEFAULT_FOLLOW_DISTANCE
        );
        petPosRef.current = [defaultTrailing[0], defaultTrailing[1], defaultTrailing[2]];
        velocityRef.current = { x: 0, z: 0 };
      } else {
        // 1.4 Smooth Steering Movement Towards Target Position
        const distToTarget = distance2D(petPosRef.current, targetPos);

        if (distToTarget > PET_STOP_DISTANCE_BUFFER) {
          const dx = targetPos[0] - petPosRef.current[0];
          const dz = targetPos[2] - petPosRef.current[2];

          const speedMultiplier = isAutoHarvesting ? 1.2 : Math.max(1.0, distToTarget / 1.5);
          const currentSpeed = Math.min(PET_STEERING_SPEED * speedMultiplier, 7.5);
          const step = Math.min(distToTarget, currentSpeed * dt);

          const stepX = (dx / distToTarget) * step;
          const stepZ = (dz / distToTarget) * step;

          petPosRef.current[0] += stepX;
          petPosRef.current[2] += stepZ;
          petPosRef.current[1] = playerPos[1];

          velocityRef.current = {
            x: stepX / dt,
            z: stepZ / dt,
          };
        } else {
          // Stationary
          velocityRef.current = {
            x: THREE.MathUtils.lerp(velocityRef.current.x, 0, dt * 10),
            z: THREE.MathUtils.lerp(velocityRef.current.z, 0, dt * 10),
          };
        }
      }

      // 1.5 Smooth Yaw Rotation (Face movement or face player)
      const targetYaw = computePetTargetYaw(
        petPosRef.current,
        velocityRef.current,
        playerPos,
        petYawRef.current
      );
      petYawRef.current = lerpPetAngle(
        petYawRef.current,
        targetYaw,
        Math.min(1.0, PET_ROTATION_LERP_SPEED * dt)
      );

      // 1.6 Apply Root Transform
      if (petRootRef.current) {
        petRootRef.current.position.set(
          petPosRef.current[0],
          petPosRef.current[1],
          petPosRef.current[2]
        );
        petRootRef.current.rotation.y = petYawRef.current;
      }

      // 1.7 60fps Zero-Allocation Procedural Bone Animation
      const speed = Math.hypot(velocityRef.current.x, velocityRef.current.z);

      if (equippedPetType === 'bee') {
        const beeAnim = calculateBeeAnimation(state.clock.elapsedTime);
        if (beeLeftWingRef.current) {
          beeLeftWingRef.current.rotation.x = beeAnim.wingPitchLeft;
          beeLeftWingRef.current.rotation.z = beeAnim.wingRollLeft;
        }
        if (beeRightWingRef.current) {
          beeRightWingRef.current.rotation.x = beeAnim.wingPitchRight;
          beeRightWingRef.current.rotation.z = beeAnim.wingRollRight;
        }
        if (beeAntennaeRef.current) {
          beeAntennaeRef.current.rotation.x = beeAnim.antennaWobble;
        }
        if (petRootRef.current) {
          petRootRef.current.position.y = petPosRef.current[1] + beeAnim.hoverY + beeAnim.bodyBobY;
        }
      } else if (equippedPetType === 'dog') {
        const dogAnim = calculateDogAnimation(state.clock.elapsedTime, speed, isAutoHarvesting);
        if (dogTailRef.current) {
          dogTailRef.current.rotation.y = dogAnim.tailWagYaw;
        }
        if (dogHeadRef.current) {
          dogHeadRef.current.rotation.x = dogAnim.headPitch;
        }
        if (dogFrontLeftLegRef.current) {
          dogFrontLeftLegRef.current.rotation.x = dogAnim.legPitchFrontLeft;
        }
        if (dogFrontRightLegRef.current) {
          dogFrontRightLegRef.current.rotation.x = dogAnim.legPitchFrontRight;
        }
        if (dogBackLeftLegRef.current) {
          dogBackLeftLegRef.current.rotation.x = dogAnim.legPitchBackLeft;
        }
        if (dogBackRightLegRef.current) {
          dogBackRightLegRef.current.rotation.x = dogAnim.legPitchBackRight;
        }
        if (petRootRef.current) {
          petRootRef.current.position.y = petPosRef.current[1] + dogAnim.harvestBounceY;
        }
      } else if (equippedPetType === 'pig') {
        const pigAnim = calculatePigAnimation(state.clock.elapsedTime, speed);
        if (pigSnoutRef.current) {
          pigSnoutRef.current.position.y = pigAnim.snoutTwitchY;
        }
        if (pigTailRef.current) {
          pigTailRef.current.rotation.z = pigAnim.tailCurlRotation;
        }
        if (pigFrontLeftLegRef.current) {
          pigFrontLeftLegRef.current.rotation.x = pigAnim.legPitchFrontLeft;
        }
        if (pigFrontRightLegRef.current) {
          pigFrontRightLegRef.current.rotation.x = pigAnim.legPitchFrontRight;
        }
        if (pigBackLeftLegRef.current) {
          pigBackLeftLegRef.current.rotation.x = pigAnim.legPitchBackLeft;
        }
        if (pigBackRightLegRef.current) {
          pigBackRightLegRef.current.rotation.x = pigAnim.legPitchBackRight;
        }
        if (petRootRef.current) {
          petRootRef.current.position.y = petPosRef.current[1] + pigAnim.trotBounceY;
        }
      }
    }

    // ========================================================
    // 2. INCUBATING EGG SIMULATION & RENDERING
    // ========================================================
    if (storeIncubatingEgg && eggRootRef.current) {
      // Place incubating egg floating gently or trailing nearby if no pet is equipped
      const eggOffset: [number, number, number] = equippedPetType
        ? [playerPos[0] + 0.9, playerPos[1] + 0.1, playerPos[2] + 0.9]
        : [playerPos[0] - 1.2, playerPos[1] + 0.05, playerPos[2] - 1.2];

      eggRootRef.current.position.set(eggOffset[0], eggOffset[1], eggOffset[2]);

      const timeRatio = storeIncubatingEgg.elapsedIncubationSec / 90;
      const distRatio = storeIncubatingEgg.distanceTraveled / 120;
      const progressRatio = Math.min(1.0, Math.max(timeRatio, distRatio));

      const eggAnim = calculateEggAnimation(
        state.clock.elapsedTime,
        progressRatio,
        storeIncubatingEgg.incubating
      );

      eggRootRef.current.rotation.z = eggAnim.wobbleRollZ;
      eggRootRef.current.rotation.x = eggAnim.wobblePitchX;
    }
  });

  return (
    <group name="PetSystemRenderer">
      {/* Active Equipped Companion Pet */}
      {equippedPetType && (
        <group ref={petRootRef} name="ActiveEquippedPet">
          <PetModel
            petType={equippedPetType}
            beeLeftWingRef={beeLeftWingRef}
            beeRightWingRef={beeRightWingRef}
            beeAntennaeRef={beeAntennaeRef}
            dogHeadRef={dogHeadRef}
            dogTailRef={dogTailRef}
            dogFrontLeftLegRef={dogFrontLeftLegRef}
            dogFrontRightLegRef={dogFrontRightLegRef}
            dogBackLeftLegRef={dogBackLeftLegRef}
            dogBackRightLegRef={dogBackRightLegRef}
            pigSnoutRef={pigSnoutRef}
            pigTailRef={pigTailRef}
            pigFrontLeftLegRef={pigFrontLeftLegRef}
            pigFrontRightLegRef={pigFrontRightLegRef}
            pigBackLeftLegRef={pigBackLeftLegRef}
            pigBackRightLegRef={pigBackRightLegRef}
          />
        </group>
      )}

      {/* Active Incubating Egg */}
      {storeIncubatingEgg && (
        <group ref={eggRootRef} name="ActiveIncubatingEgg">
          <EggRenderer egg={storeIncubatingEgg} />
        </group>
      )}
    </group>
  );
};
