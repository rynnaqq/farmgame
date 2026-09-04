import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CropData } from '../../state/storeTypes';
import { getCropDefinition } from './cropDefinitions';
import {
  getCropStage,
  getCropProgressRatio,
  getGrowthScale,
  CROP_EMERGE_RATIO,
  getMutationScale,
  getMutationMaterialProps,
  calculateStageTransition,
  CROP_STAGE_CATALOG,
  type CropStage,
  type MeshElementDef,
  type MeshElementType,
} from './cropMeshGenerators';
import { MutationVisualDecorator } from './mutationVisuals';
import { useSettingsStore } from '../../state/settingsStore';
import {
  STAGE_TRANSITION_EASE_DURATION_MS,
  STAGE_TRANSITION_REDUCED_MOTION_MS,
  type MutationType,
} from '../core/constants';

// Shared GPU geometry cache to eliminate per-element heap allocation and geometry thrashing
const CROP_GEOMETRY_CACHE = new Map<string, THREE.BufferGeometry>();

function getOrCreateCropGeometry(type: MeshElementType, args: number[] = []): THREE.BufferGeometry {
  const key = `${type}_${args.join('_')}`;
  let geo = CROP_GEOMETRY_CACHE.get(key);
  if (!geo) {
    switch (type) {
      case 'cone':
        geo = new THREE.ConeGeometry(args[0] ?? 0.05, args[1] ?? 0.15, args[2] ?? 5);
        break;
      case 'cylinder':
        geo = new THREE.CylinderGeometry(
          args[0] ?? 0.03,
          args[1] ?? 0.03,
          args[2] ?? 0.2,
          args[3] ?? 6
        );
        break;
      case 'sphere':
        geo = new THREE.SphereGeometry(args[0] ?? 0.08, args[1] ?? 6, args[2] ?? 6);
        break;
      case 'box':
        geo = new THREE.BoxGeometry(args[0] ?? 0.1, args[1] ?? 0.1, args[2] ?? 0.1);
        break;
      case 'dodecahedron':
        geo = new THREE.DodecahedronGeometry(args[0] ?? 0.1, args[1] ?? 0);
        break;
      case 'torus':
        geo = new THREE.TorusGeometry(args[0] ?? 0.08, args[1] ?? 0.02, args[2] ?? 4, args[3] ?? 8);
        break;
      case 'star':
      default:
        geo = new THREE.CylinderGeometry(args[0] ?? 0.06, args[1] ?? 0.06, args[2] ?? 0.15, 5);
        break;
    }
    CROP_GEOMETRY_CACHE.set(key, geo);
  }
  return geo;
}

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
  const geometry = getOrCreateCropGeometry(element.type, element.args);

  return (
    <mesh
      geometry={geometry}
      position={element.position}
      rotation={element.rotation}
      scale={element.scale}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color={matProps.color}
        roughness={matProps.roughness}
        metalness={matProps.metalness}
        emissive={matProps.emissive ?? element.emissive}
        emissiveIntensity={matProps.emissiveIntensity ?? element.emissiveIntensity ?? 0}
        transparent={isTransparent}
        opacity={opacity}
        flatShading
      />
    </mesh>
  );
};

export interface CropRendererProps {
  crop: CropData;
  position?: [number, number, number];
}

export const CropRenderer: React.FC<CropRendererProps> = ({ crop, position = [0, 0, 0] }) => {
  const rootRef = useRef<THREE.Group>(null);
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);

  const cropDef = getCropDefinition(crop.cropId);
  const baseGrowthSec = cropDef?.baseGrowthSec ?? 45;

  const currentStage = getCropStage(crop.growthProgressSec, baseGrowthSec);
  const growthRatio = getCropProgressRatio(crop.growthProgressSec, baseGrowthSec);
  // Continuous size from emergence to maturity; stored in a ref so the
  // per-frame loop always uses the latest progress without re-subscribing.
  const growthScaleRef = useRef<number>(getGrowthScale(growthRatio));
  growthScaleRef.current = getGrowthScale(growthRatio);
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
      const growthScale = growthScaleRef.current;
      // Gentle harvestable idle bobbing/breathing if mature
      if (isHarvestable && !reducedMotion) {
        const t = clock.getElapsedTime();
        const harvestBob = 1.0 + Math.sin(t * 3.0) * 0.03;
        const totalScale = mutationScale * growthScale * transitionProgress.scale * harvestBob;
        rootRef.current.scale.set(totalScale, totalScale, totalScale);
      } else {
        const totalScale = mutationScale * growthScale * transitionProgress.scale;
        rootRef.current.scale.set(totalScale, totalScale, totalScale);
      }
    }
  });

  // Freshly planted seeds show only the dark soil spot — the sprout
  // emerges gradually once growth passes the emergence threshold.
  if (growthRatio <= CROP_EMERGE_RATIO) {
    return null;
  }

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
      <MutationVisualDecorator mutation={crop.mutation} reducedMotion={reducedMotion} />
    </group>
  );
};
