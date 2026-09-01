import React, { useRef } from 'react';
import type * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { EggData } from '../../state/storeTypes';
import { calculateEggAnimation } from './petSteeringMath';
import { EGG_HATCH_SECONDS, EGG_HATCH_DISTANCE } from './petDefinitions';

export interface EggRendererProps {
  egg?: EggData | null;
  position?: [number, number, number];
  rootRef?: React.RefObject<THREE.Group | null>;
  wobbleZ?: number;
  wobbleX?: number;
  glowIntensity?: number;
  crackStage?: 0 | 1 | 2 | 3;
}

/**
 * 3D Procedural Incubating Egg Model:
 * - Dynamic low-poly egg geometry with distinctive Common (ivory) and Rare (iridescent purple) shells.
 * - Procedural crack fracture indicators that appear and widen at 50%, 80%, and 100% progress.
 * - Dynamic incubation wobble, rock, and excitation hatching shake.
 * - Cozy rustic twig/moss nest base.
 */
export const EggRenderer: React.FC<EggRendererProps> = ({
  egg,
  position = [0, 0, 0],
  rootRef: externalRootRef,
  wobbleZ: propWobbleZ,
  wobbleX: propWobbleX,
  glowIntensity: propGlowIntensity,
  crackStage: propCrackStage,
}) => {
  const internalRootRef = useRef<THREE.Group | null>(null);
  const rootRef = externalRootRef || internalRootRef;

  const isRare = egg?.type === 'rare';
  const isIncubating = egg?.incubating ?? true;

  // Calculate incubation progress ratio if egg data is present
  const timeRatio = egg ? egg.elapsedIncubationSec / EGG_HATCH_SECONDS : 0;
  const distRatio = egg ? egg.distanceTraveled / EGG_HATCH_DISTANCE : 0;
  const progressRatio = Math.min(1.0, Math.max(timeRatio, distRatio));

  useFrame((state) => {
    // If props are not explicitly controlling transforms, drive dynamically via useFrame
    if (propWobbleZ === undefined && rootRef.current) {
      const anim = calculateEggAnimation(state.clock.elapsedTime, progressRatio, isIncubating);
      rootRef.current.rotation.z = anim.wobbleRollZ;
      rootRef.current.rotation.x = anim.wobblePitchX;
    }
  });

  const animStatic = calculateEggAnimation(0, progressRatio, isIncubating);
  const activeCrackStage = propCrackStage ?? animStatic.crackStage;
  const activeGlow = propGlowIntensity ?? animStatic.glowIntensity;
  const activeWobbleZ = propWobbleZ ?? 0;
  const activeWobbleX = propWobbleX ?? 0;

  return (
    <group
      ref={rootRef}
      name={`EggRenderer_${egg?.type ?? 'common'}`}
      position={position}
      rotation={[activeWobbleX, 0, activeWobbleZ]}
    >
      {/* 1. Rustic Nest Base */}
      <group position={[0, 0.05, 0]}>
        {/* Outer Twig Ring */}
        <mesh receiveShadow castShadow>
          <torusGeometry args={[0.26, 0.07, 6, 12]} />
          <meshStandardMaterial color="#78350F" roughness={0.9} flatShading />
        </mesh>
        {/* Soft Moss Cushion */}
        <mesh position={[0, -0.02, 0]} receiveShadow>
          <cylinderGeometry args={[0.22, 0.24, 0.06, 8]} />
          <meshStandardMaterial color="#15803D" roughness={0.8} flatShading />
        </mesh>
      </group>

      {/* 2. Procedural Egg Shell */}
      <group position={[0, 0.32, 0]}>
        {/* Main Egg Body - Bottom Sphere */}
        <mesh castShadow receiveShadow position={[0, -0.04, 0]}>
          <sphereGeometry args={[0.24, 10, 10]} />
          <meshStandardMaterial
            color={isRare ? '#A855F7' : '#FEF3C7'}
            emissive={isRare ? '#7E22CE' : '#F59E0B'}
            emissiveIntensity={isRare ? 0.35 + activeGlow * 0.4 : activeGlow * 0.3}
            roughness={isRare ? 0.3 : 0.6}
            metalness={isRare ? 0.2 : 0.05}
            flatShading
          />
        </mesh>

        {/* Main Egg Body - Tapered Top Cone / Cap */}
        <mesh castShadow receiveShadow position={[0, 0.12, 0]}>
          <coneGeometry args={[0.235, 0.32, 10]} />
          <meshStandardMaterial
            color={isRare ? '#C084FC' : '#FDE68A'}
            emissive={isRare ? '#9333EA' : '#F59E0B'}
            emissiveIntensity={isRare ? 0.4 + activeGlow * 0.5 : activeGlow * 0.3}
            roughness={isRare ? 0.3 : 0.6}
            metalness={isRare ? 0.2 : 0.05}
            flatShading
          />
        </mesh>

        {/* Decorative Speckles / Bands */}
        <mesh position={[0, 0.02, 0]}>
          <torusGeometry args={[0.242, 0.015, 4, 8]} />
          <meshStandardMaterial
            color={isRare ? '#F472B6' : '#F59E0B'}
            roughness={0.5}
            flatShading
          />
        </mesh>

        {/* 3. Crack Indicators */}
        {/* Stage 1: Initial Hairline Crack */}
        {activeCrackStage >= 1 && (
          <mesh position={[0.12, 0.05, 0.18]} rotation={[0, 0.4, 0.3]}>
            <boxGeometry args={[0.015, 0.12, 0.01]} />
            <meshStandardMaterial
              color="#111827"
              emissive={isRare ? '#F472B6' : '#F59E0B'}
              emissiveIntensity={0.6}
              roughness={0.9}
            />
          </mesh>
        )}

        {/* Stage 2: Secondary Branching Cracks */}
        {activeCrackStage >= 2 && (
          <>
            <mesh position={[-0.14, 0.08, 0.14]} rotation={[0.2, -0.3, -0.4]}>
              <boxGeometry args={[0.02, 0.16, 0.01]} />
              <meshStandardMaterial
                color="#111827"
                emissive={isRare ? '#F472B6' : '#F59E0B'}
                emissiveIntensity={0.8}
                roughness={0.9}
              />
            </mesh>
            <mesh position={[-0.08, 0.16, 0.16]} rotation={[0, 0, 0.7]}>
              <boxGeometry args={[0.018, 0.1, 0.01]} />
              <meshStandardMaterial
                color="#111827"
                emissive={isRare ? '#F472B6' : '#F59E0B'}
                emissiveIntensity={0.8}
                roughness={0.9}
              />
            </mesh>
          </>
        )}

        {/* Stage 3: Ready to Hatch Major Glowing Fissures */}
        {activeCrackStage >= 3 && (
          <>
            <mesh position={[0, 0.22, 0.16]} rotation={[0, 0, -0.5]}>
              <boxGeometry args={[0.025, 0.18, 0.015]} />
              <meshStandardMaterial color="#FFFFFF" emissive="#FBBF24" emissiveIntensity={1.5} />
            </mesh>
            <mesh position={[0.08, -0.06, 0.2]} rotation={[0, 0.5, 0.6]}>
              <boxGeometry args={[0.025, 0.14, 0.015]} />
              <meshStandardMaterial color="#FFFFFF" emissive="#FBBF24" emissiveIntensity={1.5} />
            </mesh>
          </>
        )}
      </group>
    </group>
  );
};
