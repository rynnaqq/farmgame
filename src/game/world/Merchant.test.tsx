import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Merchant } from './Merchant';
import { useGameStore, resetGameStore } from '../../state/gameStore';
import { useUiStore, resetUiStore } from '../../state/uiStore';
import { MERCHANT_POSITION, MERCHANT_INTERACTION_RANGE } from '../core/constants';

// Mock @react-three/fiber and @react-three/drei for DOM test runner
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  extend: vi.fn(),
}));

vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="drei-html">{children}</div>
  ),
}));

vi.mock('@react-three/rapier', () => ({
  RigidBody: ({ children }: { children: React.ReactNode }) => (
    <group data-testid="rigid-body">{children}</group>
  ),
  CylinderCollider: () => <mesh data-testid="cylinder-collider" />,
  CuboidCollider: () => <mesh data-testid="cuboid-collider" />,
}));

describe('Merchant NPC & Interaction Tests', () => {
  beforeEach(() => {
    resetGameStore(42);
    resetUiStore();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Proximity Detection & Keyboard E Trigger', () => {
    it('opens shop modal on "E" key press when player is within interaction range', () => {
      // Place player close to merchant
      useGameStore
        .getState()
        .setPlayerPosition([MERCHANT_POSITION[0] + 1.0, 0, MERCHANT_POSITION[2]]);

      render(<Merchant />);

      expect(useUiStore.getState().activeModal).toBeNull();

      fireEvent.keyDown(window, { key: 'e' });
      expect(useUiStore.getState().activeModal).toBe('shop');
    });

    it('supports uppercase "E" key press as well', () => {
      useGameStore
        .getState()
        .setPlayerPosition([MERCHANT_POSITION[0], 0, MERCHANT_POSITION[2] + 1.5]);

      render(<Merchant />);

      fireEvent.keyDown(window, { key: 'E' });
      expect(useUiStore.getState().activeModal).toBe('shop');
    });

    it('ignores "E" key press when player is outside interaction range (> 2.5 units)', () => {
      // Place player at origin [0, 0, 0]
      useGameStore.getState().setPlayerPosition([0, 0, 0]);

      render(<Merchant />);

      fireEvent.keyDown(window, { key: 'e' });
      expect(useUiStore.getState().activeModal).toBeNull();
    });

    it('ignores "E" key press when a modal is already open', () => {
      useGameStore.getState().setPlayerPosition([MERCHANT_POSITION[0], 0, MERCHANT_POSITION[2]]);
      useUiStore.getState().openModal('settings');

      render(<Merchant />);

      fireEvent.keyDown(window, { key: 'e' });
      // Modal should remain settings, not shop
      expect(useUiStore.getState().activeModal).toBe('settings');
    });

    it('ignores "E" key press when typing inside an input element', () => {
      useGameStore.getState().setPlayerPosition([MERCHANT_POSITION[0], 0, MERCHANT_POSITION[2]]);

      render(
        <div>
          <input data-testid="search-input" type="text" />
          <Merchant />
        </div>
      );

      const input = document.querySelector('input')!;
      input.focus();

      fireEvent.keyDown(input, { key: 'e' });
      expect(useUiStore.getState().activeModal).toBeNull();
    });
  });

  describe('2. Custom Position & Callback Support', () => {
    it('calls onOpenShop callback when shop is opened', () => {
      const onOpenShopMock = vi.fn();
      useGameStore.getState().setPlayerPosition([10, 0, 10]);

      render(<Merchant position={[10, 0, 10]} onOpenShop={onOpenShopMock} />);

      fireEvent.keyDown(window, { key: 'e' });
      expect(useUiStore.getState().activeModal).toBe('shop');
      expect(onOpenShopMock).toHaveBeenCalledTimes(1);
    });

    it('correctly uses MERCHANT_INTERACTION_RANGE constant (3.0 units per PRD §7.11)', () => {
      expect(MERCHANT_INTERACTION_RANGE).toBe(3.0);
    });
  });
});
