import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../../state/gameStore';
import { useUiStore } from '../../state/uiStore';
import { PlotMesh } from './PlotMesh';
import { FARM_BOUNDS } from './farmLayout';
import type { PlotId } from '../../state/storeTypes';

export interface FarmSoilPoint {
  x: number;
  z: number;
}

export interface FarmBedsProps {
  onSoilClick?: (point: FarmSoilPoint) => void;
  onPlotClick?: (plotId: PlotId) => void;
}

const BED_WIDTH = (FARM_BOUNDS.maxX - FARM_BOUNDS.minX) / 2;
const BED_DEPTH = FARM_BOUNDS.maxZ - FARM_BOUNDS.minZ;
const LEFT_BED_X = (FARM_BOUNDS.minX + 0) / 2;
const RIGHT_BED_X = FARM_BOUNDS.maxX / 2;

const SOIL_SLAB_GEO = new THREE.BoxGeometry(BED_WIDTH, 0.12, BED_DEPTH);

/**
 * Free-placement farm rendering: two continuous soil beds plus one small
 * soil spot per planted crop at its world position. No tile grid, no locks.
 * Clicking bare soil reports the world point for planting; clicking a
 * planted spot reports its plot id for watering/harvesting.
 */
export const FarmBeds: React.FC<FarmBedsProps> = ({ onSoilClick, onPlotClick }) => {
  const plots = useGameStore((state) => state.farm.plots);
  const hoveredPlotId = useUiStore((state) => state.hoveredPlotId);
  const lastSavedUtcMs = useGameStore((state) => state.lastSavedUtcMs);

  // Sim-aware clock for hydration display (follows fast-forwarded sim time).
  const [wallNow, setWallNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setWallNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const simNow = Math.max(wallNow, lastSavedUtcMs || 0);

  const plotList = useMemo(() => Object.values(plots), [plots]);

  const handleSoilClick = (e: { stopPropagation: () => void; point: THREE.Vector3 }) => {
    e.stopPropagation();
    onSoilClick?.({ x: e.point.x, z: e.point.z });
  };

  return (
    <group name="FarmBeds">
      {/* Left soil bed */}
      <mesh
        receiveShadow
        geometry={SOIL_SLAB_GEO}
        position={[LEFT_BED_X, -0.03, 0]}
        onClick={handleSoilClick}
      >
        <meshStandardMaterial color="#4A2E16" roughness={0.9} flatShading />
      </mesh>

      {/* Right soil bed */}
      <mesh
        receiveShadow
        geometry={SOIL_SLAB_GEO}
        position={[RIGHT_BED_X, -0.03, 0]}
        onClick={handleSoilClick}
      >
        <meshStandardMaterial color="#4A2E16" roughness={0.9} flatShading />
      </mesh>

      {/* Planted crops */}
      {plotList.map((plot) => (
        <PlotMesh
          key={plot.id}
          plot={plot}
          position={[plot.x, 0.05, plot.z]}
          isHovered={hoveredPlotId === plot.id}
          isTargeted={false}
          onPlotClick={onPlotClick}
          nowMs={simNow}
        />
      ))}
    </group>
  );
};
