import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  WEATHER_VISUAL_PRESETS,
  type WeatherVisualPreset,
} from './weatherDefinitions';
import { interpolateWeatherPreset, getWeatherShadowConfig } from './weatherRendererMath';
import type { WeatherType } from '../../state/storeTypes';

describe('WeatherRenderer & Lighting Crossfades', () => {
  describe('1. Weather Visual Presets', () => {
    it('defines distinct visual presets for all 4 weather states', () => {
      const weathers: WeatherType[] = ['sunny', 'heavy_rain', 'heatwave', 'blood_moon'];
      for (const w of weathers) {
        const preset = WEATHER_VISUAL_PRESETS[w];
        expect(preset).toBeDefined();
        expect(preset.skyColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(preset.fogColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(preset.dirLightColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(preset.dirLightIntensity).toBeGreaterThan(0);
        expect(preset.fogNear).toBeLessThan(preset.fogFar);
      }
    });

    it('has sunny with bright warm sunlight and high fog distance', () => {
      const sunny = WEATHER_VISUAL_PRESETS.sunny;
      expect(sunny.dirLightIntensity).toBe(1.6);
      expect(sunny.fogNear).toBe(25);
      expect(sunny.fogFar).toBe(60);
    });

    it('has heavy rain with cooler dimmer light and closer fog', () => {
      const rain = WEATHER_VISUAL_PRESETS.heavy_rain;
      expect(rain.dirLightIntensity).toBe(0.75);
      expect(rain.fogNear).toBe(15);
      expect(rain.fogFar).toBe(45);
      expect(rain.particleType).toBe('rain');
    });

    it('has heatwave with strong amber intensity and warm fog', () => {
      const heatwave = WEATHER_VISUAL_PRESETS.heatwave;
      expect(heatwave.dirLightIntensity).toBe(2.1);
      expect(heatwave.particleType).toBe('heat_distortion');
    });

    it('has blood moon with crimson moon light and dense red fog', () => {
      const bloodMoon = WEATHER_VISUAL_PRESETS.blood_moon;
      expect(bloodMoon.dirLightColor).toBe('#E63946');
      expect(bloodMoon.fogNear).toBe(12);
      expect(bloodMoon.particleType).toBe('blood_motes');
    });
  });

  describe('2. 2-Second Transition Crossfade Interpolation', () => {
    const fromPreset: WeatherVisualPreset = WEATHER_VISUAL_PRESETS.sunny;
    const toPreset: WeatherVisualPreset = WEATHER_VISUAL_PRESETS.blood_moon;

    it('returns exact from-preset values at alpha = 0', () => {
      const result = interpolateWeatherPreset(fromPreset, toPreset, 0);
      expect(result.dirLightIntensity).toBeCloseTo(fromPreset.dirLightIntensity);
      expect(result.hemiIntensity).toBeCloseTo(fromPreset.hemiIntensity);
      expect(result.fogNear).toBeCloseTo(fromPreset.fogNear);
      expect(result.fogFar).toBeCloseTo(fromPreset.fogFar);

      const resSky = new THREE.Color(result.skyColor);
      const expectedSky = new THREE.Color(fromPreset.skyColor);
      expect(resSky.r).toBeCloseTo(expectedSky.r, 2);
      expect(resSky.g).toBeCloseTo(expectedSky.g, 2);
      expect(resSky.b).toBeCloseTo(expectedSky.b, 2);
    });

    it('interpolates numeric and color properties at alpha = 0.5 (1s into 2s transition)', () => {
      const result = interpolateWeatherPreset(fromPreset, toPreset, 0.5);

      const expectedIntensity = (fromPreset.dirLightIntensity + toPreset.dirLightIntensity) / 2;
      expect(result.dirLightIntensity).toBeCloseTo(expectedIntensity);

      const expectedFogNear = (fromPreset.fogNear + toPreset.fogNear) / 2;
      expect(result.fogNear).toBeCloseTo(expectedFogNear);

      const expectedFogFar = (fromPreset.fogFar + toPreset.fogFar) / 2;
      expect(result.fogFar).toBeCloseTo(expectedFogFar);
    });

    it('returns exact to-preset values at alpha = 1.0 (transition complete)', () => {
      const result = interpolateWeatherPreset(fromPreset, toPreset, 1.0);
      expect(result.dirLightIntensity).toBeCloseTo(toPreset.dirLightIntensity);
      expect(result.hemiIntensity).toBeCloseTo(toPreset.hemiIntensity);
      expect(result.fogNear).toBeCloseTo(toPreset.fogNear);
      expect(result.fogFar).toBeCloseTo(toPreset.fogFar);

      const resSky = new THREE.Color(result.skyColor);
      const expectedSky = new THREE.Color(toPreset.skyColor);
      expect(resSky.r).toBeCloseTo(expectedSky.r, 2);
      expect(resSky.g).toBeCloseTo(expectedSky.g, 2);
      expect(resSky.b).toBeCloseTo(expectedSky.b, 2);
    });

    it('clamps alpha cleanly outside [0, 1]', () => {
      const resNeg = interpolateWeatherPreset(fromPreset, toPreset, -0.5);
      expect(resNeg.dirLightIntensity).toBeCloseTo(fromPreset.dirLightIntensity);

      const resOver = interpolateWeatherPreset(fromPreset, toPreset, 1.5);
      expect(resOver.dirLightIntensity).toBeCloseTo(toPreset.dirLightIntensity);
    });
  });

  describe('3. Quality-Aware Shadow Map Configuration', () => {
    it('disables shadows on low quality', () => {
      const config = getWeatherShadowConfig('low');
      expect(config.castShadow).toBe(false);
      expect(config.mapSize).toBe(0);
    });

    it('uses 1024 map size on medium quality', () => {
      const config = getWeatherShadowConfig('medium');
      expect(config.castShadow).toBe(true);
      expect(config.mapSize).toBe(1024);
    });

    it('uses 2048 map size on high quality', () => {
      const config = getWeatherShadowConfig('high');
      expect(config.castShadow).toBe(true);
      expect(config.mapSize).toBe(2048);
    });
  });
});
