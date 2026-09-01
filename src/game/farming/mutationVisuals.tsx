import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { MutationType } from '../core/constants';
import { useSettingsStore } from '../../state/settingsStore';

import { getCosmicMotePositions } from './cropMeshGenerators';

// ============================================================================
// Visual Decorator Components
// ============================================================================

export interface GoldVisualDecoratorProps {
  intensity?: number;
}

export const GoldVisualDecorator: React.FC<GoldVisualDecoratorProps> = ({ intensity = 1.0 }) => {
  const lightRef = useRef<THREE.PointLight>(null);
  const effectiveQuality = useSettingsStore((state) => state.effectiveQuality);

  useFrame(({ clock }) => {
    if (lightRef.current) {
      const t = clock.getElapsedTime();
      const pulse = 1.0 + Math.sin(t * 3.5) * 0.25;
      lightRef.current.intensity = intensity * pulse;
    }
  });

  // Only render point light if quality is medium or high for performance
  if (effectiveQuality === 'low') {
    return null;
  }

  return (
    <pointLight
      ref={lightRef}
      position={[0, 0.35, 0]}
      color="#FFE082"
      intensity={intensity}
      distance={1.6}
      decay={2}
    />
  );
};

export interface CosmicVisualDecoratorProps {
  reducedMotion?: boolean;
}

export const CosmicVisualDecorator: React.FC<CosmicVisualDecoratorProps> = ({
  reducedMotion = false,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const effectiveQuality = useSettingsStore((state) => state.effectiveQuality);

  const initialMotes = useMemo(() => getCosmicMotePositions(0), []);
  const moteMeshes = useRef<THREE.Mesh[]>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (!reducedMotion && groupRef.current) {
      groupRef.current.rotation.y = t * 0.4;
    }

    if (lightRef.current) {
      const pulse = 1.0 + Math.sin(t * 4.0) * 0.3;
      lightRef.current.intensity = 1.2 * pulse;
    }

    if (!reducedMotion) {
      const currentMotes = getCosmicMotePositions(t);
      moteMeshes.current.forEach((mesh, idx) => {
        if (mesh && currentMotes[idx]) {
          mesh.position.set(...currentMotes[idx].position);
        }
      });
    }
  });

  return (
    <group ref={groupRef} name="CosmicVisualDecorator">
      {/* Drifting star motes */}
      {initialMotes.map((mote, idx) => (
        <mesh
          key={idx}
          ref={(el) => {
            if (el) moteMeshes.current[idx] = el;
          }}
          position={mote.position}
        >
          <octahedronGeometry args={[mote.size, 0]} />
          <meshBasicMaterial color={mote.color} />
        </mesh>
      ))}

      {/* Cosmic ambient point light on medium/high settings */}
      {effectiveQuality !== 'low' && (
        <pointLight
          ref={lightRef}
          position={[0, 0.4, 0]}
          color="#BA68C8"
          intensity={1.2}
          distance={2.0}
          decay={2}
        />
      )}
    </group>
  );
};

export interface MutationVisualDecoratorProps {
  mutation: MutationType;
  reducedMotion?: boolean;
}

export const MutationVisualDecorator: React.FC<MutationVisualDecoratorProps> = ({
  mutation,
  reducedMotion = false,
}) => {
  switch (mutation) {
    case 'gold':
      return <GoldVisualDecorator />;
    case 'cosmic':
      return <CosmicVisualDecorator reducedMotion={reducedMotion} />;
    case 'giant':
    case 'none':
    default:
      return null;
  }
};
