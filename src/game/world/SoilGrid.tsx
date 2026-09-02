import React, { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { PLOT_SIZE, MAX_GRID_SIZE } from '../core/constants';
import type { PlotId } from '../../state/storeTypes';
import { useGameStore } from '../../state/gameStore';
import { useUiStore } from '../../state/uiStore';
import { useSettingsStore } from '../../state/settingsStore';
import { PlotMesh } from './PlotMesh';
import {
  getPlotPosition,
  getGridBounds,
  getPlotId,
  getLockedPlotSlots,
  type LockedPlotSlot,
} from './gridCoordinates';
import {
  calculateExpansionRing,
  calculatePlotExpansionScale,
  isPlotInExpansionWave,
  getExpansionWaveDuration,
} from './expansionAnimation';

// ==========================================
// Locked Plot Indicator Subcomponent (Individual fallback & Instanced)
// ==========================================

export interface LockedPlotMeshProps {
  position: [number, number, number];
  requiredGridSize: 6 | 8;
}

export const LockedPlotMesh: React.FC<LockedPlotMeshProps> = ({ position }) => {
  return (
    <group position={position}>
      {/* Stone border tile */}
      <mesh receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[PLOT_SIZE, 0.08, PLOT_SIZE]} />
        <meshStandardMaterial color="#64748B" roughness={0.85} metalness={0.05} flatShading />
      </mesh>

      {/* Inset grass/moss patch */}
      <mesh receiveShadow position={[0, 0.042, 0]}>
        <boxGeometry args={[PLOT_SIZE * 0.78, 0.02, PLOT_SIZE * 0.78]} />
        <meshStandardMaterial color="#50D028" roughness={0.8} metalness={0.0} flatShading />
      </mesh>

      {/* Procedural Low-Poly Padlock Icon */}
      <group position={[0, 0.14, 0]}>
        {/* Lock Body */}
        <mesh castShadow receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={[0.22, 0.16, 0.1]} />
          <meshStandardMaterial color="#EAB308" roughness={0.35} metalness={0.7} flatShading />
        </mesh>
        {/* Lock Shackle */}
        <mesh castShadow position={[0, 0.11, 0]}>
          <torusGeometry args={[0.07, 0.02, 4, 8, Math.PI]} />
          <meshStandardMaterial color="#CBD5E1" roughness={0.25} metalness={0.85} flatShading />
        </mesh>
      </group>
    </group>
  );
};

// ==========================================
// Instanced Locked Plots (GPU Instancing to keep draw calls < 200)
// ==========================================

const LOCKED_TILE_GEO = new THREE.BoxGeometry(PLOT_SIZE, 0.08, PLOT_SIZE);
const LOCKED_MOSS_GEO = new THREE.BoxGeometry(PLOT_SIZE * 0.78, 0.02, PLOT_SIZE * 0.78);
const LOCKED_BODY_GEO = new THREE.BoxGeometry(0.22, 0.16, 0.1);
const LOCKED_SHACKLE_GEO = new THREE.TorusGeometry(0.07, 0.02, 4, 8, Math.PI);

interface LockedPlotsInstancedProps {
  slots: LockedPlotSlot[];
}

export const LockedPlotsInstanced: React.FC<LockedPlotsInstancedProps> = ({ slots }) => {
  const tileRef = useRef<THREE.InstancedMesh>(null);
  const mossRef = useRef<THREE.InstancedMesh>(null);
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const shackleRef = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    if (slots.length === 0) return;

    slots.forEach((slot, i) => {
      const [x, y, z] = slot.position;

      // 1. Stone border tile
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      tileRef.current?.setMatrixAt(i, dummy.matrix);

      // 2. Moss patch
      dummy.position.set(x, y + 0.042, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mossRef.current?.setMatrixAt(i, dummy.matrix);

      // 3. Lock body
      dummy.position.set(x, y + 0.14, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bodyRef.current?.setMatrixAt(i, dummy.matrix);

      // 4. Lock shackle
      dummy.position.set(x, y + 0.25, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      shackleRef.current?.setMatrixAt(i, dummy.matrix);
    });

    if (tileRef.current) {
      tileRef.current.count = slots.length;
      tileRef.current.instanceMatrix.needsUpdate = true;
    }
    if (mossRef.current) {
      mossRef.current.count = slots.length;
      mossRef.current.instanceMatrix.needsUpdate = true;
    }
    if (bodyRef.current) {
      bodyRef.current.count = slots.length;
      bodyRef.current.instanceMatrix.needsUpdate = true;
    }
    if (shackleRef.current) {
      shackleRef.current.count = slots.length;
      shackleRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [slots, dummy]);

  if (slots.length === 0) return null;

  return (
    <group name="LockedPlotsInstanced">
      {/* 1. Stone Border Tiles */}
      <instancedMesh
        ref={tileRef}
        key={`tile-${slots.length}`}
        args={[LOCKED_TILE_GEO, undefined, slots.length]}
        count={slots.length}
        receiveShadow
      >
        <meshStandardMaterial color="#64748B" roughness={0.85} metalness={0.05} flatShading />
      </instancedMesh>

      {/* 2. Inset Grass/Moss Patches */}
      <instancedMesh
        ref={mossRef}
        key={`moss-${slots.length}`}
        args={[LOCKED_MOSS_GEO, undefined, slots.length]}
        count={slots.length}
        receiveShadow
      >
        <meshStandardMaterial color="#50D028" roughness={0.8} metalness={0.0} flatShading />
      </instancedMesh>

      {/* 3. Lock Bodies */}
      <instancedMesh
        ref={bodyRef}
        key={`body-${slots.length}`}
        args={[LOCKED_BODY_GEO, undefined, slots.length]}
        count={slots.length}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#EAB308" roughness={0.35} metalness={0.7} flatShading />
      </instancedMesh>

      {/* 4. Lock Shackles */}
      <instancedMesh
        ref={shackleRef}
        key={`shackle-${slots.length}`}
        args={[LOCKED_SHACKLE_GEO, undefined, slots.length]}
        count={slots.length}
        castShadow
      >
        <meshStandardMaterial color="#CBD5E1" roughness={0.25} metalness={0.85} flatShading />
      </instancedMesh>
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
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);

  // Expansion wave animation state
  const [waveState, setWaveState] = useState<{
    prevGridSize: number;
    newGridSize: number;
    startTime: number;
    duration: number;
  } | null>(null);

  const [animTime, setAnimTime] = useState<number>(Date.now());
  const prevGridSizeRef = useRef<number>(gridSize);

  useEffect(() => {
    if (gridSize > prevGridSizeRef.current) {
      const prev = prevGridSizeRef.current;
      const duration = getExpansionWaveDuration(prev, gridSize);
      setWaveState({
        prevGridSize: prev,
        newGridSize: gridSize,
        startTime: Date.now(),
        duration,
      });
      setAnimTime(Date.now());
    }
    prevGridSizeRef.current = gridSize;
  }, [gridSize]);

  useEffect(() => {
    if (!waveState || reducedMotion) return;

    let rafId: number;
    const updateAnim = () => {
      const now = Date.now();
      setAnimTime(now);

      if (now - waveState.startTime < waveState.duration + 50) {
        rafId = requestAnimationFrame(updateAnim);
      } else {
        setWaveState(null);
      }
    };

    rafId = requestAnimationFrame(updateAnim);
    return () => cancelAnimationFrame(rafId);
  }, [waveState, reducedMotion]);

  // Compute scale factor for a given plot based on active expansion wave
  const getPlotScale = (row: number, col: number): number => {
    if (!waveState || reducedMotion) return 1.0;
    if (!isPlotInExpansionWave(row, col, waveState.prevGridSize, waveState.newGridSize)) {
      return 1.0;
    }
    const ring = calculateExpansionRing(row, col, waveState.prevGridSize);
    return calculatePlotExpansionScale(animTime, waveState.startTime, ring);
  };

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
      <mesh receiveShadow position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[maxGridBounds.width + 0.6, maxGridBounds.depth + 0.6]} />
        <meshStandardMaterial color="#3F6E22" roughness={0.9} metalness={0.0} flatShading />
      </mesh>

      {/* Active Plot Meshes */}
      {activePlots.map(({ plot, position }) => (
        <PlotMesh
          key={plot.id}
          plot={plot}
          position={position}
          scale={getPlotScale(plot.row, plot.col)}
          isHovered={hoveredPlotId === plot.id}
          isTargeted={targetedPlotId === plot.id}
          onPlotClick={onPlotClick}
        />
      ))}

      {/* GPU-Instanced Locked Plot Markers (4 draw calls total) */}
      <LockedPlotsInstanced slots={lockedSlots} />
    </group>
  );
};
