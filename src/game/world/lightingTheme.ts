import type { WeatherType } from '../../state/storeTypes';

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

export const WEATHER_LIGHTING: Record<WeatherType, LightingTheme> = {
  sunny: {
    dirLightColor: '#FFF8E7',
    dirLightIntensity: 1.6,
    dirLightPosition: [12, 18, 10],
    skyColor: '#87CEEB',
    groundColor: '#4A7C2C',
    hemiIntensity: 0.7,
    ambientColor: '#FFE8D6',
    ambientIntensity: 0.3,
  },
  heavy_rain: {
    dirLightColor: '#8BA3B8',
    dirLightIntensity: 0.75,
    dirLightPosition: [10, 16, 8],
    skyColor: '#5A6B7C',
    groundColor: '#3D4A38',
    hemiIntensity: 0.5,
    ambientColor: '#78909C',
    ambientIntensity: 0.25,
  },
  heatwave: {
    dirLightColor: '#FFB347',
    dirLightIntensity: 2.1,
    dirLightPosition: [14, 20, 8],
    skyColor: '#FFE4B5',
    groundColor: '#8B7355',
    hemiIntensity: 0.9,
    ambientColor: '#FFA726',
    ambientIntensity: 0.4,
  },
  blood_moon: {
    dirLightColor: '#E63946',
    dirLightIntensity: 1.2,
    dirLightPosition: [10, 15, -12],
    skyColor: '#4A1525',
    groundColor: '#220911',
    hemiIntensity: 0.4,
    ambientColor: '#880E4F',
    ambientIntensity: 0.2,
  },
};
