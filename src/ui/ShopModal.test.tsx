import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShopModal } from './ShopModal';
import { useGameStore, resetGameStore } from '../state/gameStore';
import { useUiStore, resetUiStore } from '../state/uiStore';
import { resetSettingsStore } from '../state/settingsStore';
import {
  CROPS,
  GOLDEN_WATERING_CAN_COST,
} from '../game/core/constants';

describe('Task 16: ShopModal & EggShop Component Tests', () => {
  beforeEach(() => {
    resetGameStore(42);
    resetUiStore();
    resetSettingsStore();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Modal Visibility, Overlay & Dismissal', () => {
    it('does not render dialog content when activeModal is null or another modal', () => {
      render(<ShopModal />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByTestId('shop-modal')).not.toBeInTheDocument();
    });

    it('renders accessible dialog with aria-modal="true" and title when activeModal is "shop"', () => {
      useUiStore.getState().openModal('shop');
      render(<ShopModal />);

      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(screen.getByTestId('shop-modal')).toBeInTheDocument();
      expect(screen.getByText(/merchant|shop|market/i)).toBeInTheDocument();
    });

    it('displays player coin balance dynamically in modal header', () => {
      useGameStore.getState().setCoins(850);
      useUiStore.getState().openModal('shop');
      render(<ShopModal />);

      expect(screen.getByTestId('shop-player-coins')).toHaveTextContent('850');
    });

    it('closes modal when clicking the close button (X)', () => {
      useUiStore.getState().openModal('shop');
      render(<ShopModal />);

      const closeBtn = screen.getByTestId('shop-close-button');
      fireEvent.click(closeBtn);

      expect(useUiStore.getState().activeModal).toBeNull();
    });

    it('closes modal when pressing Escape key', () => {
      useUiStore.getState().openModal('shop');
      render(<ShopModal />);

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(useUiStore.getState().activeModal).toBeNull();
    });

    it('closes modal when clicking outside dialog on the backdrop', () => {
      useUiStore.getState().openModal('shop');
      render(<ShopModal />);

      const backdrop = screen.getByTestId('shop-backdrop');
      fireEvent.click(backdrop);

      expect(useUiStore.getState().activeModal).toBeNull();
    });

    it('traps Tab key focus within modal elements', () => {
      useUiStore.getState().openModal('shop');
      render(<ShopModal />);

      const modal = screen.getByRole('dialog');
      const focusable = modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
      );
      expect(focusable.length).toBeGreaterThan(1);

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      // Tab on last element should cycle to first
      lastElement.focus();
      fireEvent.keyDown(lastElement, { key: 'Tab', shiftKey: false });
      expect(document.activeElement).toBe(firstElement);

      // Shift+Tab on first element should cycle to last
      firstElement.focus();
      fireEvent.keyDown(firstElement, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(lastElement);
    });
  });

  describe('2. Tab Navigation', () => {
    it('renders all 4 tabs: Seeds, Sell, Upgrades, Eggs with default active tab "seeds"', () => {
      useUiStore.getState().openModal('shop');
      render(<ShopModal />);

      const seedsTab = screen.getByTestId('tab-seeds');
      const sellTab = screen.getByTestId('tab-sell');
      const upgradesTab = screen.getByTestId('tab-upgrades');
      const eggsTab = screen.getByTestId('tab-eggs');

      expect(seedsTab).toBeInTheDocument();
      expect(sellTab).toBeInTheDocument();
      expect(upgradesTab).toBeInTheDocument();
      expect(eggsTab).toBeInTheDocument();

      expect(seedsTab).toHaveAttribute('aria-selected', 'true');
      expect(sellTab).toHaveAttribute('aria-selected', 'false');
      expect(upgradesTab).toHaveAttribute('aria-selected', 'false');
      expect(eggsTab).toHaveAttribute('aria-selected', 'false');
    });

    it('switches active tab when clicked and displays relevant content pane', () => {
      useUiStore.getState().openModal('shop');
      render(<ShopModal />);

      // Switch to Sell tab
      const sellTab = screen.getByTestId('tab-sell');
      fireEvent.click(sellTab);
      expect(sellTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('pane-sell')).toBeInTheDocument();

      // Switch to Upgrades tab
      const upgradesTab = screen.getByTestId('tab-upgrades');
      fireEvent.click(upgradesTab);
      expect(upgradesTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('pane-upgrades')).toBeInTheDocument();

      // Switch to Eggs tab
      const eggsTab = screen.getByTestId('tab-eggs');
      fireEvent.click(eggsTab);
      expect(eggsTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('pane-eggs')).toBeInTheDocument();

      // Switch back to Seeds tab
      const seedsTab = screen.getByTestId('tab-seeds');
      fireEvent.click(seedsTab);
      expect(seedsTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('pane-seeds')).toBeInTheDocument();
    });
  });

  describe('3. Seeds Tab', () => {
    it('lists all 5 crops with price, growth time, base sell value, and owned count', () => {
      useGameStore.getState().addSeeds('tomato', 2);
      useUiStore.getState().openModal('shop');
      render(<ShopModal />);

      for (const [id, def] of Object.entries(CROPS)) {
        const itemRow = screen.getByTestId(`seed-item-${id}`);
        expect(itemRow).toBeInTheDocument();
        expect(itemRow).toHaveTextContent(def.name);
        expect(itemRow).toHaveTextContent(`${def.seedCost}`);
      }

      expect(screen.getByTestId('seed-owned-carrot')).toHaveTextContent('5');
      expect(screen.getByTestId('seed-owned-tomato')).toHaveTextContent('2');
    });

    it('buys 1 seed when clicking Buy 1: deducts coins, adds seed, updates owned count', () => {
      useGameStore.getState().setCoins(100);
      useUiStore.getState().openModal('shop');
      render(<ShopModal />);

      const buy1Carrot = screen.getByTestId('buy-seed-1-carrot');
      fireEvent.click(buy1Carrot);

      expect(useGameStore.getState().player.coins).toBe(100 - CROPS.carrot.seedCost);
      expect(useGameStore.getState().inventory.seeds.carrot).toBe(6); // 5 initial + 1
      expect(screen.getByTestId('seed-owned-carrot')).toHaveTextContent('6');
      expect(screen.getByTestId('shop-player-coins')).toHaveTextContent(
        `${100 - CROPS.carrot.seedCost}`
      );
    });

    it('buys 5 seeds in batch when clicking Buy 5', () => {
      useGameStore.getState().setCoins(500);
      useUiStore.getState().openModal('shop');
      render(<ShopModal />);

      const buy5Tomato = screen.getByTestId('buy-seed-5-tomato');
      fireEvent.click(buy5Tomato);

      const cost5x = CROPS.tomato.seedCost * 5;
      expect(useGameStore.getState().player.coins).toBe(500 - cost5x);
      expect(useGameStore.getState().inventory.seeds.tomato).toBe(5);
      expect(screen.getByTestId('seed-owned-tomato')).toHaveTextContent('5');
    });

    it('disables Buy 1 and Buy 5 buttons when player has insufficient coins', () => {
      useGameStore.getState().setCoins(10); // Starfruit costs 500c (1x) and 2500c (5x)
      useUiStore.getState().openModal('shop');
      render(<ShopModal />);

      const buy1Starfruit = screen.getByTestId('buy-seed-1-starfruit');
      const buy5Starfruit = screen.getByTestId('buy-seed-5-starfruit');

      expect(buy1Starfruit).toBeDisabled();
      expect(buy5Starfruit).toBeDisabled();
    });
  });

  describe('4. Sell Tab', () => {
    it('displays empty state message and disabled Sell All button when produce inventory is empty', () => {
      useGameStore.getState().clearAllProduce();
      useUiStore.getState().openModal('shop');
      render(<ShopModal initialTab="sell" />);

      expect(screen.getByTestId('sell-empty-state')).toBeInTheDocument();
      const sellAllBtn = screen.getByTestId('sell-all-button');
      expect(sellAllBtn).toBeDisabled();
    });

    it('lists produce stacks with mutation multiplier badges, quantity, and prices', () => {
      useGameStore.getState().clearAllProduce();
      useGameStore.getState().addProduce('carrot', 'none', 3);
      useGameStore.getState().addProduce('tomato', 'giant', 2); // 2 * 48 * 3 = 288
      useGameStore.getState().addProduce('pumpkin', 'gold', 1); // 1 * 190 * 5 = 950

      useUiStore.getState().openModal('shop');
      render(<ShopModal initialTab="sell" />);

      expect(screen.getByTestId('produce-stack-carrot-none')).toBeInTheDocument();
      expect(screen.getByTestId('produce-stack-tomato-giant')).toBeInTheDocument();
      expect(screen.getByTestId('produce-stack-pumpkin-gold')).toBeInTheDocument();

      expect(screen.getByTestId('mutation-badge-giant')).toHaveTextContent(/3x|giant/i);
      expect(screen.getByTestId('mutation-badge-gold')).toHaveTextContent(/5x|gold/i);
    });

    it('sells an individual produce stack when clicking its Sell button', () => {
      useGameStore.getState().setCoins(0);
      useGameStore.getState().clearAllProduce();
      useGameStore.getState().addProduce('carrot', 'none', 4); // 4 * 12 = 48

      useUiStore.getState().openModal('shop');
      render(<ShopModal initialTab="sell" />);

      const sellBtn = screen.getByTestId('sell-stack-carrot-none');
      fireEvent.click(sellBtn);

      expect(useGameStore.getState().player.coins).toBe(48);
      expect(useGameStore.getState().inventory.produce.length).toBe(0);
      expect(screen.getByTestId('sell-empty-state')).toBeInTheDocument();
    });

    it('sells all produce stacks when clicking Sell All button', () => {
      useGameStore.getState().setCoins(50);
      useGameStore.getState().clearAllProduce();
      useGameStore.getState().addProduce('carrot', 'none', 2); // 24
      useGameStore.getState().addProduce('tomato', 'none', 1); // 48

      useUiStore.getState().openModal('shop');
      render(<ShopModal initialTab="sell" />);

      const sellAllBtn = screen.getByTestId('sell-all-button');
      expect(sellAllBtn).not.toBeDisabled();
      fireEvent.click(sellAllBtn);

      expect(useGameStore.getState().player.coins).toBe(50 + 24 + 48);
      expect(useGameStore.getState().inventory.produce).toEqual([]);
      expect(screen.getByTestId('sell-empty-state')).toBeInTheDocument();
    });
  });

  describe('5. Upgrades Tab', () => {
    it('Golden Watering Can: shows cost and enables purchase when player has >= 1200 coins', () => {
      useGameStore.getState().setCoins(1500);
      useGameStore.getState().setGoldenWateringCan(false);

      useUiStore.getState().openModal('shop');
      render(<ShopModal initialTab="upgrades" />);

      const buyCanBtn = screen.getByTestId('upgrade-buy-golden_watering_can');
      expect(buyCanBtn).not.toBeDisabled();
      expect(buyCanBtn).toHaveTextContent('1,200');

      fireEvent.click(buyCanBtn);

      expect(useGameStore.getState().farm.goldenWateringCanOwned).toBe(true);
      expect(useGameStore.getState().player.coins).toBe(1500 - GOLDEN_WATERING_CAN_COST);
      expect(buyCanBtn).toBeDisabled();
      expect(buyCanBtn).toHaveTextContent(/owned/i);
    });

    it('Golden Watering Can: is disabled when player has < 1200 coins', () => {
      useGameStore.getState().setCoins(800);
      useGameStore.getState().setGoldenWateringCan(false);

      useUiStore.getState().openModal('shop');
      render(<ShopModal initialTab="upgrades" />);

      const buyCanBtn = screen.getByTestId('upgrade-buy-golden_watering_can');
      expect(buyCanBtn).toBeDisabled();
    });

    it('offers only the Golden Watering Can upgrade (no grid expansions)', () => {
      useGameStore.getState().setCoins(1000);

      useUiStore.getState().openModal('shop');
      render(<ShopModal initialTab="upgrades" />);

      expect(screen.getByTestId('upgrade-card-golden_watering_can')).toBeInTheDocument();
      expect(screen.queryByTestId('upgrade-card-expansion_6x6')).not.toBeInTheDocument();
      expect(screen.queryByTestId('upgrade-card-expansion_8x8')).not.toBeInTheDocument();
      expect(screen.queryByText(/expansion/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/6x6|8x8/i)).not.toBeInTheDocument();
    });
  });

  describe('6. Eggs Tab (EggShop Sub-component)', () => {
    it('displays pet capacity counter "X / 12 pets"', () => {
      useGameStore.getState().setCoins(5000);
      useUiStore.getState().openModal('shop');
      render(<ShopModal initialTab="eggs" />);

      const capacityBadge = screen.getByTestId('pet-capacity-counter');
      expect(capacityBadge).toHaveTextContent(/0\s*\/\s*12/);
    });

    it('buys Common Egg (450c): deducts coins, adds egg to inventory, increments capacity counter', () => {
      useGameStore.getState().setCoins(1000);
      useUiStore.getState().openModal('shop');
      render(<ShopModal initialTab="eggs" />);

      const buyCommonBtn = screen.getByTestId('buy-egg-common');
      expect(buyCommonBtn).not.toBeDisabled();
      expect(screen.getByTestId('egg-odds-common')).toHaveTextContent(/60%/);

      fireEvent.click(buyCommonBtn);

      expect(useGameStore.getState().player.coins).toBe(1000 - 450);
      expect(useGameStore.getState().inventory.eggs.length).toBe(1);
      expect(screen.getByTestId('pet-capacity-counter')).toHaveTextContent(/1\s*\/\s*12/);
    });

    it('buys Rare Egg (1500c): deducts coins and adds rare egg to inventory', () => {
      useGameStore.getState().setCoins(2000);
      useUiStore.getState().openModal('shop');
      render(<ShopModal initialTab="eggs" />);

      const buyRareBtn = screen.getByTestId('buy-egg-rare');
      expect(buyRareBtn).not.toBeDisabled();
      expect(screen.getByTestId('egg-odds-rare')).toHaveTextContent(/50%/);

      fireEvent.click(buyRareBtn);

      expect(useGameStore.getState().player.coins).toBe(2000 - 1500);
      expect(useGameStore.getState().inventory.eggs.length).toBe(1);
      expect(useGameStore.getState().inventory.eggs[0].type).toBe('rare');
    });

    it('disables egg buy buttons when player has insufficient coins', () => {
      useGameStore.getState().setCoins(400); // Common is 450, Rare is 1500
      useUiStore.getState().openModal('shop');
      render(<ShopModal initialTab="eggs" />);

      expect(screen.getByTestId('buy-egg-common')).toBeDisabled();
      expect(screen.getByTestId('buy-egg-rare')).toBeDisabled();
    });

    it('disables all egg purchases when pet & egg inventory reaches capacity cap (12/12)', () => {
      useGameStore.getState().setCoins(50000);

      // Add 12 dummy pets/eggs
      for (let i = 0; i < 12; i++) {
        useGameStore.getState().addPet({
          id: `pet-${i}`,
          type: 'dog',
          acquiredAtUtcMs: Date.now(),
        });
      }

      useUiStore.getState().openModal('shop');
      render(<ShopModal initialTab="eggs" />);

      const capacityBadge = screen.getByTestId('pet-capacity-counter');
      expect(capacityBadge).toHaveTextContent(/12\s*\/\s*12/);

      expect(screen.getByTestId('buy-egg-common')).toBeDisabled();
      expect(screen.getByTestId('buy-egg-rare')).toBeDisabled();
    });
  });
});
