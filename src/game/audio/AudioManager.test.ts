import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioManager, createAudioManager, type SfxType } from './AudioManager';
import {
  createNoiseBuffer,
  synthesizeTill,
  synthesizeWater,
  synthesizePlant,
  synthesizeHarvest,
  synthesizeCoin,
  synthesizeMutation,
  synthesizeWeatherChange,
  synthesizeEggHatch,
  synthesizeUiClick,
  synthesizeError,
  createWeatherAmbienceNode,
} from './audioSynthesizer';
import { useSettingsStore, resetSettingsStore } from '../../state/settingsStore';
import type { WeatherType, MutationType } from '../../state/storeTypes';

/**
 * Creates a robust mock Web Audio API context for Vitest.
 */
function createMockAudioContext() {
  const audioContext = {
    state: 'suspended' as AudioContextState,
    currentTime: 0,
    sampleRate: 44100,
    destination: {
      channelCount: 2,
    },
    resume: vi.fn(async () => {
      audioContext.state = 'running';
    }),
    suspend: vi.fn(async () => {
      audioContext.state = 'suspended';
    }),
    close: vi.fn(async () => {
      audioContext.state = 'closed';
    }),
    createGain: vi.fn(() => {
      const gainNode = {
        gain: {
          value: 1,
          setValueAtTime: vi.fn((val: number, _time: number) => {
            gainNode.gain.value = val;
          }),
          linearRampToValueAtTime: vi.fn((val: number, _time: number) => {
            gainNode.gain.value = val;
          }),
          exponentialRampToValueAtTime: vi.fn((val: number, _time: number) => {
            gainNode.gain.value = val;
          }),
          setTargetAtTime: vi.fn((val: number, _time: number, _tc: number) => {
            gainNode.gain.value = val;
          }),
          cancelScheduledValues: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      return gainNode;
    }),
    createOscillator: vi.fn(() => {
      const oscNode = {
        type: 'sine' as OscillatorType,
        frequency: {
          value: 440,
          setValueAtTime: vi.fn((val: number) => {
            oscNode.frequency.value = val;
          }),
          linearRampToValueAtTime: vi.fn((val: number) => {
            oscNode.frequency.value = val;
          }),
          exponentialRampToValueAtTime: vi.fn((val: number) => {
            oscNode.frequency.value = val;
          }),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
      };
      return oscNode;
    }),
    createBiquadFilter: vi.fn(() => {
      const filterNode = {
        type: 'lowpass' as BiquadFilterType,
        frequency: {
          value: 350,
          setValueAtTime: vi.fn((val: number) => {
            filterNode.frequency.value = val;
          }),
          linearRampToValueAtTime: vi.fn((val: number) => {
            filterNode.frequency.value = val;
          }),
          exponentialRampToValueAtTime: vi.fn((val: number) => {
            filterNode.frequency.value = val;
          }),
        },
        Q: {
          value: 1,
          setValueAtTime: vi.fn((val: number) => {
            filterNode.Q.value = val;
          }),
        },
        gain: {
          value: 0,
          setValueAtTime: vi.fn((val: number) => {
            filterNode.gain.value = val;
          }),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      return filterNode;
    }),
    createBuffer: vi.fn((channels: number, length: number, sampleRate: number) => {
      const channelData = new Array(channels)
        .fill(null)
        .map(() => new Float32Array(length));
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        duration: length / sampleRate,
        getChannelData: vi.fn((c: number) => channelData[c] ?? channelData[0]),
      };
    }),
    createBufferSource: vi.fn(() => {
      const sourceNode = {
        buffer: null as unknown,
        loop: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
      };
      return sourceNode;
    }),
  };

  return audioContext;
}

describe('Web Audio Engine & Synthesizer', () => {
  let mockCtx: ReturnType<typeof createMockAudioContext>;

  beforeEach(() => {
    resetSettingsStore();
    mockCtx = createMockAudioContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('audioSynthesizer Pure Functions', () => {
    it('createNoiseBuffer generates non-empty audio buffer with random float values', () => {
      const buffer = createNoiseBuffer(mockCtx as unknown as AudioContext, 0.5, 'white');
      expect(mockCtx.createBuffer).toHaveBeenCalledWith(1, expect.any(Number), 44100);
      expect(buffer.length).toBeGreaterThan(0);
      const data = buffer.getChannelData(0);
      expect(data.length).toBeGreaterThan(0);
    });

    it('synthesizeTill creates low frequency oscillator and bandpass noise burst', () => {
      const dest = mockCtx.createGain();
      synthesizeTill(mockCtx as unknown as AudioContext, dest as unknown as AudioNode);
      expect(mockCtx.createOscillator).toHaveBeenCalled();
      expect(mockCtx.createBiquadFilter).toHaveBeenCalled();
      expect(mockCtx.createBufferSource).toHaveBeenCalled();
    });

    it('synthesizeWater generates bubbling chirps and filtered noise', () => {
      const dest = mockCtx.createGain();
      synthesizeWater(mockCtx as unknown as AudioContext, dest as unknown as AudioNode);
      expect(mockCtx.createOscillator).toHaveBeenCalled();
      expect(mockCtx.createGain).toHaveBeenCalled();
    });

    it('synthesizePlant generates crisp rustle noise and click', () => {
      const dest = mockCtx.createGain();
      synthesizePlant(mockCtx as unknown as AudioContext, dest as unknown as AudioNode);
      expect(mockCtx.createBufferSource).toHaveBeenCalled();
      expect(mockCtx.createBiquadFilter).toHaveBeenCalled();
    });

    it('synthesizeHarvest generates pluck pop and resonant chime harmonic', () => {
      const dest = mockCtx.createGain();
      synthesizeHarvest(mockCtx as unknown as AudioContext, dest as unknown as AudioNode);
      expect(mockCtx.createOscillator).toHaveBeenCalled();
      expect(mockCtx.createGain).toHaveBeenCalled();
    });

    it('synthesizeCoin creates dual sequential metallic chime pings (B5 and E6)', () => {
      const dest = mockCtx.createGain();
      synthesizeCoin(mockCtx as unknown as AudioContext, dest as unknown as AudioNode);
      // Twin chime creates at least two oscillator sources
      expect(mockCtx.createOscillator.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('synthesizeMutation handles gold, giant, and cosmic flourish variations', () => {
      const dest = mockCtx.createGain();
      const variations: MutationType[] = ['gold', 'giant', 'cosmic'];

      for (const variant of variations) {
        mockCtx.createOscillator.mockClear();
        synthesizeMutation(
          mockCtx as unknown as AudioContext,
          dest as unknown as AudioNode,
          variant
        );
        expect(mockCtx.createOscillator.mock.calls.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('synthesizeWeatherChange creates sweeping filter wind whoosh', () => {
      const dest = mockCtx.createGain();
      synthesizeWeatherChange(mockCtx as unknown as AudioContext, dest as unknown as AudioNode);
      expect(mockCtx.createBufferSource).toHaveBeenCalled();
      expect(mockCtx.createBiquadFilter).toHaveBeenCalled();
    });

    it('synthesizeEggHatch creates snap pop and cute rising chirp', () => {
      const dest = mockCtx.createGain();
      synthesizeEggHatch(mockCtx as unknown as AudioContext, dest as unknown as AudioNode);
      expect(mockCtx.createOscillator).toHaveBeenCalled();
      expect(mockCtx.createBufferSource).toHaveBeenCalled();
    });

    it('synthesizeUiClick creates clean micro-tick burst', () => {
      const dest = mockCtx.createGain();
      synthesizeUiClick(mockCtx as unknown as AudioContext, dest as unknown as AudioNode);
      expect(mockCtx.createOscillator).toHaveBeenCalled();
    });

    it('synthesizeError creates low pitch-drop thud', () => {
      const dest = mockCtx.createGain();
      synthesizeError(mockCtx as unknown as AudioContext, dest as unknown as AudioNode);
      expect(mockCtx.createOscillator).toHaveBeenCalled();
    });

    it('createWeatherAmbienceNode creates looped ambience generator for each weather type', () => {
      const dest = mockCtx.createGain();
      const weathers: WeatherType[] = ['sunny', 'heavy_rain', 'heatwave', 'blood_moon'];

      for (const w of weathers) {
        const ambience = createWeatherAmbienceNode(
          mockCtx as unknown as AudioContext,
          dest as unknown as AudioNode,
          w
        );
        expect(ambience).toHaveProperty('gainNode');
        expect(typeof ambience.stop).toBe('function');
        ambience.stop();
      }
    });
  });

  describe('AudioManager Class & Lifecycle', () => {
    let manager: AudioManager;

    beforeEach(() => {
      manager = createAudioManager({
        audioContextFactory: () => mockCtx as unknown as AudioContext,
      });
    });

    afterEach(() => {
      manager.dispose();
    });

    it('gracefully handles environments without Web Audio API support', () => {
      const fallbackManager = createAudioManager({
        audioContextFactory: () => {
          throw new Error('AudioContext not supported in this environment');
        },
      });

      expect(fallbackManager.isSupported).toBe(false);
      expect(fallbackManager.isUnlocked).toBe(false);

      // Calling methods should not crash
      expect(() => fallbackManager.init()).not.toThrow();
      expect(() => fallbackManager.playSfx('till')).not.toThrow();
      expect(() => fallbackManager.setWeatherAmbience('sunny')).not.toThrow();
      expect(() =>
        fallbackManager.syncSettings({
          masterVolume: 1,
          sfxVolume: 1,
          musicVolume: 1,
          muted: false,
        })
      ).not.toThrow();
      expect(() => fallbackManager.dispose()).not.toThrow();
    });

    it('initializes volume buses correctly with master, sfx, and music nodes', () => {
      manager.init();
      expect(manager.isSupported).toBe(true);
      expect(manager.getMasterGainNode()).not.toBeNull();
      expect(manager.getSfxGainNode()).not.toBeNull();
      expect(manager.getMusicGainNode()).not.toBeNull();
    });

    it('correctly calculates bus volumes and respects mute setting', () => {
      manager.init();
      const masterGain = manager.getMasterGainNode()!;
      const sfxGain = manager.getSfxGainNode()!;
      const musicGain = manager.getMusicGainNode()!;

      // Default settings: master: 0.8, music: 0.6, sfx: 0.8, muted: false
      manager.syncSettings({
        masterVolume: 0.8,
        sfxVolume: 0.7,
        musicVolume: 0.5,
        muted: false,
      });

      expect(masterGain.gain.setValueAtTime).toHaveBeenCalledWith(0.8, expect.any(Number));
      expect(sfxGain.gain.setValueAtTime).toHaveBeenCalledWith(0.7, expect.any(Number));
      expect(musicGain.gain.setValueAtTime).toHaveBeenCalledWith(0.5, expect.any(Number));

      // Muted: Master bus gain becomes 0
      manager.syncSettings({
        masterVolume: 0.8,
        sfxVolume: 0.7,
        musicVolume: 0.5,
        muted: true,
      });

      expect(masterGain.gain.setValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));

      // Unmuted: Master bus gain returns to masterVolume
      manager.syncSettings({
        masterVolume: 0.8,
        sfxVolume: 0.7,
        musicVolume: 0.5,
        muted: false,
      });

      expect(masterGain.gain.setValueAtTime).toHaveBeenCalledWith(0.8, expect.any(Number));
    });

    it('clamps volume inputs between 0 and 1', () => {
      manager.init();
      const masterGain = manager.getMasterGainNode()!;
      const sfxGain = manager.getSfxGainNode()!;

      manager.syncSettings({
        masterVolume: 1.5,
        sfxVolume: -0.5,
        musicVolume: 2.0,
        muted: false,
      });

      expect(masterGain.gain.setValueAtTime).toHaveBeenCalledWith(1.0, expect.any(Number));
      expect(sfxGain.gain.setValueAtTime).toHaveBeenCalledWith(0.0, expect.any(Number));
    });

    it('unlocks audio context on user interaction', async () => {
      manager.init();
      expect(manager.isUnlocked).toBe(false);

      const unlocked = await manager.unlock();
      expect(unlocked).toBe(true);
      expect(manager.isUnlocked).toBe(true);
      expect(mockCtx.resume).toHaveBeenCalled();
    });

    it('attaches and cleans up user gesture listeners on window', async () => {
      manager.init();
      const mockTarget = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      const detach = manager.attachUserGestureListeners(
        mockTarget as unknown as EventTarget
      );

      expect(mockTarget.addEventListener).toHaveBeenCalledWith(
        'pointerdown',
        expect.any(Function),
        expect.any(Object)
      );
      expect(mockTarget.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        expect.any(Object)
      );
      expect(mockTarget.addEventListener).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function),
        expect.any(Object)
      );

      detach();

      expect(mockTarget.removeEventListener).toHaveBeenCalledWith(
        'pointerdown',
        expect.any(Function)
      );
    });

    it('pauses and resumes audio on visibilitychange event', async () => {
      manager.init();
      await manager.unlock();
      const mockDoc = {
        hidden: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      const detach = manager.attachVisibilityListener(mockDoc as unknown as Document);
      expect(mockDoc.addEventListener).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      );

      const handler = mockDoc.addEventListener.mock.calls[0][1];

      // Simulate tab hidden
      mockDoc.hidden = true;
      handler();
      expect(mockCtx.suspend).toHaveBeenCalled();

      // Simulate tab visible
      mockDoc.hidden = false;
      handler();
      expect(mockCtx.resume).toHaveBeenCalled();

      detach();
      expect(mockDoc.removeEventListener).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      );
    });

    it('plays all SFX types without error', () => {
      manager.init();
      const sfxList: SfxType[] = [
        'till',
        'water',
        'plant',
        'harvest',
        'coin',
        'mutation',
        'weather_change',
        'egg_hatch',
        'ui_click',
        'error',
      ];

      for (const sfx of sfxList) {
        expect(() => manager.playSfx(sfx)).not.toThrow();
      }
    });

    it('passes options like mutationType to playSfx', () => {
      manager.init();
      expect(() =>
        manager.playSfx('mutation', { mutationType: 'gold', volume: 0.9 })
      ).not.toThrow();
    });

    it('crossfades weather ambience over specified duration', () => {
      manager.init();
      manager.setWeatherAmbience('sunny', 2.0);
      expect(manager.getCurrentWeatherAmbience()).toBe('sunny');

      // Crossfade to heavy rain
      manager.setWeatherAmbience('heavy_rain', 2.0);
      expect(manager.getCurrentWeatherAmbience()).toBe('heavy_rain');

      // Stop all ambience
      manager.stopAllAmbience(0.5);
      expect(manager.getCurrentWeatherAmbience()).toBeNull();
    });

    it('subscribes automatically to settingsStore updates', () => {
      manager.init();
      manager.bindToSettingsStore();

      useSettingsStore.getState().setMuted(true);
      const masterGain = manager.getMasterGainNode()!;
      expect(masterGain.gain.setValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));

      useSettingsStore.getState().setMasterVolume(0.4);
      useSettingsStore.getState().setMuted(false);
      expect(masterGain.gain.setValueAtTime).toHaveBeenCalledWith(0.4, expect.any(Number));
    });
  });
});
