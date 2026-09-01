import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSettingsStore } from '../state/settingsStore';
import { useGameStore } from '../state/gameStore';
import { useUiStore } from '../state/uiStore';
import type { QualityLevel } from '../game/core/constants';

export interface SettingsModalProps {
  onClose?: () => void;
  className?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  onClose,
  className = '',
}) => {
  const activeModal = useUiStore((state) => state.activeModal);

  const masterVolume = useSettingsStore((state) => state.masterVolume);
  const musicVolume = useSettingsStore((state) => state.musicVolume);
  const sfxVolume = useSettingsStore((state) => state.sfxVolume);
  const muted = useSettingsStore((state) => state.muted);
  const quality = useSettingsStore((state) => state.quality);
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const haptics = useSettingsStore((state) => state.haptics);
  const inputMode = useSettingsStore((state) => state.inputMode);
  const cameraSensitivity = useSettingsStore((state) => state.cameraSensitivity);
  const invertY = useSettingsStore((state) => state.invertY);

  const setMasterVolume = useSettingsStore((state) => state.setMasterVolume);
  const setMusicVolume = useSettingsStore((state) => state.setMusicVolume);
  const setSfxVolume = useSettingsStore((state) => state.setSfxVolume);
  const setMuted = useSettingsStore((state) => state.setMuted);
  const setQuality = useSettingsStore((state) => state.setQuality);
  const setReducedMotion = useSettingsStore((state) => state.setReducedMotion);
  const setHaptics = useSettingsStore((state) => state.setHaptics);
  const setInputMode = useSettingsStore((state) => state.setInputMode);
  const setCameraSensitivity = useSettingsStore((state) => state.setCameraSensitivity);
  const setInvertY = useSettingsStore((state) => state.setInvertY);

  const [isConfirmingReset, setIsConfirmingReset] = useState<boolean>(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    setIsConfirmingReset(false);
    useUiStore.getState().closeModal();
    onClose?.();
  }, [onClose]);

  // Focus trap & Escape key listener
  useEffect(() => {
    if (activeModal !== 'settings') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModal, handleClose]);

  // Auto-focus dialog on open
  useEffect(() => {
    if (activeModal === 'settings' && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [activeModal]);

  if (activeModal !== 'settings') {
    return null;
  }

  const handleResetSave = () => {
    useGameStore.getState().resetGame();
    useUiStore.getState().showToast('Save data reset to default.', 'info');
    setIsConfirmingReset(false);
    handleClose();
  };

  const handleReplayTutorial = () => {
    useGameStore.setState((s) => ({
      tutorial: { ...s.tutorial, dismissed: false },
    }));
    useUiStore.getState().openModal('tutorial');
  };

  return (
    <div
      data-testid="settings-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md pointer-events-auto animate-in fade-in duration-200"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
        data-testid="settings-modal"
        className={`relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-white/15 p-5 sm:p-6 shadow-2xl shadow-black/80 flex flex-col gap-6 text-slate-100 outline-none ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl" role="img" aria-hidden="true">
              ⚙️
            </span>
            <h2
              id="settings-title"
              data-testid="settings-title"
              className="text-lg sm:text-xl font-black text-amber-400 font-mono tracking-wide"
            >
              Game Settings
            </h2>
          </div>

          <button
            type="button"
            data-testid="settings-close-button"
            onClick={handleClose}
            aria-label="Close settings"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 outline-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 1. Audio Section */}
        <section className="flex flex-col gap-3 rounded-xl bg-slate-950/40 p-4 border border-white/5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 font-mono">
              <span>🔊</span> Audio Settings
            </h3>

            <button
              type="button"
              data-testid="setting-mute-toggle"
              onClick={() => setMuted(!muted)}
              aria-pressed={muted}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer ${
                muted
                  ? 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                  : 'bg-slate-800 border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              {muted ? '🔇 Muted' : '🔊 Sound On'}
            </button>
          </div>

          {/* Master Volume */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs font-medium text-slate-300">
              <label htmlFor="master-volume-slider">Master Volume</label>
              <span className="font-mono text-amber-300">{Math.round(masterVolume * 100)}%</span>
            </div>
            <input
              id="master-volume-slider"
              type="range"
              min="0"
              max="100"
              value={Math.round(masterVolume * 100)}
              onChange={(e) => setMasterVolume(Number(e.target.value) / 100)}
              data-testid="setting-master-volume"
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          {/* Music Volume */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs font-medium text-slate-300">
              <label htmlFor="music-volume-slider">Music & Ambience</label>
              <span className="font-mono text-amber-300">{Math.round(musicVolume * 100)}%</span>
            </div>
            <input
              id="music-volume-slider"
              type="range"
              min="0"
              max="100"
              value={Math.round(musicVolume * 100)}
              onChange={(e) => setMusicVolume(Number(e.target.value) / 100)}
              data-testid="setting-music-volume"
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          {/* SFX Volume */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs font-medium text-slate-300">
              <label htmlFor="sfx-volume-slider">Sound Effects (SFX)</label>
              <span className="font-mono text-amber-300">{Math.round(sfxVolume * 100)}%</span>
            </div>
            <input
              id="sfx-volume-slider"
              type="range"
              min="0"
              max="100"
              value={Math.round(sfxVolume * 100)}
              onChange={(e) => setSfxVolume(Number(e.target.value) / 100)}
              data-testid="setting-sfx-volume"
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>
        </section>

        {/* 2. Graphics & Performance */}
        <section className="flex flex-col gap-3 rounded-xl bg-slate-950/40 p-4 border border-white/5">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 font-mono">
            <span>✨</span> Graphics & Display
          </h3>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-300">Quality Preset</label>
            <div className="grid grid-cols-4 gap-2">
              {(['auto', 'low', 'medium', 'high'] as QualityLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  data-testid={`setting-quality-${level}`}
                  onClick={() => setQuality(level)}
                  className={`py-1.5 rounded-lg text-xs font-bold capitalize border transition-all outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer ${
                    quality === level
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-slate-800/80 border-white/10 text-slate-300 hover:text-white hover:bg-slate-700/80'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="text-xs font-medium text-slate-200">Reduced Motion</div>
              <div className="text-[11px] text-slate-400">
                Disables screen shake and camera impulses
              </div>
            </div>
            <button
              type="button"
              data-testid="setting-reduced-motion-toggle"
              onClick={() => setReducedMotion(!reducedMotion)}
              aria-pressed={reducedMotion}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer ${
                reducedMotion
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-800 border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              {reducedMotion ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </section>

        {/* 3. Input & Controls */}
        <section className="flex flex-col gap-3 rounded-xl bg-slate-950/40 p-4 border border-white/5">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 font-mono">
            <span>🎮</span> Input & Controls
          </h3>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-300">Input Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {(['auto', 'desktop', 'touch'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  data-testid={`setting-input-mode-${mode}`}
                  onClick={() => setInputMode(mode)}
                  className={`py-1.5 rounded-lg text-xs font-bold capitalize border transition-all outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer ${
                    inputMode === mode
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-slate-800/80 border-white/10 text-slate-300 hover:text-white hover:bg-slate-700/80'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Camera Sensitivity */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs font-medium text-slate-300">
              <label htmlFor="camera-sensitivity-slider">Camera Sensitivity</label>
              <span className="font-mono text-amber-300">{cameraSensitivity.toFixed(1)}x</span>
            </div>
            <input
              id="camera-sensitivity-slider"
              type="range"
              min="0.1"
              max="3.0"
              step="0.1"
              value={cameraSensitivity}
              onChange={(e) => setCameraSensitivity(Number(e.target.value))}
              data-testid="setting-camera-sensitivity"
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-xs font-medium text-slate-200">Invert Camera Y-Axis</div>
            <button
              type="button"
              data-testid="setting-invert-y-toggle"
              onClick={() => setInvertY(!invertY)}
              aria-pressed={invertY}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer ${
                invertY
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-800 border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              {invertY ? 'Inverted' : 'Normal'}
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-xs font-medium text-slate-200">Haptic Vibration</div>
            <button
              type="button"
              data-testid="setting-haptics-toggle"
              onClick={() => setHaptics(!haptics)}
              aria-pressed={haptics}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer ${
                haptics
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-800 border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              {haptics ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </section>

        {/* 4. Tutorial & Help Shortcut */}
        <section className="flex items-center justify-between rounded-xl bg-slate-950/40 p-4 border border-white/5">
          <div>
            <div className="text-xs font-bold text-slate-200">How to Play</div>
            <div className="text-[11px] text-slate-400">
              Revisit the 6-step island farming onboarding guide
            </div>
          </div>
          <button
            type="button"
            data-testid="setting-replay-tutorial"
            onClick={handleReplayTutorial}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-white/10 text-emerald-300 hover:text-emerald-200 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 outline-none cursor-pointer"
          >
            Replay Tutorial
          </button>
        </section>

        {/* 5. Danger Zone: Reset Save Data */}
        <section className="flex flex-col gap-3 rounded-xl bg-rose-950/20 p-4 border border-rose-500/20">
          <div className="flex items-center gap-2 text-rose-300 text-sm font-bold font-mono">
            <span>⚠️</span> Danger Zone
          </div>

          {!isConfirmingReset ? (
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                Wipe all farm progress, coins, pets, and inventory back to fresh state.
              </div>
              <button
                type="button"
                data-testid="setting-reset-save-button"
                onClick={() => setIsConfirmingReset(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-rose-400 outline-none whitespace-nowrap cursor-pointer"
              >
                Reset Save Data
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 animate-in fade-in duration-150">
              <div className="text-xs font-semibold text-rose-200">
                Are you sure? This will wipe all progress and cannot be undone.
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  data-testid="setting-cancel-reset-button"
                  onClick={() => setIsConfirmingReset(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 outline-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="setting-confirm-reset-button"
                  onClick={handleResetSave}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/60 border border-rose-400/40 transition-colors focus-visible:ring-2 focus-visible:ring-rose-300 outline-none cursor-pointer"
                >
                  Confirm Reset
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
