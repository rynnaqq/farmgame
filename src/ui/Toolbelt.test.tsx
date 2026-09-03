import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Toolbelt } from './Toolbelt';
import { useGameStore, resetGameStore } from '../state/gameStore';
import { useUiStore, resetUiStore } from '../state/uiStore';
import { resetSettingsStore } from '../state/settingsStore';
import { InputManager } from '../game/input/InputManager';

describe('Toolbelt Component', () => {
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
    it('offers only Water, Seeds, and Harvest in that order', () => {
      render(<Toolbelt inputManager={inputManager} />);

      const toolbelt = screen.getByTestId('toolbelt-container');
      expect(toolbelt).toBeInTheDocument();

      expect(screen.queryByTestId('tool-trowel')).not.toBeInTheDocument();
      expect(screen.queryByText(/till|trowel/i)).not.toBeInTheDocument();

      const waterBtn = screen.getByTestId('tool-watering_can');
      const seedBtn = screen.getByTestId('tool-seed_bag');
      const handBtn = screen.getByTestId('tool-hand');

      expect(waterBtn).toHaveAttribute('data-hotkey', '1');
      expect(seedBtn).toHaveAttribute('data-hotkey', '2');
      expect(handBtn).toHaveAttribute('data-hotkey', '3');

      // Verify DOM order
      const buttons = [waterBtn, seedBtn, handBtn];
      for (let i = 0; i < buttons.length - 1; i += 1) {
        expect(buttons[i].compareDocumentPosition(buttons[i + 1])).toBe(
          Node.DOCUMENT_POSITION_FOLLOWING
        );
      }

      const toolButtons = screen.getAllByRole('button');
      expect(toolButtons.filter((button) => button.hasAttribute('data-tool'))).toHaveLength(3);
    });

    it('displays shortcut numbers 1, 2, 3 on the respective tools', () => {
      render(<Toolbelt inputManager={inputManager} />);

      expect(screen.getByTestId('tool-watering_can')).toHaveTextContent('1');
      expect(screen.getByTestId('tool-seed_bag')).toHaveTextContent('2');
      expect(screen.getByTestId('tool-hand')).toHaveTextContent('3');
    });
  });

  describe('2. Tool Selection and Active State Highlighting', () => {
    it('initializes with seed_bag as active tool with aria-pressed="true"', () => {
      render(<Toolbelt inputManager={inputManager} />);

      const seedBtn = screen.getByTestId('tool-seed_bag');
      const waterBtn = screen.getByTestId('tool-watering_can');

      expect(seedBtn).toHaveAttribute('aria-pressed', 'true');
      expect(waterBtn).toHaveAttribute('aria-pressed', 'false');
    });

    it('selects Watering Can on click and updates uiStore', () => {
      render(<Toolbelt inputManager={inputManager} />);

      const waterBtn = screen.getByTestId('tool-watering_can');
      fireEvent.click(waterBtn);

      expect(useUiStore.getState().selectedTool).toBe('watering_can');
      expect(waterBtn).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('tool-seed_bag')).toHaveAttribute('aria-pressed', 'false');
    });

    it('selects Seed Bag on click and updates uiStore', () => {
      render(<Toolbelt inputManager={inputManager} />);

      const seedBtn = screen.getByTestId('tool-seed_bag');
      fireEvent.click(seedBtn);

      expect(useUiStore.getState().selectedTool).toBe('seed_bag');
      expect(seedBtn).toHaveAttribute('aria-pressed', 'true');
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

      const seedBtn = screen.getByTestId('tool-seed_bag');
      expect(seedBtn.className).toMatch(/border-|ring-|scale-/);
    });
  });

  describe('3. Keyboard Shortcuts (1-3)', () => {
    it('switches tool to Watering Can on pressing "1"', () => {
      useUiStore.getState().setSelectedTool('seed_bag');
      render(<Toolbelt inputManager={inputManager} />);

      fireEvent.keyDown(window, { key: '1' });
      expect(useUiStore.getState().selectedTool).toBe('watering_can');
      expect(screen.getByTestId('tool-watering_can')).toHaveAttribute('aria-pressed', 'true');
    });

    it('switches tool to Seed Bag on pressing "2"', () => {
      render(<Toolbelt inputManager={inputManager} />);

      fireEvent.keyDown(window, { key: '2' });
      expect(useUiStore.getState().selectedTool).toBe('seed_bag');
      expect(screen.getByTestId('tool-seed_bag')).toHaveAttribute('aria-pressed', 'true');
    });

    it('switches tool to Harvest on pressing "3"', () => {
      render(<Toolbelt inputManager={inputManager} />);

      fireEvent.keyDown(window, { key: '3' });
      expect(['hand', 'scythe']).toContain(useUiStore.getState().selectedTool);
      expect(screen.getByTestId('tool-hand')).toHaveAttribute('aria-pressed', 'true');
    });

    it('does nothing on pressing "4" (no fourth tool)', () => {
      useUiStore.getState().setSelectedTool('watering_can');
      render(<Toolbelt inputManager={inputManager} />);

      fireEvent.keyDown(window, { key: '4' });
      expect(useUiStore.getState().selectedTool).toBe('watering_can');
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
      // Remains seed_bag (the default) because the keystroke was consumed by the input
      expect(useUiStore.getState().selectedTool).toBe('seed_bag');
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
      expect(waterBtn).toHaveTextContent(/golden can/i);
      expect(waterBtn.className).toMatch(/amber|yellow|gold/i);
    });
  });

  describe('5. Seed Bag Active Badge & Inventory Count', () => {
    it('displays current active seed and remaining seed count on Seed Bag button', () => {
      useUiStore.getState().setSelectedSeed('carrot');
      render(<Toolbelt inputManager={inputManager} />);

      const seedBtn = screen.getByTestId('tool-seed_bag');
      // Default starting carrot seeds is 5
      expect(seedBtn).toHaveTextContent('5');
      expect(seedBtn).toHaveAttribute('aria-label', expect.stringMatching(/carrot/i));
    });

    it('updates Seed Bag badge reactively when seed count or selected seed changes', () => {
      render(<Toolbelt inputManager={inputManager} />);

      act(() => {
        useUiStore.getState().setSelectedSeed('pumpkin');
        useGameStore.getState().addSeeds('pumpkin', 12);
      });

      const seedBtn = screen.getByTestId('tool-seed_bag');
      expect(seedBtn).toHaveTextContent('12');
      expect(seedBtn).toHaveAttribute('aria-label', expect.stringMatching(/pumpkin/i));
    });
  });

  describe('6. SeedPicker Popup Integration', () => {
    it('renders SeedPicker popup when Seed Bag tool is selected', () => {
      useUiStore.getState().setSelectedTool('seed_bag');
      render(<Toolbelt inputManager={inputManager} />);

      const seedPicker = screen.getByTestId('seed-picker');
      expect(seedPicker).toBeInTheDocument();
    });

    it('hides SeedPicker popup when a non-seed tool is active', () => {
      useUiStore.getState().setSelectedTool('watering_can');
      render(<Toolbelt inputManager={inputManager} />);

      expect(screen.queryByTestId('seed-picker')).not.toBeInTheDocument();
    });
  });

  describe('7. Accessibility & Touch Targets', () => {
    it('all tool buttons have touch targets >= 44x44 CSS pixels', () => {
      render(<Toolbelt inputManager={inputManager} />);

      const buttons = [
        screen.getByTestId('tool-watering_can'),
        screen.getByTestId('tool-seed_bag'),
        screen.getByTestId('tool-hand'),
      ];

      for (const btn of buttons) {
        expect(btn).toHaveClass('min-w-[44px]', 'min-h-[44px]');
      }
    });

    it('all tool buttons have descriptive aria-labels', () => {
      render(<Toolbelt inputManager={inputManager} />);

      expect(screen.getByTestId('tool-watering_can')).toHaveAttribute('aria-label');
      expect(screen.getByTestId('tool-seed_bag')).toHaveAttribute('aria-label');
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
