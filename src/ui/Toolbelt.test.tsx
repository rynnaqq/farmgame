import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Toolbelt } from './Toolbelt';
import { useGameStore, resetGameStore } from '../state/gameStore';
import { useUiStore, resetUiStore } from '../state/uiStore';
import { resetSettingsStore } from '../state/settingsStore';
import { InputManager } from '../game/input/InputManager';

describe('Task 14: Toolbelt Component', () => {
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

  describe('1. Tool Layout and Fixed Ordering', () => {
    it('renders exactly 2 tool buttons in fixed order: Watering Can (1), Hand/Scythe (2)', () => {
      render(<Toolbelt inputManager={inputManager} />);

      const toolbelt = screen.getByTestId('toolbelt-container');
      expect(toolbelt).toBeInTheDocument();

      const waterBtn = screen.getByTestId('tool-watering_can');
      const handBtn = screen.getByTestId('tool-hand');

      expect(waterBtn).toBeInTheDocument();
      expect(handBtn).toBeInTheDocument();
      expect(screen.queryByTestId('tool-seed_bag')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tool-trowel')).not.toBeInTheDocument();

      // Verify DOM order
      expect(waterBtn.compareDocumentPosition(handBtn)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('displays shortcut numbers 1, 2 on the respective tools', () => {
      render(<Toolbelt inputManager={inputManager} />);

      expect(screen.getByTestId('tool-watering_can')).toHaveTextContent('1');
      expect(screen.getByTestId('tool-hand')).toHaveTextContent('2');
    });

    it('always renders the seed hotbar (no seed-bag tool anymore)', () => {
      render(<Toolbelt inputManager={inputManager} />);

      expect(screen.getByTestId('seed-picker')).toBeInTheDocument();
      expect(screen.getByTestId('seed-card-carrot')).toBeInTheDocument();
    });
  });

  describe('2. Tool Selection and Active State Highlighting', () => {
    it('initializes with watering can as active tool with aria-pressed="true"', () => {
      render(<Toolbelt inputManager={inputManager} />);

      const waterBtn = screen.getByTestId('tool-watering_can');
      const handBtn = screen.getByTestId('tool-hand');

      expect(waterBtn).toHaveAttribute('aria-pressed', 'true');
      expect(handBtn).toHaveAttribute('aria-pressed', 'false');
    });

    it('selects Watering Can on click and updates uiStore', () => {
      render(<Toolbelt inputManager={inputManager} />);

      const waterBtn = screen.getByTestId('tool-watering_can');
      fireEvent.click(waterBtn);

      expect(useUiStore.getState().selectedTool).toBe('watering_can');
      expect(waterBtn).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('tool-hand')).toHaveAttribute('aria-pressed', 'false');
    });

    it('selects Hand/Scythe on click and updates uiStore', () => {
      render(<Toolbelt inputManager={inputManager} />);

      const handBtn = screen.getByTestId('tool-hand');
      fireEvent.click(handBtn);

      expect(['hand', 'scythe']).toContain(useUiStore.getState().selectedTool);
      expect(handBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('applies distinct active styling (border, scale, high contrast) to selected tool', () => {
      render(<Toolbelt inputManager={inputManager} />);

      const waterBtn = screen.getByTestId('tool-watering_can');
      // Active tool should have active classes (border, ring, scale, etc.)
      expect(waterBtn.className).toMatch(/border-|ring-|scale-/);
    });
  });

  describe('3. Keyboard Shortcuts (1-2)', () => {
    it('switches tool to Watering Can on pressing "1"', () => {
      useUiStore.getState().setSelectedTool('hand');
      render(<Toolbelt inputManager={inputManager} />);

      fireEvent.keyDown(window, { key: '1' });
      expect(useUiStore.getState().selectedTool).toBe('watering_can');
      expect(screen.getByTestId('tool-watering_can')).toHaveAttribute('aria-pressed', 'true');
    });

    it('switches tool to Hand/Scythe on pressing "2"', () => {
      render(<Toolbelt inputManager={inputManager} />);

      fireEvent.keyDown(window, { key: '2' });
      expect(['hand', 'scythe']).toContain(useUiStore.getState().selectedTool);
      expect(screen.getByTestId('tool-hand')).toHaveAttribute('aria-pressed', 'true');
    });

    it('ignores number keys when typing inside an input element', () => {
      render(
        <div>
          <input data-testid="test-input" type="text" />
          <Toolbelt inputManager={inputManager} />
        </div>
      );

      const input = screen.getByTestId('test-input');
      input.focus();

      fireEvent.keyDown(input, { key: '2' });
      // Should remain watering_can (default)
      expect(useUiStore.getState().selectedTool).toBe('watering_can');
    });
  });

  describe('4. Golden Watering Can Styling', () => {
    it('displays standard watering can styling when goldenWateringCanOwned is false', () => {
      useGameStore.getState().setGoldenWateringCan(false);
      render(<Toolbelt inputManager={inputManager} />);

      const waterBtn = screen.getByTestId('tool-watering_can');
      expect(waterBtn).toHaveAttribute('aria-label', expect.stringMatching(/watering can/i));
      expect(waterBtn).not.toHaveAttribute('data-golden', 'true');
    });

    it('displays distinct golden styling and icon when goldenWateringCanOwned is true', () => {
      useGameStore.getState().setGoldenWateringCan(true);
      render(<Toolbelt inputManager={inputManager} />);

      const waterBtn = screen.getByTestId('tool-watering_can');
      expect(waterBtn).toHaveAttribute('data-golden', 'true');
      expect(waterBtn).toHaveAttribute('aria-label', expect.stringMatching(/golden/i));
      expect(waterBtn.className).toMatch(/amber|yellow|gold/i);
    });
  });

  describe('5. Armed-Seed Indicator Chip', () => {
    it('hides the armed chip while planting is disarmed', () => {
      render(<Toolbelt inputManager={inputManager} />);

      expect(useUiStore.getState().plantArmed).toBe(false);
      expect(screen.queryByTestId('plant-armed-chip')).not.toBeInTheDocument();
    });

    it('shows the armed chip with seed name and count after arming from the hotbar', () => {
      render(<Toolbelt inputManager={inputManager} />);

      fireEvent.click(screen.getByTestId('seed-card-pumpkin'));

      const chip = screen.getByTestId('plant-armed-chip');
      expect(chip).toBeInTheDocument();
      expect(chip).toHaveTextContent(/pumpkin/i);
      // Default starting pumpkin seeds is 0
      expect(chip).toHaveTextContent('0');
    });

    it('updates the armed chip count reactively when inventory changes', () => {
      render(<Toolbelt inputManager={inputManager} />);

      act(() => {
        useUiStore.getState().armSeed('pumpkin');
        useGameStore.getState().addSeeds('pumpkin', 12);
      });

      expect(screen.getByTestId('plant-armed-chip')).toHaveTextContent('12');
    });

    it('disarming via the chip cancel button hides the chip', () => {
      render(<Toolbelt inputManager={inputManager} />);

      fireEvent.click(screen.getByTestId('seed-card-carrot'));
      expect(screen.getByTestId('plant-armed-chip')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('plant-disarm-button'));
      expect(useUiStore.getState().plantArmed).toBe(false);
      expect(screen.queryByTestId('plant-armed-chip')).not.toBeInTheDocument();
    });

    it('selecting a tool disarms planting and hides the chip', () => {
      render(<Toolbelt inputManager={inputManager} />);

      fireEvent.click(screen.getByTestId('seed-card-carrot'));
      expect(screen.getByTestId('plant-armed-chip')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('tool-hand'));
      expect(useUiStore.getState().plantArmed).toBe(false);
      expect(screen.queryByTestId('plant-armed-chip')).not.toBeInTheDocument();
    });
  });

  describe('6. Seed Hotbar Integration', () => {
    it('always renders the seed hotbar above the toolbelt', () => {
      useUiStore.getState().setSelectedTool('watering_can');
      render(<Toolbelt inputManager={inputManager} />);

      expect(screen.getByTestId('seed-picker')).toBeInTheDocument();
    });
  });

  describe('7. Accessibility & Touch Targets', () => {
    it('all tool buttons have touch targets >= 44x44 CSS pixels', () => {
      render(<Toolbelt inputManager={inputManager} />);

      const buttons = [
        screen.getByTestId('tool-watering_can'),
        screen.getByTestId('tool-hand'),
      ];

      for (const btn of buttons) {
        expect(btn).toHaveClass('min-w-[44px]', 'min-h-[44px]');
      }
    });

    it('all tool buttons have descriptive aria-labels', () => {
      render(<Toolbelt inputManager={inputManager} />);

      expect(screen.getByTestId('tool-watering_can')).toHaveAttribute('aria-label');
      expect(screen.getByTestId('tool-hand')).toHaveAttribute('aria-label');
    });

    it('disables or marks inactive when a modal is open', () => {
      render(<Toolbelt inputManager={inputManager} />);

      act(() => {
        useUiStore.getState().openModal('shop');
      });

      const toolbeltContainer = screen.getByTestId('toolbelt-container');
      expect(toolbeltContainer).toHaveAttribute('data-modal-open', 'true');
    });
  });
});
