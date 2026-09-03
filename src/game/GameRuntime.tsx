import React from 'react';
import type { PlotId } from '../state/storeTypes';
import { useGameStore } from '../state/gameStore';
import { useUiStore } from '../state/uiStore';
import { WeatherRenderer } from './weather/WeatherRenderer';
import { GardenIsland } from './world/GardenIsland';
import { FarmBeds } from './world/FarmBeds';
import { PlacedCrop } from './world/PlacedCrop';
import { Boundaries } from './world/Boundaries';
import { Decorations } from './world/Decorations';
import { Merchant } from './world/Merchant';
import { LeaderboardMonument } from './world/LeaderboardMonument';
import { Player } from './player/Player';
import { FollowCamera } from './camera/FollowCamera';
import { ParticlePool } from './effects/ParticlePool';
import { PostProcessing } from './effects/PostProcessing';
import { DiagnosticsPanel } from './effects/DiagnosticsPanel';
import { PetRenderer } from './pets/PetRenderer';
import { RemotePlayerRenderer } from './multiplayer/RemotePlayerRenderer';
import type { InputManager } from './input/InputManager';
import type { CropPlacement } from './world/farmLayout';

export interface GameRuntimeProps {
  onPlantAt?: (placement: CropPlacement) => void;
  onCropInteract?: (plotId: PlotId) => void;
  onPlayerFall?: () => void;
  inputManager?: InputManager;
  children?: React.ReactNode;
}

/**
 * GameRuntime coordinates the 3D scene elements inside the R3F Canvas and Physics world.
 * All farm geometry (beds, fences, crop placement) is derived from farmLayout.ts;
 * this component only composes renderers and forwards interaction callbacks.
 */
export const GameRuntime: React.FC<GameRuntimeProps> = ({
  onPlantAt,
  onCropInteract,
  onPlayerFall,
  inputManager,
  children,
}) => {
  const plots = useGameStore((state) => state.farm.plots);
  const selectedTool = useUiStore((state) => state.selectedTool);
  const plantingEnabled = selectedTool === 'seed_bag';

  return (
    <group name="GameRuntime">
      {/* 1. Atmospheric & Sun/Moon Lighting with 2s Crossfades */}
      <WeatherRenderer />

      {/* 2. Floating Island Geometry, Fences & Landmarks */}
      <GardenIsland />

      {/* 3. Four raised farm beds (free-placement soil surfaces) */}
      <FarmBeds plantingEnabled={plantingEnabled} onPlantAt={onPlantAt} />

      {/* 3.1 Crops rendered at their saved free placements */}
      {Object.values(plots).map((plot) => (
        <PlacedCrop key={plot.id} plot={plot} onCropInteract={onCropInteract} />
      ))}

      {/* 4. Island Boundaries & Respawn Sensor */}
      <Boundaries onPlayerFall={onPlayerFall} />

      {/* 5. Low-Poly Environmental Props */}
      <Decorations />

      {/* 5.1 Procedural Merchant NPC & Stall Interaction (Market, PRD §7.3) */}
      <Merchant />

      {/* 5.2 Global Top 10 Leaderboard Monument (PRD §7.12) */}
      <LeaderboardMonument />

      {/* 6. Procedural Player Character */}
      <Player inputManager={inputManager} onFall={onPlayerFall} />

      {/* 7. Third-Person Isometric Follow Camera with Orbit, Zoom & Collision Avoidance */}
      <FollowCamera inputManager={inputManager} />

      {/* 8. GPU-Instanced Particle Pool for Weather and Gameplay Bursts */}
      <ParticlePool />

      {/* 9. Quality-Aware Bloom PostProcessing */}
      <PostProcessing />

      {/* 10. Auto Quality Manager & Diagnostics Telemetry Collector */}
      <DiagnosticsPanel />

      {/* 11. Companion Pet & Incubating Egg 3D Renderer */}
      <PetRenderer />

      {/* 12. Remote Player Avatars (multiplayer presence) */}
      <RemotePlayerRenderer />

      {/* 13. Dynamic entities & extensions (Custom entities, etc.) */}
      {children}
    </group>
  );
};
