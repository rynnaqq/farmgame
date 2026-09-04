import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../state/gameStore';
import { useSettingsStore } from '../../state/settingsStore';
import { WEATHER_VISUAL_PRESETS, WEATHER_TRANSITION_DURATION_MS } from './weatherDefinitions';
import { interpolateWeatherPreset, getWeatherShadowConfig } from './weatherRendererMath';
import type { WeatherType } from '../../state/storeTypes';
import { audioManager } from '../audio/AudioManager';

/**
 * WeatherRenderer coordinates the dynamic 3D atmospheric environment:
 * - 2-second crossfades for sky gradient / background, fog density and colors, and lighting.
 * - Directional Sun / Moon lighting with fitted orthographic soft shadow camera.
 * - Quality-aware shadow maps.
 * - Hemisphere light (sky & ground reflection) and ambient lighting.
 * - Scene background and fog integration.
 */
export const WeatherRenderer: React.FC = () => {
  const { scene } = useThree();
  const currentWeather = useGameStore((state) => state.weather.current);
  const effectiveQuality = useSettingsStore((state) => state.effectiveQuality);

  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);

  // Transition tracking state
  const prevWeatherRef = useRef<WeatherType>(currentWeather);
  const targetWeatherRef = useRef<WeatherType>(currentWeather);
  const transitionStartRef = useRef<number>(performance.now());
  const isTransitioningRef = useRef<boolean>(false);

  // Reusable THREE objects for zero per-frame allocation
  const tempSkyColor = useMemo(() => new THREE.Color(), []);
  const tempGroundColor = useMemo(() => new THREE.Color(), []);
  const tempDirColor = useMemo(() => new THREE.Color(), []);
  const tempAmbientColor = useMemo(() => new THREE.Color(), []);
  const tempFogColor = useMemo(() => new THREE.Color(), []);

  // Shadow configuration
  const shadowConfig = useMemo(() => getWeatherShadowConfig(effectiveQuality), [effectiveQuality]);

  // Detect weather changes and trigger 2-second crossfade & audio ambience
  useEffect(() => {
    audioManager.setWeatherAmbience(currentWeather, 2.0);
    if (currentWeather !== targetWeatherRef.current) {
      audioManager.playSfx('weather_change');
      prevWeatherRef.current = targetWeatherRef.current;
      targetWeatherRef.current = currentWeather;
      transitionStartRef.current = performance.now();
      isTransitioningRef.current = true;
    }
  }, [currentWeather]);

  // Configure directional shadow camera bounds.
  // Tight fit over the farm + near decorations (±12): at 1024px this is
  // ~2.3cm/texel instead of ~3.1cm, calming acne on the thin soil stack.
  // Distant landmarks (merchant/monument) intentionally fall outside.
  useEffect(() => {
    if (dirLightRef.current && shadowConfig.castShadow) {
      const cam = dirLightRef.current.shadow.camera;
      cam.left = -12;
      cam.right = 12;
      cam.top = 12;
      cam.bottom = -12;
      cam.near = 0.5;
      cam.far = 60;
      cam.updateProjectionMatrix();
    }
  }, [shadowConfig.castShadow]);

  // Initial fog & background setup
  useEffect(() => {
    const initialPreset = WEATHER_VISUAL_PRESETS[currentWeather] || WEATHER_VISUAL_PRESETS.sunny;
    if (!scene.fog) {
      scene.fog = new THREE.Fog(
        initialPreset.fogColor,
        initialPreset.fogNear,
        initialPreset.fogFar
      );
    }
    if (!scene.background) {
      scene.background = new THREE.Color(initialPreset.skyColor);
    }
  }, [scene, currentWeather]);

  // Per-frame crossfade update
  useFrame(() => {
    const now = performance.now();
    let alpha = 1.0;

    if (isTransitioningRef.current) {
      const elapsed = now - transitionStartRef.current;
      alpha = Math.min(Math.max(elapsed / WEATHER_TRANSITION_DURATION_MS, 0), 1);
      if (alpha >= 1.0) {
        isTransitioningRef.current = false;
        prevWeatherRef.current = targetWeatherRef.current;
      }
    }

    const fromPreset =
      WEATHER_VISUAL_PRESETS[prevWeatherRef.current] || WEATHER_VISUAL_PRESETS.sunny;
    const toPreset =
      WEATHER_VISUAL_PRESETS[targetWeatherRef.current] || WEATHER_VISUAL_PRESETS.sunny;

    const interpolated = isTransitioningRef.current
      ? interpolateWeatherPreset(fromPreset, toPreset, alpha)
      : toPreset;

    // 1. Update Directional Sun / Moon light
    if (dirLightRef.current) {
      tempDirColor.set(interpolated.dirLightColor);
      dirLightRef.current.color.copy(tempDirColor);
      dirLightRef.current.intensity = interpolated.dirLightIntensity;
      dirLightRef.current.position.set(
        interpolated.dirLightPosition[0],
        interpolated.dirLightPosition[1],
        interpolated.dirLightPosition[2]
      );
    }

    // 2. Update Hemisphere sky & ground light
    if (hemiLightRef.current) {
      tempSkyColor.set(interpolated.skyColor);
      tempGroundColor.set(interpolated.groundColor);
      hemiLightRef.current.color.copy(tempSkyColor);
      hemiLightRef.current.groundColor.copy(tempGroundColor);
      hemiLightRef.current.intensity = interpolated.hemiIntensity;
    }

    // 3. Update Ambient light
    if (ambientLightRef.current) {
      tempAmbientColor.set(interpolated.ambientColor);
      ambientLightRef.current.color.copy(tempAmbientColor);
      ambientLightRef.current.intensity = interpolated.ambientIntensity;
    }

    // 4. Update Scene Fog & Background
    if (scene.fog && scene.fog instanceof THREE.Fog) {
      tempFogColor.set(interpolated.fogColor);
      scene.fog.color.copy(tempFogColor);
      scene.fog.near = interpolated.fogNear;
      scene.fog.far = interpolated.fogFar;
    }
    if (scene.background && scene.background instanceof THREE.Color) {
      tempSkyColor.set(interpolated.skyColor);
      scene.background.copy(tempSkyColor);
    }
  });

  const activePreset = WEATHER_VISUAL_PRESETS[currentWeather] || WEATHER_VISUAL_PRESETS.sunny;

  return (
    <group name="WeatherRenderer">
      {/* 1. Ambient Baseline */}
      <ambientLight
        ref={ambientLightRef}
        color={activePreset.ambientColor}
        intensity={activePreset.ambientIntensity}
      />

      {/* 2. Hemisphere Sky & Ground Light */}
      <hemisphereLight
        ref={hemiLightRef}
        color={activePreset.skyColor}
        groundColor={activePreset.groundColor}
        intensity={activePreset.hemiIntensity}
      />

      {/* 3. Directional Sun / Moon Light with Soft Shadows */}
      <directionalLight
        ref={dirLightRef}
        color={activePreset.dirLightColor}
        intensity={activePreset.dirLightIntensity}
        position={activePreset.dirLightPosition}
        castShadow={shadowConfig.castShadow}
        shadow-mapSize={
          shadowConfig.castShadow ? [shadowConfig.mapSize, shadowConfig.mapSize] : undefined
        }
        shadow-bias={-0.0005}
        shadow-normalBias={0.01}
      />
    </group>
  );
};
