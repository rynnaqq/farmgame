import React, { useEffect, useRef, useCallback } from 'react';
import { useUiStore } from '../state/uiStore';
import type { OfflineSummaryData } from '../persistence/offlineSimulation';
import { getCropDefinition } from '../game/farming/cropDefinitions';
import { getPetDefinition } from '../game/pets/petDefinitions';
import { audioManager } from '../game/audio/AudioManager';
import type { CropId, MutationType, PetType } from '../state/storeTypes';

export interface OfflineSummaryProps {
  onClose?: () => void;
  className?: string;
}

const CROP_ICONS: Record<CropId, string> = {
  carrot: '🥕',
  tomato: '🍅',
  pumpkin: '🎃',
  golden_berry: '🍓',
  starfruit: '⭐',
};

const PET_ICONS: Record<PetType, string> = {
  dog: '🐕',
  bee: '🐝',
  pig: '🐷',
};

const MUTATION_CONFIGS: Record<
  MutationType,
  { label: string; bg: string; text: string; border: string }
> = {
  none: { label: '', bg: '', text: '', border: '' },
  gold: {
    label: '✨ Gold (5x)',
    bg: 'bg-amber-950/70',
    text: 'text-amber-300',
    border: 'border-amber-400/50',
  },
  giant: {
    label: '🌿 Giant (3x)',
    bg: 'bg-emerald-950/70',
    text: 'text-emerald-300',
    border: 'border-emerald-400/50',
  },
  cosmic: {
    label: '🌌 Cosmic (15x)',
    bg: 'bg-purple-950/70',
    text: 'text-purple-300',
    border: 'border-purple-400/50',
  },
};

export const OfflineSummary: React.FC<OfflineSummaryProps> = ({ onClose, className = '' }) => {
  const activeModal = useUiStore((state) => state.activeModal);
  const rawModalData = useUiStore((state) => state.modalData);
  const modalData = rawModalData as OfflineSummaryData | null;

  const dialogRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    audioManager.playSfx('ui_click');
    useUiStore.getState().closeModal();
    onClose?.();
  }, [onClose]);

  // Focus trap & Escape key listener
  useEffect(() => {
    if (activeModal !== 'offline_summary') return;

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
    if (activeModal === 'offline_summary' && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [activeModal]);

  if (activeModal !== 'offline_summary' || !modalData) {
    return null;
  }

  const {
    formattedElapsed,
    maturedCrops,
    totalMaturedCount,
    dogHarvestsCount,
    dogHarvests,
    hatchedPets,
    clockMovedBackward,
  } = modalData;

  return (
    <div
      data-testid="offline-summary-backdrop"
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
        aria-labelledby="offline-summary-title"
        tabIndex={-1}
        data-testid="offline-summary-modal"
        className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-white/15 p-5 sm:p-6 shadow-2xl shadow-black/80 flex flex-col gap-5 text-slate-100 outline-none ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl" role="img" aria-hidden="true">
              🏡
            </span>
            <div>
              <h2
                id="offline-summary-title"
                data-testid="offline-summary-title"
                className="text-lg sm:text-xl font-black text-amber-400 font-mono tracking-wide"
              >
                Welcome Back!
              </h2>
              <p className="text-xs text-slate-300">
                You were away for{' '}
                <span
                  data-testid="offline-elapsed-time"
                  className="font-bold text-amber-300 font-mono"
                >
                  {formattedElapsed}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="offline-summary-close-button"
            onClick={handleClose}
            aria-label="Close summary"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 outline-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Backward Clock Warning */}
        {clockMovedBackward && (
          <div
            data-testid="offline-clock-warning"
            className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs font-medium"
          >
            <span className="text-lg">⚠️</span>
            <span>
              Your device clock was set backward since the last session. Offline simulation was
              safely paused to prevent desynchronization.
            </span>
          </div>
        )}

        {/* 1. Matured Crops Section */}
        <section
          data-testid="offline-matured-section"
          className="flex flex-col gap-3 rounded-xl bg-slate-950/40 p-4 border border-white/5"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 font-mono">
              <span>🌱</span> Crops Reached Maturity
            </h3>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30">
              {totalMaturedCount} Total
            </span>
          </div>

          {maturedCrops.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {maturedCrops.map((item, idx) => {
                const cropDef = getCropDefinition(item.cropId);
                const cropName = cropDef ? cropDef.name : item.cropId;
                const cropIcon = CROP_ICONS[item.cropId] || '🌱';
                const hasMutation = item.mutation !== 'none';
                const mutConfig = MUTATION_CONFIGS[item.mutation];

                return (
                  <div
                    key={`${item.cropId}-${item.mutation}-${idx}`}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-white/10"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl" role="img" aria-hidden="true">
                        {cropIcon}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-100">{cropName}</span>
                        {hasMutation && (
                          <span
                            data-testid={`mutation-badge-${item.mutation}`}
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded border font-mono ${mutConfig.bg} ${mutConfig.text} ${mutConfig.border}`}
                          >
                            {mutConfig.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-mono font-black text-amber-300">
                      x{item.count}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-slate-400 py-1 text-center italic">
              No crops reached maturity while away.
            </div>
          )}
        </section>

        {/* 2. Dog Auto-Harvest Section */}
        {dogHarvestsCount > 0 && (
          <section
            data-testid="offline-dog-harvests-section"
            className="flex flex-col gap-3 rounded-xl bg-amber-950/20 p-4 border border-amber-500/20"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-amber-200 flex items-center gap-2 font-mono">
                <span>🐕</span> Dog Auto-Harvests
              </h3>
              <span
                data-testid="offline-dog-harvest-count"
                className="text-xs font-mono font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-500/30"
              >
                {dogHarvestsCount}
              </span>
            </div>

            <p className="text-xs text-slate-300">
              Your loyal Dog harvested {dogHarvestsCount} mature crops and added them directly to
              your inventory produce!
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              {dogHarvests.map((item, idx) => {
                const cropDef = getCropDefinition(item.cropId);
                const cropName = cropDef ? cropDef.name : item.cropId;
                const cropIcon = CROP_ICONS[item.cropId] || '🌱';
                const hasMutation = item.mutation !== 'none';
                const mutConfig = MUTATION_CONFIGS[item.mutation];

                return (
                  <div
                    key={`dog-${item.cropId}-${item.mutation}-${idx}`}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-amber-500/30 text-xs font-medium text-amber-100"
                  >
                    <span>{cropIcon}</span>
                    <span>{cropName}</span>
                    {hasMutation && (
                      <span className={`text-[10px] font-bold ${mutConfig.text}`}>
                        ({item.mutation})
                      </span>
                    )}
                    <span className="font-mono font-bold text-amber-300">x{item.count}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 3. Hatched Pets Section */}
        {hatchedPets.length > 0 && (
          <section
            data-testid="offline-hatched-pets-section"
            className="flex flex-col gap-3 rounded-xl bg-purple-950/30 p-4 border border-purple-500/30"
          >
            <h3 className="text-sm font-bold text-purple-200 flex items-center gap-2 font-mono">
              <span>🐣</span> Hatched Companion Pets
            </h3>

            <div className="flex flex-col gap-2">
              {hatchedPets.map((pet) => {
                const petDef = getPetDefinition(pet.type);
                const petIcon = PET_ICONS[pet.type] || '🐾';

                return (
                  <div
                    key={pet.petId}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/80 border border-purple-500/30"
                  >
                    <span className="text-2xl" role="img" aria-hidden="true">
                      {petIcon}
                    </span>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-100">{petDef.name}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-900/70 text-purple-200 border border-purple-400/40">
                          {petDef.perkDescription}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">{petDef.description}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Footer Dismiss Action */}
        <div className="flex justify-end pt-2 border-t border-white/10">
          <button
            type="button"
            data-testid="offline-summary-dismiss-button"
            onClick={handleClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 border border-amber-400 transition-all focus-visible:ring-2 focus-visible:ring-amber-300 outline-none cursor-pointer"
          >
            Welcome Back!
          </button>
        </div>
      </div>
    </div>
  );
};
