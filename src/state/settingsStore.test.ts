import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSettingsStore, resetSettingsStore, SETTINGS_STORAGE_KEY } from './settingsStore';

describe('useSettingsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    resetSettingsStore();
  });

  describe('Initial State', () => {
    it('initializes with default settings', () => {
      const state = useSettingsStore.getState();
      expect(state.masterVolume).toBe(0.8);
      expect(state.musicVolume).toBe(0.6);
      expect(state.sfxVolume).toBe(0.8);
      expect(state.muted).toBe(false);
      expect(state.quality).toBe('auto');
      expect(state.effectiveQuality).toBe('medium');
      expect(state.haptics).toBe(true);
      expect(state.inputMode).toBe('auto');
      expect(state.cameraSensitivity).toBe(1.0);
      expect(state.invertY).toBe(false);
    });
  });

  describe('Volume & Audio Actions', () => {
    it('sets master volume clamped to [0, 1]', () => {
      useSettingsStore.getState().setMasterVolume(0.5);
      expect(useSettingsStore.getState().masterVolume).toBe(0.5);

      useSettingsStore.getState().setMasterVolume(1.5);
      expect(useSettingsStore.getState().masterVolume).toBe(1.0);

      useSettingsStore.getState().setMasterVolume(-0.2);
      expect(useSettingsStore.getState().masterVolume).toBe(0.0);
    });

    it('sets music and sfx volumes clamped', () => {
      useSettingsStore.getState().setMusicVolume(0.3);
      expect(useSettingsStore.getState().musicVolume).toBe(0.3);

      useSettingsStore.getState().setSfxVolume(0.7);
      expect(useSettingsStore.getState().sfxVolume).toBe(0.7);
    });

    it('toggles mute', () => {
      useSettingsStore.getState().setMuted(true);
      expect(useSettingsStore.getState().muted).toBe(true);
    });
  });

  describe('Quality & Display Actions', () => {
    it('sets quality preset and adjusts effective quality', () => {
      useSettingsStore.getState().setQuality('high');
      expect(useSettingsStore.getState().quality).toBe('high');
      expect(useSettingsStore.getState().effectiveQuality).toBe('high');

      useSettingsStore.getState().setQuality('low');
      expect(useSettingsStore.getState().quality).toBe('low');
      expect(useSettingsStore.getState().effectiveQuality).toBe('low');

      useSettingsStore.getState().setQuality('auto');
      expect(useSettingsStore.getState().quality).toBe('auto');
      useSettingsStore.getState().setEffectiveQuality('low');
      expect(useSettingsStore.getState().effectiveQuality).toBe('low');
    });

    it('toggles reduced motion and haptics', () => {
      useSettingsStore.getState().setReducedMotion(true);
      expect(useSettingsStore.getState().reducedMotion).toBe(true);

      useSettingsStore.getState().setHaptics(false);
      expect(useSettingsStore.getState().haptics).toBe(false);
    });
  });

  describe('Input & Camera Controls', () => {
    it('sets inputMode', () => {
      useSettingsStore.getState().setInputMode('touch');
      expect(useSettingsStore.getState().inputMode).toBe('touch');

      useSettingsStore.getState().setInputMode('desktop');
      expect(useSettingsStore.getState().inputMode).toBe('desktop');
    });

    it('sets camera sensitivity clamped', () => {
      useSettingsStore.getState().setCameraSensitivity(2.0);
      expect(useSettingsStore.getState().cameraSensitivity).toBe(2.0);

      useSettingsStore.getState().setCameraSensitivity(10.0);
      expect(useSettingsStore.getState().cameraSensitivity).toBe(5.0);

      useSettingsStore.getState().setCameraSensitivity(0.01);
      expect(useSettingsStore.getState().cameraSensitivity).toBe(0.2);
    });

    it('toggles invertY', () => {
      useSettingsStore.getState().setInvertY(true);
      expect(useSettingsStore.getState().invertY).toBe(true);
    });
  });

  describe('LocalStorage Persistence', () => {
    it('persists settings to localStorage upon mutation', () => {
      useSettingsStore.getState().setMasterVolume(0.42);
      useSettingsStore.getState().setQuality('high');

      const savedJson = localStorage.getItem(SETTINGS_STORAGE_KEY);
      expect(savedJson).not.toBeNull();
      const parsed = JSON.parse(savedJson!);
      expect(parsed.masterVolume).toBe(0.42);
      expect(parsed.quality).toBe('high');
    });

    it('loads saved settings from localStorage upon reset or initialization', () => {
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({
          masterVolume: 0.15,
          musicVolume: 0.25,
          quality: 'low',
          invertY: true,
        })
      );

      resetSettingsStore();

      const state = useSettingsStore.getState();
      expect(state.masterVolume).toBe(0.15);
      expect(state.musicVolume).toBe(0.25);
      expect(state.quality).toBe('low');
      expect(state.effectiveQuality).toBe('low');
      expect(state.invertY).toBe(true);
      expect(state.sfxVolume).toBe(0.8); // default preserved for missing keys
    });

    it('handles corrupted localStorage JSON gracefully without throwing', () => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, '{ invalid json');

      expect(() => resetSettingsStore()).not.toThrow();
      expect(useSettingsStore.getState().masterVolume).toBe(0.8);
    });

    it('handles localStorage throw errors (e.g. quota exceeded) safely', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => useSettingsStore.getState().setMasterVolume(0.5)).not.toThrow();
      expect(useSettingsStore.getState().masterVolume).toBe(0.5);

      setItemSpy.mockRestore();
    });
  });
});
