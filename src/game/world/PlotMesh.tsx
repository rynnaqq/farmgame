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

// Shared materials: one instance per soil state for ALL plots. Per-plot
// <meshStandardMaterial> JSX would compile a program switch per tile and
// allocate on every state change — with unbounded free-placement plots the
// shared set keeps draw state constant no matter the farm size.
function soilMaterial(color: string, roughness: number, metalness: number) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
}
const SOIL_BASE_MAT = soilMaterial('#553218', 0.88, 0.05);
const SOIL_BORDER_MAT = soilMaterial('#754823', 0.8, 0.05);
const SOIL_DRY_MAT = soilMaterial('#663C1D', 0.85, 0.05);
const SOIL_WET_MAT = soilMaterial('#281509', 0.32, 0.15);
const FURROW_DRY_MAT = soilMaterial('#522E15', 0.85, 0.05);
const FURROW_WET_MAT = soilMaterial('#1C0D05', 0.32, 0.15);
const SHEEN_MAT = new THREE.MeshStandardMaterial({
  color: '#241307',
  roughness: 0.12,
  metalness: 0.45,
  transparent: true,
  opacity: 0.45,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
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

  // Uniform soil palette: rich furrowed dark loam when dry, dark moist
  // soil when hydrated. No till distinction — all soil is plantable.
  // Resolved to SHARED materials (see module scope) at render time.
  const soilMat = isHydrated ? SOIL_WET_MAT : SOIL_DRY_MAT;
  const furrowMat = isHydrated ? FURROW_WET_MAT : FURROW_DRY_MAT;

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
        <mesh
          receiveShadow
          geometry={SHARED_SOIL_BASE_GEO}
          material={SOIL_BASE_MAT}
          position={[0, 0, 0]}
        />

        {/* North and South Raised Wooden Edges */}
        <mesh
          position={[0, 0.045, (PLOT_SIZE - 0.09) / 2]}
          geometry={SHARED_BORDER_NS_GEO}
          material={SOIL_BORDER_MAT}
          castShadow
          receiveShadow
        />
        <mesh
          position={[0, 0.045, -(PLOT_SIZE - 0.09) / 2]}
          geometry={SHARED_BORDER_NS_GEO}
          material={SOIL_BORDER_MAT}
          castShadow
          receiveShadow
        />

        {/* East and West Raised Wooden Edges */}
        <mesh
          position={[(PLOT_SIZE - 0.09) / 2, 0.045, 0]}
          geometry={SHARED_BORDER_EW_GEO}
          material={SOIL_BORDER_MAT}
          castShadow
          receiveShadow
        />
        <mesh
          position={[-(PLOT_SIZE - 0.09) / 2, 0.045, 0]}
          geometry={SHARED_BORDER_EW_GEO}
          material={SOIL_BORDER_MAT}
          castShadow
          receiveShadow
        />
      </group>

      {/* 2. Inner Tillable Soil Surface */}
      <mesh
        castShadow
        receiveShadow
        geometry={SHARED_SOIL_INNER_GEO}
        material={soilMat}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
        position={[0, 0.042, 0]}
      />

      {/* 3. Furrow Ridges (always visible — all soil is plantable) */}
      {/* Raised clear of the soil top to avoid depth shimmer at grazing angles. */}
      <group position={[0, 0.068, 0]}>
        {[-0.28, 0, 0.28].map((offsetZ, idx) => (
          <mesh
            key={idx}
            position={[0, 0.01, offsetZ]}
            geometry={SHARED_FURROW_RIDGE_GEO}
            material={furrowMat}
            receiveShadow
          />
        ))}
      </group>

      {/* 4. Hydration Water Sheen Layer */}
      {/* Lifted + polygon-offset so the zero-thickness plane never z-fights
          the soil top; depthWrite off keeps it from haloing the furrows. */}
      {isHydrated && (
        <mesh
          position={[0, 0.066, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          geometry={SHARED_HYDRATION_PLANE_GEO}
          material={SHEEN_MAT}
          receiveShadow
          renderOrder={1}
        />
      )}

      {/* 5. Procedural 3D Crop Mesh */}
      {plot.crop && <CropRenderer crop={plot.crop} position={[0, 0.06, 0]} />}

      {/* 6. Hover / Targeted Selection Outline */}
      {showOutline && (
        <group position={[0, 0.095, 0]}>
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
