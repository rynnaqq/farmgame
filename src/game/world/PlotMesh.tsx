import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { PlotData, PlotId } from '../../state/storeTypes';
import { useUiStore } from '../../state/uiStore';
import { CropRenderer } from '../farming/CropRenderer';

// A planted seed is just a small darker soil spot — no planter box, no
// till rows, nothing that clutters the farm beds.
const SPOT_RADIUS = 0.35;
const SHARED_SPOT_GEO = new THREE.CircleGeometry(SPOT_RADIUS, 24);
// Generous invisible tap target so small spots stay easy to tap on mobile.
const SHARED_HIT_GEO = new THREE.CircleGeometry(0.7, 12);
const SHARED_OUTLINE_RING_GEO = new THREE.RingGeometry(0.4, 0.47, 24);

// Shared materials: one instance per soil state for ALL plots.
function soilMaterial(color: string, roughness: number, metalness: number) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
}
// Noticeably darker than the bed slabs (#4A2E16) so planted spots read
// clearly, and uniform across every plot.
const SPOT_DRY_MAT = soilMaterial('#3A2412', 0.9, 0.0);
const SPOT_WET_MAT = soilMaterial('#1E0E05', 0.35, 0.1);
const HIT_MAT = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
});

export interface PlotMeshProps {
  plot: PlotData;
  position: [number, number, number];
  isHovered?: boolean;
  isTargeted?: boolean;
  onPlotClick?: (plotId: PlotId) => void;
  scale?: number | [number, number, number];
  /** Simulated now in ms; defaults to wall clock. Injected by tests/deterministic sim. */
  nowMs?: number;
}

export const PlotMesh: React.FC<PlotMeshProps> = ({
  plot,
  position,
  isHovered = false,
  isTargeted = false,
  onPlotClick,
  scale = 1.0,
  nowMs,
}) => {
  const setHoveredPlot = useUiStore((state) => state.setHoveredPlot);

  const isHydrated = useMemo(() => {
    return plot.hydratedUntilUtcMs > (nowMs ?? Date.now());
  }, [plot.hydratedUntilUtcMs, nowMs]);

  const spotMat = isHydrated ? SPOT_WET_MAT : SPOT_DRY_MAT;

  const outlineColor = isTargeted ? '#FFD700' : '#FFFFFF';
  const showOutline = isHovered || isTargeted;

  const handlePointerOver = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setHoveredPlot(plot.id);
  };

  const handlePointerOut = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setHoveredPlot(null);
  };

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onPlotClick?.(plot.id);
  };

  const scaleVector: [number, number, number] =
    typeof scale === 'number' ? [scale, scale, scale] : scale;

  return (
    <group position={position} scale={scaleVector} name={`PlotMesh-${plot.id}`}>
      {/* Planting spot: small soil circle, darker than the bed slabs */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={SHARED_SPOT_GEO}
        material={spotMat}
        receiveShadow
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      />

      {/* Invisible tap target (mobile-friendly) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.005, 0]}
        geometry={SHARED_HIT_GEO}
        material={HIT_MAT}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      />

      {/* Procedural 3D Crop Mesh (grows gradually, see CropRenderer) */}
      {plot.crop && <CropRenderer crop={plot.crop} position={[0, 0, 0]} />}

      {/* Hover / Targeted Selection Outline */}
      {showOutline && (
        <group position={[0, 0.02, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={SHARED_OUTLINE_RING_GEO}>
            <meshBasicMaterial
              color={outlineColor}
              transparent
              opacity={isTargeted ? 0.9 : 0.65}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}
    </group>
  );
};
