import type React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useGameStore } from '../state/gameStore';
import { useUiStore } from '../state/uiStore';
import { EggShop } from './EggShop';
import {
  buySeed,
  sellProduce,
  sellAllProduce,
  buyGoldenWateringCan,
  buyGridExpansion,
} from '../game/economy/economyCommands';
import { getSeedCatalog, getUpgradeCatalog } from '../game/economy/shopCatalog';
import { calculateProduceSaleValue } from '../game/economy/economyDefinitions';
import { MUTATION_MULTIPLIERS, type CropId, type MutationType } from '../game/core/constants';
import { audioManager } from '../game/audio/AudioManager';

export type ShopTabId = 'seeds' | 'sell' | 'upgrades' | 'eggs';

export interface ShopModalProps {
  initialTab?: ShopTabId;
  onClose?: () => void;
  className?: string;
}

/**
 * Seed & Produce SVG icon helper for the shop cards.
 */
function CropIcon({ cropId }: { cropId: CropId }) {
  switch (cropId) {
    case 'carrot':
      return (
        <span className="text-xl" role="img" aria-label="Carrot">
          🥕
        </span>
      );
    case 'tomato':
      return (
        <span className="text-xl" role="img" aria-label="Tomato">
          🍅
        </span>
      );
    case 'pumpkin':
      return (
        <span className="text-xl" role="img" aria-label="Pumpkin">
          🎃
        </span>
      );
    case 'golden_berry':
      return (
        <span className="text-xl" role="img" aria-label="Golden Berry">
          🌟
        </span>
      );
    case 'starfruit':
      return (
        <span className="text-xl" role="img" aria-label="Starfruit">
          ⭐
        </span>
      );
  }
}

/**
 * Tabbed Shop Modal component:
 * - Tab 1: Seeds (1x & 5x buy buttons for all 5 crops with price, growth time, base sell value)
 * - Tab 2: Sell (Produce stacks with mutation multiplier badges, unit/stack prices, Sell & Sell All)
 * - Tab 3: Upgrades (Golden Watering Can, Plot Expansion 6x6 and 8x8)
 * - Tab 4: Eggs (Companion egg store with odds breakdown and slot capacity counter)
 * - Accessible focus trap, Escape dismissal, backdrop close, and atomic economy operations.
 */
export const ShopModal: React.FC<ShopModalProps> = ({
  initialTab = 'seeds',
  onClose,
  className = '',
}) => {
  const activeModal = useUiStore((state) => state.activeModal);
  const [activeTab, setActiveTab] = useState<ShopTabId>(initialTab);

  const dialogRef = useRef<HTMLDivElement>(null);

  const coins = useGameStore((state) => state.player.coins);
  const inventorySeeds = useGameStore((state) => state.inventory.seeds);
  const produceStacks = useGameStore((state) => state.inventory.produce);
  const gridSize = useGameStore((state) => state.farm.gridSize);
  const goldenCanOwned = useGameStore((state) => state.farm.goldenWateringCanOwned);

  const modalData = useUiStore((state) => state.modalData) as { initialTab?: ShopTabId } | null;

  // Sync initial tab when modal opens
  useEffect(() => {
    if (activeModal === 'shop') {
      setActiveTab(modalData?.initialTab || initialTab);
    }
  }, [activeModal, initialTab, modalData]);

  const handleClose = useCallback(() => {
    audioManager.playSfx('ui_click');
    useUiStore.getState().closeModal();
    onClose?.();
  }, [onClose]);

  // Focus trap & Escape key listener
  useEffect(() => {
    if (activeModal !== 'shop') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'Tab') {
        // Focus trap
        if (!dialogRef.current) return;
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

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
    if (activeModal === 'shop' && dialogRef.current) {
      const firstBtn = dialogRef.current.querySelector<HTMLElement>('button:not([disabled])');
      firstBtn?.focus();
    }
  }, [activeModal, activeTab]);

  // Seed purchasing
  const handleBuySeeds = useCallback((cropId: CropId, quantity: number) => {
    const result = buySeed(cropId, quantity);
    if (result.ok) {
      audioManager.playSfx('coin');
      useUiStore
        .getState()
        .showToast(result.message ?? `Purchased ${quantity}x seeds`, 'success', 2500);
    } else {
      audioManager.playSfx('error');
      useUiStore.getState().showToast(result.message, 'error', 2500);
    }
  }, []);

  // Produce selling
  const handleSellStack = useCallback((cropId: CropId, mutation: MutationType) => {
    const result = sellProduce(cropId, mutation);
    if (result.ok) {
      audioManager.playSfx('coin');
      useUiStore.getState().showToast(result.message ?? 'Produce sold', 'success', 2500);
    } else {
      audioManager.playSfx('error');
      useUiStore.getState().showToast(result.message, 'error', 2500);
    }
  }, []);

  const handleSellAll = useCallback(() => {
    const result = sellAllProduce();
    if (result.ok) {
      audioManager.playSfx('coin');
      useUiStore
        .getState()
        .showToast(
          result.message ?? `Sold all produce for ${result.value.totalCoinsEarned} coins!`,
          'success',
          3000
        );
    } else {
      audioManager.playSfx('error');
      useUiStore.getState().showToast(result.message, 'error', 2500);
    }
  }, []);

  // Upgrades
  const handleBuyGoldenCan = useCallback(() => {
    const result = buyGoldenWateringCan();
    if (result.ok) {
      audioManager.playSfx('coin');
      useUiStore.getState().showToast('Purchased Golden Watering Can!', 'success', 3000);
    } else {
      audioManager.playSfx('error');
      useUiStore.getState().showToast(result.message, 'error', 2500);
    }
  }, []);

  const handleBuyExpansion = useCallback(() => {
    const result = buyGridExpansion();
    if (result.ok) {
      audioManager.playSfx('coin');
      useUiStore.getState().showToast(result.message ?? 'Expanded farm grid!', 'success', 3500);
    } else {
      audioManager.playSfx('error');
      useUiStore.getState().showToast(result.message, 'error', 2500);
    }
  }, []);

  const totalProduceValue = useMemo(() => {
    return produceStacks.reduce(
      (sum, stack) => sum + calculateProduceSaleValue(stack.cropId, stack.mutation, stack.quantity),
      0
    );
  }, [produceStacks]);

  if (activeModal !== 'shop') {
    return null;
  }

  const seedCatalog = getSeedCatalog();
  const upgradeCatalog = getUpgradeCatalog(gridSize, goldenCanOwned);

  return (
    <div
      data-testid="shop-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 select-none animate-in fade-in duration-200"
    >
      {/* Dimmed backdrop */}
      <div
        data-testid="shop-backdrop"
        onClick={handleClose}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Modal Dialog Box */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shop-dialog-title"
        data-testid="shop-modal"
        className={`relative z-10 w-full max-w-2xl max-h-[92vh] bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans pointer-events-auto ${className}`}
      >
        {/* ========================================== */}
        {/* 1. Modal Header                            */}
        {/* ========================================== */}
        <header className="px-5 py-3.5 bg-gradient-to-r from-amber-950/70 via-slate-900 to-slate-900 border-b border-amber-500/20 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl" role="img" aria-label="Merchant Stall">
              🏪
            </span>
            <div>
              <h2
                id="shop-dialog-title"
                className="text-base md:text-lg font-bold text-amber-200 tracking-wide"
              >
                Merchant's Island Shop
              </h2>
              <p className="text-xs text-amber-300/70">
                Seeds, produce trading, farm expansions & companion eggs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Coin Counter */}
            <div
              data-testid="shop-player-coins"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-amber-500/40 text-amber-300 font-mono font-bold text-sm md:text-base shadow-inner"
              title="Your Coins"
            >
              <span>🪙</span>
              <span>{coins.toLocaleString()}</span>
            </div>

            {/* Close Button (X) */}
            <button
              type="button"
              data-testid="shop-close-button"
              aria-label="Close Shop"
              onClick={handleClose}
              className="min-w-[36px] min-h-[36px] w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </header>

        {/* ========================================== */}
        {/* 2. Tab Navigation Bar                      */}
        {/* ========================================== */}
        <nav
          role="tablist"
          aria-label="Shop categories"
          className="flex border-b border-slate-800 bg-slate-950/50 px-3 pt-2 gap-1.5 flex-shrink-0 overflow-x-auto no-scrollbar"
        >
          {(
            [
              { id: 'seeds', label: 'Seeds', icon: '🌱', testId: 'tab-seeds' },
              { id: 'sell', label: 'Sell Produce', icon: '💰', testId: 'tab-sell' },
              { id: 'upgrades', label: 'Upgrades', icon: '⭐', testId: 'tab-upgrades' },
              { id: 'eggs', label: 'Companion Eggs', icon: '🥚', testId: 'tab-eggs' },
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
                className={`min-h-[44px] px-4 py-2 rounded-t-xl text-xs md:text-sm font-bold flex items-center gap-2 border-t border-x transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 border-amber-500/40 text-amber-300 border-b-transparent translate-y-[1px] shadow-sm'
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
          {/* TAB 1: SEEDS                           */}
          {/* -------------------------------------- */}
          {activeTab === 'seeds' && (
            <div
              data-testid="pane-seeds"
              role="tabpanel"
              aria-labelledby="tab-seeds"
              className="flex flex-col gap-3"
            >
              <div className="text-xs text-slate-400 mb-1">
                Purchase seeds to plant in your tilled plots. Higher tier crops yield greater
                profits and higher mutation rewards.
              </div>

              <div className="grid grid-cols-1 gap-3">
                {seedCatalog.map((item) => {
                  const ownedCount = inventorySeeds[item.cropId] ?? 0;
                  const canAfford1 = coins >= item.seedCost;
                  const canAfford5 = coins >= item.cost5x;

                  return (
                    <div
                      key={item.cropId}
                      data-testid={`seed-item-${item.cropId}`}
                      className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-slate-600 transition-colors"
                    >
                      {/* Left: Crop Details */}
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center border border-white/5 flex-shrink-0">
                          <CropIcon cropId={item.cropId} />
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">{item.name}</h4>
                            <span
                              data-testid={`seed-owned-${item.cropId}`}
                              className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-900/90 text-emerald-300 border border-emerald-500/30"
                            >
                              Owned: {ownedCount}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
                            <span>
                              ⏳ <strong className="text-slate-300">{item.baseGrowthSec}s</strong>
                            </span>
                            <span>
                              💰 Base Sell:{' '}
                              <strong className="text-amber-300">{item.baseSalePrice}c</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Buy Buttons */}
                      <div className="flex items-center gap-2 self-end md:self-center">
                        <button
                          type="button"
                          data-testid={`buy-seed-1-${item.cropId}`}
                          disabled={!canAfford1}
                          onClick={() => handleBuySeeds(item.cropId, 1)}
                          className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                            canAfford1
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40 cursor-pointer active:scale-95'
                              : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-50'
                          }`}
                        >
                          <span>Buy 1</span>
                          <span>({item.seedCost}c)</span>
                        </button>

                        <button
                          type="button"
                          data-testid={`buy-seed-5-${item.cropId}`}
                          disabled={!canAfford5}
                          onClick={() => handleBuySeeds(item.cropId, 5)}
                          className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                            canAfford5
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-950/40 cursor-pointer active:scale-95'
                              : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-50'
                          }`}
                        >
                          <span>Buy 5</span>
                          <span>({item.cost5x}c)</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* -------------------------------------- */}
          {/* TAB 2: SELL PRODUCE                    */}
          {/* -------------------------------------- */}
          {activeTab === 'sell' && (
            <div
              data-testid="pane-sell"
              role="tabpanel"
              aria-labelledby="tab-sell"
              className="flex flex-col gap-4"
            >
              {/* Header & Sell All Bar */}
              <div className="flex items-center justify-between bg-slate-800/80 border border-slate-700/60 rounded-xl p-3.5">
                <div>
                  <h3 className="text-sm font-bold text-white">Harvested Produce</h3>
                  <p className="text-xs text-slate-400">
                    Mutations apply huge multipliers (Gold 5x, Giant 3x, Cosmic 15x).
                  </p>
                </div>

                <button
                  type="button"
                  data-testid="sell-all-button"
                  disabled={produceStacks.length === 0 || totalProduceValue === 0}
                  onClick={handleSellAll}
                  className={`min-h-[44px] px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    produceStacks.length > 0 && totalProduceValue > 0
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-md shadow-amber-900/30 cursor-pointer active:scale-95'
                      : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-60'
                  }`}
                >
                  <span>Sell All</span>
                  {totalProduceValue > 0 && (
                    <span className="font-mono">(+{totalProduceValue.toLocaleString()}c)</span>
                  )}
                </button>
              </div>

              {/* Empty State */}
              {produceStacks.length === 0 ? (
                <div
                  data-testid="sell-empty-state"
                  className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-2"
                >
                  <span className="text-3xl">🧺</span>
                  <p className="text-sm font-bold text-slate-300">No produce in inventory</p>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Grow crops and harvest them with your hand or scythe to sell them here for
                    coins.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {produceStacks.map((stack) => {
                    const mult = MUTATION_MULTIPLIERS[stack.mutation] ?? 1;
                    const unitPrice = calculateProduceSaleValue(stack.cropId, stack.mutation, 1);
                    const stackTotal = calculateProduceSaleValue(
                      stack.cropId,
                      stack.mutation,
                      stack.quantity
                    );

                    return (
                      <div
                        key={`${stack.cropId}-${stack.mutation}`}
                        data-testid={`produce-stack-${stack.cropId}-${stack.mutation}`}
                        className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-slate-600 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center border border-white/5">
                            <CropIcon cropId={stack.cropId} />
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white capitalize">
                                {stack.cropId.replace('_', ' ')}
                              </h4>
                              <span className="text-xs font-bold text-emerald-300 font-mono">
                                x{stack.quantity}
                              </span>

                              {/* Mutation Badge */}
                              {stack.mutation !== 'none' && (
                                <span
                                  data-testid={`mutation-badge-${stack.mutation}`}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono ${
                                    stack.mutation === 'gold'
                                      ? 'bg-amber-950 text-amber-300 border border-amber-500/60'
                                      : stack.mutation === 'giant'
                                        ? 'bg-indigo-950 text-indigo-300 border border-indigo-500/60'
                                        : 'bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-500/60 animate-pulse'
                                  }`}
                                >
                                  {stack.mutation} ({mult}x)
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-slate-400 font-mono mt-0.5">
                              <span>Unit: {unitPrice}c</span> ·{' '}
                              <span className="text-amber-300 font-bold">
                                Total: {stackTotal.toLocaleString()}c
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          data-testid={`sell-stack-${stack.cropId}-${stack.mutation}`}
                          onClick={() => handleSellStack(stack.cropId, stack.mutation)}
                          className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-700 hover:bg-slate-600 text-amber-300 hover:text-amber-200 border border-white/10 transition-all active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
                        >
                          Sell ({stackTotal}c)
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* -------------------------------------- */}
          {/* TAB 3: UPGRADES                        */}
          {/* -------------------------------------- */}
          {activeTab === 'upgrades' && (
            <div
              data-testid="pane-upgrades"
              role="tabpanel"
              aria-labelledby="tab-upgrades"
              className="flex flex-col gap-3"
            >
              <div className="text-xs text-slate-400 mb-1">
                Permanent farm upgrades to accelerate crop watering and expand your island farming
                territory.
              </div>

              <div className="grid grid-cols-1 gap-3">
                {upgradeCatalog.map((upgrade) => {
                  const isAffordable = coins >= upgrade.cost;
                  let isInteractive = upgrade.isAvailable && !upgrade.isOwned;
                  let buttonText = `Buy (${upgrade.cost.toLocaleString()}c)`;

                  if (upgrade.isOwned) {
                    buttonText = 'Owned';
                    isInteractive = false;
                  } else if (!upgrade.isAvailable) {
                    if (upgrade.id === 'expansion_8x8') {
                      buttonText = 'Locked (Requires 6x6)';
                    }
                    isInteractive = false;
                  }

                  const handleUpgradeClick = () => {
                    if (upgrade.id === 'golden_can') {
                      handleBuyGoldenCan();
                    } else {
                      handleBuyExpansion();
                    }
                  };

                  return (
                    <div
                      key={upgrade.id}
                      data-testid={`upgrade-card-${upgrade.id}`}
                      className={`bg-slate-800/80 border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                        upgrade.isOwned
                          ? 'border-emerald-500/40 bg-emerald-950/20'
                          : upgrade.isAvailable
                            ? 'border-slate-700 hover:border-slate-600'
                            : 'border-slate-800 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center border border-white/5 text-2xl flex-shrink-0">
                          {upgrade.id === 'golden_can' ? '✨🚰' : '🌾'}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">{upgrade.name}</h4>
                            {upgrade.isOwned && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-900/80 text-emerald-300 border border-emerald-500/40">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                            {upgrade.description}
                          </p>
                        </div>
                      </div>

                      <div className="self-end md:self-center flex-shrink-0">
                        <button
                          type="button"
                          data-testid={`upgrade-buy-${upgrade.id}`}
                          disabled={!isInteractive || !isAffordable}
                          onClick={handleUpgradeClick}
                          className={`min-h-[44px] px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                            upgrade.isOwned
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-600/50 cursor-default'
                              : isInteractive && isAffordable
                                ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-md shadow-amber-900/30 cursor-pointer active:scale-95'
                                : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-60'
                          }`}
                        >
                          {buttonText}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* -------------------------------------- */}
          {/* TAB 4: COMPANION EGGS (EggShop)        */}
          {/* -------------------------------------- */}
          {activeTab === 'eggs' && <EggShop />}
        </main>
      </div>
    </div>
  );
};
