import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { CropData } from '../../state/storeTypes';
import {
  getCropDefinition,
} from './cropDefinitions';
import {
  getCropStage,
  getMutationScale,
  getMutationMaterialProps,
  calculateStageTransition,
  CROP_STAGE_CATALOG,
  type CropStage,
  type MeshElementDef,
} from './cropMeshGenerators';
import { MutationVisualDecorator } from './mutationVisuals';
import { useSettingsStore } from '../../state/settingsStore';
import {
  STAGE_TRANSITION_EASE_DURATION_MS,
  STAGE_TRANSITION_REDUCED_MOTION_MS,
  type MutationType,
} from '../core/constants';

export interface ProceduralElementProps {
  element: MeshElementDef;
  mutation: MutationType;
  opacity?: number;
}

export const ProceduralElement: React.FC<ProceduralElementProps> = ({
  element,
  mutation,
  opacity = 1.0,
}) => {
  const matProps = getMutationMaterialProps(mutation, element.color);
  const isTransparent = opacity < 0.999;

  const material = (
    <meshStandardMaterial
      color={matProps.color}
      roughness={matProps.roughness}
      metalness={matProps.metalness}
      emissive={matProps.emissive ?? element.emissive}
      emissiveIntensity={
        matProps.emissiveIntensity ?? element.emissiveIntensity ?? 0
      }
      transparent={isTransparent}
      opacity={opacity}
      flatShading
    />
  );

  const getGeometry = () => {
    const args = element.args ?? [];
    switch (element.type) {
      case 'cone':
        return (
          <coneGeometry
            args={[
              args[0] ?? 0.05,
              args[1] ?? 0.15,
              args[2] ?? 5,
            ]}
          />
        );
      case 'cylinder':
        return (
          <cylinderGeometry
            args={[
              args[0] ?? 0.03,
              args[1] ?? 0.03,
              args[2] ?? 0.2,
              args[3] ?? 6,
            ]}
          />
        );
      case 'sphere':
        return (
          <sphereGeometry
            args={[
              args[0] ?? 0.08,
              args[1] ?? 6,
              args[2] ?? 6,
            ]}
          />
        );
      case 'box':
        return (
          <boxGeometry
            args={[
              args[0] ?? 0.1,
              args[1] ?? 0.1,
              args[2] ?? 0.1,
            ]}
          />
        );
      case 'dodecahedron':
        return (
          <dodecahedronGeometry
            args={[
              args[0] ?? 0.1,
              args[1] ?? 0,
            ]}
          />
        );
      case 'torus':
        return (
          <torusGeometry
            args={[
              args[0] ?? 0.08,
              args[1] ?? 0.02,
              args[2] ?? 4,
              args[3] ?? 8,
            ]}
          />
        );
      case 'star':
      default:
        return (
          <cylinderGeometry
            args={[
              args[0] ?? 0.06,
              args[1] ?? 0.06,
              args[2] ?? 0.15,
              5,
            ]}
          />
        );
    }
  };

  return (
    <mesh
      position={element.position}
      rotation={element.rotation}
      scale={element.scale}
      castShadow
      receiveShadow
    >
      {getGeometry()}
      {material}
    </mesh>
  );
};


export interface CropRendererProps {
  crop: CropData;
  position?: [number, number, number];
}

export const CropRenderer: React.FC<CropRendererProps> = ({
  crop,
  position = [0, 0, 0],
}) => {
  const rootRef = useRef<THREE.Group>(null);
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);

  const cropDef = getCropDefinition(crop.cropId);
  const baseGrowthSec = cropDef?.baseGrowthSec ?? 45;

  const currentStage = getCropStage(crop.growthProgressSec, baseGrowthSec);
  const [prevStage, setPrevStage] = useState<CropStage>(currentStage);
  const transitionStartMs = useRef<number>(Date.now());
  const [transitionProgress, setTransitionProgress] = useState({ scale: 1.0, opacity: 1.0 });

  const isHarvestable = crop.growthProgressSec >= baseGrowthSec;
  const mutationScale = getMutationScale(crop.mutation);

  // Trigger stage transition animation when stage progresses
  useEffect(() => {
    if (currentStage !== prevStage) {
      setPrevStage(currentStage);
      transitionStartMs.current = Date.now();
    }
  }, [currentStage, prevStage]);

  const durationMs = reducedMotion
    ? STAGE_TRANSITION_REDUCED_MOTION_MS
    : STAGE_TRANSITION_EASE_DURATION_MS;

  useFrame(({ clock }) => {
    const elapsed = Date.now() - transitionStartMs.current;
    if (elapsed <= durationMs + 50) {
      const trans = calculateStageTransition(elapsed, durationMs, reducedMotion);
      setTransitionProgress(trans);
    }

    if (rootRef.current) {
      // Gentle harvestable idle bobbing/breathing if mature
      if (isHarvestable && !reducedMotion) {
        const t = clock.getElapsedTime();
        const harvestBob = 1.0 + Math.sin(t * 3.0) * 0.03;
        const totalScale = mutationScale * transitionProgress.scale * harvestBob;
        rootRef.current.scale.set(totalScale, totalScale, totalScale);
      } else {
        const totalScale = mutationScale * transitionProgress.scale;
        rootRef.current.scale.set(totalScale, totalScale, totalScale);
      }
    }
  });

  const cropConfig = CROP_STAGE_CATALOG[crop.cropId]?.[currentStage];
  if (!cropConfig) {
    return null;
  }

  return (
    <group ref={rootRef} position={position} name={`Crop-${crop.cropId}-${currentStage}`}>
      {/* 3D Procedural elements for active stage */}
      {cropConfig.elements.map((elem, idx) => (
        <ProceduralElement
          key={`${currentStage}-${idx}`}
          element={elem}
          mutation={crop.mutation}
          opacity={transitionProgress.opacity}
        />
      ))}

      {/* Mutation Visual Decorator (Gold pulsing glow, Cosmic star motes) */}
      <MutationVisualDecorator
        mutation={crop.mutation}
        reducedMotion={reducedMotion}
      />
    </group>
  );
};
