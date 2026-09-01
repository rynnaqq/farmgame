import type React from 'react';
import { useCallback } from 'react';
import { useGameStore } from '../state/gameStore';
import { useUiStore } from '../state/uiStore';
import { SeededRNG } from '../game/core/rng';
import { buyEgg } from '../game/economy/economyCommands';
import { getEggCatalog } from '../game/economy/shopCatalog';
import { MAX_PET_INVENTORY, type EggType } from '../game/core/constants';
import { audioManager } from '../game/audio/AudioManager';

export interface EggShopProps {
  className?: string;
  disabled?: boolean;
}

/**
 * Egg SVG Graphics for Common (warm speckled) and Rare (gilded star) companion eggs.
 */
function EggGraphic({ type }: { type: EggType }) {
  if (type === 'rare') {
    return (
      <svg className="w-14 h-16 md:w-16 md:h-20 drop-shadow-md" viewBox="0 0 64 80" fill="none">
        <defs>
          <linearGradient id="rareEggGrad" x1="16" y1="8" x2="48" y2="72" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FDE047" />
            <stop offset="0.4" stopColor="#EAB308" />
            <stop offset="0.8" stopColor="#CA8A04" />
            <stop offset="1" stopColor="#854D0E" />
          </linearGradient>
        </defs>
        <ellipse cx="32" cy="44" rx="26" ry="34" fill="url(#rareEggGrad)" stroke="#FEF08A" strokeWidth="2.5" />
        {/* Shimmer streaks and star marking */}
        <path d="M22 28c4-12 16-16 22-12" stroke="#FEF9C3" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        <path
          d="M32 36l2.5 5 5.5.8-4 4 1 5.5-5-2.7-5 2.7 1-5.5-4-4 5.5-.8z"
          fill="#FEF08A"
          stroke="#A16207"
          strokeWidth="1.2"
        />
      </svg>
    );
  }

  return (
    <svg className="w-14 h-16 md:w-16 md:h-20 drop-shadow-md" viewBox="0 0 64 80" fill="none">
      <defs>
        <linearGradient id="commonEggGrad" x1="16" y1="8" x2="48" y2="72" gradientUnits="userSpaceOnUse">
          <stop stopColor="#BAE6FD" />
          <stop offset="0.5" stopColor="#38BDF8" />
          <stop offset="1" stopColor="#0284C7" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="44" rx="26" ry="34" fill="url(#commonEggGrad)" stroke="#E0F2FE" strokeWidth="2.5" />
      <path d="M22 28c4-12 16-16 22-12" stroke="#F0F9FF" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
      {/* Speckles */}
      <circle cx="26" cy="46" r="3" fill="#0369A1" opacity="0.6" />
      <circle cx="38" cy="38" r="2.5" fill="#0369A1" opacity="0.6" />
      <circle cx="34" cy="56" r="3.5" fill="#0369A1" opacity="0.6" />
    </svg>
  );
}

/**
 * EggShop Sub-component:
 * - Tab 4 in ShopModal
 * - Displays pet capacity counter (X / 12 pets)
 * - Renders Common Egg and Rare Egg purchase cards with odds breakdown and perks
 * - Deducts coins and generates deterministic outcomes atomically via economy commands
 */
export const EggShop: React.FC<EggShopProps> = ({ className = '', disabled = false }) => {
  const coins = useGameStore((state) => state.player.coins);
  const pets = useGameStore((state) => state.inventory.pets);
  const eggs = useGameStore((state) => state.inventory.eggs);

  const occupiedSlots = pets.length + eggs.length;
  const isInventoryFull = occupiedSlots >= MAX_PET_INVENTORY;
  const eggCatalog = getEggCatalog();

  const handleBuyEgg = useCallback(
    (eggType: EggType) => {
      if (disabled) return;
      const store = useGameStore.getState();
      const rng = new SeededRNG(store.rngState);
      const result = buyEgg(eggType, rng);

      if (result.ok) {
        audioManager.playSfx('coin');
        useUiStore
          .getState()
          .showToast(`Purchased ${eggType === 'rare' ? 'Rare' : 'Common'} Egg! Check Pet Sanctuary.`, 'success', 3000);
      } else {
        audioManager.playSfx('error');
        useUiStore.getState().showToast(result.message, 'error', 3000);
      }
    },
    [disabled]
  );

  return (
    <div data-testid="pane-eggs" className={`flex flex-col gap-4 ${className}`}>
      {/* Top Banner & Pet Capacity Tracker */}
      <div className="flex items-center justify-between bg-slate-800/80 border border-slate-700/60 rounded-xl p-3.5 shadow-inner">
        <div>
          <h3 className="text-sm font-bold text-sky-300">Companion Pet Sanctuary</h3>
          <p className="text-xs text-slate-300">
            Hatch eggs into loyal companions with automatic harvesting, growth boosts, and luck perks.
          </p>
        </div>

        <div
          data-testid="pet-capacity-counter"
          className={`flex flex-col items-end px-3 py-1.5 rounded-lg border font-mono text-xs font-bold tracking-tight ${
            isInventoryFull
              ? 'bg-rose-950/80 border-rose-500 text-rose-300'
              : 'bg-slate-900/90 border-slate-700 text-emerald-300'
          }`}
        >
          <span className="text-[10px] text-slate-400 uppercase font-sans">Capacity</span>
          <span>
            {occupiedSlots} / {MAX_PET_INVENTORY} pets
          </span>
        </div>
      </div>

      {isInventoryFull && (
        <div className="bg-amber-950/60 border border-amber-500/50 rounded-lg p-2.5 text-xs text-amber-200 text-center font-medium">
          Pet capacity full ({MAX_PET_INVENTORY}/{MAX_PET_INVENTORY}). Hatch existing eggs or manage pets to purchase more.
        </div>
      )}

      {/* Egg Catalog Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {eggCatalog.map((item) => {
          const canAfford = coins >= item.cost;
          const isPurchasable = canAfford && !isInventoryFull && !disabled;

          return (
            <div
              key={item.eggType}
              data-testid={`egg-card-${item.eggType}`}
              className="bg-slate-800/90 border border-slate-700/80 hover:border-slate-600 rounded-2xl p-4 flex flex-col justify-between shadow-lg transition-all duration-150"
            >
              <div className="flex gap-3.5 items-start">
                <div className="flex-shrink-0 flex items-center justify-center p-2 rounded-xl bg-slate-900/70 border border-white/5">
                  <EggGraphic type={item.eggType} />
                </div>

                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-bold text-white tracking-wide">{item.name}</h4>
                    <span className="text-sm font-black text-amber-400 flex items-center gap-1 font-mono">
                      <span>🪙</span>
                      <span>{item.cost.toLocaleString()}c</span>
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">{item.description}</p>

                  {/* Odds Breakdown Table */}
                  <div
                    data-testid={`egg-odds-${item.eggType}`}
                    className="mt-3 bg-slate-900/80 border border-slate-700/50 rounded-xl p-2.5 text-[11px] flex flex-col gap-1 text-slate-300"
                  >
                    <div className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider mb-0.5">
                      Hatch Probabilities & Perks:
                    </div>
                    {item.eggType === 'common' ? (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-amber-200">🐶 Dog (Auto-Harvester):</span>
                          <span className="font-bold text-white font-mono">60%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-amber-200">🐝 Bee (+15% Growth Speed):</span>
                          <span className="font-bold text-white font-mono">35%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-amber-200">🐷 Pig (+20% Mutation Chance):</span>
                          <span className="font-bold text-white font-mono">5%</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-amber-200">🐷 Pig (+20% Mutation Chance):</span>
                          <span className="font-bold text-white font-mono">50%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-amber-200">🐝 Bee (+15% Growth Speed):</span>
                          <span className="font-bold text-white font-mono">30%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-amber-200">🐶 Dog (Auto-Harvester):</span>
                          <span className="font-bold text-white font-mono">20%</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Purchase Action Button */}
              <div className="mt-4 pt-2 border-t border-slate-700/40 flex justify-end">
                <button
                  type="button"
                  data-testid={`buy-egg-${item.eggType}`}
                  disabled={!isPurchasable}
                  onClick={() => handleBuyEgg(item.eggType)}
                  className={`min-h-[44px] px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    isPurchasable
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-md shadow-amber-900/30 cursor-pointer active:scale-95'
                      : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-60'
                  }`}
                >
                  <span>Buy {item.name}</span>
                  <span>({item.cost.toLocaleString()}c)</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
