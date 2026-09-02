import React, { useCallback } from 'react';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { ISLAND_FALL_Y_THRESHOLD, ISLAND_SIZE, PLAYER_SPAWN_POSITION } from '../core/constants';
import { useGameStore } from '../../state/gameStore';

export interface BoundariesProps {
  onPlayerFall?: () => void;
}

/**
 * Invisible Rapier boundary colliders:
 * - 4 perimeter walls around the island edge to prevent walking off cliffs.
 * - Y = -5 fall safety / killzone trigger to respawn the player if they ever fall below.
 * Collision geometry stays simpler than visual geometry (PRD §7.3).
 */
export const Boundaries: React.FC<BoundariesProps> = ({ onPlayerFall }) => {
  const setPlayerPosition = useGameStore((state) => state.setPlayerPosition);

  const handleKillzoneIntersection = useCallback(() => {
    // Respawn player to spawn coordinates safely
    setPlayerPosition([
      PLAYER_SPAWN_POSITION[0],
      PLAYER_SPAWN_POSITION[1],
      PLAYER_SPAWN_POSITION[2],
    ]);
    onPlayerFall?.();
  }, [setPlayerPosition, onPlayerFall]);

  const half = ISLAND_SIZE / 2;
  const wallInset = 0.2;
  const wallXZ = half + wallInset;
  const wallSpan = half + 1;

  return (
    <group name="WorldBoundaries">
      {/* 4 Invisible Perimeter Walls */}
      <RigidBody type="fixed" colliders={false} name="PerimeterWalls">
        {/* North Wall (Z = -half) */}
        <CuboidCollider args={[wallSpan, 4.0, 0.4]} position={[0, 3.5, -wallXZ]} />
        {/* South Wall (Z = +half) */}
        <CuboidCollider args={[wallSpan, 4.0, 0.4]} position={[0, 3.5, wallXZ]} />
        {/* East Wall (X = +half) */}
        <CuboidCollider args={[0.4, 4.0, wallSpan]} position={[wallXZ, 3.5, 0]} />
        {/* West Wall (X = -half) */}
        <CuboidCollider args={[0.4, 4.0, wallSpan]} position={[-wallXZ, 3.5, 0]} />
      </RigidBody>

      {/* Safety / Respawn Sensor at Y = -5 */}
      <RigidBody
        type="fixed"
        colliders={false}
        sensor
        name="FallKillzone"
        onIntersectionEnter={handleKillzoneIntersection}
      >
        <CuboidCollider args={[half + 8, 0.5, half + 8]} position={[0, ISLAND_FALL_Y_THRESHOLD, 0]} sensor />
      </RigidBody>
    </group>
  );
};
