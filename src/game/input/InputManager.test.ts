import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { processJoystickDeadzone, transformCameraRelative, mergeInputVectors } from './inputTypes';
import { KeyboardInput } from './KeyboardInput';
import { TouchInput } from './TouchInput';
import { InputManager } from './InputManager';
import { useUiStore } from '../../state/uiStore';
import {
  JOYSTICK_DEADZONE_RATIO,
  JOYSTICK_RUN_TIME_MS,
  CAMERA_DEFAULT_YAW_DEG,
} from '../core/constants';

describe('Task 6: Cross-Platform Input Pipeline', () => {
  beforeEach(() => {
    useUiStore.getState().resetUi();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('1. Joystick Deadzone Math (processJoystickDeadzone)', () => {
    it('returns zero vector and zero magnitude when input is inside the 12% deadzone', () => {
      // (0.05, 0.05) has magnitude ~0.0707 < 0.12
      const result = processJoystickDeadzone(0.05, 0.05);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.magnitude).toBe(0);
      expect(result.rawMagnitude).toBeCloseTo(Math.hypot(0.05, 0.05), 4);
    });

    it('returns zero at exact deadzone boundary (0.12)', () => {
      const result = processJoystickDeadzone(JOYSTICK_DEADZONE_RATIO, 0);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.magnitude).toBe(0);
    });

    it('linearly remaps magnitude above deadzone (mag=0.56 -> remapped=0.5)', () => {
      // (0.56 - 0.12) / (1 - 0.12) = 0.44 / 0.88 = 0.5
      const result = processJoystickDeadzone(0.56, 0);
      expect(result.magnitude).toBeCloseTo(0.5, 4);
      expect(result.x).toBeCloseTo(0.5, 4);
      expect(result.y).toBe(0);
    });

    it('remaps full deflection (mag=1.0 -> remapped=1.0)', () => {
      const result = processJoystickDeadzone(0, 1.0);
      expect(result.magnitude).toBeCloseTo(1.0, 4);
      expect(result.x).toBe(0);
      expect(result.y).toBeCloseTo(1.0, 4);
    });

    it('clamps deflection > 1.0 to magnitude 1.0 and preserves angle', () => {
      const result = processJoystickDeadzone(1.5, 1.5);
      expect(result.magnitude).toBeCloseTo(1.0, 4);
      const expectedComponent = 1 / Math.SQRT2;
      expect(result.x).toBeCloseTo(expectedComponent, 4);
      expect(result.y).toBeCloseTo(expectedComponent, 4);
    });

    it('preserves exact direction vector angle when remapping', () => {
      const angle = Math.PI / 6; // 30 degrees
      const rawMag = 0.56;
      const rawX = rawMag * Math.cos(angle);
      const rawY = rawMag * Math.sin(angle);

      const result = processJoystickDeadzone(rawX, rawY);
      expect(result.magnitude).toBeCloseTo(0.5, 4);
      expect(result.x).toBeCloseTo(0.5 * Math.cos(angle), 4);
      expect(result.y).toBeCloseTo(0.5 * Math.sin(angle), 4);
    });
  });

  describe('2. Vector Merging (mergeInputVectors)', () => {
    it('returns zero vector when both keyboard and joystick are idle', () => {
      const result = mergeInputVectors({ x: 0, z: 0 }, { x: 0, z: 0 });
      expect(result.x).toBe(0);
      expect(result.z).toBe(0);
      expect(result.magnitude).toBe(0);
    });

    it('uses keyboard vector directly when joystick is idle', () => {
      const result = mergeInputVectors({ x: 1, z: 0 }, { x: 0, z: 0 });
      expect(result.x).toBeCloseTo(1, 4);
      expect(result.z).toBe(0);
      expect(result.magnitude).toBeCloseTo(1, 4);
    });

    it('uses joystick vector directly when keyboard is idle', () => {
      const result = mergeInputVectors({ x: 0, z: 0 }, { x: 0, z: -0.75 });
      expect(result.x).toBe(0);
      expect(result.z).toBeCloseTo(-0.75, 4);
      expect(result.magnitude).toBeCloseTo(0.75, 4);
    });

    it('merges both vectors and clamps to max length 1 when sum exceeds 1', () => {
      const result = mergeInputVectors({ x: 1, z: 0 }, { x: 1, z: 0 });
      expect(result.x).toBeCloseTo(1, 4);
      expect(result.z).toBe(0);
      expect(result.magnitude).toBeCloseTo(1, 4);
    });

    it('merges perpendicular vectors correctly', () => {
      // Keyboard forward (z: -1), Joystick right (x: 0.5)
      // combined: (0.5, -1), length = sqrt(0.25 + 1) = sqrt(1.25) ~ 1.118 -> normalized to length 1
      const result = mergeInputVectors({ x: 0, z: -1 }, { x: 0.5, z: 0 });
      const len = Math.hypot(0.5, -1);
      expect(result.magnitude).toBeCloseTo(1, 4);
      expect(result.x).toBeCloseTo(0.5 / len, 4);
      expect(result.z).toBeCloseTo(-1 / len, 4);
    });
  });

  describe('3. Camera-Relative Movement Translation (transformCameraRelative)', () => {
    it('preserves vector unchanged when camera yaw is 0 radians', () => {
      const forward = transformCameraRelative(0, -1, 0);
      expect(forward.x).toBeCloseTo(0, 4);
      expect(forward.z).toBeCloseTo(-1, 4);

      const right = transformCameraRelative(1, 0, 0);
      expect(right.x).toBeCloseTo(1, 4);
      expect(right.z).toBeCloseTo(0, 4);
    });

    it('rotates vector by 90 degrees (pi/2 rad)', () => {
      const forward = transformCameraRelative(0, -1, Math.PI / 2);
      expect(forward.x).toBeCloseTo(-1, 4);
      expect(forward.z).toBeCloseTo(0, 4);

      const right = transformCameraRelative(1, 0, Math.PI / 2);
      expect(right.x).toBeCloseTo(0, 4);
      expect(right.z).toBeCloseTo(-1, 4);
    });

    it('rotates vector by default isometric yaw (45 degrees)', () => {
      const yawRad = (CAMERA_DEFAULT_YAW_DEG * Math.PI) / 180;
      const forward = transformCameraRelative(0, -1, yawRad);
      // forward (0, -1) rotated by 45 deg -> (-sin 45°, -cos 45°)
      expect(forward.x).toBeCloseTo(-Math.SQRT1_2, 4);
      expect(forward.z).toBeCloseTo(-Math.SQRT1_2, 4);
      expect(Math.hypot(forward.x, forward.z)).toBeCloseTo(1.0, 4);
    });

    it('preserves magnitude under any arbitrary yaw angle', () => {
      const yawRad = 1.234;
      const mag = 0.65;
      const result = transformCameraRelative(mag * 0.6, mag * 0.8, yawRad);
      expect(Math.hypot(result.x, result.z)).toBeCloseTo(mag, 4);
    });
  });

  describe('4. KeyboardInput', () => {
    let keyboard: KeyboardInput;

    beforeEach(() => {
      keyboard = new KeyboardInput();
      keyboard.attach(window);
    });

    afterEach(() => {
      keyboard.detach();
    });

    it('starts with zero vector and not running', () => {
      expect(keyboard.getVector()).toEqual({ x: 0, z: 0 });
      expect(keyboard.isRunning()).toBe(false);
    });

    it('tracks WASD keys and generates normalized vectors', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }));
      expect(keyboard.getVector()).toEqual({ x: 0, z: -1 });

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 'd' }));
      const diag = keyboard.getVector();
      expect(diag.x).toBeCloseTo(Math.SQRT1_2, 4);
      expect(diag.z).toBeCloseTo(-Math.SQRT1_2, 4);

      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' }));
      expect(keyboard.getVector()).toEqual({ x: 1, z: 0 });

      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', key: 'd' }));
      expect(keyboard.getVector()).toEqual({ x: 0, z: 0 });
    });

    it('tracks Arrow keys correctly', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', key: 'ArrowUp' }));
      expect(keyboard.getVector()).toEqual({ x: 0, z: -1 });

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft' }));
      const diag = keyboard.getVector();
      expect(diag.x).toBeCloseTo(-Math.SQRT1_2, 4);
      expect(diag.z).toBeCloseTo(-Math.SQRT1_2, 4);

      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp', key: 'ArrowUp' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft', key: 'ArrowLeft' }));
      expect(keyboard.getVector()).toEqual({ x: 0, z: 0 });
    });

    it('cancels opposing movement keys (W+S, A+D)', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', key: 's' }));
      expect(keyboard.getVector()).toEqual({ x: 0, z: 0 });

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'a' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 'd' }));
      expect(keyboard.getVector()).toEqual({ x: 0, z: 0 });
    });

    it('tracks Shift key for running', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', key: 'Shift' }));
      expect(keyboard.isRunning()).toBe(true);

      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft', key: 'Shift' }));
      expect(keyboard.isRunning()).toBe(false);
    });

    it('triggers tool selection callbacks for keys 1-4', () => {
      const toolSpy = vi.fn();
      keyboard.onToolSelect = toolSpy;

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1' }));
      expect(toolSpy).toHaveBeenCalledWith('watering_can');

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2', key: '2' }));
      expect(toolSpy).toHaveBeenCalledWith('watering_can');

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit3', key: '3' }));
      expect(toolSpy).toHaveBeenCalledWith('seed_bag');

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit4', key: '4' }));
      expect(toolSpy).toHaveBeenCalledWith('hand');
    });

    it('triggers seed cycle callbacks on Q and E', () => {
      const cycleSpy = vi.fn();
      keyboard.onCycleSeed = cycleSpy;

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', key: 'q' }));
      expect(cycleSpy).toHaveBeenCalledWith(-1);

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e' }));
      expect(cycleSpy).toHaveBeenCalledWith(1);
    });

    it('triggers interact callback on E and escape callback on Escape', () => {
      const interactSpy = vi.fn();
      const escapeSpy = vi.fn();
      keyboard.onInteract = interactSpy;
      keyboard.onEscape = escapeSpy;

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e' }));
      expect(interactSpy).toHaveBeenCalled();

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
      expect(escapeSpy).toHaveBeenCalled();
    });

    it('clears all active keys on window blur and visibilitychange', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', key: 'Shift' }));
      expect(keyboard.getVector()).toEqual({ x: 0, z: -1 });
      expect(keyboard.isRunning()).toBe(true);

      window.dispatchEvent(new Event('blur'));
      expect(keyboard.getVector()).toEqual({ x: 0, z: 0 });
      expect(keyboard.isRunning()).toBe(false);

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'a' }));
      expect(keyboard.getVector()).toEqual({ x: -1, z: 0 });

      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(keyboard.getVector()).toEqual({ x: 0, z: 0 });
    });
  });

  describe('5. TouchInput (Touch Camera Gestures)', () => {
    let touchInput: TouchInput;
    let targetEl: HTMLElement;

    beforeEach(() => {
      targetEl = document.createElement('div');
      document.body.appendChild(targetEl);
      touchInput = new TouchInput();
      touchInput.attach(targetEl);
    });

    afterEach(() => {
      touchInput.detach();
      targetEl.remove();
    });

    it('handles 1-finger drag for camera orbit', () => {
      const orbitSpy = vi.fn();
      touchInput.onOrbit = orbitSpy;

      targetEl.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
          pointerType: 'touch',
        })
      );
      targetEl.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerId: 1,
          clientX: 120,
          clientY: 110,
          pointerType: 'touch',
        })
      );

      expect(orbitSpy).toHaveBeenCalledWith(20, 10);

      targetEl.dispatchEvent(
        new PointerEvent('pointerup', {
          pointerId: 1,
          clientX: 120,
          clientY: 110,
          pointerType: 'touch',
        })
      );
      expect(touchInput.getActivePointerCount()).toBe(0);
    });

    it('handles 2-finger pinch for camera zoom', () => {
      const zoomSpy = vi.fn();
      touchInput.onZoom = zoomSpy;

      // Finger 1 down at (100, 100)
      targetEl.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
          pointerType: 'touch',
        })
      );
      // Finger 2 down at (200, 100) -> initial distance = 100
      targetEl.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 2,
          clientX: 200,
          clientY: 100,
          pointerType: 'touch',
        })
      );

      // Move finger 2 to (250, 100) -> new distance = 150 (pinching out / zoom in)
      targetEl.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerId: 2,
          clientX: 250,
          clientY: 100,
          pointerType: 'touch',
        })
      );

      expect(zoomSpy).toHaveBeenCalled();
      const [deltaDistance] = zoomSpy.mock.calls[0];
      expect(deltaDistance).toBeCloseTo(50, 1);
    });

    it('resets gestures on pointercancel or blur', () => {
      const orbitSpy = vi.fn();
      touchInput.onOrbit = orbitSpy;

      targetEl.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
          pointerType: 'touch',
        })
      );
      targetEl.dispatchEvent(
        new PointerEvent('pointercancel', {
          pointerId: 1,
          clientX: 105,
          clientY: 105,
          pointerType: 'touch',
        })
      );

      expect(touchInput.getActivePointerCount()).toBe(0);

      targetEl.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 2,
          clientX: 100,
          clientY: 100,
          pointerType: 'touch',
        })
      );
      window.dispatchEvent(new Event('blur'));
      expect(touchInput.getActivePointerCount()).toBe(0);
    });

    it('ignores pointers marked with ignorePointerId (e.g. active virtual joystick)', () => {
      const orbitSpy = vi.fn();
      touchInput.onOrbit = orbitSpy;

      // Pointer 1 is registered as the joystick pointer
      touchInput.ignorePointerId(1);

      // Joystick pointerdown on screen
      targetEl.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 1,
          clientX: 50,
          clientY: 50,
          pointerType: 'touch',
        })
      );
      // Joystick pointermove
      targetEl.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerId: 1,
          clientX: 70,
          clientY: 50,
          pointerType: 'touch',
        })
      );

      // Camera orbit should NOT be triggered by the joystick pointer
      expect(orbitSpy).not.toHaveBeenCalled();
      expect(touchInput.getActivePointerCount()).toBe(0);

      // Camera swipe pointer 2 touches and moves
      targetEl.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 2,
          clientX: 200,
          clientY: 200,
          pointerType: 'touch',
        })
      );
      targetEl.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerId: 2,
          clientX: 230,
          clientY: 210,
          pointerType: 'touch',
        })
      );

      // Camera orbit triggers with identical sensitivity (deltaX = 30, deltaY = 10)
      expect(orbitSpy).toHaveBeenCalledTimes(1);
      expect(orbitSpy).toHaveBeenCalledWith(30, 10);
      expect(touchInput.getActivePointerCount()).toBe(1);

      // Clean up pointer 2
      targetEl.dispatchEvent(
        new PointerEvent('pointerup', {
          pointerId: 2,
          clientX: 230,
          clientY: 210,
          pointerType: 'touch',
        })
      );
      expect(touchInput.getActivePointerCount()).toBe(0);
    });

    it('excludes elements matching virtual-joystick-base and virtual-joystick-knob', () => {
      const orbitSpy = vi.fn();
      touchInput.onOrbit = orbitSpy;

      const joystickBase = document.createElement('div');
      joystickBase.setAttribute('data-testid', 'virtual-joystick-base');
      targetEl.appendChild(joystickBase);

      const joystickKnob = document.createElement('div');
      joystickKnob.setAttribute('data-testid', 'virtual-joystick-knob');
      joystickBase.appendChild(joystickKnob);

      joystickKnob.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 10,
          clientX: 80,
          clientY: 80,
          pointerType: 'touch',
          bubbles: true,
        })
      );

      expect(touchInput.getActivePointerCount()).toBe(0);
      expect(orbitSpy).not.toHaveBeenCalled();

      joystickBase.remove();
    });
  });

  describe('6. InputManager Coordination & Run Duration', () => {
    let inputManager: InputManager;

    beforeEach(() => {
      inputManager = new InputManager();
      inputManager.attach(window);
    });

    afterEach(() => {
      inputManager.detach();
    });

    it('returns zero movement and idle state when no input is active', () => {
      const state = inputManager.getMovementState();
      expect(state.moveVector).toEqual({ x: 0, z: 0 });
      expect(state.magnitude).toBe(0);
      expect(state.isRunning).toBe(false);
    });

    it('walks when joystick magnitude is below 0.88 even after 350ms', () => {
      inputManager.setJoystickInput(0.5, 0); // remapped mag ~ 0.43
      inputManager.update(100);
      vi.advanceTimersByTime(400);
      inputManager.update(400);

      const state = inputManager.getMovementState();
      expect(state.isRunning).toBe(false);
      expect(state.magnitude).toBeGreaterThan(0);
      expect(state.magnitude).toBeLessThan(0.88);
    });

    it('walks when joystick magnitude >= 0.88 for less than 350ms', () => {
      inputManager.setJoystickInput(0.95, 0); // raw mag 0.95 >= 0.88
      inputManager.update(100);
      vi.advanceTimersByTime(200);
      inputManager.update(200);

      const state = inputManager.getMovementState();
      expect(state.isRunning).toBe(false);
    });

    it('transitions to run when joystick magnitude >= 0.88 for >= 350ms', () => {
      inputManager.setJoystickInput(0.95, 0);
      inputManager.update(0);

      vi.advanceTimersByTime(JOYSTICK_RUN_TIME_MS);
      inputManager.update(JOYSTICK_RUN_TIME_MS);

      const state = inputManager.getMovementState();
      expect(state.isRunning).toBe(true);
    });

    it('resets run timer if joystick drops below 0.88 before 350ms', () => {
      inputManager.setJoystickInput(0.95, 0);
      inputManager.update(0);

      vi.advanceTimersByTime(200);
      inputManager.update(200);

      // Magnitude drops to 0.5
      inputManager.setJoystickInput(0.5, 0);
      inputManager.update(50);

      // Back to 0.95
      inputManager.setJoystickInput(0.95, 0);
      inputManager.update(50);

      vi.advanceTimersByTime(200);
      inputManager.update(200);

      // Total time is 450ms, but sustained >= 0.88 is only 200ms
      const state = inputManager.getMovementState();
      expect(state.isRunning).toBe(false);
    });

    it('runs immediately when keyboard Shift is pressed during movement', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', key: 'Shift' }));
      inputManager.update(16);

      const state = inputManager.getMovementState();
      expect(state.isRunning).toBe(true);
    });

    it('translates combined vector relative to current camera yaw', () => {
      // Keyboard forward (W) -> (0, -1) in screen space
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }));
      inputManager.setCameraYaw((CAMERA_DEFAULT_YAW_DEG * Math.PI) / 180);
      inputManager.update(16);

      const state = inputManager.getMovementState();
      expect(state.moveVector.x).toBeCloseTo(-Math.SQRT1_2, 4);
      expect(state.moveVector.z).toBeCloseTo(-Math.SQRT1_2, 4);
      expect(state.magnitude).toBeCloseTo(1.0, 4);
    });

    it('suppresses movement and running when a modal is open', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', key: 'Shift' }));
      inputManager.setJoystickInput(1.0, 0);
      inputManager.update(16);

      expect(inputManager.getMovementState().magnitude).toBeGreaterThan(0);

      // Open shop modal
      useUiStore.getState().openModal('shop');
      inputManager.update(16);

      const suppressedState = inputManager.getMovementState();
      expect(suppressedState.moveVector).toEqual({ x: 0, z: 0 });
      expect(suppressedState.magnitude).toBe(0);
      expect(suppressedState.isRunning).toBe(false);

      // Close modal
      useUiStore.getState().closeModal();
      inputManager.update(16);
      expect(inputManager.getMovementState().magnitude).toBeGreaterThan(0);
    });

    it('suppresses gameplay keys while modal is open', () => {
      const toolSpy = vi.fn();
      inputManager.onToolSelect = toolSpy;

      useUiStore.getState().openModal('settings');

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1' }));
      expect(toolSpy).not.toHaveBeenCalled();

      useUiStore.getState().closeModal();
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1' }));
      expect(toolSpy).toHaveBeenCalledWith('watering_can');
    });

    it('clears all input on window blur', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 'd' }));
      inputManager.setJoystickInput(1.0, 0);
      inputManager.update(16);
      expect(inputManager.getMovementState().magnitude).toBeGreaterThan(0);

      window.dispatchEvent(new Event('blur'));
      inputManager.update(16);

      const state = inputManager.getMovementState();
      expect(state.moveVector).toEqual({ x: 0, z: 0 });
      expect(state.magnitude).toBe(0);
      expect(state.isRunning).toBe(false);
    });
  });
});
