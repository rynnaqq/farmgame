import type React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../state/gameStore';
import { useUiStore } from '../state/uiStore';
import {
  CROPS,
  MUTATION_MULTIPLIERS,
  EGG_CONFIGS,
  EGG_HATCH_DISTANCE,
  type CropId,
  type EggType,
} from '../game/core/constants';
import { calculateProduceSaleValue } from '../game/economy/economyDefinitions';
import { selectTotalProduceValue } from '../state/selectors';
import { audioManager } from '../game/audio/AudioManager';

export type InventoryTabId = 'seeds' | 'produce' | 'eggs';

export interface InventoryPanelProps {
  initialTab?: InventoryTabId;
  onClose?: () => void;
  className?: string;
}

function CropIcon({ cropId }: { cropId: CropId }) {
  switch (cropId) {
    case 'carrot':
      return <span className="text-xl" role="img" aria-label="Carrot">🥕</span>;
    case 'tomato':
      return <span className="text-xl" role="img" aria-label="Tomato">🍅</span>;
    case 'pumpkin':
      return <span className="text-xl" role="img" aria-label="Pumpkin">🎃</span>;
    case 'golden_berry':
      return <span className="text-xl" role="img" aria-label="Golden Berry">🌟</span>;
    case 'starfruit':
      return <span className="text-xl" role="img" aria-label="Starfruit">⭐</span>;
  }
}

function getEggName(type: EggType): string {
  return EGG_CONFIGS[type]?.name ?? (type === 'rare' ? 'Rare Egg' : 'Common Egg');
}

/**
 * Full Inventory drawer / modal for Garden Island 3D:
 * - Seeds Tab: All 5 crops with current stock and planting info
 * - Produce Tab: Harvested produce stacks with mutation multipliers, unit values, and stack totals
 * - Eggs Tab: Companion eggs in inventory with incubation status and hatch distance
 * - Footer: Total estimated produce value and quick "Open Shop to Sell" shortcut button
 */
export const InventoryPanel: React.FC<InventoryPanelProps> = ({
  initialTab = 'produce',
  onClose,
  className = '',
}) => {
  const activeModal = useUiStore((state) => state.activeModal);
  const [activeTab, setActiveTab] = useState<InventoryTabId>(initialTab);

  const dialogRef = useRef<HTMLDivElement>(null);

  const inventorySeeds = useGameStore((state) => state.inventory.seeds);
  const produceStacks = useGameStore((state) => state.inventory.produce);
  const eggs = useGameStore((state) => state.inventory.eggs);

  const totalProduceValue = useGameStore(selectTotalProduceValue);

  // Sync initial tab when modal opens
  useEffect(() => {
    if (activeModal === 'inventory') {
      setActiveTab(initialTab);
    }
  }, [activeModal, initialTab]);

  const handleClose = useCallback(() => {
    audioManager.playSfx('ui_click');
    useUiStore.getState().closeModal();
    onClose?.();
  }, [onClose]);

  // Focus trap & Escape key listener
  useEffect(() => {
    if (activeModal !== 'inventory') return;

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

  // Auto-focus dialog on mount
  useEffect(() => {
    if (activeModal === 'inventory' && dialogRef.current) {
      const firstBtn = dialogRef.current.querySelector<HTMLElement>('button:not([disabled])');
      firstBtn?.focus();
    }
  }, [activeModal, activeTab]);

  const handleOpenShop = useCallback(() => {
    useUiStore.getState().openModal('shop');
  }, []);

  if (activeModal !== 'inventory') {
    return null;
  }

  const cropList = Object.values(CROPS);

  return (
    <div
      data-testid="inventory-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 select-none animate-in fade-in duration-200"
    >
      {/* Dimmed backdrop */}
      <div
        data-testid="inventory-backdrop"
        onClick={handleClose}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Modal Dialog Box */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-dialog-title"
        data-testid="inventory-modal"
        className={`relative z-10 w-full max-w-2xl max-h-[92vh] bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans pointer-events-auto ${className}`}
      >
        {/* ========================================== */}
        {/* 1. Modal Header                            */}
        {/* ========================================== */}
        <header className="px-5 py-3.5 bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 border-b border-emerald-500/20 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl" role="img" aria-label="Inventory Backpack">
              🎒
            </span>
            <div>
              <h2 id="inventory-dialog-title" className="text-base md:text-lg font-bold text-emerald-200 tracking-wide">
                Farm Inventory
              </h2>
              <p className="text-xs text-emerald-300/70">Seeds stock, harvested produce & companion eggs</p>
            </div>
          </div>

          {/* Close Button (X) */}
          <button
            type="button"
            data-testid="inventory-close-button"
            aria-label="Close Inventory"
            onClick={handleClose}
            className="min-w-[36px] min-h-[36px] w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </header>

        {/* ========================================== */}
        {/* 2. Tab Navigation Bar                      */}
        {/* ========================================== */}
        <nav
          role="tablist"
          aria-label="Inventory categories"
          className="flex border-b border-slate-800 bg-slate-950/50 px-3 pt-2 gap-1.5 flex-shrink-0 overflow-x-auto no-scrollbar"
        >
          {(
            [
              { id: 'produce', label: 'Produce', icon: '🧺', testId: 'tab-produce' },
              { id: 'seeds', label: 'Seeds', icon: '🌱', testId: 'tab-seeds' },
              { id: 'eggs', label: 'Eggs', icon: '🥚', testId: 'tab-eggs' },
            ] as const
          ).map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                id={`tab-${tab.id}`}
                aria-controls={`pane-${tab.id}`}
                aria-selected={isSelected}
                data-testid={tab.testId}
                onClick={() => {
                  audioManager.playSfx('ui_click');
                  setActiveTab(tab.id);
                }}
                className={`min-h-[44px] px-4 py-2 rounded-t-xl text-xs md:text-sm font-bold flex items-center gap-2 border-t border-x transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 border-emerald-500/40 text-emerald-300 border-b-transparent translate-y-[1px] shadow-sm'
                    : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ========================================== */}
        {/* 3. Tab Content Area (Scrollable)           */}
        {/* ========================================== */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-900/95 space-y-4">
          {/* -------------------------------------- */}
          {/* TAB 1: PRODUCE                         */}
          {/* -------------------------------------- */}
          {activeTab === 'produce' && (
            <div data-testid="pane-produce" role="tabpanel" aria-labelledby="tab-produce" className="flex flex-col gap-3">
              {produceStacks.length === 0 ? (
                <div
                  data-testid="produce-empty-state"
                  className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-2"
                >
                  <span className="text-3xl">🧺</span>
                  <p className="text-sm font-bold text-slate-300">No produce in inventory</p>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Harvest mature crops with your hand or scythe to store produce stacks here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {produceStacks.map((stack) => {
                    const mult = MUTATION_MULTIPLIERS[stack.mutation] ?? 1;
                    const unitPrice = calculateProduceSaleValue(stack.cropId, stack.mutation, 1);
                    const stackTotal = calculateProduceSaleValue(stack.cropId, stack.mutation, stack.quantity);

                    return (
                      <div
                        key={`${stack.cropId}-${stack.mutation}`}
                        data-testid={`inventory-produce-stack-${stack.cropId}-${stack.mutation}`}
                        className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-slate-600 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center border border-white/5">
                            <CropIcon cropId={stack.cropId} />
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-white capitalize">
                                {stack.cropId.replace('_', ' ')}
                              </h4>
                              <span className="text-xs font-bold text-emerald-300 font-mono">
                                x{stack.quantity}
                              </span>

                              {/* Mutation Badge */}
                              <span
                                data-testid={`inventory-mutation-badge-${stack.mutation}`}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono ${
                                  stack.mutation === 'gold'
                                    ? 'bg-amber-950 text-amber-300 border border-amber-500/60'
                                    : stack.mutation === 'giant'
                                    ? 'bg-indigo-950 text-indigo-300 border border-indigo-500/60'
                                    : stack.mutation === 'cosmic'
                                    ? 'bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-500/60 animate-pulse'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                              >
                                {stack.mutation === 'none' ? 'Normal (1x)' : `${stack.mutation} (${mult}x)`}
                              </span>
                            </div>

                            <div className="text-xs text-slate-400 font-mono mt-1">
                              <span>Unit: {unitPrice}c</span> ·{' '}
                              <span className="text-amber-300 font-bold">Stack Total: {stackTotal.toLocaleString()}c</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* -------------------------------------- */}
          {/* TAB 2: SEEDS                           */}
          {/* -------------------------------------- */}
          {activeTab === 'seeds' && (
            <div data-testid="pane-seeds" role="tabpanel" aria-labelledby="tab-seeds" className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-2.5">
                {cropList.map((crop) => {
                  const count = inventorySeeds[crop.id] ?? 0;

                  return (
                    <div
                      key={crop.id}
                      data-testid={`inventory-seed-item-${crop.id}`}
                      className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-slate-600 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center border border-white/5">
                          <CropIcon cropId={crop.id} />
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">{crop.name} Seeds</h4>
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5 flex gap-3">
                            <span>⏳ {crop.baseGrowthSec}s growth</span>
                            <span>💰 {crop.baseSalePrice}c base sell</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          data-testid={`inventory-seed-count-${crop.id}`}
                          className="px-3 py-1 rounded-xl font-mono font-bold text-sm bg-slate-950 border border-emerald-500/30 text-emerald-300 shadow-inner"
                        >
                          {count}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* -------------------------------------- */}
          {/* TAB 3: EGGS                            */}
          {/* -------------------------------------- */}
          {activeTab === 'eggs' && (
            <div data-testid="pane-eggs" role="tabpanel" aria-labelledby="tab-eggs" className="flex flex-col gap-3">
              {eggs.length === 0 ? (
                <div
                  data-testid="eggs-empty-state"
                  className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-2"
                >
                  <span className="text-3xl">🥚</span>
                  <p className="text-sm font-bold text-slate-300">No pet eggs in inventory</p>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Purchase companion eggs from the Merchant shop to hatch loyal animal pets that help you farm.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {eggs.map((egg) => {
                    const eggName = getEggName(egg.type);

                    return (
                      <div
                        key={egg.id}
                        data-testid={`inventory-egg-item-${egg.id}`}
                        className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-slate-600 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center border border-white/5 text-xl">
                            🥚
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white">{eggName}</h4>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono ${
                                  egg.incubating
                                    ? 'bg-amber-950 text-amber-300 border border-amber-500/50 animate-pulse'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                              >
                                {egg.incubating ? 'Incubating' : 'Stored'}
                              </span>
                            </div>

                            <div className="text-xs text-slate-400 font-mono mt-0.5">
                              {egg.incubating ? (
                                <span>
                                  Walk distance: {egg.distanceTraveled.toFixed(0)} / {EGG_HATCH_DISTANCE}m
                                </span>
                              ) : (
                                <span>Place in incubator or walk to hatch</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>

        {/* ========================================== */}
        {/* 4. Footer Summary                          */}
        {/* ========================================== */}
        <footer className="px-5 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-3 flex-shrink-0">
          <div
            data-testid="inventory-total-value"
            className="text-xs md:text-sm font-bold font-mono text-amber-300 flex items-center gap-1.5"
          >
            <span>💰 Total Value:</span>
            <span>{totalProduceValue.toLocaleString()}c</span>
          </div>

          <button
            type="button"
            data-testid="inventory-open-shop-button"
            onClick={handleOpenShop}
            className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-md shadow-amber-900/30 transition-all active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
          >
            Open Shop to Sell
          </button>
        </footer>
      </div>
    </div>
  );
};
