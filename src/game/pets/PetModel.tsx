import React from 'react';
import type * as THREE from 'three';
import type { PetType } from '../core/constants';
import type {
  BeeAnimationState,
  DogAnimationState,
  PigAnimationState,
} from './petSteeringMath';

export interface PetModelProps {
  petType: PetType;
  rootRef?: React.RefObject<THREE.Group | null>;
  // Bee Animation Refs
  beeLeftWingRef?: React.RefObject<THREE.Group | null>;
  beeRightWingRef?: React.RefObject<THREE.Group | null>;
  beeAntennaeRef?: React.RefObject<THREE.Group | null>;
  // Dog Animation Refs
  dogHeadRef?: React.RefObject<THREE.Group | null>;
  dogTailRef?: React.RefObject<THREE.Group | null>;
  dogFrontLeftLegRef?: React.RefObject<THREE.Group | null>;
  dogFrontRightLegRef?: React.RefObject<THREE.Group | null>;
  dogBackLeftLegRef?: React.RefObject<THREE.Group | null>;
  dogBackRightLegRef?: React.RefObject<THREE.Group | null>;
  // Pig Animation Refs
  pigSnoutRef?: React.RefObject<THREE.Group | null>;
  pigTailRef?: React.RefObject<THREE.Group | null>;
  pigFrontLeftLegRef?: React.RefObject<THREE.Group | null>;
  pigFrontRightLegRef?: React.RefObject<THREE.Group | null>;
  pigBackLeftLegRef?: React.RefObject<THREE.Group | null>;
  pigBackRightLegRef?: React.RefObject<THREE.Group | null>;
  // Optional initial state for testing or static rendering
  beeAnim?: Partial<BeeAnimationState>;
  dogAnim?: Partial<DogAnimationState>;
  pigAnim?: Partial<PigAnimationState>;
}

/**
 * Procedural low-poly companion 3D meshes for Bee, Dog, and Pig.
 * Uses stylized geometric primitives with flat shading and cheerful palettes.
 * Provides direct bone/group refs for 60fps zero-allocation procedural animation.
 */
export const PetModel: React.FC<PetModelProps> = ({
  petType,
  rootRef,
  beeLeftWingRef,
  beeRightWingRef,
  beeAntennaeRef,
  dogHeadRef,
  dogTailRef,
  dogFrontLeftLegRef,
  dogFrontRightLegRef,
  dogBackLeftLegRef,
  dogBackRightLegRef,
  pigSnoutRef,
  pigTailRef,
  pigFrontLeftLegRef,
  pigFrontRightLegRef,
  pigBackLeftLegRef,
  pigBackRightLegRef,
  beeAnim,
  dogAnim,
  pigAnim,
}) => {
  return (
    <group ref={rootRef} name={`PetModel_${petType}`}>
      {petType === 'bee' && (
        <BeeMesh
          leftWingRef={beeLeftWingRef}
          rightWingRef={beeRightWingRef}
          antennaeRef={beeAntennaeRef}
          anim={beeAnim}
        />
      )}
      {petType === 'dog' && (
        <DogMesh
          headRef={dogHeadRef}
          tailRef={dogTailRef}
          frontLeftLegRef={dogFrontLeftLegRef}
          frontRightLegRef={dogFrontRightLegRef}
          backLeftLegRef={dogBackLeftLegRef}
          backRightLegRef={dogBackRightLegRef}
          anim={dogAnim}
        />
      )}
      {petType === 'pig' && (
        <PigMesh
          snoutRef={pigSnoutRef}
          tailRef={pigTailRef}
          frontLeftLegRef={pigFrontLeftLegRef}
          frontRightLegRef={pigFrontRightLegRef}
          backLeftLegRef={pigBackLeftLegRef}
          backRightLegRef={pigBackRightLegRef}
          anim={pigAnim}
        />
      )}
    </group>
  );
};

// ==========================================
// 1. Procedural Bee Companion Mesh
// ==========================================
interface BeeMeshProps {
  leftWingRef?: React.RefObject<THREE.Group | null>;
  rightWingRef?: React.RefObject<THREE.Group | null>;
  antennaeRef?: React.RefObject<THREE.Group | null>;
  anim?: Partial<BeeAnimationState>;
}

const BeeMesh: React.FC<BeeMeshProps> = ({
  leftWingRef,
  rightWingRef,
  antennaeRef,
  anim,
}) => {
  const hoverY = anim?.hoverY ?? 0;
  const bobY = anim?.bodyBobY ?? 0;

  return (
    <group name="BeeCompanion" position={[0, hoverY + bobY, 0]} scale={[0.85, 0.85, 0.85]}>
      {/* Striped Bee Body */}
      {/* Yellow Front Segment */}
      <mesh position={[0, 0, 0.12]} castShadow receiveShadow>
        <boxGeometry args={[0.32, 0.28, 0.18]} />
        <meshStandardMaterial color="#FBBF24" roughness={0.5} flatShading />
      </mesh>
      {/* Black Middle Stripe */}
      <mesh position={[0, 0, -0.02]} castShadow receiveShadow>
        <boxGeometry args={[0.34, 0.3, 0.14]} />
        <meshStandardMaterial color="#1F2937" roughness={0.6} flatShading />
      </mesh>
      {/* Yellow Back Stripe */}
      <mesh position={[0, 0, -0.14]} castShadow receiveShadow>
        <boxGeometry args={[0.3, 0.26, 0.14]} />
        <meshStandardMaterial color="#FBBF24" roughness={0.5} flatShading />
      </mesh>
      {/* Black Stinger End */}
      <mesh position={[0, -0.02, -0.24]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.06, 0.12, 5]} />
        <meshStandardMaterial color="#111827" roughness={0.4} flatShading />
      </mesh>

      {/* Cute Head & Face */}
      <group position={[0, 0.02, 0.23]}>
        {/* Head Block */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.26, 0.24, 0.12]} />
          <meshStandardMaterial color="#F59E0B" roughness={0.5} flatShading />
        </mesh>
        {/* Left Eye */}
        <mesh position={[-0.07, 0.03, 0.065]}>
          <boxGeometry args={[0.045, 0.05, 0.01]} />
          <meshStandardMaterial color="#111827" roughness={0.2} />
        </mesh>
        {/* Right Eye */}
        <mesh position={[0.07, 0.03, 0.065]}>
          <boxGeometry args={[0.045, 0.05, 0.01]} />
          <meshStandardMaterial color="#111827" roughness={0.2} />
        </mesh>
        {/* Rosy Cheeks */}
        <mesh position={[-0.09, -0.04, 0.065]}>
          <boxGeometry args={[0.035, 0.02, 0.01]} />
          <meshStandardMaterial color="#FB7185" roughness={0.7} />
        </mesh>
        <mesh position={[0.09, -0.04, 0.065]}>
          <boxGeometry args={[0.035, 0.02, 0.01]} />
          <meshStandardMaterial color="#FB7185" roughness={0.7} />
        </mesh>
      </group>

      {/* Antennae Group */}
      <group
        ref={antennaeRef}
        name="BeeAntennae"
        position={[0, 0.15, 0.22]}
        rotation={[anim?.antennaWobble ?? 0, 0, 0]}
      >
        {/* Left Antenna */}
        <mesh position={[-0.06, 0.06, 0]} rotation={[0, 0, -0.2]}>
          <cylinderGeometry args={[0.01, 0.01, 0.12, 4]} />
          <meshStandardMaterial color="#1F2937" roughness={0.5} />
        </mesh>
        <mesh position={[-0.08, 0.12, 0]}>
          <sphereGeometry args={[0.022, 6, 6]} />
          <meshStandardMaterial color="#FBBF24" roughness={0.4} />
        </mesh>

        {/* Right Antenna */}
        <mesh position={[0.06, 0.06, 0]} rotation={[0, 0, 0.2]}>
          <cylinderGeometry args={[0.01, 0.01, 0.12, 4]} />
          <meshStandardMaterial color="#1F2937" roughness={0.5} />
        </mesh>
        <mesh position={[0.08, 0.12, 0]}>
          <sphereGeometry args={[0.022, 6, 6]} />
          <meshStandardMaterial color="#FBBF24" roughness={0.4} />
        </mesh>
      </group>

      {/* Translucent Fluttering Wings (30Hz) */}
      {/* Left Wing Group */}
      <group
        ref={leftWingRef}
        name="BeeLeftWing"
        position={[-0.12, 0.14, 0]}
        rotation={[
          anim?.wingPitchLeft ?? 0,
          0,
          anim?.wingRollLeft ?? 0.3,
        ]}
      >
        <mesh position={[-0.14, 0.02, -0.04]} rotation={[0, 0, -0.15]}>
          <boxGeometry args={[0.26, 0.01, 0.18]} />
          <meshStandardMaterial
            color="#E0F2FE"
            transparent
            opacity={0.7}
            roughness={0.2}
            metalness={0.1}
          />
        </mesh>
      </group>

      {/* Right Wing Group */}
      <group
        ref={rightWingRef}
        name="BeeRightWing"
        position={[0.12, 0.14, 0]}
        rotation={[
          anim?.wingPitchRight ?? 0,
          0,
          anim?.wingRollRight ?? -0.3,
        ]}
      >
        <mesh position={[0.14, 0.02, -0.04]} rotation={[0, 0, 0.15]}>
          <boxGeometry args={[0.26, 0.01, 0.18]} />
          <meshStandardMaterial
            color="#E0F2FE"
            transparent
            opacity={0.7}
            roughness={0.2}
            metalness={0.1}
          />
        </mesh>
      </group>
    </group>
  );
};

// ==========================================
// 2. Procedural Dog Companion Mesh
// ==========================================
interface DogMeshProps {
  headRef?: React.RefObject<THREE.Group | null>;
  tailRef?: React.RefObject<THREE.Group | null>;
  frontLeftLegRef?: React.RefObject<THREE.Group | null>;
  frontRightLegRef?: React.RefObject<THREE.Group | null>;
  backLeftLegRef?: React.RefObject<THREE.Group | null>;
  backRightLegRef?: React.RefObject<THREE.Group | null>;
  anim?: Partial<DogAnimationState>;
}

const DogMesh: React.FC<DogMeshProps> = ({
  headRef,
  tailRef,
  frontLeftLegRef,
  frontRightLegRef,
  backLeftLegRef,
  backRightLegRef,
  anim,
}) => {
  const harvestBounceY = anim?.harvestBounceY ?? 0;

  return (
    <group name="DogCompanion" position={[0, harvestBounceY + 0.28, 0]} scale={[0.8, 0.8, 0.8]}>
      {/* Dog Torso Body */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.32, 0.28, 0.52]} />
        <meshStandardMaterial color="#D97706" roughness={0.7} flatShading />
      </mesh>

      {/* Dog Chest / Underbelly Accent */}
      <mesh position={[0, -0.03, 0.08]} castShadow receiveShadow>
        <boxGeometry args={[0.28, 0.22, 0.32]} />
        <meshStandardMaterial color="#FDE68A" roughness={0.75} flatShading />
      </mesh>

      {/* Red Collar & Brass Tag */}
      <mesh position={[0, 0.08, 0.23]} castShadow>
        <boxGeometry args={[0.3, 0.05, 0.06]} />
        <meshStandardMaterial color="#DC2626" roughness={0.5} flatShading />
      </mesh>
      <mesh position={[0, 0.04, 0.27]}>
        <cylinderGeometry args={[0.025, 0.025, 0.015, 6]} />
        <meshStandardMaterial color="#FBBF24" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Head Group with Snout & Floppy Ears */}
      <group
        ref={headRef}
        name="DogHead"
        position={[0, 0.16, 0.28]}
        rotation={[anim?.headPitch ?? 0, 0, 0]}
      >
        {/* Main Head */}
        <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.28, 0.26, 0.26]} />
          <meshStandardMaterial color="#D97706" roughness={0.7} flatShading />
        </mesh>

        {/* Snout */}
        <mesh position={[0, -0.02, 0.16]} castShadow receiveShadow>
          <boxGeometry args={[0.18, 0.14, 0.16]} />
          <meshStandardMaterial color="#B45309" roughness={0.7} flatShading />
        </mesh>

        {/* Black Nose */}
        <mesh position={[0, 0.02, 0.25]}>
          <boxGeometry args={[0.06, 0.04, 0.03]} />
          <meshStandardMaterial color="#111827" roughness={0.3} />
        </mesh>

        {/* Eyes */}
        <mesh position={[-0.08, 0.08, 0.135]}>
          <boxGeometry args={[0.035, 0.04, 0.01]} />
          <meshStandardMaterial color="#111827" roughness={0.3} />
        </mesh>
        <mesh position={[0.08, 0.08, 0.135]}>
          <boxGeometry args={[0.035, 0.04, 0.01]} />
          <meshStandardMaterial color="#111827" roughness={0.3} />
        </mesh>

        {/* Left Floppy Ear */}
        <mesh
          position={[-0.16, 0.02, -0.02]}
          rotation={[0.1, 0, -0.2]}
          castShadow
        >
          <boxGeometry args={[0.06, 0.2, 0.12]} />
          <meshStandardMaterial color="#92400E" roughness={0.75} flatShading />
        </mesh>

        {/* Right Floppy Ear */}
        <mesh
          position={[0.16, 0.02, -0.02]}
          rotation={[0.1, 0, 0.2]}
          castShadow
        >
          <boxGeometry args={[0.06, 0.2, 0.12]} />
          <meshStandardMaterial color="#92400E" roughness={0.75} flatShading />
        </mesh>
      </group>

      {/* Wagging Tail Group */}
      <group
        ref={tailRef}
        name="DogTail"
        position={[0, 0.08, -0.26]}
        rotation={[0.3, anim?.tailWagYaw ?? 0, 0]}
      >
        <mesh position={[0, 0.1, -0.06]} rotation={[0.4, 0, 0]} castShadow>
          <boxGeometry args={[0.06, 0.22, 0.06]} />
          <meshStandardMaterial color="#B45309" roughness={0.7} flatShading />
        </mesh>
        {/* Fluffy Tip */}
        <mesh position={[0, 0.2, -0.11]}>
          <boxGeometry args={[0.07, 0.08, 0.07]} />
          <meshStandardMaterial color="#FDE68A" roughness={0.75} flatShading />
        </mesh>
      </group>

      {/* 4 Articulated Quadruped Legs */}
      {/* Front Left Leg */}
      <group
        ref={frontLeftLegRef}
        name="DogFrontLeftLeg"
        position={[-0.11, -0.12, 0.18]}
        rotation={[anim?.legPitchFrontLeft ?? 0, 0, 0]}
      >
        <mesh position={[0, -0.08, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 0.18, 0.08]} />
          <meshStandardMaterial color="#D97706" roughness={0.7} flatShading />
        </mesh>
        {/* Paw */}
        <mesh position={[0, -0.16, 0.02]} castShadow receiveShadow>
          <boxGeometry args={[0.09, 0.04, 0.11]} />
          <meshStandardMaterial color="#FDE68A" roughness={0.75} flatShading />
        </mesh>
      </group>

      {/* Front Right Leg */}
      <group
        ref={frontRightLegRef}
        name="DogFrontRightLeg"
        position={[0.11, -0.12, 0.18]}
        rotation={[anim?.legPitchFrontRight ?? 0, 0, 0]}
      >
        <mesh position={[0, -0.08, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 0.18, 0.08]} />
          <meshStandardMaterial color="#D97706" roughness={0.7} flatShading />
        </mesh>
        {/* Paw */}
        <mesh position={[0, -0.16, 0.02]} castShadow receiveShadow>
          <boxGeometry args={[0.09, 0.04, 0.11]} />
          <meshStandardMaterial color="#FDE68A" roughness={0.75} flatShading />
        </mesh>
      </group>

      {/* Back Left Leg */}
      <group
        ref={backLeftLegRef}
        name="DogBackLeftLeg"
        position={[-0.11, -0.12, -0.18]}
        rotation={[anim?.legPitchBackLeft ?? 0, 0, 0]}
      >
        <mesh position={[0, -0.08, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 0.18, 0.08]} />
          <meshStandardMaterial color="#D97706" roughness={0.7} flatShading />
        </mesh>
        {/* Paw */}
        <mesh position={[0, -0.16, 0.02]} castShadow receiveShadow>
          <boxGeometry args={[0.09, 0.04, 0.11]} />
          <meshStandardMaterial color="#FDE68A" roughness={0.75} flatShading />
        </mesh>
      </group>

      {/* Back Right Leg */}
      <group
        ref={backRightLegRef}
        name="DogBackRightLeg"
        position={[0.11, -0.12, -0.18]}
        rotation={[anim?.legPitchBackRight ?? 0, 0, 0]}
      >
        <mesh position={[0, -0.08, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 0.18, 0.08]} />
          <meshStandardMaterial color="#D97706" roughness={0.7} flatShading />
        </mesh>
        {/* Paw */}
        <mesh position={[0, -0.16, 0.02]} castShadow receiveShadow>
          <boxGeometry args={[0.09, 0.04, 0.11]} />
          <meshStandardMaterial color="#FDE68A" roughness={0.75} flatShading />
        </mesh>
      </group>
    </group>
  );
};

// ==========================================
// 3. Procedural Pig Companion Mesh
// ==========================================
interface PigMeshProps {
  snoutRef?: React.RefObject<THREE.Group | null>;
  tailRef?: React.RefObject<THREE.Group | null>;
  frontLeftLegRef?: React.RefObject<THREE.Group | null>;
  frontRightLegRef?: React.RefObject<THREE.Group | null>;
  backLeftLegRef?: React.RefObject<THREE.Group | null>;
  backRightLegRef?: React.RefObject<THREE.Group | null>;
  anim?: Partial<PigAnimationState>;
}

const PigMesh: React.FC<PigMeshProps> = ({
  snoutRef,
  tailRef,
  frontLeftLegRef,
  frontRightLegRef,
  backLeftLegRef,
  backRightLegRef,
  anim,
}) => {
  const trotBounceY = anim?.trotBounceY ?? 0;

  return (
    <group name="PigCompanion" position={[0, trotBounceY + 0.25, 0]} scale={[0.8, 0.8, 0.8]}>
      {/* Plump Pig Body */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.36, 0.32, 0.5]} />
        <meshStandardMaterial color="#F472B6" roughness={0.65} flatShading />
      </mesh>

      {/* Pig Head */}
      <group position={[0, 0.04, 0.28]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.3, 0.28, 0.2]} />
          <meshStandardMaterial color="#F472B6" roughness={0.65} flatShading />
        </mesh>

        {/* Snout with Nostrils */}
        <group
          ref={snoutRef}
          name="PigSnout"
          position={[0, anim?.snoutTwitchY ?? 0, 0.12]}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.16, 0.11, 0.08]} />
            <meshStandardMaterial color="#FB7185" roughness={0.55} flatShading />
          </mesh>
          {/* Left Nostril */}
          <mesh position={[-0.04, 0, 0.042]}>
            <boxGeometry args={[0.025, 0.03, 0.01]} />
            <meshStandardMaterial color="#9D174D" roughness={0.4} />
          </mesh>
          {/* Right Nostril */}
          <mesh position={[0.04, 0, 0.042]}>
            <boxGeometry args={[0.025, 0.03, 0.01]} />
            <meshStandardMaterial color="#9D174D" roughness={0.4} />
          </mesh>
        </group>

        {/* Eyes */}
        <mesh position={[-0.08, 0.06, 0.105]}>
          <boxGeometry args={[0.035, 0.035, 0.01]} />
          <meshStandardMaterial color="#111827" roughness={0.3} />
        </mesh>
        <mesh position={[0.08, 0.06, 0.105]}>
          <boxGeometry args={[0.035, 0.035, 0.01]} />
          <meshStandardMaterial color="#111827" roughness={0.3} />
        </mesh>

        {/* Floppy Triangular Ears */}
        <mesh
          position={[-0.14, 0.14, 0]}
          rotation={[0.2, 0, -0.4]}
          castShadow
        >
          <boxGeometry args={[0.08, 0.1, 0.05]} />
          <meshStandardMaterial color="#FB7185" roughness={0.6} flatShading />
        </mesh>
        <mesh
          position={[0.14, 0.14, 0]}
          rotation={[0.2, 0, 0.4]}
          castShadow
        >
          <boxGeometry args={[0.08, 0.1, 0.05]} />
          <meshStandardMaterial color="#FB7185" roughness={0.6} flatShading />
        </mesh>
      </group>

      {/* Curly Tail */}
      <group
        ref={tailRef}
        name="PigTail"
        position={[0, 0.04, -0.26]}
        rotation={[0, 0, anim?.tailCurlRotation ?? 0]}
      >
        <mesh position={[0, 0.04, -0.04]} rotation={[0.4, 0, 0]} castShadow>
          <cylinderGeometry args={[0.018, 0.018, 0.1, 5]} />
          <meshStandardMaterial color="#FB7185" roughness={0.6} flatShading />
        </mesh>
        <mesh position={[0.03, 0.07, -0.07]} rotation={[0, 0, 0.6]}>
          <cylinderGeometry args={[0.016, 0.016, 0.07, 5]} />
          <meshStandardMaterial color="#FB7185" roughness={0.6} flatShading />
        </mesh>
      </group>

      {/* 4 Stubby Trotter Legs */}
      {/* Front Left */}
      <group
        ref={frontLeftLegRef}
        name="PigFrontLeftLeg"
        position={[-0.12, -0.14, 0.16]}
        rotation={[anim?.legPitchFrontLeft ?? 0, 0, 0]}
      >
        <mesh position={[0, -0.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.09, 0.12, 0.09]} />
          <meshStandardMaterial color="#F472B6" roughness={0.65} flatShading />
        </mesh>
        {/* Hoof */}
        <mesh position={[0, -0.11, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.092, 0.04, 0.092]} />
          <meshStandardMaterial color="#9D174D" roughness={0.7} flatShading />
        </mesh>
      </group>

      {/* Front Right */}
      <group
        ref={frontRightLegRef}
        name="PigFrontRightLeg"
        position={[0.12, -0.14, 0.16]}
        rotation={[anim?.legPitchFrontRight ?? 0, 0, 0]}
      >
        <mesh position={[0, -0.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.09, 0.12, 0.09]} />
          <meshStandardMaterial color="#F472B6" roughness={0.65} flatShading />
        </mesh>
        <mesh position={[0, -0.11, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.092, 0.04, 0.092]} />
          <meshStandardMaterial color="#9D174D" roughness={0.7} flatShading />
        </mesh>
      </group>

      {/* Back Left */}
      <group
        ref={backLeftLegRef}
        name="PigBackLeftLeg"
        position={[-0.12, -0.14, -0.16]}
        rotation={[anim?.legPitchBackLeft ?? 0, 0, 0]}
      >
        <mesh position={[0, -0.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.09, 0.12, 0.09]} />
          <meshStandardMaterial color="#F472B6" roughness={0.65} flatShading />
        </mesh>
        <mesh position={[0, -0.11, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.092, 0.04, 0.092]} />
          <meshStandardMaterial color="#9D174D" roughness={0.7} flatShading />
        </mesh>
      </group>

      {/* Back Right */}
      <group
        ref={backRightLegRef}
        name="PigBackRightLeg"
        position={[0.12, -0.14, -0.16]}
        rotation={[anim?.legPitchBackRight ?? 0, 0, 0]}
      >
        <mesh position={[0, -0.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.09, 0.12, 0.09]} />
          <meshStandardMaterial color="#F472B6" roughness={0.65} flatShading />
        </mesh>
        <mesh position={[0, -0.11, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.092, 0.04, 0.092]} />
          <meshStandardMaterial color="#9D174D" roughness={0.7} flatShading />
        </mesh>
      </group>
    </group>
  );
};
