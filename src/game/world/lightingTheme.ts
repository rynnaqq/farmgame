import type { WeatherType } from '../../state/storeTypes';
import { WEATHER_VISUAL_PRESETS } from '../weather/weatherDefinitions';

export interface LightingTheme {
  dirLightColor: string;
  dirLightIntensity: number;
  dirLightPosition: [number, number, number];
  skyColor: string;
  groundColor: string;
  hemiIntensity: number;
  ambientColor: string;
  ambientIntensity: number;
}

function toLightingTheme(weather: WeatherType): LightingTheme {
  const preset = WEATHER_VISUAL_PRESETS[weather];
  return {
    dirLightColor: preset.dirLightColor,
    dirLightIntensity: preset.dirLightIntensity,
    dirLightPosition: preset.dirLightPosition,
    skyColor: preset.skyColor,
    groundColor: preset.groundColor,
    hemiIntensity: preset.hemiIntensity,
    ambientColor: preset.ambientColor,
    ambientIntensity: preset.ambientIntensity,
  };
}

/**
 * Single-source lighting derived from `WEATHER_VISUAL_PRESETS`.
 * Kept as a re-export shim so existing imports keep working without drift.
 */
export const WEATHER_LIGHTING: Record<WeatherType, LightingTheme> = {
  sunny: toLightingTheme('sunny'),
  heavy_rain: toLightingTheme('heavy_rain'),
  heatwave: toLightingTheme('heatwave'),
  blood_moon: toLightingTheme('blood_moon'),
};
