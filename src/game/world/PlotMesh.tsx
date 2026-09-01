import React, { useMemo } from 'react';
import type { PlotData, PlotId } from '../../state/storeTypes';
import { PLOT_SIZE } from '../core/constants';
import { useUiStore } from '../../state/uiStore';

export interface PlotMeshProps {
  plot: PlotData;
  position: [number, number, number];
  isHovered?: boolean;
  isTargeted?: boolean;
  onPlotClick?: (plotId: PlotId) => void;
}

export const PlotMesh: React.FC<PlotMeshProps> = ({
  plot,
  position,
  isHovered = false,
  isTargeted = false,
  onPlotClick,
}) => {
  const setHoveredPlot = useUiStore((state) => state.setHoveredPlot);

  const isHydrated = useMemo(() => {
    return plot.tilled && plot.hydratedUntilUtcMs > Date.now();
  }, [plot.tilled, plot.hydratedUntilUtcMs]);

  // Determine soil visual properties based on state
  const soilMaterialProps = useMemo(() => {
    if (!plot.tilled) {
      // Untilled, rough dry earth
      return {
        color: '#8A6240',
        roughness: 0.95,
        metalness: 0.0,
      };
    }

    if (isHydrated) {
      // Hydrated, dark moist soil with slight reflection
      return {
        color: '#2B170B',
        roughness: 0.3,
        metalness: 0.15,
      };
    }

    // Tilled, dry furrowed soil
    return {
      color: '#5C381E',
      roughness: 0.85,
      metalness: 0.05,
    };
  }, [plot.tilled, isHydrated]);

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

  return (
    <group position={position}>
      {/* Main Soil Bed Mesh */}
      <mesh
        castShadow
        receiveShadow
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
        position={[0, 0, 0]}
      >
        <boxGeometry args={[PLOT_SIZE, 0.1, PLOT_SIZE]} />
        <meshStandardMaterial
          color={soilMaterialProps.color}
          roughness={soilMaterialProps.roughness}
          metalness={soilMaterialProps.metalness}
          flatShading
        />
      </mesh>

      {/* Tilled Furrow Ridges (Visual detail when tilled) */}
      {plot.tilled && (
        <group position={[0, 0.055, 0]}>
          {[-0.35, 0, 0.35].map((offsetZ, idx) => (
            <mesh key={idx} position={[0, 0.015, offsetZ]} receiveShadow>
              <boxGeometry args={[PLOT_SIZE * 0.9, 0.03, 0.18]} />
              <meshStandardMaterial
                color={isHydrated ? '#241308' : '#4E2F18'}
                roughness={soilMaterialProps.roughness}
                metalness={soilMaterialProps.metalness}
                flatShading
              />
            </mesh>
          ))}
        </group>
      )}

      {/* Hydration Water Sheen Layer */}
      {isHydrated && (
        <mesh
          position={[0, 0.052, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[PLOT_SIZE * 0.94, PLOT_SIZE * 0.94]} />
          <meshStandardMaterial
            color="#3D2817"
            roughness={0.15}
            metalness={0.4}
            transparent
            opacity={0.35}
          />
        </mesh>
      )}

      {/* Hover / Targeted Selection Outline */}
      {showOutline && (
        <group position={[0, 0.06, 0]}>
          {/* Top border frame */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry
              args={[
                (PLOT_SIZE * 0.98) / 2,
                (PLOT_SIZE * 1.04) / 2,
                4,
                1,
                Math.PI / 4,
              ]}
            />
            <meshBasicMaterial
              color={outlineColor}
              transparent
              opacity={isTargeted ? 0.9 : 0.65}
            />
          </mesh>
        </group>
      )}
    </group>
  );
};
