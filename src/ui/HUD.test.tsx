import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { HUD } from './HUD';
import { ToastRegion } from './ToastRegion';
import { useGameStore, resetGameStore } from '../state/gameStore';
import { useUiStore, resetUiStore } from '../state/uiStore';
import { resetSettingsStore } from '../state/settingsStore';

describe('HUD & ToastRegion Components', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetGameStore();
    resetUiStore();
    resetSettingsStore();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('HUD: Coin Counter & Animated Delta', () => {
    it('renders initial player coins formatted', () => {
      useGameStore.setState((s) => ({
        player: { ...s.player, coins: 1500 },
      }));

      render(<HUD />);

      const coinCounter = screen.getByTestId('hud-coin-counter');
      expect(coinCounter).toBeInTheDocument();
      expect(coinCounter).toHaveTextContent('1,500');
    });

    it('shows positive floating delta badge when coins increase', () => {
      render(<HUD />);

      act(() => {
        useGameStore.getState().addCoins(250);
      });

      const deltaBadge = screen.getByTestId('hud-coin-delta');
      expect(deltaBadge).toBeInTheDocument();
      expect(deltaBadge).toHaveTextContent('+250');
      expect(deltaBadge).toHaveClass('text-emerald-400');

      // Advance timers to check fade-out / cleanup
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.queryByTestId('hud-coin-delta')).not.toBeInTheDocument();
    });

    it('shows negative floating delta badge when coins decrease', () => {
      render(<HUD />);

      act(() => {
        useGameStore.getState().deductCoins(50);
      });

      const deltaBadge = screen.getByTestId('hud-coin-delta');
      expect(deltaBadge).toBeInTheDocument();
      expect(deltaBadge).toHaveTextContent('-50');
      expect(deltaBadge).toHaveClass('text-rose-400');

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.queryByTestId('hud-coin-delta')).not.toBeInTheDocument();
    });
  });

  describe('HUD: Weather Widget', () => {
    it('renders active weather name, icon, and live countdown timer formatted as m:ss', () => {
      const now = Date.now();
      useGameStore.setState((s) => ({
        ...s,
        weather: {
          current: 'heavy_rain',
          startedAtUtcMs: now,
          endsAtUtcMs: now + 125000, // 2 minutes 5 seconds remaining
          previousWeather: 'sunny',
        },
      }));

      render(<HUD />);

      const weatherWidget = screen.getByTestId('hud-weather-widget');
      expect(weatherWidget).toBeInTheDocument();
      expect(screen.getByText(/heavy rain/i)).toBeInTheDocument();

      const timer = screen.getByTestId('hud-weather-timer');
      expect(timer).toHaveTextContent('2:05');

      // Advance time by 65 seconds -> 1:00 remaining
      act(() => {
        vi.advanceTimersByTime(65000);
      });

      expect(screen.getByTestId('hud-weather-timer')).toHaveTextContent('1:00');
    });

    it('renders weather mutation hint and updates when weather changes', () => {
      const now = Date.now();
      useGameStore.setState((s) => ({
        ...s,
        weather: {
          current: 'blood_moon',
          startedAtUtcMs: now,
          endsAtUtcMs: now + 60000,
          previousWeather: 'sunny',
        },
      }));

      render(<HUD />);

      expect(screen.getByText(/blood moon/i)).toBeInTheDocument();
      expect(screen.getByText(/cosmic/i)).toBeInTheDocument();
    });
  });

  describe('HUD: Equipped Pet Chip', () => {
    it('renders "No Pet" state when no pet is equipped', () => {
      useGameStore.setState((s) => ({
        inventory: {
          ...s.inventory,
          equippedPetId: null,
        },
      }));

      render(<HUD />);

      const petChip = screen.getByTestId('hud-pet-chip');
      expect(petChip).toBeInTheDocument();
      expect(petChip).toHaveTextContent(/no pet/i);
    });

    it('renders Dog pet badge and auto-harvest perk summary when dog equipped', () => {
      useGameStore.setState((s) => ({
        inventory: {
          ...s.inventory,
          pets: [{ id: 'pet-dog-1', type: 'dog', acquiredAtUtcMs: 1000 }],
          equippedPetId: 'pet-dog-1',
        },
      }));

      render(<HUD />);

      const petChip = screen.getByTestId('hud-pet-chip');
      expect(petChip).toHaveTextContent(/dog/i);
      expect(screen.getByTestId('hud-pet-perk')).toHaveTextContent(/auto-harvest/i);
    });

    it('renders Bee pet badge and growth speed perk summary when bee equipped', () => {
      useGameStore.setState((s) => ({
        inventory: {
          ...s.inventory,
          pets: [{ id: 'pet-bee-1', type: 'bee', acquiredAtUtcMs: 1000 }],
          equippedPetId: 'pet-bee-1',
        },
      }));

      render(<HUD />);

      const petChip = screen.getByTestId('hud-pet-chip');
      expect(petChip).toHaveTextContent(/bee/i);
      expect(screen.getByTestId('hud-pet-perk')).toHaveTextContent(/15%/i);
    });

    it('renders Pig pet badge and mutation boost perk summary when pig equipped', () => {
      useGameStore.setState((s) => ({
        inventory: {
          ...s.inventory,
          pets: [{ id: 'pet-pig-1', type: 'pig', acquiredAtUtcMs: 1000 }],
          equippedPetId: 'pet-pig-1',
        },
      }));

      render(<HUD />);

      const petChip = screen.getByTestId('hud-pet-chip');
      expect(petChip).toHaveTextContent(/pig/i);
      expect(screen.getByTestId('hud-pet-perk')).toHaveTextContent(/20%/i);
    });
  });

  describe('HUD: Inventory & Settings Triggers', () => {
    it('renders produce count badge and toggles inventory modal on button click', () => {
      useGameStore.setState((s) => ({
        inventory: {
          ...s.inventory,
          produce: [
            { cropId: 'carrot', mutation: 'none', quantity: 3 },
            { cropId: 'tomato', mutation: 'gold', quantity: 2 },
          ],
        },
      }));

      render(<HUD />);

      const badge = screen.getByTestId('hud-produce-count-badge');
      expect(badge).toHaveTextContent('5');

      const invBtn = screen.getByTestId('hud-inventory-button');
      fireEvent.click(invBtn);

      expect(useUiStore.getState().activeModal).toBe('inventory');

      // Click again while open closes modal
      fireEvent.click(invBtn);
      expect(useUiStore.getState().activeModal).toBeNull();
    });

    it('opens settings modal on settings button click', () => {
      render(<HUD />);

      const settingsBtn = screen.getByTestId('hud-settings-button');
      fireEvent.click(settingsBtn);

      expect(useUiStore.getState().activeModal).toBe('settings');
    });

    it('renders fullscreen toggle button and triggers fullscreen request/exit', () => {
      render(<HUD />);

      const fullscreenBtn = screen.getByTestId('hud-fullscreen-button');
      expect(fullscreenBtn).toBeInTheDocument();

      const requestFsMock = vi.fn().mockResolvedValue(undefined);
      document.documentElement.requestFullscreen = requestFsMock;

      fireEvent.click(fullscreenBtn);
      expect(requestFsMock).toHaveBeenCalled();
    });
  });

  describe('ToastRegion: Notification Rendering & Dismissal', () => {
    it('renders active toasts with type-specific indicators and handles manual dismissal', () => {
      render(<ToastRegion />);

      act(() => {
        useUiStore.getState().showToast('Harvested 3x Gold Carrots!', 'success');
        useUiStore.getState().showToast('Water plot first', 'warning');
      });

      expect(screen.getByText('Harvested 3x Gold Carrots!')).toBeInTheDocument();
      expect(screen.getByText('Water plot first')).toBeInTheDocument();

      const dismissButtons = screen.getAllByRole('button', { name: /dismiss/i });
      expect(dismissButtons.length).toBe(2);

      // Dismiss the first toast
      fireEvent.click(dismissButtons[0]);
      expect(screen.queryByText('Harvested 3x Gold Carrots!')).not.toBeInTheDocument();
      expect(screen.getByText('Water plot first')).toBeInTheDocument();
    });

    it('auto-dismisses toasts after duration expires', () => {
      render(<ToastRegion />);

      act(() => {
        useUiStore.getState().showToast('Quick message', 'info', 3000);
      });

      expect(screen.getByText('Quick message')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(3100);
      });

      expect(screen.queryByText('Quick message')).not.toBeInTheDocument();
    });
  });
});
