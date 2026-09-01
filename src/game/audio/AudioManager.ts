import { useSettingsStore } from '../../state/settingsStore';
import type { WeatherType, MutationType } from '../../state/storeTypes';
import {
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
  type AmbienceInstance,
} from './audioSynthesizer';

export type SfxType =
  | 'till'
  | 'water'
  | 'plant'
  | 'harvest'
  | 'coin'
  | 'mutation'
  | 'weather_change'
  | 'egg_hatch'
  | 'ui_click'
  | 'error';

export interface PlaySfxOptions {
  volume?: number;
  mutationType?: MutationType;
  pitchMultiplier?: number;
}

export interface AudioManagerOptions {
  audioContextFactory?: () => AudioContext;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Singleton Web Audio controller for Garden Island 3D:
 * - Manages Web Audio context lifecycle, unlocking on user gestures.
 * - Manages three-tier volume buses: Master, SFX, and Music/Ambience.
 * - Synchronizes with useSettingsStore and handles mute toggles.
 * - Plays procedural sound effects for farming, economy, and UI actions.
 * - Controls 2-second crossfading ambient weather loops.
 * - Handles tab visibility change pausing / resuming.
 * - Provides graceful fallback when Web Audio is unsupported.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  public isSupported: boolean = false;
  public isUnlocked: boolean = false;
  public isPaused: boolean = false;

  private currentAmbience: AmbienceInstance | null = null;
  private currentWeather: WeatherType | null = null;

  private settingsUnsubscribe: (() => void) | null = null;
  private customContextFactory?: () => AudioContext;

  constructor(options?: AudioManagerOptions) {
    this.customContextFactory = options?.audioContextFactory;
    this.checkSupport();
  }

  private checkSupport(): void {
    if (this.customContextFactory) {
      try {
        const testCtx = this.customContextFactory();
        this.ctx = testCtx;
        this.isSupported = true;
      } catch {
        this.isSupported = false;
      }
      return;
    }

    if (
      typeof window !== 'undefined' &&
      (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
    ) {
      this.isSupported = true;
    } else {
      this.isSupported = false;
    }
  }

  /**
   * Initializes the AudioContext and volume buses.
   * Safe to call multiple times.
   */
  public init(): boolean {
    if (this.masterGain && this.sfxGain && this.musicGain) {
      return true;
    }

    try {
      if (!this.ctx) {
        if (this.customContextFactory) {
          this.ctx = this.customContextFactory();
        } else if (typeof window !== 'undefined') {
          const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioContextClass) {
            this.ctx = new AudioContextClass();
          }
        }
      }

      if (!this.ctx) {
        this.isSupported = false;
        return false;
      }

      this.isSupported = true;

      // Master Bus -> Destination
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);

      // SFX Bus -> Master Bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.masterGain);

      // Music / Ambience Bus -> Master Bus
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.masterGain);

      // Apply initial store settings
      const settings = useSettingsStore.getState();
      this.syncSettings({
        masterVolume: settings.masterVolume,
        sfxVolume: settings.sfxVolume,
        musicVolume: settings.musicVolume,
        muted: settings.muted,
      });

      return true;
    } catch {
      this.isSupported = false;
      this.ctx = null;
      this.masterGain = null;
      this.sfxGain = null;
      this.musicGain = null;
      return false;
    }
  }

  /**
   * Resumes the AudioContext upon user gesture.
   */
  public async unlock(): Promise<boolean> {
    if (!this.init()) {
      return false;
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        // Resume failed or was rejected
      }
    }

    this.isUnlocked = this.ctx
      ? this.ctx.state === 'running' || this.ctx.state === ('interrupted' as unknown)
      : false;
    return this.isUnlocked;
  }

  /**
   * Attaches one-time gesture listeners to window to unlock audio on first interaction.
   */
  public attachUserGestureListeners(
    target: EventTarget = typeof window !== 'undefined' ? window : ({} as EventTarget)
  ): () => void {
    if (!target || typeof target.addEventListener !== 'function') {
      return () => {};
    }

    const handleGesture = () => {
      this.unlock();
      removeListeners();
    };

    const removeListeners = () => {
      try {
        target.removeEventListener('pointerdown', handleGesture);
        target.removeEventListener('keydown', handleGesture);
        target.removeEventListener('touchstart', handleGesture);
      } catch {
        // Ignore
      }
    };

    target.addEventListener('pointerdown', handleGesture, { passive: true });
    target.addEventListener('keydown', handleGesture, { passive: true });
    target.addEventListener('touchstart', handleGesture, { passive: true });

    return removeListeners;
  }

  /**
   * Attaches visibility change listener to pause when the document is hidden.
   */
  public attachVisibilityListener(
    doc: Document = typeof document !== 'undefined' ? document : ({} as Document)
  ): () => void {
    if (!doc || typeof doc.addEventListener !== 'function') {
      return () => {};
    }

    const handleVisibilityChange = () => {
      if (!this.ctx) return;
      if (doc.hidden) {
        this.isPaused = true;
        try {
          this.ctx.suspend();
        } catch {
          // Ignore
        }
      } else {
        this.isPaused = false;
        if (this.isUnlocked) {
          try {
            this.ctx.resume();
          } catch {
            // Ignore
          }
        }
      }
    };

    doc.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      try {
        doc.removeEventListener('visibilitychange', handleVisibilityChange);
      } catch {
        // Ignore
      }
    };
  }

  /**
   * Subscribes to the useSettingsStore to automatically update volume buses.
   */
  public bindToSettingsStore(): () => void {
    if (this.settingsUnsubscribe) {
      this.settingsUnsubscribe();
    }

    this.settingsUnsubscribe = useSettingsStore.subscribe((state) => {
      this.syncSettings({
        masterVolume: state.masterVolume,
        sfxVolume: state.sfxVolume,
        musicVolume: state.musicVolume,
        muted: state.muted,
      });
    });

    return () => {
      if (this.settingsUnsubscribe) {
        this.settingsUnsubscribe();
        this.settingsUnsubscribe = null;
      }
    };
  }

  /**
   * Updates gain values for the volume buses.
   */
  public syncSettings(settings: {
    masterVolume: number;
    sfxVolume: number;
    musicVolume: number;
    muted: boolean;
  }): void {
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const effectiveMaster = settings.muted ? 0 : clamp(settings.masterVolume, 0, 1);
    const effectiveSfx = clamp(settings.sfxVolume, 0, 1);
    const effectiveMusic = clamp(settings.musicVolume, 0, 1);

    if (this.masterGain) {
      try {
        this.masterGain.gain.setValueAtTime(effectiveMaster, now);
      } catch {
        // Fallback direct assignment
        this.masterGain.gain.value = effectiveMaster;
      }
    }

    if (this.sfxGain) {
      try {
        this.sfxGain.gain.setValueAtTime(effectiveSfx, now);
      } catch {
        this.sfxGain.gain.value = effectiveSfx;
      }
    }

    if (this.musicGain) {
      try {
        this.musicGain.gain.setValueAtTime(effectiveMusic, now);
      } catch {
        this.musicGain.gain.value = effectiveMusic;
      }
    }
  }

  /**
   * Plays a procedural sound effect.
   */
  public playSfx(type: SfxType, options?: PlaySfxOptions): void {
    if (!this.isSupported || !this.ctx || !this.sfxGain) {
      return;
    }

    const volume = clamp(options?.volume ?? 1.0, 0, 2.0);
    const pitch = clamp(options?.pitchMultiplier ?? 1.0, 0.2, 4.0);

    // Create per-sound gain node routing to SFX bus
    const soundGain = this.ctx.createGain();
    soundGain.gain.setValueAtTime(volume, this.ctx.currentTime);
    soundGain.connect(this.sfxGain);

    try {
      switch (type) {
        case 'till':
          synthesizeTill(this.ctx, soundGain, pitch);
          break;
        case 'water':
          synthesizeWater(this.ctx, soundGain, pitch);
          break;
        case 'plant':
          synthesizePlant(this.ctx, soundGain, pitch);
          break;
        case 'harvest':
          synthesizeHarvest(this.ctx, soundGain, pitch);
          break;
        case 'coin':
          synthesizeCoin(this.ctx, soundGain, pitch);
          break;
        case 'mutation':
          synthesizeMutation(this.ctx, soundGain, options?.mutationType, pitch);
          break;
        case 'weather_change':
          synthesizeWeatherChange(this.ctx, soundGain, pitch);
          break;
        case 'egg_hatch':
          synthesizeEggHatch(this.ctx, soundGain, pitch);
          break;
        case 'ui_click':
          synthesizeUiClick(this.ctx, soundGain, pitch);
          break;
        case 'error':
          synthesizeError(this.ctx, soundGain, pitch);
          break;
      }
    } catch {
      // Catch synthesis error gracefully
    }
  }

  /**
   * Sets the active ambient weather loop with a 2-second crossfade.
   */
  public setWeatherAmbience(weather: WeatherType, crossfadeDurationSec: number = 2.0): void {
    if (!this.init() || !this.ctx || !this.musicGain) {
      this.currentWeather = weather;
      return;
    }

    if (this.currentWeather === weather && this.currentAmbience !== null) {
      return;
    }

    // 1. Crossfade out previous ambience
    if (this.currentAmbience) {
      this.currentAmbience.stop(crossfadeDurationSec);
      this.currentAmbience = null;
    }

    this.currentWeather = weather;

    // 2. Start and crossfade in new ambience
    const newAmbience = createWeatherAmbienceNode(this.ctx, this.musicGain, weather);
    const now = this.ctx.currentTime;
    try {
      newAmbience.gainNode.gain.setValueAtTime(0.0001, now);
      newAmbience.gainNode.gain.linearRampToValueAtTime(1.0, now + crossfadeDurationSec);
    } catch {
      newAmbience.gainNode.gain.value = 1.0;
    }

    this.currentAmbience = newAmbience;
  }

  /**
   * Stops all ambient weather sounds.
   */
  public stopAllAmbience(fadeDurationSec: number = 0.5): void {
    if (this.currentAmbience) {
      this.currentAmbience.stop(fadeDurationSec);
      this.currentAmbience = null;
    }
    this.currentWeather = null;
  }

  public getCurrentWeatherAmbience(): WeatherType | null {
    return this.currentWeather;
  }

  public getMasterGainNode(): GainNode | null {
    return this.masterGain;
  }

  public getSfxGainNode(): GainNode | null {
    return this.sfxGain;
  }

  public getMusicGainNode(): GainNode | null {
    return this.musicGain;
  }

  /**
   * Cleanup all resources, event listeners, and audio context.
   */
  public dispose(): void {
    if (this.settingsUnsubscribe) {
      this.settingsUnsubscribe();
      this.settingsUnsubscribe = null;
    }

    this.stopAllAmbience(0.1);

    if (this.ctx) {
      try {
        if (this.ctx.state !== 'closed') {
          this.ctx.close();
        }
      } catch {
        // Ignore
      }
      this.ctx = null;
    }

    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.isUnlocked = false;
    this.isPaused = false;
  }
}

/**
 * Factory helper for unit testing.
 */
export function createAudioManager(options?: AudioManagerOptions): AudioManager {
  return new AudioManager(options);
}

/**
 * Shared singleton audio manager instance for Garden Island 3D.
 */
export const audioManager = new AudioManager();
