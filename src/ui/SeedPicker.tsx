import type React from 'react';
import { useEffect, useCallback } from 'react';
import { useGameStore } from '../state/gameStore';
import { useUiStore } from '../state/uiStore';
import { CROPS, type CropId } from '../game/core/constants';

const ALL_CROPS: CropId[] = ['carrot', 'tomato', 'pumpkin', 'golden_berry', 'starfruit'];

function getNextSeed(current: CropId, direction: 1 | -1): CropId {
  const idx = ALL_CROPS.indexOf(current);
  if (idx === -1) return ALL_CROPS[0];
  const nextIdx = (idx + direction + ALL_CROPS.length) % ALL_CROPS.length;
  return ALL_CROPS[nextIdx];
}

export interface SeedPickerProps {
  selectedSeed?: CropId;
  onSelectSeed?: (seed: CropId) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Seed SVG Icons representing each crop's visual identity.
 */
function CropSeedIcon({ cropId, isSelected }: { cropId: CropId; isSelected: boolean }) {
  switch (cropId) {
    case 'carrot':
      return (
        <svg
          className={`w-6 h-6 md:w-7 md:h-7 transition-transform ${isSelected ? 'scale-110' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Leaves */}
          <path d="M16 3c-1 3-3 4-6 4" stroke="#4ade80" strokeWidth="2.5" />
          <path d="M19 6c-2 2-4 3-6 3" stroke="#22c55e" strokeWidth="2.5" />
          {/* Root */}
          <path
            d="M13.5 7.5L5 18.5c-.8.9-.4 2.1.7 2.3 1.2.2 2.1-.4 2.6-1.3l6.7-10.5"
            fill="#f97316"
            stroke="#ea580c"
            strokeWidth="1.5"
          />
        </svg>
      );

    case 'tomato':
      return (
        <svg
          className={`w-6 h-6 md:w-7 md:h-7 transition-transform ${isSelected ? 'scale-110' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Tomato Body */}
          <circle cx="12" cy="14" r="7" fill="#ef4444" stroke="#dc2626" strokeWidth="1.5" />
          {/* Calyx / Leaf Crown */}
          <path d="M12 7V4" stroke="#22c55e" strokeWidth="2" />
          <path d="M9 8c1.5-.5 3 0 3 0s1.5-.5 3 0" stroke="#4ade80" strokeWidth="2" />
        </svg>
      );

    case 'pumpkin':
      return (
        <svg
          className={`w-6 h-6 md:w-7 md:h-7 transition-transform ${isSelected ? 'scale-110' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Pumpkin Stem */}
          <path d="M12 7V4c1 0 2 .5 2 1" stroke="#15803d" strokeWidth="2" />
          {/* Pumpkin Body */}
          <ellipse cx="12" cy="14" rx="8" ry="6.5" fill="#ea580c" stroke="#c2410c" strokeWidth="1.5" />
          <path d="M12 7.5v13M8.5 9c-.5 3-.5 7 0 10M15.5 9c.5 3 .5 7 0 10" stroke="#9a3412" strokeWidth="1.2" />
        </svg>
      );

    case 'golden_berry':
      return (
        <svg
          className={`w-6 h-6 md:w-7 md:h-7 transition-transform ${isSelected ? 'scale-110' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Golden Berries cluster */}
          <circle cx="9" cy="15" r="4.5" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5" />
          <circle cx="15" cy="15" r="4.5" fill="#f59e0b" stroke="#b45309" strokeWidth="1.5" />
          <circle cx="12" cy="10" r="4" fill="#fde047" stroke="#ca8a04" strokeWidth="1.5" />
          <path d="M12 6v2" stroke="#22c55e" strokeWidth="1.5" />
        </svg>
      );

    case 'starfruit':
      return (
        <svg
          className={`w-6 h-6 md:w-7 md:h-7 transition-transform ${isSelected ? 'scale-110' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* 5-pointed Starfruit */}
          <polygon
            points="12,2 15,8.5 22,9.5 17,14.5 18.5,21.5 12,18 5.5,21.5 7,14.5 2,9.5 9,8.5"
            fill="#eab308"
            stroke="#a16207"
            strokeWidth="1.5"
          />
        </svg>
      );
  }
}

/**
 * SeedPicker: Floating popup seed selector above the toolbelt.
 * - Displays all 5 crops with icons, names, and live inventory count badges.
 * - Supports click selection and Q/E shortcut seed cycling with wrap-around.
 * - Accessible >= 44x44px touch targets with aria-label & aria-pressed.
 * - Responsive scrollable bar with safe-area spacing.
 */
export const SeedPicker: React.FC<SeedPickerProps> = ({
  selectedSeed: propSelectedSeed,
  onSelectSeed,
  className = '',
  disabled = false,
}) => {
  const activeModal = useUiStore((state) => state.activeModal);
  const storeSelectedSeed = useUiStore((state) => state.selectedSeed);
  const inventorySeeds = useGameStore((state) => state.inventory.seeds);

  const currentSelectedSeed = propSelectedSeed ?? storeSelectedSeed;

  const handleSelect = useCallback(
    (cropId: CropId) => {
      if (disabled || activeModal !== null) return;
      useUiStore.getState().setSelectedSeed(cropId);
      onSelectSeed?.(cropId);
    },
    [disabled, activeModal, onSelectSeed]
  );

  // Keyboard navigation for Q / E seed cycling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') {
        return;
      }
      if (disabled || useUiStore.getState().activeModal !== null) {
        return;
      }

      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        const cur = useUiStore.getState().selectedSeed;
        const next = getNextSeed(cur, -1);
        handleSelect(next);
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        const cur = useUiStore.getState().selectedSeed;
        const next = getNextSeed(cur, 1);
        handleSelect(next);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, handleSelect]);

  const isInteractive = !disabled && activeModal === null;

  return (
    <div
      data-testid="seed-picker"
      className={`pointer-events-auto select-none bg-slate-900/90 backdrop-blur-md border border-white/15 rounded-2xl p-2 shadow-2xl flex flex-col items-center gap-1.5 transition-all duration-200 animate-in fade-in zoom-in-95 ${className}`}
    >
      {/* Top Header & Shortcut Hints */}
      <div className="w-full flex items-center justify-between px-1 text-[11px] font-medium text-slate-300">
        <div className="flex items-center gap-1">
          <span
            data-testid="seed-shortcut-prev"
            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-300"
          >
            Q
          </span>
          <span className="text-slate-400">◀</span>
        </div>

        <span className="font-bold uppercase tracking-wider text-emerald-400 text-[11px]">
          Select Seed
        </span>

        <div className="flex items-center gap-1">
          <span className="text-slate-400">▶</span>
          <span
            data-testid="seed-shortcut-next"
            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-300"
          >
            E
          </span>
        </div>
      </div>

      {/* Horizontal Crop Cards List */}
      <div
        className="flex items-center gap-2 overflow-x-auto max-w-[calc(100vw-2.5rem)] px-1 py-1 no-scrollbar"
        role="group"
        aria-label="Seed Selection"
      >
        {ALL_CROPS.map((cropId) => {
          const cropDef = CROPS[cropId];
          const count = inventorySeeds[cropId] ?? 0;
          const isSelected = currentSelectedSeed === cropId;
          const isEmpty = count === 0;

          return (
            <button
              key={cropId}
              type="button"
              data-testid={`seed-card-${cropId}`}
              data-empty={isEmpty ? 'true' : 'false'}
              aria-label={`${cropDef.name} Seeds (${count} available)`}
              aria-pressed={isSelected}
              disabled={!isInteractive}
              onClick={() => handleSelect(cropId)}
              className={`min-w-[44px] min-h-[44px] w-16 h-18 md:w-20 md:h-20 flex flex-col items-center justify-between p-1.5 rounded-xl border transition-all duration-150 relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                isSelected
                  ? 'border-2 border-emerald-400 ring-2 ring-emerald-400/40 bg-emerald-950/80 scale-105 shadow-md shadow-emerald-500/20 z-10'
                  : 'border-white/10 bg-slate-800/80 hover:bg-slate-700/80 hover:border-white/25 scale-100'
              } ${isEmpty ? 'opacity-70' : 'opacity-100'} ${
                !isInteractive ? 'cursor-not-allowed opacity-40' : ''
              }`}
            >
              {/* Seed Icon */}
              <div className="flex-1 flex items-center justify-center pointer-events-none">
                <CropSeedIcon cropId={cropId} isSelected={isSelected} />
              </div>

              {/* Crop Name */}
              <span className="text-[10px] md:text-xs font-semibold text-white truncate max-w-full leading-tight pointer-events-none">
                {cropDef.name}
              </span>

              {/* Seed Count Badge */}
              <span
                data-testid={`seed-count-${cropId}`}
                className={`text-[10px] md:text-[11px] font-bold px-1.5 py-0.2 rounded-full leading-tight pointer-events-none mt-0.5 ${
                  isEmpty
                    ? 'text-slate-400 bg-slate-900/80 border border-slate-700/50'
                    : isSelected
                    ? 'text-emerald-200 bg-emerald-900/90 border border-emerald-400/50'
                    : 'text-amber-200 bg-slate-900/80 border border-white/10'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
