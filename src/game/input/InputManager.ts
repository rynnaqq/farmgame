import {
  JOYSTICK_RUN_THRESHOLD,
  JOYSTICK_RUN_TIME_MS,
  CAMERA_DEFAULT_YAW_DEG,
} from '../core/constants';
import { useUiStore } from '../../state/uiStore';
import {
  processJoystickDeadzone,
  mergeInputVectors,
  transformCameraRelative,
  type ProcessedMovementState,
  type ToolSelectCallback,
  type CycleSeedCallback,
  type InteractCallback,
  type EscapeCallback,
  type CameraOrbitCallback,
  type CameraZoomCallback,
} from './inputTypes';
import { KeyboardInput } from './KeyboardInput';
import { TouchInput } from './TouchInput';

export class InputManager {
  public readonly keyboard: KeyboardInput;
  public readonly touch: TouchInput;

  private rawJoystickX = 0;
  private rawJoystickY = 0;
  private isJoystickActive = false;
  private joystickRunHoldMs = 0;
  private isJoystickRunning = false;

  private cameraYawRad: number = (CAMERA_DEFAULT_YAW_DEG * Math.PI) / 180;
  private movementState: ProcessedMovementState = {
    moveVector: { x: 0, z: 0 },
    rawVector: { x: 0, z: 0 },
    magnitude: 0,
    isRunning: false,
  };

  private attached = false;

  // External Callbacks
  public onToolSelect?: ToolSelectCallback;
  public onCycleSeed?: CycleSeedCallback;
  public onInteract?: InteractCallback;
  public onEscape?: EscapeCallback;
  public onCameraOrbit?: CameraOrbitCallback;
  public onCameraZoom?: CameraZoomCallback;

  private boundBlur = () => this.reset();

  constructor() {
    this.keyboard = new KeyboardInput();
    this.touch = new TouchInput();
    this.setupInternalCallbacks();
  }

  private setupInternalCallbacks(): void {
    this.keyboard.onToolSelect = (tool) => {
      if (this.isModalOpen()) return;
      this.onToolSelect?.(tool);
      useUiStore.getState().setSelectedTool(tool);
    };

    this.keyboard.onCycleSeed = (direction) => {
      if (this.isModalOpen()) return;
      this.onCycleSeed?.(direction);
      const crops = ['carrot', 'tomato', 'pumpkin', 'golden_berry', 'starfruit'] as const;
      const current = useUiStore.getState().selectedSeed;
      const idx = crops.indexOf(current);
      const nextIdx = (idx + direction + crops.length) % crops.length;
      useUiStore.getState().setSelectedSeed(crops[nextIdx]);
    };

    this.keyboard.onInteract = () => {
      if (this.isModalOpen()) return;
      this.onInteract?.();
    };

    this.keyboard.onEscape = () => {
      // Escape should still fire when modal is open to close it
      this.onEscape?.();
      const activeModal = useUiStore.getState().activeModal;
      if (activeModal !== null) {
        useUiStore.getState().closeModal();
      }
    };

    this.touch.onOrbit = (deltaX, deltaY) => {
      if (this.isModalOpen()) return;
      this.onCameraOrbit?.(deltaX, deltaY);
    };

    this.touch.onZoom = (deltaDistance) => {
      if (this.isModalOpen()) return;
      this.onCameraZoom?.(deltaDistance);
    };
  }

  public attach(target: (Window & typeof globalThis) | HTMLElement = window): void {
    if (this.attached) {
      this.detach();
    }

    this.keyboard.attach(target);
    this.touch.attach(target);

    if (typeof window !== 'undefined') {
      window.addEventListener('blur', this.boundBlur);
    }

    this.attached = true;
  }

  public detach(): void {
    if (!this.attached) return;

    this.keyboard.detach();
    this.touch.detach();

    if (typeof window !== 'undefined') {
      window.removeEventListener('blur', this.boundBlur);
    }

    this.reset();
    this.attached = false;
  }

  public reset(): void {
    this.keyboard.reset();
    this.touch.reset();
    this.rawJoystickX = 0;
    this.rawJoystickY = 0;
    this.isJoystickActive = false;
    this.joystickRunHoldMs = 0;
    this.isJoystickRunning = false;
    this.movementState = {
      moveVector: { x: 0, z: 0 },
      rawVector: { x: 0, z: 0 },
      magnitude: 0,
      isRunning: false,
    };
  }

  public setCameraYaw(yawRad: number): void {
    this.cameraYawRad = yawRad;
  }

  public getCameraYaw(): number {
    return this.cameraYawRad;
  }

  public setJoystickInput(x: number, y: number, isActive?: boolean): void {
    this.rawJoystickX = x;
    this.rawJoystickY = y;
    this.isJoystickActive = isActive !== undefined ? isActive : Math.hypot(x, y) > 0;
  }

  public setJoystickVector(x: number, y: number, isActive?: boolean): void {
    this.setJoystickInput(x, y, isActive);
  }

  public isModalOpen(): boolean {
    return useUiStore.getState().activeModal !== null;
  }

  public update(deltaMs: number = 16): ProcessedMovementState {
    if (this.isModalOpen()) {
      this.joystickRunHoldMs = 0;
      this.isJoystickRunning = false;
      this.movementState = {
        moveVector: { x: 0, z: 0 },
        rawVector: { x: 0, z: 0 },
        magnitude: 0,
        isRunning: false,
      };
      return this.movementState;
    }

    // 1. Deadzone processing for virtual joystick
    const deadzone = processJoystickDeadzone(this.rawJoystickX, this.rawJoystickY);
    const jx = deadzone.x;
    const jz = deadzone.y;

    // 2. Run detection for joystick (sustained >= 0.88 for >= 350ms)
    if (this.isJoystickActive && deadzone.rawMagnitude >= JOYSTICK_RUN_THRESHOLD) {
      this.joystickRunHoldMs += deltaMs;
      if (this.joystickRunHoldMs >= JOYSTICK_RUN_TIME_MS) {
        this.isJoystickRunning = true;
      }
    } else {
      this.joystickRunHoldMs = 0;
      this.isJoystickRunning = false;
    }

    // 3. Keyboard input vector
    const kbVector = this.keyboard.getVector();
    const isKbRunning = this.keyboard.isRunning();

    // 4. Merge vectors
    const merged = mergeInputVectors(kbVector, { x: jx, z: jz });

    // 5. Overall run condition
    const isRunning = (isKbRunning || this.isJoystickRunning) && merged.magnitude > 0;

    // 6. Camera-relative translation
    const worldMoveVector = transformCameraRelative(merged.x, merged.z, this.cameraYawRad);

    this.movementState = {
      moveVector: worldMoveVector,
      rawVector: { x: merged.x, z: merged.z },
      magnitude: merged.magnitude,
      isRunning,
    };

    return this.movementState;
  }

  public getMovementState(): ProcessedMovementState {
    return this.movementState;
  }
}
