import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tutorial } from './Tutorial';
import { useGameStore, resetGameStore } from '../state/gameStore';
import { useUiStore, resetUiStore } from '../state/uiStore';
import { useSettingsStore, resetSettingsStore } from '../state/settingsStore';

describe('Task 19: Tutorial Component Tests', () => {
  beforeEach(() => {
    resetGameStore(42);
    resetUiStore();
    resetSettingsStore();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Tutorial Visibility & First-Run Logic', () => {
    it('renders on first run when tutorial is not dismissed and no modal is active', () => {
      // By default in fresh store: tutorial.dismissed === false, activeModal === null
      render(<Tutorial />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('tutorial-card')).toBeInTheDocument();
    });

    it('does not render when tutorial.dismissed is true and activeModal is null', () => {
      useGameStore.getState().dismissTutorial();
      render(<Tutorial />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tutorial-card')).not.toBeInTheDocument();
    });

    it('renders when activeModal is explicitly "tutorial" even if previously dismissed', () => {
      useGameStore.getState().dismissTutorial();
      useUiStore.getState().openModal('tutorial');
      render(<Tutorial />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('tutorial-card')).toBeInTheDocument();
    });

    it('does not render over another open modal (e.g. shop or settings)', () => {
      useUiStore.getState().openModal('shop');
      render(<Tutorial />);

      expect(screen.queryByTestId('tutorial-card')).not.toBeInTheDocument();
    });
  });

  describe('2. Five Tutorial Steps Navigation', () => {
    it('starts at Step 1: Move & Camera and shows step indicator', () => {
      render(<Tutorial />);

      expect(screen.getByTestId('tutorial-step-indicator')).toHaveTextContent(
        /1\s*\/\s*5|step 1 of 5/i
      );
      expect(screen.getByTestId('tutorial-title')).toHaveTextContent(/move|camera|movement/i);
    });

    it('navigates through all 5 steps with Next and Back buttons', () => {
      render(<Tutorial />);

      // Step 1: Move & Camera
      expect(screen.getByTestId('tutorial-title')).toHaveTextContent(/move|camera|movement/i);
      const backBtn = screen.getByTestId('tutorial-back-button');
      expect(backBtn).toBeDisabled();

      const nextBtn = screen.getByTestId('tutorial-next-button');
      expect(nextBtn).toHaveTextContent(/next/i);

      // Step 2: Planting (Seeds)
      fireEvent.click(nextBtn);
      expect(screen.getByTestId('tutorial-step-indicator')).toHaveTextContent(
        /2\s*\/\s*5|step 2 of 5/i
      );
      expect(screen.getByTestId('tutorial-title')).toHaveTextContent(/plant|seed/i);
      expect(screen.getByTestId('tutorial-back-button')).not.toBeDisabled();

      // Step 3: Watering
      fireEvent.click(nextBtn);
      expect(screen.getByTestId('tutorial-step-indicator')).toHaveTextContent(
        /3\s*\/\s*5|step 3 of 5/i
      );
      expect(screen.getByTestId('tutorial-title')).toHaveTextContent(/water|hydration/i);

      // Step 4: Harvesting & Selling
      fireEvent.click(nextBtn);
      expect(screen.getByTestId('tutorial-step-indicator')).toHaveTextContent(
        /4\s*\/\s*5|step 4 of 5/i
      );
      expect(screen.getByTestId('tutorial-title')).toHaveTextContent(/harvest|sell/i);

      // Step 5: Weather & Pets
      fireEvent.click(nextBtn);
      expect(screen.getByTestId('tutorial-step-indicator')).toHaveTextContent(
        /5\s*\/\s*5|step 5 of 5/i
      );
      expect(screen.getByTestId('tutorial-title')).toHaveTextContent(/weather|pet/i);
      expect(screen.getByTestId('tutorial-next-button')).toHaveTextContent(
        /finish|done|got it|start farming/i
      );

      // Step Back from 5 to 4
      fireEvent.click(screen.getByTestId('tutorial-back-button'));
      expect(screen.getByTestId('tutorial-step-indicator')).toHaveTextContent(
        /4\s*\/\s*5|step 4 of 5/i
      );
    });

    it('records completed tutorial steps in gameStore', () => {
      render(<Tutorial />);

      const nextBtn = screen.getByTestId('tutorial-next-button');
      fireEvent.click(nextBtn); // Completed step 1, now on step 2

      const completed = useGameStore.getState().tutorial.completedSteps;
      expect(completed.length).toBeGreaterThan(0);
    });
  });

  describe('3. Device-Aware Instructions (Desktop vs Mobile)', () => {
    it('displays desktop instructions (WASD, 1-4, Q/E, Right-click drag) when inputMode is "desktop"', () => {
      useSettingsStore.getState().setInputMode('desktop');
      render(<Tutorial />);

      // Step 1 on Desktop
      const body = screen.getByTestId('tutorial-body');
      expect(body.textContent).toMatch(/WASD|Arrow/i);
      expect(body.textContent).toMatch(/Right-Click|drag|Q\/E/i);
      expect(body.textContent).not.toMatch(/Virtual Joystick/i);

      // Step 2 on Desktop (Planting)
      fireEvent.click(screen.getByTestId('tutorial-next-button'));
      expect(screen.getByTestId('tutorial-body').textContent).toMatch(/2|Seed|Click/i);

      // Step 3 on Desktop (Watering)
      fireEvent.click(screen.getByTestId('tutorial-next-button'));
      expect(screen.getByTestId('tutorial-body').textContent).toMatch(/1|Water|Click/i);
    });

    it('displays mobile instructions (Virtual Joystick, tap action button, drag to orbit) when inputMode is "touch"', () => {
      useSettingsStore.getState().setInputMode('touch');
      render(<Tutorial />);

      // Step 1 on Mobile
      const body = screen.getByTestId('tutorial-body');
      expect(body.textContent).toMatch(/joystick/i);
      expect(body.textContent).toMatch(/drag|orbit|pinch/i);
      expect(body.textContent).not.toMatch(/WASD/i);

      // Step 2 on Mobile (Planting)
      fireEvent.click(screen.getByTestId('tutorial-next-button'));
      expect(screen.getByTestId('tutorial-body').textContent).toMatch(
        /tap|action button|toolbelt/i
      );
      expect(screen.getByTestId('tutorial-body').textContent).not.toMatch(/WASD/i);
    });

    it('supports forceTouch prop override', () => {
      render(<Tutorial forceTouch={true} />);

      const body = screen.getByTestId('tutorial-body');
      expect(body.textContent).toMatch(/joystick/i);
      expect(body.textContent).not.toMatch(/WASD/i);
    });
  });

  describe('4. Skip & Dismissal Persistence', () => {
    it('dismisses tutorial and updates gameStore when clicking "Skip Tutorial"', () => {
      render(<Tutorial />);

      const skipBtn = screen.getByTestId('tutorial-skip-button');
      fireEvent.click(skipBtn);

      expect(useGameStore.getState().tutorial.dismissed).toBe(true);
      expect(screen.queryByTestId('tutorial-card')).not.toBeInTheDocument();
    });

    it('dismisses tutorial when finishing the 5th step', () => {
      render(<Tutorial />);

      // Advance to step 5
      for (let i = 0; i < 4; i++) {
        fireEvent.click(screen.getByTestId('tutorial-next-button'));
      }

      // Finish step 5
      const finishBtn = screen.getByTestId('tutorial-next-button');
      fireEvent.click(finishBtn);

      expect(useGameStore.getState().tutorial.dismissed).toBe(true);
      expect(screen.queryByTestId('tutorial-card')).not.toBeInTheDocument();
    });

    it('dismisses tutorial when pressing Escape key', () => {
      render(<Tutorial />);

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(useGameStore.getState().tutorial.dismissed).toBe(true);
      expect(screen.queryByTestId('tutorial-card')).not.toBeInTheDocument();
    });

    it('closes modal when dismissed if activeModal was "tutorial"', () => {
      useUiStore.getState().openModal('tutorial');
      render(<Tutorial />);

      const skipBtn = screen.getByTestId('tutorial-skip-button');
      fireEvent.click(skipBtn);

      expect(useUiStore.getState().activeModal).toBeNull();
    });
  });

  describe('5. Accessibility and Structure', () => {
    it('has accessible dialog role, title reference, and focusable buttons with ring styles', () => {
      render(<Tutorial />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby');

      const nextBtn = screen.getByTestId('tutorial-next-button');
      expect(nextBtn).toHaveAttribute('type', 'button');
    });
  });
});
