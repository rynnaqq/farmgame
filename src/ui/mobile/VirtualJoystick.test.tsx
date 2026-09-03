import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { VirtualJoystick } from './VirtualJoystick';
import { MobileActionButton } from './MobileActionButton';
import { MobileHUD } from './MobileHUD';
import { InputManager } from '../../game/input/InputManager';
import { useUiStore, resetUiStore } from '../../state/uiStore';
import { resetGameStore } from '../../state/gameStore';
import { useSettingsStore, resetSettingsStore } from '../../state/settingsStore';
import {
  JOYSTICK_BASE_DIAMETER,
  JOYSTICK_BASE_DIAMETER_SMALL,
  JOYSTICK_KNOB_DIAMETER,
  JOYSTICK_MAX_TRAVEL,
} from '../../game/core/constants';

describe('Task 9: Mobile Virtual Joystick & Touch Controls', () => {
  let inputManager: InputManager;

  beforeEach(() => {
    resetUiStore();
    resetGameStore();
    resetSettingsStore();
    inputManager = new InputManager();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. VirtualJoystick Rendering & Dimensions', () => {
    it('renders joystick base and knob with expected accessible attributes and default sizes', () => {
      render(<VirtualJoystick inputManager={inputManager} />);

      const base = screen.getByTestId('virtual-joystick-base');
      const knob = screen.getByTestId('virtual-joystick-knob');

      expect(base).toBeInTheDocument();
      expect(knob).toBeInTheDocument();
      expect(base).toHaveAttribute('aria-label', expect.stringMatching(/virtual joystick/i));
    });

    it('renders with 112px base on standard screen and 96px on small screen (<380px)', () => {
      // Standard screen (1024px)
      window.innerWidth = 1024;
      const { unmount } = render(<VirtualJoystick inputManager={inputManager} />);
      const baseStandard = screen.getByTestId('virtual-joystick-base');
      expect(baseStandard).toHaveStyle({
        width: `${JOYSTICK_BASE_DIAMETER}px`,
        height: `${JOYSTICK_BASE_DIAMETER}px`,
      });
      unmount();

      // Small screen (360px)
      window.innerWidth = 360;
      render(<VirtualJoystick inputManager={inputManager} />);
      const baseSmall = screen.getByTestId('virtual-joystick-base');
      expect(baseSmall).toHaveStyle({
        width: `${JOYSTICK_BASE_DIAMETER_SMALL}px`,
        height: `${JOYSTICK_BASE_DIAMETER_SMALL}px`,
      });
    });

    it('knob has 48px diameter', () => {
      render(<VirtualJoystick inputManager={inputManager} />);
      const knob = screen.getByTestId('virtual-joystick-knob');
      expect(knob).toHaveStyle({
        width: `${JOYSTICK_KNOB_DIAMETER}px`,
        height: `${JOYSTICK_KNOB_DIAMETER}px`,
      });
    });
  });

  describe('2. Pointer Capture & Drag Math', () => {
    it('captures pointer on pointerdown and sets joystick active', () => {
      render(<VirtualJoystick inputManager={inputManager} />);
      const base = screen.getByTestId('virtual-joystick-base');

      const setPointerCaptureMock = vi.fn();
      base.setPointerCapture = setPointerCaptureMock;

      // Mock getBoundingClientRect so base center is at (100, 100)
      vi.spyOn(base, 'getBoundingClientRect').mockReturnValue({
        left: 44,
        top: 44,
        right: 156,
        bottom: 156,
        width: 112,
        height: 112,
        x: 44,
        y: 44,
        toJSON: () => {},
      });

      fireEvent.pointerDown(base, {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        pointerType: 'touch',
      });

      expect(setPointerCaptureMock).toHaveBeenCalledWith(1);
      expect(useUiStore.getState().isJoystickActive).toBe(true);
    });

    it('ignores secondary pointerdown events when a touch pointer is already active', () => {
      render(<VirtualJoystick inputManager={inputManager} />);
      const base = screen.getByTestId('virtual-joystick-base');

      const setPointerCaptureMock = vi.fn();
      base.setPointerCapture = setPointerCaptureMock;

      vi.spyOn(base, 'getBoundingClientRect').mockReturnValue({
        left: 44,
        top: 44,
        right: 156,
        bottom: 156,
        width: 112,
        height: 112,
        x: 44,
        y: 44,
        toJSON: () => {},
      });

      // Pointer 1 down
      fireEvent.pointerDown(base, { pointerId: 1, clientX: 100, clientY: 100 });
      expect(setPointerCaptureMock).toHaveBeenCalledWith(1);

      // Pointer 2 down should be ignored
      fireEvent.pointerDown(base, { pointerId: 2, clientX: 120, clientY: 120 });
      expect(setPointerCaptureMock).not.toHaveBeenCalledWith(2);
    });

    it('translates pointer movement into normalized vector and updates inputManager and uiStore', () => {
      render(<VirtualJoystick inputManager={inputManager} />);
      const base = screen.getByTestId('virtual-joystick-base');
      const knob = screen.getByTestId('virtual-joystick-knob');

      vi.spyOn(base, 'getBoundingClientRect').mockReturnValue({
        left: 44,
        top: 44,
        right: 156,
        bottom: 156,
        width: 112,
        height: 112,
        x: 44,
        y: 44,
        toJSON: () => {},
      });

      // Pointer down at center (100, 100)
      fireEvent.pointerDown(base, { pointerId: 1, clientX: 100, clientY: 100 });

      // Move 21px up (clientY = 79, deltaY = -21) -> half travel (21 / 42 = 0.5)
      fireEvent.pointerMove(base, { pointerId: 1, clientX: 100, clientY: 79 });

      const vector = useUiStore.getState().joystickVector;
      expect(vector.x).toBeCloseTo(0, 2);
      expect(vector.y).toBeCloseTo(-0.5, 2);

      // Knob visually translated by -21px Y
      expect(knob.style.transform).toContain('-21px');
    });

    it('clamps knob drag travel to maximum 42px and vector magnitude to 1.0', () => {
      render(<VirtualJoystick inputManager={inputManager} />);
      const base = screen.getByTestId('virtual-joystick-base');
      const knob = screen.getByTestId('virtual-joystick-knob');

      vi.spyOn(base, 'getBoundingClientRect').mockReturnValue({
        left: 44,
        top: 44,
        right: 156,
        bottom: 156,
        width: 112,
        height: 112,
        x: 44,
        y: 44,
        toJSON: () => {},
      });

      fireEvent.pointerDown(base, { pointerId: 1, clientX: 100, clientY: 100 });

      // Drag 100px to the right (clientX = 200, deltaX = 100)
      fireEvent.pointerMove(base, { pointerId: 1, clientX: 200, clientY: 100 });

      const vector = useUiStore.getState().joystickVector;
      expect(vector.x).toBeCloseTo(1.0, 2);
      expect(vector.y).toBeCloseTo(0, 2);

      // Knob transform clamped to 42px
      expect(knob.style.transform).toContain(`${JOYSTICK_MAX_TRAVEL}px`);
    });

    it('releases pointer capture and resets knob and vector on pointerup', () => {
      render(<VirtualJoystick inputManager={inputManager} />);
      const base = screen.getByTestId('virtual-joystick-base');
      const knob = screen.getByTestId('virtual-joystick-knob');

      const releasePointerCaptureMock = vi.fn();
      base.releasePointerCapture = releasePointerCaptureMock;

      vi.spyOn(base, 'getBoundingClientRect').mockReturnValue({
        left: 44,
        top: 44,
        right: 156,
        bottom: 156,
        width: 112,
        height: 112,
        x: 44,
        y: 44,
        toJSON: () => {},
      });

      fireEvent.pointerDown(base, { pointerId: 1, clientX: 100, clientY: 100 });
      fireEvent.pointerMove(base, { pointerId: 1, clientX: 142, clientY: 100 });
      expect(useUiStore.getState().isJoystickActive).toBe(true);

      fireEvent.pointerUp(base, { pointerId: 1, clientX: 142, clientY: 100 });

      expect(releasePointerCaptureMock).toHaveBeenCalledWith(1);
      expect(useUiStore.getState().isJoystickActive).toBe(false);
      expect(useUiStore.getState().joystickVector).toEqual({ x: 0, y: 0 });
      expect(knob.style.transform).toContain('0px');
    });
  });

  describe('3. Cleanup & Cancellation', () => {
    it('resets joystick on pointercancel', () => {
      render(<VirtualJoystick inputManager={inputManager} />);
      const base = screen.getByTestId('virtual-joystick-base');

      vi.spyOn(base, 'getBoundingClientRect').mockReturnValue({
        left: 44,
        top: 44,
        right: 156,
        bottom: 156,
        width: 112,
        height: 112,
        x: 44,
        y: 44,
        toJSON: () => {},
      });

      fireEvent.pointerDown(base, { pointerId: 1, clientX: 100, clientY: 100 });
      fireEvent.pointerMove(base, { pointerId: 1, clientX: 120, clientY: 120 });
      expect(useUiStore.getState().isJoystickActive).toBe(true);

      fireEvent.pointerCancel(base, { pointerId: 1, clientX: 120, clientY: 120 });

      expect(useUiStore.getState().isJoystickActive).toBe(false);
      expect(useUiStore.getState().joystickVector).toEqual({ x: 0, y: 0 });
    });

    it('resets joystick on lostpointercapture', () => {
      render(<VirtualJoystick inputManager={inputManager} />);
      const base = screen.getByTestId('virtual-joystick-base');

      vi.spyOn(base, 'getBoundingClientRect').mockReturnValue({
        left: 44,
        top: 44,
        right: 156,
        bottom: 156,
        width: 112,
        height: 112,
        x: 44,
        y: 44,
        toJSON: () => {},
      });

      fireEvent.pointerDown(base, { pointerId: 1, clientX: 100, clientY: 100 });
      expect(useUiStore.getState().isJoystickActive).toBe(true);

      fireEvent(base, new Event('lostpointercapture'));

      expect(useUiStore.getState().isJoystickActive).toBe(false);
      expect(useUiStore.getState().joystickVector).toEqual({ x: 0, y: 0 });
    });

    it('resets joystick on window blur', () => {
      render(<VirtualJoystick inputManager={inputManager} />);
      const base = screen.getByTestId('virtual-joystick-base');

      vi.spyOn(base, 'getBoundingClientRect').mockReturnValue({
        left: 44,
        top: 44,
        right: 156,
        bottom: 156,
        width: 112,
        height: 112,
        x: 44,
        y: 44,
        toJSON: () => {},
      });

      fireEvent.pointerDown(base, { pointerId: 1, clientX: 100, clientY: 100 });
      expect(useUiStore.getState().isJoystickActive).toBe(true);

      window.dispatchEvent(new Event('blur'));

      expect(useUiStore.getState().isJoystickActive).toBe(false);
      expect(useUiStore.getState().joystickVector).toEqual({ x: 0, y: 0 });
    });

    it('cancels and resets joystick when a modal opens', () => {
      render(<VirtualJoystick inputManager={inputManager} />);
      const base = screen.getByTestId('virtual-joystick-base');

      vi.spyOn(base, 'getBoundingClientRect').mockReturnValue({
        left: 44,
        top: 44,
        right: 156,
        bottom: 156,
        width: 112,
        height: 112,
        x: 44,
        y: 44,
        toJSON: () => {},
      });

      fireEvent.pointerDown(base, { pointerId: 1, clientX: 100, clientY: 100 });
      expect(useUiStore.getState().isJoystickActive).toBe(true);

      act(() => {
        useUiStore.getState().openModal('shop');
      });

      expect(useUiStore.getState().isJoystickActive).toBe(false);
      expect(useUiStore.getState().joystickVector).toEqual({ x: 0, y: 0 });
    });
  });

  describe('4. MobileActionButton Contextual Actions & Haptics', () => {
    it('renders with minimum 56x56 CSS pixel size in bottom-right safe area', () => {
      render(<MobileActionButton />);
      const actionButton = screen.getByTestId('mobile-action-button');
      expect(actionButton).toBeInTheDocument();
      expect(actionButton).toHaveClass('min-w-[56px]', 'min-h-[56px]');
    });

    it('displays contextual label per tool (watering_can -> Water, seed_bag -> Tap Soil, scythe -> Harvest)', () => {
      const { rerender } = render(<MobileActionButton selectedTool="watering_can" hasTarget={true} />);
      expect(screen.getByTestId('mobile-action-button')).toHaveAttribute(
        'aria-label',
        expect.stringMatching(/water/i)
      );

      rerender(<MobileActionButton selectedTool="seed_bag" hasTarget={true} />);
      expect(screen.getByTestId('mobile-action-button')).toHaveAttribute(
        'aria-label',
        expect.stringMatching(/tap soil/i)
      );
      expect(screen.getByTestId('mobile-action-button')).toBeDisabled();

      rerender(<MobileActionButton selectedTool="scythe" hasTarget={true} />);
      expect(screen.getByTestId('mobile-action-button')).toHaveAttribute(
        'aria-label',
        expect.stringMatching(/harvest/i)
      );
    });

    it('displays Merchant Shop action when nearMerchant is true', () => {
      render(<MobileActionButton nearMerchant={true} />);
      expect(screen.getByTestId('mobile-action-button')).toHaveAttribute(
        'aria-label',
        expect.stringMatching(/shop|merchant/i)
      );
    });

    it('triggers navigator.vibrate(15) on tap when haptics setting is true', () => {
      useSettingsStore.getState().setHaptics(true);
      const vibrateMock = vi.fn();
      Object.defineProperty(navigator, 'vibrate', {
        value: vibrateMock,
        configurable: true,
        writable: true,
      });

      const onAction = vi.fn();
      render(<MobileActionButton onAction={onAction} selectedTool="hand" hasTarget={true} />);
      const button = screen.getByTestId('mobile-action-button');

      fireEvent.click(button);

      expect(vibrateMock).toHaveBeenCalledWith(15);
      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('does not trigger navigator.vibrate when haptics setting is false', () => {
      useSettingsStore.getState().setHaptics(false);
      const vibrateMock = vi.fn();
      Object.defineProperty(navigator, 'vibrate', {
        value: vibrateMock,
        configurable: true,
        writable: true,
      });

      render(<MobileActionButton selectedTool="hand" hasTarget={true} />);
      const button = screen.getByTestId('mobile-action-button');

      fireEvent.click(button);

      expect(vibrateMock).not.toHaveBeenCalled();
    });
  });

  describe('5. MobileHUD Component Integration', () => {
    it('renders VirtualJoystick and MobileActionButton when inputMode is "touch"', () => {
      useSettingsStore.getState().setInputMode('touch');
      render(<MobileHUD inputManager={inputManager} />);

      expect(screen.getByTestId('mobile-hud-container')).toBeInTheDocument();
      expect(screen.getByTestId('virtual-joystick-base')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-action-button')).toBeInTheDocument();
    });

    it('does not render mobile HUD when inputMode is "desktop" on non-touch device', () => {
      useSettingsStore.getState().setInputMode('desktop');
      render(<MobileHUD inputManager={inputManager} forceTouch={false} />);

      expect(screen.queryByTestId('mobile-hud-container')).not.toBeInTheDocument();
    });

    it('has pointer-events-none on HUD overlay container to allow camera touch gestures on canvas', () => {
      useSettingsStore.getState().setInputMode('touch');
      render(<MobileHUD inputManager={inputManager} />);

      const hudContainer = screen.getByTestId('mobile-hud-container');
      expect(hudContainer).toHaveClass('pointer-events-none');
    });

    it('hides controls or marks them inactive when a modal is active', () => {
      useSettingsStore.getState().setInputMode('touch');
      render(<MobileHUD inputManager={inputManager} />);

      expect(screen.getByTestId('virtual-joystick-base')).toBeInTheDocument();

      act(() => {
        useUiStore.getState().openModal('settings');
      });

      const hudContainer = screen.getByTestId('mobile-hud-container');
      expect(hudContainer).toHaveAttribute('data-modal-open', 'true');
    });
  });
});
