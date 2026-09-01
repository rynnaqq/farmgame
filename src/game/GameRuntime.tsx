import React from 'react';
import type { PlotId } from '../state/storeTypes';
import { WorldLighting } from './world/WorldLighting';
import { GardenIsland } from './world/GardenIsland';
import { SoilGrid } from './world/SoilGrid';
import { Boundaries } from './world/Boundaries';
import { Decorations } from './world/Decorations';
import { Merchant } from './world/Merchant';
import { Player } from './player/Player';
import { FollowCamera } from './camera/FollowCamera';
import type { InputManager } from './input/InputManager';

export interface GameRuntimeProps {
  onPlotClick?: (plotId: PlotId) => void;
  onPlayerFall?: () => void;
  inputManager?: InputManager;
  children?: React.ReactNode;
}

/**
 * GameRuntime coordinates the 3D scene elements inside the R3F Canvas and Physics world:
 * - Dynamic atmospheric lighting & shadow maps
 * - 28x28 floating Garden Island base mesh and landmark props
 * - Dynamic Soil Grid with active plot tiles and locked slot indicators
 * - Invisible boundary barriers and respawn killzone
 * - Low-poly environmental decorations (trees, rocks, flowers, grass)
 * - Procedural Player character with kinematic Rapier capsule controller & animation
 * - Extension slot for camera, weather particles, and pet systems
 */
export const GameRuntime: React.FC<GameRuntimeProps> = ({
  onPlotClick,
  onPlayerFall,
  inputManager,
  children,
}) => {
  return (
    <group name="GameRuntime">
      {/* 1. Atmospheric & Sun/Moon Lighting */}
      <WorldLighting />

      {/* 2. Floating Island Geometry & Landmarks */}
      <GardenIsland />

      {/* 3. Soil Farm Grid & Plots */}
      <SoilGrid onPlotClick={onPlotClick} />

      {/* 4. Island Boundaries & Respawn Sensor */}
      <Boundaries onPlayerFall={onPlayerFall} />

      {/* 5. Low-Poly Environmental Props */}
      <Decorations />

      {/* 5.1 Procedural Merchant NPC & Stall Interaction */}
      <Merchant />

      {/* 6. Procedural Player Character */}
      <Player inputManager={inputManager} onFall={onPlayerFall} />

      {/* 7. Third-Person Isometric Follow Camera with Orbit, Zoom & Collision Avoidance */}
      <FollowCamera inputManager={inputManager} />

      {/* 8. Dynamic entities & extensions (Pets, Weather, Particles, etc.) */}
      {children}
    </group>
  );
};
