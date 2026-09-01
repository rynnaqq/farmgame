import React, { useMemo, useRef, useEffect } from 'react';
import type * as THREE from 'three';
import { useGameStore } from '../../state/gameStore';
import { useSettingsStore } from '../../state/settingsStore';
import { WEATHER_LIGHTING } from './lightingTheme';

/**
 * World lighting component managing:
 * - Hemisphere light (sky & ground ambient reflections)
 * - Directional Sun / Moon light with fitted orthographic shadow camera
 * - Quality-aware shadow map resolution (Off / 1024 / 2048)
 * - Dynamic weather atmospheric color adjustments
 */
export const WorldLighting: React.FC = () => {
  const weather = useGameStore((state) => state.weather.current);
  const effectiveQuality = useSettingsStore((state) => state.effectiveQuality);
  const dirLightRef = useRef<THREE.DirectionalLight>(null);

  // Quality-based shadow settings
  const shadowSettings = useMemo(() => {
    switch (effectiveQuality) {
      case 'low':
        return { castShadow: false, mapSize: 0 };
      case 'medium':
        return { castShadow: true, mapSize: 1024 };
      case 'high':
      default:
        return { castShadow: true, mapSize: 2048 };
    }
  }, [effectiveQuality]);

  // Active lighting theme for weather
  const theme = WEATHER_LIGHTING[weather] || WEATHER_LIGHTING.sunny;

  // Update shadow camera bounds when directional light mounts
  useEffect(() => {
    if (dirLightRef.current && shadowSettings.castShadow) {
      const cam = dirLightRef.current.shadow.camera;
      cam.left = -16;
      cam.right = 16;
      cam.top = 16;
      cam.bottom = -16;
      cam.near = 0.5;
      cam.far = 50;
      cam.updateProjectionMatrix();
    }
  }, [shadowSettings.castShadow]);

  return (
    <group name="WorldLighting">
      {/* 1. Ambient Baseline */}
      <ambientLight
        color={theme.ambientColor}
        intensity={theme.ambientIntensity}
      />

      {/* 2. Hemisphere Sky & Ground Light */}
      <hemisphereLight
        color={theme.skyColor}
        groundColor={theme.groundColor}
        intensity={theme.hemiIntensity}
      />

      {/* 3. Directional Sun / Moon Light with Soft Shadows */}
      <directionalLight
        ref={dirLightRef}
        color={theme.dirLightColor}
        intensity={theme.dirLightIntensity}
        position={theme.dirLightPosition}
        castShadow={shadowSettings.castShadow}
        shadow-mapSize={
          shadowSettings.castShadow
            ? [shadowSettings.mapSize, shadowSettings.mapSize]
            : undefined
        }
        shadow-bias={-0.0005}
      />
    </group>
  );
};
