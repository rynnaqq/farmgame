import { describe, it, expect } from 'vitest';
import { getBloomConfig } from './postProcessingMath';
import type { WeatherType } from '../../state/storeTypes';

describe('PostProcessing & Quality-Aware Bloom', () => {
  describe('getBloomConfig()', () => {
    it('disables bloom entirely when quality is low', () => {
      const config = getBloomConfig('low', 'sunny');
      expect(config.enabled).toBe(false);
      expect(config.strength).toBe(0);
    });

    it('enables mutations-only bloom on medium quality with higher threshold (0.85)', () => {
      const config = getBloomConfig('medium', 'sunny');
      expect(config.enabled).toBe(true);
      expect(config.threshold).toBe(0.85);
      expect(config.strength).toBeCloseTo(0.3);
    });

    it('enables mutations + weather bloom on high quality with lower threshold (0.75)', () => {
      const configSunny = getBloomConfig('high', 'sunny');
      const configBloodMoon = getBloomConfig('high', 'blood_moon');

      expect(configSunny.enabled).toBe(true);
      expect(configSunny.threshold).toBe(0.75);

      // Blood Moon has higher bloom intensity preset (0.4) than Sunny (0.1)
      expect(configBloodMoon.strength).toBeGreaterThan(configSunny.strength);
    });

    it('reduces bloom strength when reducedMotion is active', () => {
      const normalConfig = getBloomConfig('high', 'heatwave', false);
      const reducedConfig = getBloomConfig('high', 'heatwave', true);

      expect(reducedConfig.enabled).toBe(true);
      expect(reducedConfig.strength).toBeLessThan(normalConfig.strength);
    });

    it('handles all weather types gracefully on high quality', () => {
      const weathers: WeatherType[] = ['sunny', 'heavy_rain', 'heatwave', 'blood_moon'];
      for (const w of weathers) {
        const config = getBloomConfig('high', w);
        expect(config.enabled).toBe(true);
        expect(config.strength).toBeGreaterThan(0);
      }
    });
  });
});
