import { create } from 'zustand';
import type { QualityLevel, SettingsState } from './storeTypes';

export const SETTINGS_STORAGE_KEY = 'garden_island_settings';

export interface SettingsStoreState extends SettingsState {
  setMasterVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  setQuality: (quality: QualityLevel) => void;
  setEffectiveQuality: (quality: 'low' | 'medium' | 'high') => void;
  setReducedMotion: (reduced: boolean) => void;
  setHaptics: (haptics: boolean) => void;
  setInputMode: (mode: 'auto' | 'desktop' | 'touch') => void;
  setCameraSensitivity: (sensitivity: number) => void;
  setInvertY: (invert: boolean) => void;
  resetSettings: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getDefaultReducedMotion(): boolean {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }
  return false;
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function getStoredSettings(): Partial<SettingsState> {
  const storage = getLocalStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function persistSettings(state: SettingsState): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    const data: Partial<SettingsState> = {
      masterVolume: state.masterVolume,
      musicVolume: state.musicVolume,
      sfxVolume: state.sfxVolume,
      muted: state.muted,
      quality: state.quality,
      effectiveQuality: state.effectiveQuality,
      reducedMotion: state.reducedMotion,
      haptics: state.haptics,
      inputMode: state.inputMode,
      cameraSensitivity: state.cameraSensitivity,
      invertY: state.invertY,
    };
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage quota exceeded or disabled in private browsing; fail silently
  }
}

function createDefaultSettings(): SettingsState {
  const stored = getStoredSettings();
  const quality = (stored.quality as QualityLevel) ?? 'auto';
  const effectiveQuality =
    quality === 'auto'
      ? (stored.effectiveQuality ?? 'medium')
      : quality;

  return {
    masterVolume: typeof stored.masterVolume === 'number' ? clamp(stored.masterVolume, 0, 1) : 0.8,
    musicVolume: typeof stored.musicVolume === 'number' ? clamp(stored.musicVolume, 0, 1) : 0.6,
    sfxVolume: typeof stored.sfxVolume === 'number' ? clamp(stored.sfxVolume, 0, 1) : 0.8,
    muted: typeof stored.muted === 'boolean' ? stored.muted : false,
    quality,
    effectiveQuality,
    reducedMotion:
      typeof stored.reducedMotion === 'boolean'
        ? stored.reducedMotion
        : getDefaultReducedMotion(),
    haptics: typeof stored.haptics === 'boolean' ? stored.haptics : true,
    inputMode: stored.inputMode ?? 'auto',
    cameraSensitivity:
      typeof stored.cameraSensitivity === 'number'
        ? clamp(stored.cameraSensitivity, 0.1, 3.0)
        : 1.0,
    invertY: typeof stored.invertY === 'boolean' ? stored.invertY : false,
  };
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  ...createDefaultSettings(),

  setMasterVolume: (volume: number) => {
    const masterVolume = clamp(volume, 0, 1);
    set({ masterVolume });
    persistSettings(get());
  },

  setMusicVolume: (volume: number) => {
    const musicVolume = clamp(volume, 0, 1);
    set({ musicVolume });
    persistSettings(get());
  },

  setSfxVolume: (volume: number) => {
    const sfxVolume = clamp(volume, 0, 1);
    set({ sfxVolume });
    persistSettings(get());
  },

  setMuted: (muted: boolean) => {
    set({ muted });
    persistSettings(get());
  },

  setQuality: (quality: QualityLevel) => {
    const effectiveQuality = quality === 'auto' ? get().effectiveQuality : quality;
    set({ quality, effectiveQuality });
    persistSettings(get());
  },

  setEffectiveQuality: (effectiveQuality: 'low' | 'medium' | 'high') => {
    set({ effectiveQuality });
    persistSettings(get());
  },

  setReducedMotion: (reducedMotion: boolean) => {
    set({ reducedMotion });
    persistSettings(get());
  },

  setHaptics: (haptics: boolean) => {
    set({ haptics });
    persistSettings(get());
  },

  setInputMode: (inputMode: 'auto' | 'desktop' | 'touch') => {
    set({ inputMode });
    persistSettings(get());
  },

  setCameraSensitivity: (sensitivity: number) => {
    const cameraSensitivity = clamp(sensitivity, 0.1, 3.0);
    set({ cameraSensitivity });
    persistSettings(get());
  },

  setInvertY: (invertY: boolean) => {
    set({ invertY });
    persistSettings(get());
  },

  resetSettings: () => {
    const defaults = {
      masterVolume: 0.8,
      musicVolume: 0.6,
      sfxVolume: 0.8,
      muted: false,
      quality: 'auto' as QualityLevel,
      effectiveQuality: 'medium' as const,
      reducedMotion: getDefaultReducedMotion(),
      haptics: true,
      inputMode: 'auto' as const,
      cameraSensitivity: 1.0,
      invertY: false,
    };
    set(defaults);
    persistSettings(defaults);
  },
}));

export function resetSettingsStore(): void {
  const initial = createDefaultSettings();
  useSettingsStore.setState(initial);
}
