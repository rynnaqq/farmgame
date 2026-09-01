import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { PlotData, PlotId } from '../../state/storeTypes';
import { PLOT_SIZE } from '../core/constants';
import { useUiStore } from '../../state/uiStore';
import { CropRenderer } from '../farming/CropRenderer';

// Pre-allocated shared geometries for plot meshes to eliminate per-plot geometry churn
const SHARED_SOIL_BASE_GEO = new THREE.BoxGeometry(PLOT_SIZE, 0.08, PLOT_SIZE);
const SHARED_SOIL_INNER_GEO = new THREE.BoxGeometry(PLOT_SIZE * 0.86, 0.025, PLOT_SIZE * 0.86);
const SHARED_BORDER_NS_GEO = new THREE.BoxGeometry(PLOT_SIZE, 0.05, 0.09);
const SHARED_BORDER_EW_GEO = new THREE.BoxGeometry(0.09, 0.05, PLOT_SIZE - 0.18);
const SHARED_FURROW_RIDGE_GEO = new THREE.BoxGeometry(PLOT_SIZE * 0.78, 0.02, 0.15);
const SHARED_HYDRATION_PLANE_GEO = new THREE.PlaneGeometry(PLOT_SIZE * 0.84, PLOT_SIZE * 0.84);
const SHARED_OUTLINE_RING_GEO = new THREE.RingGeometry(
  (PLOT_SIZE * 0.98) / 2,
  (PLOT_SIZE * 1.04) / 2,
  4,
  1,
  Math.PI / 4
);

export interface PlotMeshProps {
  plot: PlotData;
  position: [number, number, number];
  isHovered?: boolean;
  isTargeted?: boolean;
  onPlotClick?: (plotId: PlotId) => void;
  scale?: number | [number, number, number];
}

export const PlotMesh: React.FC<PlotMeshProps> = ({
  plot,
  position,
  isHovered = false,
  isTargeted = false,
  onPlotClick,
  scale = 1.0,
}) => {
  const setHoveredPlot = useUiStore((state) => state.setHoveredPlot);

  const isHydrated = useMemo(() => {
    return plot.tilled && plot.hydratedUntilUtcMs > Date.now();
  }, [plot.tilled, plot.hydratedUntilUtcMs]);

  // Determine soil visual properties based on state
  const soilMaterialProps = useMemo(() => {
    if (!plot.tilled) {
      // Untilled, warm sandy-clay earth (matching Growden/Roblox farm look)
      return {
        color: '#C2965B',
        roughness: 0.92,
        metalness: 0.0,
      };
    }

    if (isHydrated) {
      // Hydrated, dark moist soil with slight reflection
      return {
        color: '#2A160B',
        roughness: 0.35,
        metalness: 0.12,
      };
    }

    // Tilled, dry furrowed soil
    return {
      color: '#653E20',
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

  const scaleVector: [number, number, number] =
    typeof scale === 'number' ? [scale, scale, scale] : scale;

  return (
    <group position={position} scale={scaleVector} name={`PlotMesh-${plot.id}`}>
      {/* 1. Raised Wooden Border Bed (Planter Frame) */}
      <group position={[0, 0, 0]}>
        {/* Underbed base foundation */}
        <mesh receiveShadow geometry={SHARED_SOIL_BASE_GEO} position={[0, 0, 0]}>
          <meshStandardMaterial color="#4A2E16" roughness={0.88} metalness={0.05} flatShading />
        </mesh>

        {/* North and South Raised Wooden Edges */}
        <mesh
          position={[0, 0.045, (PLOT_SIZE - 0.09) / 2]}
          geometry={SHARED_BORDER_NS_GEO}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#5C381E" roughness={0.82} metalness={0.05} flatShading />
        </mesh>
        <mesh
          position={[0, 0.045, -(PLOT_SIZE - 0.09) / 2]}
          geometry={SHARED_BORDER_NS_GEO}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#5C381E" roughness={0.82} metalness={0.05} flatShading />
        </mesh>

        {/* East and West Raised Wooden Edges */}
        <mesh
          position={[(PLOT_SIZE - 0.09) / 2, 0.045, 0]}
          geometry={SHARED_BORDER_EW_GEO}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#5C381E" roughness={0.82} metalness={0.05} flatShading />
        </mesh>
        <mesh
          position={[-(PLOT_SIZE - 0.09) / 2, 0.045, 0]}
          geometry={SHARED_BORDER_EW_GEO}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#5C381E" roughness={0.82} metalness={0.05} flatShading />
        </mesh>
      </group>

      {/* 2. Inner Tillable Soil Surface */}
      <mesh
        castShadow
        receiveShadow
        geometry={SHARED_SOIL_INNER_GEO}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
        position={[0, 0.042, 0]}
      >
        <meshStandardMaterial
          color={soilMaterialProps.color}
          roughness={soilMaterialProps.roughness}
          metalness={soilMaterialProps.metalness}
          flatShading
        />
      </mesh>

      {/* 3. Tilled Furrow Ridges (Visual detail when tilled) */}
      {plot.tilled && (
        <group position={[0, 0.058, 0]}>
          {[-0.28, 0, 0.28].map((offsetZ, idx) => (
            <mesh
              key={idx}
              position={[0, 0.01, offsetZ]}
              geometry={SHARED_FURROW_RIDGE_GEO}
              receiveShadow
            >
              <meshStandardMaterial
                color={isHydrated ? '#221107' : '#4E2F18'}
                roughness={soilMaterialProps.roughness}
                metalness={soilMaterialProps.metalness}
                flatShading
              />
            </mesh>
          ))}
        </group>
      )}

      {/* 4. Hydration Water Sheen Layer */}
      {isHydrated && (
        <mesh
          position={[0, 0.056, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          geometry={SHARED_HYDRATION_PLANE_GEO}
          receiveShadow
        >
          <meshStandardMaterial
            color="#3D2817"
            roughness={0.15}
            metalness={0.4}
            transparent
            opacity={0.35}
          />
        </mesh>
      )}

      {/* 5. Procedural 3D Crop Mesh */}
      {plot.crop && <CropRenderer crop={plot.crop} position={[0, 0.06, 0]} />}

      {/* 6. Hover / Targeted Selection Outline */}
      {showOutline && (
        <group position={[0, 0.08, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={SHARED_OUTLINE_RING_GEO}>
            <meshBasicMaterial color={outlineColor} transparent opacity={isTargeted ? 0.9 : 0.65} />
          </mesh>
        </group>
      )}
    </group>
  );
};
