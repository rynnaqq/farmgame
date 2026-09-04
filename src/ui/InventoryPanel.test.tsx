import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InventoryPanel } from './InventoryPanel';
import { useGameStore, resetGameStore } from '../state/gameStore';
import { useUiStore, resetUiStore } from '../state/uiStore';
import { resetSettingsStore } from '../state/settingsStore';

describe('InventoryPanel Component', () => {
  beforeEach(() => {
    resetGameStore();
    resetUiStore();
    resetSettingsStore();
  });

  it('renders nothing when activeModal is not inventory', () => {
    useUiStore.setState({ activeModal: null });

    const { container } = render(<InventoryPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal dialog when activeModal is inventory', () => {
    useUiStore.getState().openModal('inventory');

    render(<InventoryPanel />);

    const modal = screen.getByTestId('inventory-modal');
    expect(modal).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /inventory/i })).toBeInTheDocument();
  });

  it('closes modal when clicking close button (X)', () => {
    useUiStore.getState().openModal('inventory');
    render(<InventoryPanel />);

    const closeBtn = screen.getByTestId('inventory-close-button');
    fireEvent.click(closeBtn);
    expect(useUiStore.getState().activeModal).toBeNull();
  });

  it('closes modal when clicking backdrop', () => {
    useUiStore.getState().openModal('inventory');
    render(<InventoryPanel />);

    const backdrop = screen.getByTestId('inventory-backdrop');
    fireEvent.click(backdrop);
    expect(useUiStore.getState().activeModal).toBeNull();
  });

  it('closes modal when pressing Escape key', () => {
    useUiStore.getState().openModal('inventory');
    render(<InventoryPanel />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useUiStore.getState().activeModal).toBeNull();
  });

  describe('Seeds Section / Tab', () => {
    it('displays all 5 crops with their current owned seed quantities', () => {
      useGameStore.setState((s) => ({
        inventory: {
          ...s.inventory,
          seeds: {
            carrot: 10,
            tomato: 4,
            pumpkin: 2,
            golden_berry: 1,
            starfruit: 0,
          },
        },
      }));
      useUiStore.getState().openModal('inventory');

      render(<InventoryPanel />);

      // Switch to seeds tab if tabbed
      const seedsTab = screen.queryByTestId('tab-seeds');
      if (seedsTab) fireEvent.click(seedsTab);

      expect(screen.getByTestId('inventory-seed-count-carrot')).toHaveTextContent('10');
      expect(screen.getByTestId('inventory-seed-count-tomato')).toHaveTextContent('4');
      expect(screen.getByTestId('inventory-seed-count-pumpkin')).toHaveTextContent('2');
      expect(screen.getByTestId('inventory-seed-count-golden_berry')).toHaveTextContent('1');
      expect(screen.getByTestId('inventory-seed-count-starfruit')).toHaveTextContent('0');
    });

    it('arms planting and closes the modal when a seed Plant button is clicked', () => {
      useUiStore.getState().openModal('inventory');

      render(<InventoryPanel />);

      const seedsTab = screen.queryByTestId('tab-seeds');
      if (seedsTab) fireEvent.click(seedsTab);

      fireEvent.click(screen.getByTestId('inventory-plant-seed-tomato'));

      expect(useUiStore.getState().selectedSeed).toBe('tomato');
      expect(useUiStore.getState().plantArmed).toBe(true);
      expect(useUiStore.getState().activeModal).toBeNull();
    });
  });

  describe('Produce Section / Tab', () => {
    it('renders empty state when player has no produce', () => {
      useGameStore.setState((s) => ({
        inventory: {
          ...s.inventory,
          produce: [],
        },
      }));
      useUiStore.getState().openModal('inventory');

      render(<InventoryPanel />);

      const produceTab = screen.queryByTestId('tab-produce');
      if (produceTab) fireEvent.click(produceTab);

      expect(screen.getByTestId('produce-empty-state')).toBeInTheDocument();
    });

    it('renders stacked produce cards with mutation badges, unit value, and stack value', () => {
      useGameStore.setState((s) => ({
        inventory: {
          ...s.inventory,
          produce: [
            { cropId: 'carrot', mutation: 'gold', quantity: 5 }, // 12 * 5 = 60 unit value, 60 * 5 = 300 stack
            { cropId: 'pumpkin', mutation: 'giant', quantity: 3 }, // 190 * 3 = 570 unit value, 570 * 3 = 1710 stack
            { cropId: 'starfruit', mutation: 'cosmic', quantity: 2 }, // 1500 * 15 = 22500 unit value, 22500 * 2 = 45000 stack
          ],
        },
      }));
      useUiStore.getState().openModal('inventory');

      render(<InventoryPanel />);

      const produceTab = screen.queryByTestId('tab-produce');
      if (produceTab) fireEvent.click(produceTab);

      // Verify Gold Carrot stack
      const goldStack = screen.getByTestId('inventory-produce-stack-carrot-gold');
      expect(goldStack).toBeInTheDocument();
      expect(screen.getByTestId('inventory-mutation-badge-gold')).toHaveTextContent(/gold/i);
      expect(goldStack).toHaveTextContent(/x5/);
      expect(goldStack).toHaveTextContent(/300/);

      // Verify Giant Pumpkin stack
      const giantStack = screen.getByTestId('inventory-produce-stack-pumpkin-giant');
      expect(giantStack).toBeInTheDocument();
      expect(screen.getByTestId('inventory-mutation-badge-giant')).toHaveTextContent(/giant/i);
      expect(giantStack).toHaveTextContent(/1,710/);

      // Verify Cosmic Starfruit stack
      const cosmicStack = screen.getByTestId('inventory-produce-stack-starfruit-cosmic');
      expect(cosmicStack).toBeInTheDocument();
      expect(screen.getByTestId('inventory-mutation-badge-cosmic')).toHaveTextContent(/cosmic/i);
      expect(cosmicStack).toHaveTextContent(/45,000/);

      // Total estimated produce value: 300 + 1710 + 45000 = 47,010
      expect(screen.getByTestId('inventory-total-value')).toHaveTextContent('47,010');
    });
  });

  describe('Eggs Section / Tab', () => {
    it('renders empty state when no eggs owned', () => {
      useGameStore.setState((s) => ({
        inventory: {
          ...s.inventory,
          eggs: [],
        },
      }));
      useUiStore.getState().openModal('inventory');

      render(<InventoryPanel />);

      const eggsTab = screen.queryByTestId('tab-eggs');
      if (eggsTab) fireEvent.click(eggsTab);

      expect(screen.getByTestId('eggs-empty-state')).toBeInTheDocument();
    });

    it('renders list of owned eggs and shows incubating vs stored status', () => {
      useGameStore.setState((s) => ({
        inventory: {
          ...s.inventory,
          eggs: [
            {
              id: 'egg-1',
              type: 'common',
              purchasedAtUtcMs: 1000,
              outcome: 'dog',
              incubating: true,
              elapsedIncubationSec: 45,
              distanceTraveled: 60,
            },
            {
              id: 'egg-2',
              type: 'rare',
              purchasedAtUtcMs: 2000,
              outcome: 'pig',
              incubating: false,
              elapsedIncubationSec: 0,
              distanceTraveled: 0,
            },
          ],
          incubatingEggId: 'egg-1',
        },
      }));
      useUiStore.getState().openModal('inventory');

      render(<InventoryPanel />);

      const eggsTab = screen.queryByTestId('tab-eggs');
      if (eggsTab) fireEvent.click(eggsTab);

      const egg1 = screen.getByTestId('inventory-egg-item-egg-1');
      expect(egg1).toBeInTheDocument();
      expect(egg1).toHaveTextContent(/common egg/i);
      expect(egg1).toHaveTextContent(/incubating/i);

      const egg2 = screen.getByTestId('inventory-egg-item-egg-2');
      expect(egg2).toBeInTheDocument();
      expect(egg2).toHaveTextContent(/rare egg/i);
      expect(egg2).toHaveTextContent(/stored/i);
    });
  });

  describe('Open Shop To Sell Action', () => {
    it('switches modal to shop when "Open Shop to Sell" button is clicked', () => {
      useUiStore.getState().openModal('inventory');

      render(<InventoryPanel />);

      const shopBtn = screen.getByTestId('inventory-open-shop-button');
      fireEvent.click(shopBtn);

      expect(useUiStore.getState().activeModal).toBe('shop');
    });
  });
});
