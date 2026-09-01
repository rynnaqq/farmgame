import { WEATHER_VISUAL_PRESETS } from '../weather/weatherDefinitions';
import type { WeatherType, QualityLevel } from '../../state/storeTypes';

// ============================================================================
// Types and Config Math
// ============================================================================

export interface BloomConfig {
  enabled: boolean;
  strength: number;
  radius: number;
  threshold: number;
}

/**
 * Computes bloom post-processing parameters based on quality level and weather:
 * - Low: Off (returns enabled: false)
 * - Medium: Mutations only (higher threshold 0.85, moderate strength)
 * - High: Mutations and weather (scaled with active weather preset)
 * - Respects reducedMotion by softening intensity
 */
export function getBloomConfig(
  quality: QualityLevel | 'low' | 'medium' | 'high',
  weather: WeatherType,
  reducedMotion = false
): BloomConfig {
  if (quality === 'low') {
    return {
      enabled: false,
      strength: 0,
      radius: 0,
      threshold: 1.0,
    };
  }

  const weatherPreset = WEATHER_VISUAL_PRESETS[weather] || WEATHER_VISUAL_PRESETS.sunny;
  const weatherBloom = weatherPreset.bloomIntensity ?? 0.1;

  if (quality === 'medium') {
    // Medium: mutations only
    const strength = reducedMotion ? 0.15 : 0.3;
    return {
      enabled: true,
      strength,
      radius: 0.35,
      threshold: 0.85,
    };
  }

  // High: mutations + weather
  const baseStrength = 0.35 + weatherBloom * 0.5;
  const strength = reducedMotion ? baseStrength * 0.5 : baseStrength;
  return {
    enabled: true,
    strength,
    radius: 0.4,
    threshold: 0.75,
  };
}
