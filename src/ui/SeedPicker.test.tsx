import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SeedPicker } from './SeedPicker';
import { useGameStore, resetGameStore } from '../state/gameStore';
import { useUiStore, resetUiStore } from '../state/uiStore';
import { resetSettingsStore } from '../state/settingsStore';
import { InputManager } from '../game/input/InputManager';

describe('Task 14: SeedPicker Component', () => {
  let inputManager: InputManager;

  beforeEach(() => {
    resetGameStore();
    resetUiStore();
    resetSettingsStore();
    inputManager = new InputManager();
    inputManager.attach(window);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    inputManager.detach();
    vi.restoreAllMocks();
  });

  describe('1. Crop Cards Rendering and Counts', () => {
    it('renders all 5 crops: Carrot, Tomato, Pumpkin, Golden Berry, Starfruit', () => {
      render(<SeedPicker />);

      expect(screen.getByTestId('seed-picker')).toBeInTheDocument();

      const carrotCard = screen.getByTestId('seed-card-carrot');
      const tomatoCard = screen.getByTestId('seed-card-tomato');
      const pumpkinCard = screen.getByTestId('seed-card-pumpkin');
      const goldenBerryCard = screen.getByTestId('seed-card-golden_berry');
      const starfruitCard = screen.getByTestId('seed-card-starfruit');

      expect(carrotCard).toBeInTheDocument();
      expect(tomatoCard).toBeInTheDocument();
      expect(pumpkinCard).toBeInTheDocument();
      expect(goldenBerryCard).toBeInTheDocument();
      expect(starfruitCard).toBeInTheDocument();

      expect(carrotCard).toHaveTextContent(/carrot/i);
      expect(tomatoCard).toHaveTextContent(/tomato/i);
      expect(pumpkinCard).toHaveTextContent(/pumpkin/i);
      expect(goldenBerryCard).toHaveTextContent(/golden berry/i);
      expect(starfruitCard).toHaveTextContent(/starfruit/i);
    });

    it('displays accurate seed counts from inventory', () => {
      // Default: Carrot has 5 seeds, others have 0
      render(<SeedPicker />);

      expect(screen.getByTestId('seed-count-carrot')).toHaveTextContent('5');
      expect(screen.getByTestId('seed-count-tomato')).toHaveTextContent('0');
      expect(screen.getByTestId('seed-count-pumpkin')).toHaveTextContent('0');
      expect(screen.getByTestId('seed-count-golden_berry')).toHaveTextContent('0');
      expect(screen.getByTestId('seed-count-starfruit')).toHaveTextContent('0');
    });

    it('displays 0 badge clearly when seed inventory is 0', () => {
      render(<SeedPicker />);

      const tomatoCount = screen.getByTestId('seed-count-tomato');
      expect(tomatoCount).toHaveTextContent('0');
      expect(screen.getByTestId('seed-card-tomato')).toHaveAttribute('data-empty', 'true');
    });

    it('updates counts reactively when inventory changes', () => {
      render(<SeedPicker />);

      act(() => {
        useGameStore.getState().addSeeds('tomato', 8);
        useGameStore.getState().addSeeds('starfruit', 3);
      });

      expect(screen.getByTestId('seed-count-tomato')).toHaveTextContent('8');
      expect(screen.getByTestId('seed-count-starfruit')).toHaveTextContent('3');
      expect(screen.getByTestId('seed-card-tomato')).toHaveAttribute('data-empty', 'false');
    });
  });

  describe('2. Seed Selection & Plant Arming', () => {
    it('starts disarmed with no card asserting planting mode', () => {
      render(<SeedPicker />);

      expect(useUiStore.getState().plantArmed).toBe(false);
      expect(screen.getByTestId('seed-card-carrot')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByTestId('seed-card-tomato')).toHaveAttribute('aria-pressed', 'false');
    });

    it('arms planting on click and updates uiStore', () => {
      render(<SeedPicker />);

      const pumpkinCard = screen.getByTestId('seed-card-pumpkin');
      fireEvent.click(pumpkinCard);

      expect(useUiStore.getState().selectedSeed).toBe('pumpkin');
      expect(useUiStore.getState().plantArmed).toBe(true);
      expect(pumpkinCard).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('seed-card-carrot')).toHaveAttribute('aria-pressed', 'false');
    });

    it('toggles disarm when the armed card is clicked again', () => {
      render(<SeedPicker />);

      const tomatoCard = screen.getByTestId('seed-card-tomato');
      fireEvent.click(tomatoCard);
      expect(useUiStore.getState().plantArmed).toBe(true);

      fireEvent.click(tomatoCard);
      expect(useUiStore.getState().plantArmed).toBe(false);
      expect(useUiStore.getState().selectedSeed).toBe('tomato');
      expect(tomatoCard).toHaveAttribute('aria-pressed', 'false');
    });

    it('invokes custom onSelectSeed callback when provided', () => {
      const onSelectSeed = vi.fn();
      render(<SeedPicker onSelectSeed={onSelectSeed} />);

      fireEvent.click(screen.getByTestId('seed-card-tomato'));
      expect(onSelectSeed).toHaveBeenCalledWith('tomato');
    });

    it('applies active styling to the selected seed card', () => {
      render(<SeedPicker />);

      const carrotCard = screen.getByTestId('seed-card-carrot');
      expect(carrotCard.className).toMatch(/border-|ring-|scale-|bg-/);
    });
  });

  describe('3. Keyboard Shortcut Seed Cycling (Q / E)', () => {
    it('cycles to next seed on pressing "e" or "E" and arms planting (Carrot -> Tomato -> Pumpkin -> Golden Berry -> Starfruit -> Carrot)', () => {
      render(<SeedPicker />);

      expect(useUiStore.getState().selectedSeed).toBe('carrot');

      // Next -> Tomato
      fireEvent.keyDown(window, { key: 'e' });
      expect(useUiStore.getState().selectedSeed).toBe('tomato');
      expect(useUiStore.getState().plantArmed).toBe(true);
      expect(screen.getByTestId('seed-card-tomato')).toHaveAttribute('aria-pressed', 'true');

      // Next -> Pumpkin
      fireEvent.keyDown(window, { key: 'E' });
      expect(useUiStore.getState().selectedSeed).toBe('pumpkin');

      // Next -> Golden Berry
      fireEvent.keyDown(window, { key: 'e' });
      expect(useUiStore.getState().selectedSeed).toBe('golden_berry');

      // Next -> Starfruit
      fireEvent.keyDown(window, { key: 'e' });
      expect(useUiStore.getState().selectedSeed).toBe('starfruit');

      // Next -> wraps around to Carrot
      fireEvent.keyDown(window, { key: 'e' });
      expect(useUiStore.getState().selectedSeed).toBe('carrot');
    });

    it('cycles to previous seed on pressing "q" or "Q" and arms planting (Carrot -> Starfruit -> Golden Berry -> Pumpkin -> Tomato -> Carrot)', () => {
      render(<SeedPicker />);

      expect(useUiStore.getState().selectedSeed).toBe('carrot');

      // Prev -> Starfruit
      fireEvent.keyDown(window, { key: 'q' });
      expect(useUiStore.getState().selectedSeed).toBe('starfruit');
      expect(useUiStore.getState().plantArmed).toBe(true);
      expect(screen.getByTestId('seed-card-starfruit')).toHaveAttribute('aria-pressed', 'true');

      // Prev -> Golden Berry
      fireEvent.keyDown(window, { key: 'Q' });
      expect(useUiStore.getState().selectedSeed).toBe('golden_berry');

      // Prev -> Pumpkin
      fireEvent.keyDown(window, { key: 'q' });
      expect(useUiStore.getState().selectedSeed).toBe('pumpkin');

      // Prev -> Tomato
      fireEvent.keyDown(window, { key: 'q' });
      expect(useUiStore.getState().selectedSeed).toBe('tomato');

      // Prev -> Carrot
      fireEvent.keyDown(window, { key: 'q' });
      expect(useUiStore.getState().selectedSeed).toBe('carrot');
    });

    it('cycles seeds regardless of the active tool (no seed-bag tool anymore)', () => {
      useUiStore.getState().setSelectedTool('watering_can');
      render(<SeedPicker />);

      expect(useUiStore.getState().selectedSeed).toBe('carrot');

      fireEvent.keyDown(window, { key: 'e' });
      expect(useUiStore.getState().selectedSeed).toBe('tomato');
      expect(useUiStore.getState().plantArmed).toBe(true);

      fireEvent.keyDown(window, { key: 'q' });
      expect(useUiStore.getState().selectedSeed).toBe('carrot');
    });

    it('does not cycle seed when typing inside an input element', () => {
      useUiStore.getState().setSelectedTool('watering_can');
      render(
        <div>
          <input data-testid="text-input" type="text" />
          <SeedPicker />
        </div>
      );

      const input = screen.getByTestId('text-input');
      input.focus();

      fireEvent.keyDown(input, { key: 'e' });
      expect(useUiStore.getState().selectedSeed).toBe('carrot');
    });
  });

  describe('4. Accessibility and Responsive Touch Targets', () => {
    it('each crop button has touch target >= 44x44 CSS pixels', () => {
      render(<SeedPicker />);

      const cards = [
        screen.getByTestId('seed-card-carrot'),
        screen.getByTestId('seed-card-tomato'),
        screen.getByTestId('seed-card-pumpkin'),
        screen.getByTestId('seed-card-golden_berry'),
        screen.getByTestId('seed-card-starfruit'),
      ];

      for (const card of cards) {
        expect(card).toHaveClass('min-w-[44px]', 'min-h-[44px]');
      }
    });

    it('each crop button has descriptive aria-label including name and count', () => {
      render(<SeedPicker />);

      expect(screen.getByTestId('seed-card-carrot')).toHaveAttribute(
        'aria-label',
        expect.stringMatching(/carrot.*5/i)
      );
      expect(screen.getByTestId('seed-card-tomato')).toHaveAttribute(
        'aria-label',
        expect.stringMatching(/tomato.*0/i)
      );
    });

    it('displays Q/E desktop shortcut hint tags', () => {
      render(<SeedPicker />);

      expect(screen.getByTestId('seed-shortcut-prev')).toHaveTextContent('Q');
      expect(screen.getByTestId('seed-shortcut-next')).toHaveTextContent('E');
    });

    it('has no close button: the hotbar is always visible', () => {
      render(<SeedPicker />);

      expect(screen.queryByTestId('seed-picker-close-button')).not.toBeInTheDocument();
    });
  });
});
