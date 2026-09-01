import * as THREE from 'three';
import type { WeatherVisualPreset } from './weatherDefinitions';
import type { QualityLevel } from '../../state/storeTypes';

// ============================================================================
// Helper Pure Math Functions & Types
// ============================================================================

export interface ShadowConfig {
  castShadow: boolean;
  mapSize: number;
}

export function getWeatherShadowConfig(
  quality: QualityLevel | 'low' | 'medium' | 'high'
): ShadowConfig {
  switch (quality) {
    case 'low':
      return { castShadow: false, mapSize: 0 };
    case 'medium':
      return { castShadow: true, mapSize: 1024 };
    case 'high':
    case 'auto':
    default:
      return { castShadow: true, mapSize: 2048 };
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColorHex(colorA: string, colorB: string, t: number): string {
  const cA = new THREE.Color(colorA);
  const cB = new THREE.Color(colorB);
  cA.lerp(cB, t);
  return `#${cA.getHexString()}`;
}

export function interpolateWeatherPreset(
  from: WeatherVisualPreset,
  to: WeatherVisualPreset,
  rawAlpha: number
): WeatherVisualPreset {
  const alpha = Math.min(Math.max(rawAlpha, 0), 1);

  return {
    skyColor: lerpColorHex(from.skyColor, to.skyColor, alpha),
    groundColor: lerpColorHex(from.groundColor, to.groundColor, alpha),
    dirLightColor: lerpColorHex(from.dirLightColor, to.dirLightColor, alpha),
    dirLightIntensity: lerp(from.dirLightIntensity, to.dirLightIntensity, alpha),
    dirLightPosition: [
      lerp(from.dirLightPosition[0], to.dirLightPosition[0], alpha),
      lerp(from.dirLightPosition[1], to.dirLightPosition[1], alpha),
      lerp(from.dirLightPosition[2], to.dirLightPosition[2], alpha),
    ],
    hemiIntensity: lerp(from.hemiIntensity, to.hemiIntensity, alpha),
    ambientColor: lerpColorHex(from.ambientColor, to.ambientColor, alpha),
    ambientIntensity: lerp(from.ambientIntensity, to.ambientIntensity, alpha),
    fogColor: lerpColorHex(from.fogColor, to.fogColor, alpha),
    fogNear: lerp(from.fogNear, to.fogNear, alpha),
    fogFar: lerp(from.fogFar, to.fogFar, alpha),
    particleType: alpha >= 0.5 ? to.particleType : from.particleType,
    bloomIntensity: lerp(from.bloomIntensity ?? 0.1, to.bloomIntensity ?? 0.1, alpha),
  };
}
