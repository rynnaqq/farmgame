import React, { useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import {
  FARM_BED_IDS,
  FARM_BEDS,
  worldPointToPlacement,
  type CropPlacement,
} from './farmLayout';

export interface FarmBedsProps {
  plantingEnabled: boolean;
  onPlantAt?: (placement: CropPlacement) => void;
}

const MAX_TAP_MOVEMENT_PX = 6;

/**
 * FarmBeds renders the four 6.0 x 5.4 raised planter beds (2x2 layout with a
 * cross-shaped corridor) from the single geometry source in farmLayout.ts.
 *
 * - One continuous soil surface per bed receives pointer events; furrow lines
 *   are purely decorative and never a placement grid.
 * - Taps forward the exact R3F intersection point as a CropPlacement.
 * - A camera drag of more than six CSS pixels cancels planting.
 */
export const FarmBeds: React.FC<FarmBedsProps> = ({ plantingEnabled, onPlantAt }) => {
  const downPoint = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    downPoint.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    const start = downPoint.current;
    downPoint.current = null;
    if (!plantingEnabled || !start || !onPlantAt) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > MAX_TAP_MOVEMENT_PX) {
      return;
    }
    // jsdom tests dispatch native events; R3F provides the intersection directly.
    const native = event as unknown as {
      nativeEvent?: PointerEvent & { point?: { x: number; z: number } };
      point?: { x: number; z: number };
    };
    const intersection = native.point ?? native.nativeEvent?.point;
    if (!intersection) return;
    const placement = worldPointToPlacement({
      x: intersection.x,
      z: intersection.z,
    });
    if (!placement) return;
    event.stopPropagation();
    onPlantAt(placement);
  };

  return (
    <group name="FarmBeds">
      {FARM_BED_IDS.map((bedId) => {
        const bed = FARM_BEDS[bedId];
        return (
          <group key={bedId} position={[bed.centerX, 0, bed.centerZ]}>
            {/* Continuous soil surface (single pointer target) */}
            <mesh
              name={'FarmBedSoil-' + bedId}
              data-testid={'farm-bed-' + bedId + '-soil'}
              position={[0, bed.soilHeight / 2, 0]}
              receiveShadow
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
            >
              <boxGeometry args={[bed.width, bed.soilHeight, bed.depth]} />
              <meshStandardMaterial color="#6b3f24" roughness={0.92} />
            </mesh>

            {/* Wooden bed frame rails (decorative, never pointer targets) */}
            <mesh position={[0, 0.17, -(bed.depth / 2 + 0.09)]} castShadow>
              <boxGeometry args={[bed.width, 0.22, 0.18]} />
              <meshStandardMaterial color="#704226" roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.17, bed.depth / 2 + 0.09]} castShadow>
              <boxGeometry args={[bed.width, 0.22, 0.18]} />
              <meshStandardMaterial color="#704226" roughness={0.85} />
            </mesh>
            <mesh position={[-(bed.width / 2 + 0.09), 0.17, 0]} castShadow>
              <boxGeometry args={[0.18, 0.22, bed.depth]} />
              <meshStandardMaterial color="#704226" roughness={0.85} />
            </mesh>
            <mesh position={[bed.width / 2 + 0.09, 0.17, 0]} castShadow>
              <boxGeometry args={[0.18, 0.22, bed.depth]} />
              <meshStandardMaterial color="#704226" roughness={0.85} />
            </mesh>

            {/* Decorative furrow ridges; not a placement grid */}
            {[-1.8, -0.9, 0, 0.9, 1.8].map((x) => (
              <mesh key={x} position={[x, bed.soilHeight + 0.005, 0]}>
                <boxGeometry args={[0.025, 0.012, bed.depth - 0.7]} />
                <meshStandardMaterial color="#4b2a19" roughness={1} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
};
