import type React from 'react';
import { useCallback } from 'react';
import { useGameStore } from '../state/gameStore';
import { useUiStore } from '../state/uiStore';
import { CROPS } from '../game/core/constants';
import type { ToolType } from '../state/storeTypes';
import { SeedPicker } from './SeedPicker';
import type { InputManager } from '../game/input/InputManager';
import { audioManager } from '../game/audio/AudioManager';

export interface ToolbeltProps {
  inputManager?: InputManager;
  className?: string;
  disabled?: boolean;
}

/**
 * Toolbelt Tool Icon Renderers
 */
function ToolIcon({
  tool,
  isGolden,
  isActive,
}: {
  tool: ToolType;
  isGolden?: boolean;
  isActive: boolean;
}) {
  switch (tool) {
    case 'trowel':
      return (
        <svg
          className={`w-6 h-6 md:w-7 md:h-7 transition-transform ${
            isActive ? 'scale-110 text-amber-200' : 'text-amber-100/70'
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2l6 6-9 9H5v-6l9-9z" fill="currentColor" fillOpacity="0.15" />
          <path d="M3 21l3-3" strokeWidth="2.5" />
        </svg>
      );

    case 'watering_can':
      if (isGolden) {
        return (
          <svg
            className={`w-6 h-6 md:w-7 md:h-7 transition-transform ${
              isActive ? 'scale-110 text-amber-300' : 'text-amber-400'
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Golden Can Body */}
            <path
              d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"
              fill="#fbbf24"
              stroke="#d97706"
              strokeWidth="2"
            />
            {/* Sparkle */}
            <path
              d="M12 7l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"
              fill="#fef08a"
              stroke="#ca8a04"
              strokeWidth="0.5"
            />
          </svg>
        );
      }
      return (
        <svg
          className={`w-6 h-6 md:w-7 md:h-7 transition-transform ${
            isActive ? 'scale-110 text-cyan-300' : 'text-cyan-200/70'
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" fill="currentColor" fillOpacity="0.2" />
        </svg>
      );

    case 'seed_bag':
      return (
        <svg
          className={`w-6 h-6 md:w-7 md:h-7 transition-transform ${
            isActive ? 'scale-110 text-emerald-300' : 'text-emerald-200/70'
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22v-9" />
          <path
            d="M12 13a5 5 0 0 1 5-5c3 0 3 4 3 4s-4 0-4 4a5 5 0 0 1-4-3z"
            fill="currentColor"
            fillOpacity="0.2"
          />
          <path
            d="M12 13a5 5 0 0 0-5-5c-3 0-3 4-3 4s4 0 4 4a5 5 0 0 0 4-3z"
            fill="currentColor"
            fillOpacity="0.2"
          />
        </svg>
      );

    case 'hand':
    case 'scythe':
    default:
      return (
        <svg
          className={`w-6 h-6 md:w-7 md:h-7 transition-transform ${
            isActive ? 'scale-110 text-yellow-300' : 'text-yellow-200/70'
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Scythe Crescent Blade & Handle */}
          <path d="M3 21l9-9" strokeWidth="2.5" />
          <path
            d="M12 12c2-4 6-7 10-7 0 6-4 10-10 10"
            fill="currentColor"
            fillOpacity="0.25"
            strokeWidth="2"
          />
        </svg>
      );
  }
}

/**
 * Bottom Toolbelt Component for Garden Island 3D
 * - 4 Tools in fixed order: 1. Trowel, 2. Watering Can, 3. Seed Bag, 4. Hand/Scythe.
 * - Dynamic Golden Watering Can upgrade styling & icon.
 * - Seed Bag displays active seed indicator and count badge.
 * - SeedPicker popup floats directly above when Seed Bag is selected.
 * - Accessible >= 44x44px touch targets with keyboard shortcuts (1-4).
 * - Safe-area inset aware layout.
 */
export const Toolbelt: React.FC<ToolbeltProps> = ({
  inputManager: _inputManager,
  className = '',
  disabled = false,
}) => {
  const activeModal = useUiStore((state) => state.activeModal);
  const selectedTool = useUiStore((state) => state.selectedTool);
  const selectedSeed = useUiStore((state) => state.selectedSeed);

  const goldenWateringCanOwned = useGameStore((state) => state.farm.goldenWateringCanOwned);
  const inventorySeeds = useGameStore((state) => state.inventory.seeds);

  const isModalOpen = activeModal !== null;
  const isInteractive = !disabled && !isModalOpen;

  const currentSeedDef = CROPS[selectedSeed] ?? CROPS.carrot;
  const currentSeedCount = inventorySeeds[selectedSeed] ?? 0;

  const handleSelectTool = useCallback(
    (tool: ToolType) => {
      if (!isInteractive) return;
      audioManager.playSfx('ui_click');
      useUiStore.getState().setSelectedTool(tool);
    },
    [isInteractive]
  );

  const isTrowelActive = selectedTool === 'trowel';
  const isWateringActive = selectedTool === 'watering_can';
  const isSeedBagActive = selectedTool === 'seed_bag';
  const isHandActive = selectedTool === 'hand' || selectedTool === 'scythe';

  return (
    <div
      data-testid="toolbelt-container"
      data-modal-open={isModalOpen ? 'true' : 'false'}
      className={`fixed bottom-0 left-0 right-0 pointer-events-none z-30 flex flex-col items-center select-none ${className}`}
      style={{
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Floating SeedPicker Popup above Toolbelt */}
      {isSeedBagActive && (
        <div className="mb-2 pointer-events-auto transition-all duration-200">
          <SeedPicker
            disabled={!isInteractive}
            onClose={() => handleSelectTool('trowel')}
          />
        </div>
      )}

      {/* Main Toolbelt Bar */}
      <div
        className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-white/15 rounded-2xl p-1.5 shadow-2xl flex items-center gap-1.5 md:gap-2.5 max-w-[calc(100vw-1.5rem)] overflow-x-auto no-scrollbar"
        role="toolbar"
        aria-label="Farming Tools"
      >
        {/* 1. Trowel */}
        <button
          type="button"
          data-testid="tool-trowel"
          aria-label="Trowel (1)"
          aria-pressed={isTrowelActive}
          disabled={!isInteractive}
          onClick={() => handleSelectTool('trowel')}
          className={`min-w-[44px] min-h-[44px] w-14 h-15 md:w-16 md:h-17 flex flex-col items-center justify-between p-1 rounded-xl border transition-all duration-150 relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
            isTrowelActive
              ? 'border-2 border-emerald-400 ring-2 ring-emerald-400/40 bg-emerald-950/80 scale-105 shadow-md shadow-emerald-500/20 z-10'
              : 'border-white/10 bg-slate-800/80 hover:bg-slate-700/80 hover:border-white/25 scale-100 opacity-80 hover:opacity-100'
          } ${!isInteractive ? 'cursor-not-allowed opacity-40' : ''}`}
        >
          {/* Key shortcut badge */}
          <span className="absolute top-1 left-1.5 text-[9px] font-bold text-slate-300 leading-none">
            1
          </span>

          <div className="flex-1 flex items-center justify-center pointer-events-none mt-1">
            <ToolIcon tool="trowel" isActive={isTrowelActive} />
          </div>

          <span className="text-[10px] md:text-[11px] font-bold text-white leading-tight pointer-events-none">
            Trowel
          </span>
        </button>

        {/* 2. Watering Can */}
        <button
          type="button"
          data-testid="tool-watering_can"
          data-golden={goldenWateringCanOwned ? 'true' : 'false'}
          aria-label={goldenWateringCanOwned ? 'Golden Watering Can (2)' : 'Watering Can (2)'}
          aria-pressed={isWateringActive}
          disabled={!isInteractive}
          onClick={() => handleSelectTool('watering_can')}
          className={`min-w-[44px] min-h-[44px] w-14 h-15 md:w-16 md:h-17 flex flex-col items-center justify-between p-1 rounded-xl border transition-all duration-150 relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
            goldenWateringCanOwned
              ? isWateringActive
                ? 'border-2 border-amber-400 ring-2 ring-amber-400/50 bg-amber-950/80 scale-105 shadow-md shadow-amber-500/30 z-10 text-amber-200'
                : 'border-amber-500/50 bg-amber-950/40 hover:bg-amber-900/50 hover:border-amber-400 scale-100 opacity-90 hover:opacity-100 text-amber-300'
              : isWateringActive
                ? 'border-2 border-cyan-400 ring-2 ring-cyan-400/40 bg-cyan-950/80 scale-105 shadow-md shadow-cyan-500/20 z-10'
                : 'border-white/10 bg-slate-800/80 hover:bg-slate-700/80 hover:border-white/25 scale-100 opacity-80 hover:opacity-100'
          } ${!isInteractive ? 'cursor-not-allowed opacity-40' : ''}`}
        >
          {/* Key shortcut badge */}
          <span className="absolute top-1 left-1.5 text-[9px] font-bold text-slate-300 leading-none">
            2
          </span>

          <div className="flex-1 flex items-center justify-center pointer-events-none mt-1">
            <ToolIcon
              tool="watering_can"
              isGolden={goldenWateringCanOwned}
              isActive={isWateringActive}
            />
          </div>

          <span
            className={`text-[10px] md:text-[11px] font-bold leading-tight pointer-events-none ${
              goldenWateringCanOwned ? 'text-amber-300' : 'text-white'
            }`}
          >
            {goldenWateringCanOwned ? 'Golden Can' : 'Water Can'}
          </span>
        </button>

        {/* 3. Seed Bag */}
        <button
          type="button"
          data-testid="tool-seed_bag"
          aria-label={`Seed Bag (3) - ${currentSeedDef.name} (${currentSeedCount})`}
          aria-pressed={isSeedBagActive}
          disabled={!isInteractive}
          onClick={() => handleSelectTool('seed_bag')}
          className={`min-w-[44px] min-h-[44px] w-14 h-15 md:w-16 md:h-17 flex flex-col items-center justify-between p-1 rounded-xl border transition-all duration-150 relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
            isSeedBagActive
              ? 'border-2 border-emerald-400 ring-2 ring-emerald-400/40 bg-emerald-950/80 scale-105 shadow-md shadow-emerald-500/20 z-10'
              : 'border-white/10 bg-slate-800/80 hover:bg-slate-700/80 hover:border-white/25 scale-100 opacity-80 hover:opacity-100'
          } ${!isInteractive ? 'cursor-not-allowed opacity-40' : ''}`}
        >
          {/* Key shortcut badge */}
          <span className="absolute top-1 left-1.5 text-[9px] font-bold text-slate-300 leading-none">
            3
          </span>

          {/* Active seed inventory count chip */}
          <span
            data-testid="seed-badge-count"
            className="absolute top-1 right-1 px-1 py-0.2 rounded-full text-[9px] font-bold bg-emerald-900/90 text-emerald-200 border border-emerald-500/30 leading-tight pointer-events-none"
          >
            {currentSeedCount}
          </span>

          <div className="flex-1 flex items-center justify-center pointer-events-none mt-1">
            <ToolIcon tool="seed_bag" isActive={isSeedBagActive} />
          </div>

          <span className="text-[10px] md:text-[11px] font-bold text-white leading-tight pointer-events-none truncate max-w-[52px]">
            {isSeedBagActive ? currentSeedDef.name : 'Seeds'}
          </span>
        </button>

        {/* 4. Hand / Scythe */}
        <button
          type="button"
          data-testid="tool-hand"
          aria-label="Hand / Scythe (4)"
          aria-pressed={isHandActive}
          disabled={!isInteractive}
          onClick={() => handleSelectTool('hand')}
          className={`min-w-[44px] min-h-[44px] w-14 h-15 md:w-16 md:h-17 flex flex-col items-center justify-between p-1 rounded-xl border transition-all duration-150 relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
            isHandActive
              ? 'border-2 border-emerald-400 ring-2 ring-emerald-400/40 bg-emerald-950/80 scale-105 shadow-md shadow-emerald-500/20 z-10'
              : 'border-white/10 bg-slate-800/80 hover:bg-slate-700/80 hover:border-white/25 scale-100 opacity-80 hover:opacity-100'
          } ${!isInteractive ? 'cursor-not-allowed opacity-40' : ''}`}
        >
          {/* Key shortcut badge */}
          <span className="absolute top-1 left-1.5 text-[9px] font-bold text-slate-300 leading-none">
            4
          </span>

          <div className="flex-1 flex items-center justify-center pointer-events-none mt-1">
            <ToolIcon tool="hand" isActive={isHandActive} />
          </div>

          <span className="text-[10px] md:text-[11px] font-bold text-white leading-tight pointer-events-none">
            Harvest
          </span>
        </button>
      </div>
    </div>
  );
};
