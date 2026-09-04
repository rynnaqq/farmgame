import React from 'react';
import type * as THREE from 'three';
import { useUiStore } from '../../state/uiStore';
import { useGameStore } from '../../state/gameStore';

export interface PlayerModelProps {
  rootRef?: React.RefObject<THREE.Group | null>;
  headRef?: React.RefObject<THREE.Group | null>;
  torsoRef?: React.RefObject<THREE.Group | null>;
  leftArmRef?: React.RefObject<THREE.Group | null>;
  rightArmRef?: React.RefObject<THREE.Group | null>;
  leftLegRef?: React.RefObject<THREE.Group | null>;
  rightLegRef?: React.RefObject<THREE.Group | null>;
  leftLegPitch?: number;
  rightLegPitch?: number;
  leftArmPitch?: number;
  rightArmPitch?: number;
  stepBounce?: number;
  bodyRoll?: number;
  idleBobY?: number;
  idleSwayZ?: number;
  headTiltZ?: number;
}

/**
 * Low-poly stylized humanoid gardener mesh:
 * - Straw hat (brim, ribbon, crown)
 * - Head with facial features (eyes, blush dots, smile)
 * - Emerald green shirt and denim overalls with shoulder buckles
 * - Articulated opposing arms with canvas gardening gloves
 * - Articulated opposing legs with sturdy leather gardening boots
 * - Responsive to procedural animation transforms via direct refs or props
 */
export const PlayerModel: React.FC<PlayerModelProps> = ({
  rootRef,
  headRef,
  torsoRef,
  leftArmRef,
  rightArmRef,
  leftLegRef,
  rightLegRef,
  leftLegPitch = 0,
  rightLegPitch = 0,
  leftArmPitch = 0,
  rightArmPitch = 0,
  stepBounce = 0,
  bodyRoll = 0,
  idleBobY = 0,
  idleSwayZ = 0,
  headTiltZ = 0,
}) => {
  const selectedTool = useUiStore((state) => state.selectedTool);
  const goldenWateringCanOwned = useGameStore((state) => state.farm.goldenWateringCanOwned);

  const totalOffsetY = idleBobY + stepBounce;
  const totalRollZ = idleSwayZ + bodyRoll;

  return (
    <group
      ref={rootRef}
      name="PlayerGardenerModel"
      position={[0, totalOffsetY, 0]}
      rotation={[0, 0, totalRollZ]}
    >
      {/* ========================================== */}
      {/* 1. Torso & Overalls                        */}
      {/* ========================================== */}
      <group ref={torsoRef} name="Torso">
        {/* Emerald Green Gardener Shirt */}
        <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.34, 0.32, 0.22]} />
          <meshStandardMaterial color="#10B981" roughness={0.7} metalness={0.05} flatShading />
        </mesh>

        {/* Denim Overalls Body */}
        <mesh position={[0, -0.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.36, 0.26, 0.24]} />
          <meshStandardMaterial color="#1E40AF" roughness={0.75} metalness={0.05} flatShading />
        </mesh>

        {/* Front Overalls Pouch / Chest Pocket */}
        <mesh position={[0, 0.02, 0.125]} castShadow receiveShadow>
          <boxGeometry args={[0.16, 0.12, 0.02]} />
          <meshStandardMaterial color="#1D4ED8" roughness={0.78} metalness={0.05} flatShading />
        </mesh>

        {/* Left Shoulder Strap */}
        <mesh position={[-0.1, 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.06, 0.3, 0.245]} />
          <meshStandardMaterial color="#1E40AF" roughness={0.75} flatShading />
        </mesh>
        {/* Left Strap Brass Buckle */}
        <mesh position={[-0.1, 0.08, 0.125]}>
          <boxGeometry args={[0.05, 0.04, 0.015]} />
          <meshStandardMaterial color="#F59E0B" roughness={0.3} metalness={0.7} />
        </mesh>

        {/* Right Shoulder Strap */}
        <mesh position={[0.1, 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.06, 0.3, 0.245]} />
          <meshStandardMaterial color="#1E40AF" roughness={0.75} flatShading />
        </mesh>
        {/* Right Strap Brass Buckle */}
        <mesh position={[0.1, 0.08, 0.125]}>
          <boxGeometry args={[0.05, 0.04, 0.015]} />
          <meshStandardMaterial color="#F59E0B" roughness={0.3} metalness={0.7} />
        </mesh>
      </group>

      {/* ========================================== */}
      {/* 2. Head, Face & Straw Hat                  */}
      {/* ========================================== */}
      <group ref={headRef} name="HeadAndHat" position={[0, 0.4, 0]} rotation={[0, 0, headTiltZ]}>
        {/* Head Block */}
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.26, 0.26, 0.24]} />
          <meshStandardMaterial color="#FBD38D" roughness={0.65} metalness={0.0} flatShading />
        </mesh>

        {/* Hair Back / Bangs Under Hat */}
        <mesh position={[0, 0.09, -0.02]} castShadow>
          <boxGeometry args={[0.27, 0.1, 0.25]} />
          <meshStandardMaterial color="#78350F" roughness={0.85} metalness={0.0} flatShading />
        </mesh>

        {/* Eyes (Dark Charcoal Dots) */}
        <mesh position={[-0.06, 0.02, 0.125]}>
          <boxGeometry args={[0.035, 0.035, 0.01]} />
          <meshStandardMaterial color="#1F2937" roughness={0.4} />
        </mesh>
        <mesh position={[0.06, 0.02, 0.125]}>
          <boxGeometry args={[0.035, 0.035, 0.01]} />
          <meshStandardMaterial color="#1F2937" roughness={0.4} />
        </mesh>

        {/* Rosy Blush Cheeks */}
        <mesh position={[-0.09, -0.04, 0.125]}>
          <boxGeometry args={[0.04, 0.025, 0.01]} />
          <meshStandardMaterial color="#FB7185" roughness={0.6} />
        </mesh>
        <mesh position={[0.09, -0.04, 0.125]}>
          <boxGeometry args={[0.04, 0.025, 0.01]} />
          <meshStandardMaterial color="#FB7185" roughness={0.6} />
        </mesh>

        {/* Smiling Mouth */}
        <mesh position={[0, -0.05, 0.125]}>
          <boxGeometry args={[0.06, 0.02, 0.01]} />
          <meshStandardMaterial color="#9A3412" roughness={0.5} />
        </mesh>

        {/* Straw Hat Brim */}
        <mesh position={[0, 0.13, 0]} rotation={[0.04, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.4, 0.44, 0.03, 10]} />
          <meshStandardMaterial color="#FBBF24" roughness={0.7} metalness={0.05} flatShading />
        </mesh>

        {/* Hat Ribbon Band */}
        <mesh position={[0, 0.165, 0]} castShadow>
          <cylinderGeometry args={[0.245, 0.245, 0.04, 10]} />
          <meshStandardMaterial color="#991B1B" roughness={0.6} metalness={0.1} flatShading />
        </mesh>

        {/* Straw Hat Crown */}
        <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.21, 0.24, 0.15, 10]} />
          <meshStandardMaterial color="#D97706" roughness={0.72} metalness={0.05} flatShading />
        </mesh>
      </group>

      {/* ========================================== */}
      {/* 3. Articulated Arms                        */}
      {/* ========================================== */}
      {/* Left Arm Group */}
      <group
        ref={leftArmRef}
        name="LeftArm"
        position={[-0.24, 0.26, 0]}
        rotation={[leftArmPitch, 0, 0.08]}
      >
        {/* Sleeve */}
        <mesh position={[0, -0.07, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.1, 0.14, 0.1]} />
          <meshStandardMaterial color="#10B981" roughness={0.7} flatShading />
        </mesh>
        {/* Glove Cuff */}
        <mesh position={[0, -0.14, 0]}>
          <boxGeometry args={[0.095, 0.025, 0.095]} />
          <meshStandardMaterial color="#94A3B8" roughness={0.6} flatShading />
        </mesh>
        {/* Canvas Gardening Glove */}
        <mesh position={[0, -0.21, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.085, 0.14, 0.085]} />
          <meshStandardMaterial color="#E2E8F0" roughness={0.65} flatShading />
        </mesh>
      </group>

      {/* Right Arm Group */}
      <group
        ref={rightArmRef}
        name="RightArm"
        position={[0.24, 0.26, 0]}
        rotation={[rightArmPitch, 0, -0.08]}
      >
        {/* Sleeve */}
        <mesh position={[0, -0.07, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.1, 0.14, 0.1]} />
          <meshStandardMaterial color="#10B981" roughness={0.7} flatShading />
        </mesh>
        {/* Glove Cuff */}
        <mesh position={[0, -0.14, 0]}>
          <boxGeometry args={[0.095, 0.025, 0.095]} />
          <meshStandardMaterial color="#94A3B8" roughness={0.6} flatShading />
        </mesh>
        {/* Canvas Gardening Glove */}
        <mesh position={[0, -0.21, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.085, 0.14, 0.085]} />
          <meshStandardMaterial color="#E2E8F0" roughness={0.65} flatShading />
        </mesh>

        {/* Held Tool in Hand (Growden.io style) */}
        {selectedTool === 'watering_can' && (
          <group position={[0, -0.26, 0.06]} rotation={[-0.2, 0, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.065, 0.08, 0.15, 8]} />
              <meshStandardMaterial
                color={goldenWateringCanOwned ? '#F59E0B' : '#2563EB'}
                roughness={0.4}
                metalness={goldenWateringCanOwned ? 0.7 : 0.4}
                flatShading
              />
            </mesh>
            <mesh position={[0, 0.06, 0.06]} rotation={[0.4, 0, 0]} castShadow>
              <cylinderGeometry args={[0.02, 0.03, 0.1, 6]} />
              <meshStandardMaterial
                color={goldenWateringCanOwned ? '#F59E0B' : '#2563EB'}
                roughness={0.4}
                metalness={goldenWateringCanOwned ? 0.7 : 0.4}
                flatShading
              />
            </mesh>
          </group>
        )}

        {selectedTool === 'seed_bag' && (
          <group position={[0, -0.26, 0.06]} rotation={[-0.2, 0, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.05, 0.07, 0.14, 6]} />
              <meshStandardMaterial color="#D97706" roughness={0.85} flatShading />
            </mesh>
          </group>
        )}

        {(selectedTool === 'scythe' || selectedTool === 'hand') && (
          <group position={[0, -0.26, 0.06]} rotation={[-0.3, 0, 0]}>
            <mesh position={[0, -0.1, 0]} castShadow>
              <cylinderGeometry args={[0.015, 0.015, 0.4, 6]} />
              <meshStandardMaterial color="#78350F" roughness={0.8} flatShading />
            </mesh>
            <mesh position={[0.08, -0.26, 0]} rotation={[0, 0, -0.5]} castShadow>
              <boxGeometry args={[0.16, 0.03, 0.015]} />
              <meshStandardMaterial color="#CBD5E1" roughness={0.3} metalness={0.85} flatShading />
            </mesh>
          </group>
        )}
      </group>

      {/* ========================================== */}
      {/* 4. Articulated Legs & Boots                */}
      {/* ========================================== */}
      {/* Left Leg Group */}
      <group
        ref={leftLegRef}
        name="LeftLeg"
        position={[-0.1, -0.16, 0]}
        rotation={[leftLegPitch, 0, 0]}
      >
        {/* Overalls Pant Leg */}
        <mesh position={[0, -0.11, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.12, 0.22, 0.12]} />
          <meshStandardMaterial color="#1E40AF" roughness={0.75} flatShading />
        </mesh>
        {/* Leather Gardening Boot */}
        <mesh position={[0, -0.25, 0.02]} castShadow receiveShadow>
          <boxGeometry args={[0.13, 0.12, 0.18]} />
          <meshStandardMaterial color="#78350F" roughness={0.8} flatShading />
        </mesh>
        {/* Boot Sole */}
        <mesh position={[0, -0.3, 0.02]}>
          <boxGeometry args={[0.135, 0.03, 0.185]} />
          <meshStandardMaterial color="#451A03" roughness={0.9} flatShading />
        </mesh>
      </group>

      {/* Right Leg Group */}
      <group
        ref={rightLegRef}
        name="RightLeg"
        position={[0.1, -0.16, 0]}
        rotation={[rightLegPitch, 0, 0]}
      >
        {/* Overalls Pant Leg */}
        <mesh position={[0, -0.11, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.12, 0.22, 0.12]} />
          <meshStandardMaterial color="#1E40AF" roughness={0.75} flatShading />
        </mesh>
        {/* Leather Gardening Boot */}
        <mesh position={[0, -0.25, 0.02]} castShadow receiveShadow>
          <boxGeometry args={[0.13, 0.12, 0.18]} />
          <meshStandardMaterial color="#78350F" roughness={0.8} flatShading />
        </mesh>
        {/* Boot Sole */}
        <mesh position={[0, -0.3, 0.02]}>
          <boxGeometry args={[0.135, 0.03, 0.185]} />
          <meshStandardMaterial color="#451A03" roughness={0.9} flatShading />
        </mesh>
      </group>
    </group>
  );
};
