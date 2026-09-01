import React, { useMemo } from 'react';
import {
  PLOT_SIZE,
  MAX_GRID_SIZE,
} from '../core/constants';
import type { PlotId } from '../../state/storeTypes';
import { useGameStore } from '../../state/gameStore';
import { useUiStore } from '../../state/uiStore';
import { PlotMesh } from './PlotMesh';
import {
  getPlotPosition,
  getGridBounds,
  getPlotId,
  getLockedPlotSlots,
} from './gridCoordinates';

// ==========================================
// Locked Plot Indicator Subcomponent
// ==========================================

export interface LockedPlotMeshProps {
  position: [number, number, number];
  requiredGridSize: 6 | 8;
}

export const LockedPlotMesh: React.FC<LockedPlotMeshProps> = ({
  position,
}) => {
  return (
    <group position={position}>
      {/* Stone border tile */}
      <mesh receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[PLOT_SIZE, 0.08, PLOT_SIZE]} />
        <meshStandardMaterial
          color="#525B62"
          roughness={0.9}
          metalness={0.05}
          flatShading
        />
      </mesh>

      {/* Inset grass/moss patch */}
      <mesh receiveShadow position={[0, 0.042, 0]}>
        <boxGeometry args={[PLOT_SIZE * 0.78, 0.02, PLOT_SIZE * 0.78]} />
        <meshStandardMaterial
          color="#48782E"
          roughness={0.85}
          metalness={0.0}
          flatShading
        />
      </mesh>

      {/* Procedural Low-Poly Padlock Icon */}
      <group position={[0, 0.14, 0]}>
        {/* Lock Body */}
        <mesh castShadow receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={[0.22, 0.16, 0.1]} />
          <meshStandardMaterial
            color="#967B48"
            roughness={0.4}
            metalness={0.6}
            flatShading
          />
        </mesh>
        {/* Lock Shackle */}
        <mesh castShadow position={[0, 0.11, 0]}>
          <torusGeometry args={[0.07, 0.02, 4, 8, Math.PI]} />
          <meshStandardMaterial
            color="#6B7280"
            roughness={0.3}
            metalness={0.8}
            flatShading
          />
        </mesh>
      </group>
    </group>
  );
};

// ==========================================
// SoilGrid Component
// ==========================================

export interface SoilGridProps {
  onPlotClick?: (plotId: PlotId) => void;
}

export const SoilGrid: React.FC<SoilGridProps> = ({ onPlotClick }) => {
  const plots = useGameStore((state) => state.farm.plots);
  const gridSize = useGameStore((state) => state.farm.gridSize);
  const hoveredPlotId = useUiStore((state) => state.hoveredPlotId);
  const targetedPlotId = useUiStore((state) => state.targetedPlotId);

  // Active plot list
  const activePlots = useMemo(() => {
    const list = [];
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const id = getPlotId(r, c);
        const plotData = plots[id] || {
          id,
          row: r,
          col: c,
          tilled: false,
          crop: null,
          hydratedUntilUtcMs: 0,
        };
        list.push({
          plot: plotData,
          position: getPlotPosition(r, c, MAX_GRID_SIZE),
        });
      }
    }
    return list;
  }, [plots, gridSize]);

  // Locked plot slots
  const lockedSlots = useMemo(() => {
    return getLockedPlotSlots(gridSize, MAX_GRID_SIZE);
  }, [gridSize]);

  // Farm boundary dimensions for ground bed
  const maxGridBounds = useMemo(() => getGridBounds(MAX_GRID_SIZE), []);

  return (
    <group name="SoilGrid">
      {/* Subtle garden plot area foundation recess */}
      <mesh
        receiveShadow
        position={[0, -0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry
          args={[maxGridBounds.width + 0.6, maxGridBounds.depth + 0.6]}
        />
        <meshStandardMaterial
          color="#3F6E22"
          roughness={0.9}
          metalness={0.0}
          flatShading
        />
      </mesh>

      {/* Active Plot Meshes */}
      {activePlots.map(({ plot, position }) => (
        <PlotMesh
          key={plot.id}
          plot={plot}
          position={position}
          isHovered={hoveredPlotId === plot.id}
          isTargeted={targetedPlotId === plot.id}
          onPlotClick={onPlotClick}
        />
      ))}

      {/* Locked Plot Markers */}
      {lockedSlots.map((slot) => (
        <LockedPlotMesh
          key={slot.id}
          position={slot.position}
          requiredGridSize={slot.requiredGridSize}
        />
      ))}
    </group>
  );
};
