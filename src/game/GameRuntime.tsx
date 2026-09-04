import React, { useMemo } from 'react';
import type { PlotId } from '../state/storeTypes';
import { WeatherRenderer } from './weather/WeatherRenderer';
import { GardenIsland } from './world/GardenIsland';
import { FarmBeds, type FarmSoilPoint } from './world/FarmBeds';
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
import { getGameMode } from './core/gameMode';
import type { InputManager } from './input/InputManager';

export interface GameRuntimeProps {
  onSoilClick?: (point: FarmSoilPoint) => void;
  onPlotClick?: (plotId: PlotId) => void;
  onPlayerFall?: () => void;
  inputManager?: InputManager;
  children?: React.ReactNode;
}

/**
 * GameRuntime coordinates the 3D scene elements inside the R3F Canvas and Physics world:
 * - Dynamic atmospheric lighting & 2-second weather crossfades
 * - 28x28 floating Garden Island base mesh and landmark props
 * - Free-placement farm beds with per-crop soil tiles (no tile grid)
 * - Invisible boundary barriers and respawn killzone
 * - Low-poly environmental decorations (trees, rocks, flowers, grass)
 * - Procedural Player character with kinematic Rapier capsule controller & animation
 * - Third-Person Isometric Follow Camera with collision avoidance
 * - GPU Instanced Particle Pool for rain, heat haze, blood motes, and gameplay bursts
 * - Quality-aware PostProcessing bloom
 * - Auto Quality Manager & Three.js telemetry monitoring
 * - Extension slot for pet systems and custom dynamic entities
 */
export const GameRuntime: React.FC<GameRuntimeProps> = ({
  onSoilClick,
  onPlotClick,
  onPlayerFall,
  inputManager,
  children,
}) => {
  // Verdant-only backends (leaderboard service, multiplayer room) must never
  // instantiate in local mode: their singletons throw MissingEnvError without
  // Supabase env vars and would crash render (they fetch in useMemo/effects).
  const isVerdant = useMemo(() => getGameMode() === 'verdant', []);

  return (
    <group name="GameRuntime">
      {/* 1. Atmospheric & Sun/Moon Lighting with 2s Crossfades */}
      <WeatherRenderer />

      {/* 2. Floating Island Geometry & Landmarks */}
      <GardenIsland />

      {/* 3. Free-Placement Farm Beds & Crops */}
      <FarmBeds onSoilClick={onSoilClick} onPlotClick={onPlotClick} />

      {/* 4. Island Boundaries & Respawn Sensor */}
      <Boundaries onPlayerFall={onPlayerFall} />

      {/* 5. Low-Poly Environmental Props */}
      <Decorations />

      {/* 5.1 Procedural Merchant NPC & Stall Interaction (Market, PRD §7.3) */}
      <Merchant />

      {/* 5.2 Global Top 10 Leaderboard Monument (verdant-only) */}
      {isVerdant && <LeaderboardMonument />}

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

      {/* 12. Remote Player Avatars (verdant multiplayer presence only) */}
      {isVerdant && <RemotePlayerRenderer />}

      {/* 13. Dynamic entities & extensions (Custom entities, etc.) */}
      {children}
    </group>
  );
};
