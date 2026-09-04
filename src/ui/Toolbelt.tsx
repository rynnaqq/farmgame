import type React from 'react';
import { useCallback, useMemo } from 'react';
import { useGameStore } from '../state/gameStore';
import { useUiStore } from '../state/uiStore';
import { CROPS } from '../game/core/constants';
import type { ToolType } from '../state/storeTypes';
import { SeedPicker } from './SeedPicker';
import type { InputManager } from '../game/input/InputManager';
import { audioManager } from '../game/audio/AudioManager';
import { isVerdantMode } from '../game/core/gameMode';

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
 * - 3 Tools in fixed order: 1. Watering Can, 2. Seed Bag, 3. Hand/Scythe.
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
  const produce = useGameStore((state) => state.inventory.produce);

  const carrotCount = useMemo(
    () => produce.filter((p) => p.cropId === 'carrot').reduce((s, p) => s + p.quantity, 0),
    [produce]
  );
  const tomatoCount = useMemo(
    () => produce.filter((p) => p.cropId === 'tomato').reduce((s, p) => s + p.quantity, 0),
    [produce]
  );
  const pumpkinCount = useMemo(
    () => produce.filter((p) => p.cropId === 'pumpkin').reduce((s, p) => s + p.quantity, 0),
    [produce]
  );
  const goldenBerryCount = useMemo(
    () => produce.filter((p) => p.cropId === 'golden_berry').reduce((s, p) => s + p.quantity, 0),
    [produce]
  );
  const starfruitCount = useMemo(
    () => produce.filter((p) => p.cropId === 'starfruit').reduce((s, p) => s + p.quantity, 0),
    [produce]
  );

  const isModalOpen = activeModal !== null;
  const isInteractive = !disabled && !isModalOpen;
  // Verdant keeps arcade produce quickslots; core tools are till-free in all modes.
  const isVerdant = useMemo(() => isVerdantMode(), []);

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
          <SeedPicker disabled={!isInteractive} onClose={() => handleSelectTool('watering_can')} />
        </div>
      )}

      {/* Main Toolbelt Bar */}
      <div
        className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-white/15 rounded-2xl p-1.5 shadow-2xl flex items-center gap-1.5 md:gap-2.5 max-w-[calc(100vw-1.5rem)] overflow-x-auto no-scrollbar"
        role="toolbar"
        aria-label="Farming Tools"
      >
        {/* 1. Watering Can */}
        <button
          type="button"
          data-testid="tool-watering_can"
          data-golden={goldenWateringCanOwned ? 'true' : 'false'}
          aria-label={goldenWateringCanOwned ? 'Golden Watering Can (1)' : 'Watering Can (1)'}
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
          {/* Active selection arrow marker (Growden.io style) */}
          {isWateringActive && (
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-white text-[11px] leading-none animate-bounce select-none pointer-events-none drop-shadow">
              ▼
            </span>
          )}

          {/* Key shortcut badge */}
          <span className="absolute top-1 left-1.5 text-[9px] font-bold text-slate-300 leading-none">
            1
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

        {/* 2. Seed Bag */}
        <button
          type="button"
          data-testid="tool-seed_bag"
          aria-label={`Seed Bag (2) - ${currentSeedDef.name} (${currentSeedCount})`}
          aria-pressed={isSeedBagActive}
          disabled={!isInteractive}
          onClick={() => handleSelectTool('seed_bag')}
          className={`min-w-[44px] min-h-[44px] w-14 h-15 md:w-16 md:h-17 flex flex-col items-center justify-between p-1 rounded-xl border transition-all duration-150 relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
            isSeedBagActive
              ? 'border-2 border-emerald-400 ring-2 ring-emerald-400/40 bg-emerald-950/80 scale-105 shadow-md shadow-emerald-500/20 z-10'
              : 'border-white/10 bg-slate-800/80 hover:bg-slate-700/80 hover:border-white/25 scale-100 opacity-80 hover:opacity-100'
          } ${!isInteractive ? 'cursor-not-allowed opacity-40' : ''}`}
        >
          {/* Active selection arrow marker (Growden.io style) */}
          {isSeedBagActive && (
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-white text-[11px] leading-none animate-bounce select-none pointer-events-none drop-shadow">
              ▼
            </span>
          )}

          {/* Key shortcut badge */}
          <span className="absolute top-1 left-1.5 text-[9px] font-bold text-slate-300 leading-none">
            2
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

        {/* 3. Hand / Scythe */}
        <button
          type="button"
          data-testid="tool-hand"
          aria-label="Hand / Scythe (3)"
          aria-pressed={isHandActive}
          disabled={!isInteractive}
          onClick={() => handleSelectTool('hand')}
          className={`min-w-[44px] min-h-[44px] w-14 h-15 md:w-16 md:h-17 flex flex-col items-center justify-between p-1 rounded-xl border transition-all duration-150 relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
            isHandActive
              ? 'border-2 border-emerald-400 ring-2 ring-emerald-400/40 bg-emerald-950/80 scale-105 shadow-md shadow-emerald-500/20 z-10'
              : 'border-white/10 bg-slate-800/80 hover:bg-slate-700/80 hover:border-white/25 scale-100 opacity-80 hover:opacity-100'
          } ${!isInteractive ? 'cursor-not-allowed opacity-40' : ''}`}
        >
          {/* Active selection arrow marker (Growden.io style) */}
          {isHandActive && (
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-white text-[11px] leading-none animate-bounce select-none pointer-events-none drop-shadow">
              ▼
            </span>
          )}

          {/* Key shortcut badge */}
          <span className="absolute top-1 left-1.5 text-[9px] font-bold text-slate-300 leading-none">
            3
          </span>

          <div className="flex-1 flex items-center justify-center pointer-events-none mt-1">
            <ToolIcon tool="hand" isActive={isHandActive} />
          </div>

          <span className="text-[10px] md:text-[11px] font-bold text-white leading-tight pointer-events-none">
            Harvest
          </span>
        </button>

        {/* Verdant-only arcade quickslots (produce + backpack shortcuts) */}
        {isVerdant && (
          <>
            {/* 5. Carrot Quickslot */}
            <button
              type="button"
              data-testid="tool-slot-5"
              aria-label="Carrot Produce (5)"
              disabled={!isInteractive}
              onClick={() => {
                audioManager.playSfx('ui_click');
                useUiStore.getState().openModal('inventory');
              }}
              className="min-w-[40px] min-h-[44px] w-12 h-15 md:w-14 md:h-17 flex flex-col items-center justify-between p-1 rounded-xl border border-white/10 bg-slate-800/80 hover:bg-slate-700/80 hover:border-white/25 transition-all duration-150 relative cursor-pointer outline-none opacity-75 hover:opacity-100 hidden sm:flex"
            >
              <span className="absolute top-1 left-1.5 text-[9px] font-bold text-slate-300 leading-none">
                5
              </span>
              {carrotCount > 0 && (
                <span className="absolute top-1 right-1 px-1 py-0.2 rounded-full text-[9px] font-bold bg-amber-900/90 text-amber-200 border border-amber-500/30 leading-tight pointer-events-none">
                  {carrotCount}
                </span>
              )}
              <span className="text-xl mt-1">🥕</span>
              <span className="text-[10px] font-bold text-slate-300 leading-tight truncate max-w-[44px]">
                Carrot
              </span>
            </button>

            {/* 6. Tomato Quickslot */}
            <button
              type="button"
              data-testid="tool-slot-6"
              aria-label="Tomato Produce (6)"
              disabled={!isInteractive}
              onClick={() => {
                audioManager.playSfx('ui_click');
                useUiStore.getState().openModal('inventory');
              }}
              className="min-w-[40px] min-h-[44px] w-12 h-15 md:w-14 md:h-17 flex flex-col items-center justify-between p-1 rounded-xl border border-white/10 bg-slate-800/80 hover:bg-slate-700/80 hover:border-white/25 transition-all duration-150 relative cursor-pointer outline-none opacity-75 hover:opacity-100 hidden sm:flex"
            >
              <span className="absolute top-1 left-1.5 text-[9px] font-bold text-slate-300 leading-none">
                6
              </span>
              {tomatoCount > 0 && (
                <span className="absolute top-1 right-1 px-1 py-0.2 rounded-full text-[9px] font-bold bg-rose-900/90 text-rose-200 border border-rose-500/30 leading-tight pointer-events-none">
                  {tomatoCount}
                </span>
              )}
              <span className="text-xl mt-1">🍅</span>
              <span className="text-[10px] font-bold text-slate-300 leading-tight truncate max-w-[44px]">
                Tomato
              </span>
            </button>

            {/* 7. Pumpkin Quickslot */}
            <button
              type="button"
              data-testid="tool-slot-7"
              aria-label="Pumpkin Produce (7)"
              disabled={!isInteractive}
              onClick={() => {
                audioManager.playSfx('ui_click');
                useUiStore.getState().openModal('inventory');
              }}
              className="min-w-[40px] min-h-[44px] w-12 h-15 md:w-14 md:h-17 flex flex-col items-center justify-between p-1 rounded-xl border border-white/10 bg-slate-800/80 hover:bg-slate-700/80 hover:border-white/25 transition-all duration-150 relative cursor-pointer outline-none opacity-75 hover:opacity-100 hidden md:flex"
            >
              <span className="absolute top-1 left-1.5 text-[9px] font-bold text-slate-300 leading-none">
                7
              </span>
              {pumpkinCount > 0 && (
                <span className="absolute top-1 right-1 px-1 py-0.2 rounded-full text-[9px] font-bold bg-orange-900/90 text-orange-200 border border-orange-500/30 leading-tight pointer-events-none">
                  {pumpkinCount}
                </span>
              )}
              <span className="text-xl mt-1">🎃</span>
              <span className="text-[10px] font-bold text-slate-300 leading-tight truncate max-w-[44px]">
                Pumpkin
              </span>
            </button>

            {/* 8. Golden Berry Quickslot */}
            <button
              type="button"
              data-testid="tool-slot-8"
              aria-label="Golden Berry (8)"
              disabled={!isInteractive}
              onClick={() => {
                audioManager.playSfx('ui_click');
                useUiStore.getState().openModal('inventory');
              }}
              className="min-w-[40px] min-h-[44px] w-12 h-15 md:w-14 md:h-17 flex flex-col items-center justify-between p-1 rounded-xl border border-white/10 bg-slate-800/80 hover:bg-slate-700/80 hover:border-white/25 transition-all duration-150 relative cursor-pointer outline-none opacity-75 hover:opacity-100 hidden md:flex"
            >
              <span className="absolute top-1 left-1.5 text-[9px] font-bold text-slate-300 leading-none">
                8
              </span>
              {goldenBerryCount > 0 && (
                <span className="absolute top-1 right-1 px-1 py-0.2 rounded-full text-[9px] font-bold bg-amber-900/90 text-amber-200 border border-amber-500/30 leading-tight pointer-events-none">
                  {goldenBerryCount}
                </span>
              )}
              <span className="text-xl mt-1">🫐</span>
              <span className="text-[10px] font-bold text-slate-300 leading-tight truncate max-w-[44px]">
                Berry
              </span>
            </button>

            {/* 9. Starfruit Quickslot */}
            <button
              type="button"
              data-testid="tool-slot-9"
              aria-label="Starfruit (9)"
              disabled={!isInteractive}
              onClick={() => {
                audioManager.playSfx('ui_click');
                useUiStore.getState().openModal('inventory');
              }}
              className="min-w-[40px] min-h-[44px] w-12 h-15 md:w-14 md:h-17 flex flex-col items-center justify-between p-1 rounded-xl border border-white/10 bg-slate-800/80 hover:bg-slate-700/80 hover:border-white/25 transition-all duration-150 relative cursor-pointer outline-none opacity-75 hover:opacity-100 hidden lg:flex"
            >
              <span className="absolute top-1 left-1.5 text-[9px] font-bold text-slate-300 leading-none">
                9
              </span>
              {starfruitCount > 0 && (
                <span className="absolute top-1 right-1 px-1 py-0.2 rounded-full text-[9px] font-bold bg-yellow-900/90 text-yellow-200 border border-yellow-500/30 leading-tight pointer-events-none">
                  {starfruitCount}
                </span>
              )}
              <span className="text-xl mt-1">⭐</span>
              <span className="text-[10px] font-bold text-slate-300 leading-tight truncate max-w-[44px]">
                Starfruit
              </span>
            </button>

            {/* 0. Backpack Quickslot */}
            <button
              type="button"
              data-testid="tool-slot-0"
              aria-label="Backpack (0)"
              disabled={!isInteractive}
              onClick={() => {
                audioManager.playSfx('ui_click');
                useUiStore.getState().openModal('inventory');
              }}
              className="min-w-[40px] min-h-[44px] w-12 h-15 md:w-14 md:h-17 flex flex-col items-center justify-between p-1 rounded-xl border border-white/10 bg-slate-800/80 hover:bg-slate-700/80 hover:border-white/25 transition-all duration-150 relative cursor-pointer outline-none opacity-75 hover:opacity-100 hidden lg:flex"
            >
              <span className="absolute top-1 left-1.5 text-[9px] font-bold text-slate-300 leading-none">
                0
              </span>
              <span className="text-xl mt-1">🎒</span>
              <span className="text-[10px] font-bold text-slate-300 leading-tight truncate max-w-[44px]">
                Bag
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
