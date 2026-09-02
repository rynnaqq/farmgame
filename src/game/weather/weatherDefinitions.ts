import type { WeatherType, MutationType } from '../../state/storeTypes';
import {
  WEATHER_DURATION_MIN_SEC,
  WEATHER_DURATION_MAX_SEC,
  WEATHER_DURATION_MIN_MS,
  WEATHER_DURATION_MAX_MS,
  WEATHER_TRANSITION_DURATION_SEC,
  HYDRATION_DURATION_BASIC_SEC,
  HYDRATION_DURATION_BASIC_MS,
  HYDRATION_DURATION_HEATWAVE_SEC,
  HYDRATION_DURATION_HEATWAVE_MS,
  RAIN_HYDRATION_BUFFER_SEC,
  RAIN_HYDRATION_BUFFER_MS,
} from '../core/constants';

export {
  WEATHER_DURATION_MIN_SEC,
  WEATHER_DURATION_MAX_SEC,
  WEATHER_DURATION_MIN_MS,
  WEATHER_DURATION_MAX_MS,
  WEATHER_TRANSITION_DURATION_SEC,
  HYDRATION_DURATION_BASIC_SEC,
  HYDRATION_DURATION_BASIC_MS,
  HYDRATION_DURATION_HEATWAVE_SEC,
  HYDRATION_DURATION_HEATWAVE_MS,
  RAIN_HYDRATION_BUFFER_SEC,
  RAIN_HYDRATION_BUFFER_MS,
};

export const WEATHER_TRANSITION_DURATION_MS = WEATHER_TRANSITION_DURATION_SEC * 1000;
export const INITIAL_WEATHER: WeatherType = 'sunny';

export interface WeatherDefinition {
  id: WeatherType;
  name: string;
  weight: number;
  growthMultiplier: number;
  mutationType: MutationType;
  mutationChance: number;
  manualWaterDurationSec: number;
  description: string;
}

export const WEATHER_CONFIGS: Record<WeatherType, WeatherDefinition> = {
  sunny: {
    id: 'sunny',
    name: 'Sunny',
    weight: 45,
    growthMultiplier: 1.0,
    mutationType: 'gold',
    mutationChance: 0.05,
    manualWaterDurationSec: 120,
    description: 'Blue sky, warm sun, soft clouds',
  },
  heavy_rain: {
    id: 'heavy_rain',
    name: 'Heavy Rain',
    weight: 30,
    growthMultiplier: 1.15,
    mutationType: 'giant',
    mutationChance: 0.08,
    manualWaterDurationSec: 120,
    description: 'Dark sky, rain pool, splashes, cooler light',
  },
  heatwave: {
    id: 'heatwave',
    name: 'Heatwave',
    weight: 15,
    growthMultiplier: 1.25,
    mutationType: 'gold',
    mutationChance: 0.08,
    manualWaterDurationSec: 60,
    description: 'Warm haze, heat distortion, strong amber light',
  },
  blood_moon: {
    id: 'blood_moon',
    name: 'Blood Moon',
    weight: 10,
    growthMultiplier: 1.05,
    mutationType: 'cosmic',
    mutationChance: 0.03,
    manualWaterDurationSec: 120,
    description: 'Red moon, crimson fog, drifting motes',
  },
} as const;

export interface WeatherVisualPreset {
  skyColor: string;
  groundColor: string;
  dirLightColor: string;
  dirLightIntensity: number;
  dirLightPosition: [number, number, number];
  hemiIntensity: number;
  ambientColor: string;
  ambientIntensity: number;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  particleType: 'rain' | 'heat_distortion' | 'blood_motes' | 'none';
  bloomIntensity?: number;
}

export const WEATHER_VISUAL_PRESETS: Record<WeatherType, WeatherVisualPreset> = {
  sunny: {
    skyColor: '#5BC7F5',
    groundColor: '#52D12B',
    dirLightColor: '#FFFBF0',
    dirLightIntensity: 1.6,
    dirLightPosition: [12, 18, 10],
    hemiIntensity: 0.8,
    ambientColor: '#E6F4FF',
    ambientIntensity: 0.38,
    fogColor: '#6DD4FB',
    fogNear: 25,
    fogFar: 60,
    particleType: 'none',
    bloomIntensity: 0.12,
  },
  heavy_rain: {
    skyColor: '#5A6B7C',
    groundColor: '#3D4A38',
    dirLightColor: '#8BA3B8',
    dirLightIntensity: 0.75,
    dirLightPosition: [10, 16, 8],
    hemiIntensity: 0.5,
    ambientColor: '#78909C',
    ambientIntensity: 0.25,
    fogColor: '#5A6B7C',
    fogNear: 15,
    fogFar: 45,
    particleType: 'rain',
    bloomIntensity: 0.05,
  },
  heatwave: {
    skyColor: '#FFE4B5',
    groundColor: '#8B7355',
    dirLightColor: '#FFB347',
    dirLightIntensity: 2.1,
    dirLightPosition: [14, 20, 8],
    hemiIntensity: 0.9,
    ambientColor: '#FFA726',
    ambientIntensity: 0.4,
    fogColor: '#FFCC80',
    fogNear: 20,
    fogFar: 50,
    particleType: 'heat_distortion',
    bloomIntensity: 0.25,
  },
  blood_moon: {
    skyColor: '#4A1525',
    groundColor: '#220911',
    dirLightColor: '#E63946',
    dirLightIntensity: 1.2,
    dirLightPosition: [10, 15, -12],
    hemiIntensity: 0.4,
    ambientColor: '#880E4F',
    ambientIntensity: 0.2,
    fogColor: '#3B0918',
    fogNear: 12,
    fogFar: 40,
    particleType: 'blood_motes',
    bloomIntensity: 0.4,
  },
} as const;

export const ALL_WEATHER_TYPES: readonly WeatherType[] = [
  'sunny',
  'heavy_rain',
  'heatwave',
  'blood_moon',
] as const;
