import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { computeCullVisibility, DEFAULT_CULL_HYSTERESIS, DECOR_CULL_DISTANCE } from './culling';

export interface CulledGroupProps {
  children: React.ReactNode;
  /** Hide children when the camera is farther than this (world units). */
  maxDistance?: number;
  /** Hysteresis band fraction preventing flicker at the boundary. */
  hysteresis?: number;
  name?: string;
}

const _worldPos = new THREE.Vector3();

/**
 * Distance-culling wrapper: toggles `visible` (zero React re-renders) based
 * on camera distance with hysteresis. Use for tiny detail meshes that become
 * subpixel noise at range — flowers, grass tufts, mutation sparkles.
 */
export const CulledGroup: React.FC<CulledGroupProps> = ({
  children,
  maxDistance = DECOR_CULL_DISTANCE,
  hysteresis = DEFAULT_CULL_HYSTERESIS,
  name,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const visibleRef = useRef<boolean>(true);

  useFrame(({ camera }) => {
    const group = groupRef.current;
    if (!group) return;
    group.getWorldPosition(_worldPos);
    const distance = camera.position.distanceTo(_worldPos);
    const next = computeCullVisibility(distance, maxDistance, visibleRef.current, hysteresis);
    if (next !== visibleRef.current) {
      visibleRef.current = next;
      group.visible = next;
    }
  });

  return (
    <group ref={groupRef} name={name}>
      {children}
    </group>
  );
};
