import React, { useCallback } from 'react';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { ISLAND_FALL_Y_THRESHOLD, PLAYER_SPAWN_POSITION } from '../core/constants';
import { useGameStore } from '../../state/gameStore';

export interface BoundariesProps {
  onPlayerFall?: () => void;
}

/**
 * Invisible Rapier boundary colliders:
 * - 4 perimeter walls around the 28x28 island edge to prevent walking off cliffs.
 * - Y = -5 fall safety / killzone trigger to respawn the player if they ever fall below.
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

  return (
    <group name="WorldBoundaries">
      {/* 4 Invisible Perimeter Walls */}
      <RigidBody type="fixed" colliders={false} name="PerimeterWalls">
        {/* North Wall (Z = -14.2) */}
        <CuboidCollider args={[15, 4.0, 0.4]} position={[0, 3.5, -14.2]} />
        {/* South Wall (Z = 14.2) */}
        <CuboidCollider args={[15, 4.0, 0.4]} position={[0, 3.5, 14.2]} />
        {/* East Wall (X = 14.2) */}
        <CuboidCollider args={[0.4, 4.0, 15]} position={[14.2, 3.5, 0]} />
        {/* West Wall (X = -14.2) */}
        <CuboidCollider args={[0.4, 4.0, 15]} position={[-14.2, 3.5, 0]} />
      </RigidBody>

      {/* Safety / Respawn Sensor at Y = -5 */}
      <RigidBody
        type="fixed"
        colliders={false}
        sensor
        name="FallKillzone"
        onIntersectionEnter={handleKillzoneIntersection}
      >
        <CuboidCollider args={[40, 0.5, 40]} position={[0, ISLAND_FALL_Y_THRESHOLD, 0]} sensor />
      </RigidBody>
    </group>
  );
};
