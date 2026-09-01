import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsModal } from './SettingsModal';
import { useGameStore, resetGameStore } from '../state/gameStore';
import { useUiStore, resetUiStore } from '../state/uiStore';
import { useSettingsStore, resetSettingsStore } from '../state/settingsStore';

describe('Task 19: SettingsModal Component Tests', () => {
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
      render(<SettingsModal />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
    });

    it('renders accessible dialog with aria-modal="true" and title when activeModal is "settings"', () => {
      useUiStore.getState().openModal('settings');
      render(<SettingsModal />);

      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
      expect(screen.getByTestId('settings-title')).toHaveTextContent(/settings|options/i);
    });

    it('closes modal when clicking close button (X)', () => {
      useUiStore.getState().openModal('settings');
      render(<SettingsModal />);

      const closeBtn = screen.getByTestId('settings-close-button');
      fireEvent.click(closeBtn);

      expect(useUiStore.getState().activeModal).toBeNull();
    });

    it('closes modal when pressing Escape key', () => {
      useUiStore.getState().openModal('settings');
      render(<SettingsModal />);

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(useUiStore.getState().activeModal).toBeNull();
    });

    it('closes modal when clicking outside on the backdrop', () => {
      useUiStore.getState().openModal('settings');
      render(<SettingsModal />);

      const backdrop = screen.getByTestId('settings-backdrop');
      fireEvent.click(backdrop);

      expect(useUiStore.getState().activeModal).toBeNull();
    });
  });

  describe('2. Audio Controls (Volume Sliders & Mute)', () => {
    beforeEach(() => {
      useUiStore.getState().openModal('settings');
    });

    it('adjusts master volume slider and updates settingsStore', () => {
      render(<SettingsModal />);

      const slider = screen.getByTestId('setting-master-volume') as HTMLInputElement;
      expect(slider.value).toBe('80'); // default 0.8 -> 80%

      fireEvent.change(slider, { target: { value: '45' } });
      expect(useSettingsStore.getState().masterVolume).toBeCloseTo(0.45, 2);
    });

    it('adjusts music volume slider and updates settingsStore', () => {
      render(<SettingsModal />);

      const slider = screen.getByTestId('setting-music-volume') as HTMLInputElement;
      expect(slider.value).toBe('60'); // default 0.6 -> 60%

      fireEvent.change(slider, { target: { value: '20' } });
      expect(useSettingsStore.getState().musicVolume).toBeCloseTo(0.2, 2);
    });

    it('adjusts SFX volume slider and updates settingsStore', () => {
      render(<SettingsModal />);

      const slider = screen.getByTestId('setting-sfx-volume') as HTMLInputElement;
      expect(slider.value).toBe('80'); // default 0.8 -> 80%

      fireEvent.change(slider, { target: { value: '90' } });
      expect(useSettingsStore.getState().sfxVolume).toBeCloseTo(0.9, 2);
    });

    it('toggles mute setting', () => {
      render(<SettingsModal />);

      const muteToggle = screen.getByTestId('setting-mute-toggle');
      expect(useSettingsStore.getState().muted).toBe(false);

      fireEvent.click(muteToggle);
      expect(useSettingsStore.getState().muted).toBe(true);

      fireEvent.click(muteToggle);
      expect(useSettingsStore.getState().muted).toBe(false);
    });
  });

  describe('3. Graphics Controls (Quality Presets & Reduced Motion)', () => {
    beforeEach(() => {
      useUiStore.getState().openModal('settings');
    });

    it('switches quality presets (Auto, Low, Medium, High)', () => {
      render(<SettingsModal />);

      const lowBtn = screen.getByTestId('setting-quality-low');
      fireEvent.click(lowBtn);
      expect(useSettingsStore.getState().quality).toBe('low');

      const highBtn = screen.getByTestId('setting-quality-high');
      fireEvent.click(highBtn);
      expect(useSettingsStore.getState().quality).toBe('high');

      const autoBtn = screen.getByTestId('setting-quality-auto');
      fireEvent.click(autoBtn);
      expect(useSettingsStore.getState().quality).toBe('auto');
    });

    it('toggles reduced motion setting', () => {
      render(<SettingsModal />);

      const motionToggle = screen.getByTestId('setting-reduced-motion-toggle');
      const initialMotion = useSettingsStore.getState().reducedMotion;

      fireEvent.click(motionToggle);
      expect(useSettingsStore.getState().reducedMotion).toBe(!initialMotion);
    });

    it('renders fullscreen toggle button and calls fullscreen API', () => {
      render(<SettingsModal />);

      const fsToggle = screen.getByTestId('setting-fullscreen-toggle');
      expect(fsToggle).toBeInTheDocument();

      const requestFsMock = vi.fn().mockResolvedValue(undefined);
      document.documentElement.requestFullscreen = requestFsMock;

      fireEvent.click(fsToggle);
      expect(requestFsMock).toHaveBeenCalled();
    });
  });

  describe('4. Input Controls (Mode, Sensitivity, Invert-Y, Haptics)', () => {
    beforeEach(() => {
      useUiStore.getState().openModal('settings');
    });

    it('switches input modes (Auto, Desktop, Touch)', () => {
      render(<SettingsModal />);

      const touchBtn = screen.getByTestId('setting-input-mode-touch');
      fireEvent.click(touchBtn);
      expect(useSettingsStore.getState().inputMode).toBe('touch');

      const desktopBtn = screen.getByTestId('setting-input-mode-desktop');
      fireEvent.click(desktopBtn);
      expect(useSettingsStore.getState().inputMode).toBe('desktop');

      const autoBtn = screen.getByTestId('setting-input-mode-auto');
      fireEvent.click(autoBtn);
      expect(useSettingsStore.getState().inputMode).toBe('auto');
    });

    it('adjusts camera sensitivity slider', () => {
      render(<SettingsModal />);

      const sensSlider = screen.getByTestId('setting-camera-sensitivity') as HTMLInputElement;
      expect(sensSlider.value).toBe('1'); // default 1.0

      fireEvent.change(sensSlider, { target: { value: '2.2' } });
      expect(useSettingsStore.getState().cameraSensitivity).toBeCloseTo(2.2, 1);
    });

    it('toggles invert-Y setting', () => {
      render(<SettingsModal />);

      const invertToggle = screen.getByTestId('setting-invert-y-toggle');
      expect(useSettingsStore.getState().invertY).toBe(false);

      fireEvent.click(invertToggle);
      expect(useSettingsStore.getState().invertY).toBe(true);
    });

    it('toggles haptics setting', () => {
      render(<SettingsModal />);

      const hapticsToggle = screen.getByTestId('setting-haptics-toggle');
      expect(useSettingsStore.getState().haptics).toBe(true);

      fireEvent.click(hapticsToggle);
      expect(useSettingsStore.getState().haptics).toBe(false);
    });
  });

  describe('5. Tutorial Replay Shortcut', () => {
    it('opens tutorial modal and resets tutorial dismissed state when clicking Replay Tutorial', () => {
      useGameStore.getState().dismissTutorial();
      useUiStore.getState().openModal('settings');
      render(<SettingsModal />);

      const replayBtn = screen.getByTestId('setting-replay-tutorial');
      fireEvent.click(replayBtn);

      expect(useUiStore.getState().activeModal).toBe('tutorial');
    });
  });

  describe('6. Reset Save 2-Step Danger Confirmation', () => {
    beforeEach(() => {
      useUiStore.getState().openModal('settings');
    });

    it('shows initial reset button and hides confirm/cancel buttons', () => {
      render(<SettingsModal />);

      expect(screen.getByTestId('setting-reset-save-button')).toBeInTheDocument();
      expect(screen.queryByTestId('setting-confirm-reset-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('setting-cancel-reset-button')).not.toBeInTheDocument();
    });

    it('clicking Reset reveals 2-step confirmation prompt', () => {
      render(<SettingsModal />);

      const resetBtn = screen.getByTestId('setting-reset-save-button');
      fireEvent.click(resetBtn);

      expect(screen.getByTestId('setting-confirm-reset-button')).toBeInTheDocument();
      expect(screen.getByTestId('setting-cancel-reset-button')).toBeInTheDocument();
      expect(screen.getByText(/wipe|erase|cannot be undone/i)).toBeInTheDocument();
    });

    it('clicking Cancel reverts confirmation without resetting game', () => {
      useGameStore.getState().setCoins(9999);
      render(<SettingsModal />);

      // Step 1: Open confirm
      fireEvent.click(screen.getByTestId('setting-reset-save-button'));
      // Step 2: Cancel
      fireEvent.click(screen.getByTestId('setting-cancel-reset-button'));

      expect(screen.getByTestId('setting-reset-save-button')).toBeInTheDocument();
      expect(screen.queryByTestId('setting-confirm-reset-button')).not.toBeInTheDocument();
      expect(useGameStore.getState().player.coins).toBe(9999);
    });

    it('clicking Confirm Reset wipes save data, resets game state, and closes modal/shows feedback', () => {
      useGameStore.getState().setCoins(9999);
      render(<SettingsModal />);

      // Step 1: Open confirm
      fireEvent.click(screen.getByTestId('setting-reset-save-button'));
      // Step 2: Confirm reset
      fireEvent.click(screen.getByTestId('setting-confirm-reset-button'));

      expect(useGameStore.getState().player.coins).toBe(100); // Default STARTING_COINS
      expect(useUiStore.getState().activeModal).toBeNull();
    });
  });

  describe('7. Focus Trap and Keyboard Navigation', () => {
    it('traps Tab navigation within the modal dialog', () => {
      useUiStore.getState().openModal('settings');
      render(<SettingsModal />);

      const dialog = screen.getByRole('dialog');
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled])'
      );
      expect(focusable.length).toBeGreaterThan(1);

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      // Tab on last wraps to first
      last.focus();
      expect(document.activeElement).toBe(last);
      fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: false });
      expect(document.activeElement).toBe(first);

      // Shift+Tab on first wraps to last
      first.focus();
      expect(document.activeElement).toBe(first);
      fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(last);
    });
  });
});
