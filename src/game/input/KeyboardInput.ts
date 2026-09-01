import type {
  Vector3DXZ,
  ToolSelectCallback,
  CycleSeedCallback,
  InteractCallback,
  EscapeCallback,
} from './inputTypes';

export class KeyboardInput {
  private pressedKeys = new Set<string>();
  private target: (Window & typeof globalThis) | HTMLElement | null = null;
  private attached = false;

  // Callbacks
  public onToolSelect?: ToolSelectCallback;
  public onCycleSeed?: CycleSeedCallback;
  public onInteract?: InteractCallback;
  public onEscape?: EscapeCallback;

  // Keybindings mapping
  private boundKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e);
  private boundKeyUp = (e: KeyboardEvent) => this.handleKeyUp(e);
  private boundBlur = () => this.reset();
  private boundVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      this.reset();
    }
  };

  public attach(target: (Window & typeof globalThis) | HTMLElement = window): void {
    if (this.attached) {
      this.detach();
    }

    this.target = target;
    this.target.addEventListener('keydown', this.boundKeyDown as EventListener);
    this.target.addEventListener('keyup', this.boundKeyUp as EventListener);
    this.target.addEventListener('blur', this.boundBlur as EventListener);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.boundVisibilityChange);
    }

    this.attached = true;
  }

  public detach(): void {
    if (!this.attached || !this.target) return;

    this.target.removeEventListener('keydown', this.boundKeyDown as EventListener);
    this.target.removeEventListener('keyup', this.boundKeyUp as EventListener);
    this.target.removeEventListener('blur', this.boundBlur as EventListener);

    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.boundVisibilityChange);
    }

    this.reset();
    this.target = null;
    this.attached = false;
  }

  public reset(): void {
    this.pressedKeys.clear();
  }

  public isKeyDown(codeOrKey: string): boolean {
    return this.pressedKeys.has(codeOrKey);
  }

  public isRunning(): boolean {
    return (
      this.pressedKeys.has('ShiftLeft') ||
      this.pressedKeys.has('ShiftRight') ||
      this.pressedKeys.has('Shift')
    );
  }

  public getVector(): Vector3DXZ {
    const forward =
      this.pressedKeys.has('KeyW') ||
      this.pressedKeys.has('ArrowUp') ||
      this.pressedKeys.has('w') ||
      this.pressedKeys.has('W');

    const backward =
      this.pressedKeys.has('KeyS') ||
      this.pressedKeys.has('ArrowDown') ||
      this.pressedKeys.has('s') ||
      this.pressedKeys.has('S');

    const left =
      this.pressedKeys.has('KeyA') ||
      this.pressedKeys.has('ArrowLeft') ||
      this.pressedKeys.has('a') ||
      this.pressedKeys.has('A');

    const right =
      this.pressedKeys.has('KeyD') ||
      this.pressedKeys.has('ArrowRight') ||
      this.pressedKeys.has('d') ||
      this.pressedKeys.has('D');

    let dx = (right ? 1 : 0) - (left ? 1 : 0);
    let dz = (backward ? 1 : 0) - (forward ? 1 : 0);

    if (dx !== 0 && dz !== 0) {
      dx *= Math.SQRT1_2;
      dz *= Math.SQRT1_2;
    }

    return { x: dx, z: dz };
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const code = e.code || e.key;
    const key = e.key;

    // Record code and key
    this.pressedKeys.add(code);
    if (key) {
      this.pressedKeys.add(key);
    }

    // Ignore tool / gameplay keys when typing in input/textarea/select
    const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') {
      return;
    }

    // Tools 1-4
    if (code === 'Digit1' || key === '1') {
      this.onToolSelect?.('trowel');
    } else if (code === 'Digit2' || key === '2') {
      this.onToolSelect?.('watering_can');
    } else if (code === 'Digit3' || key === '3') {
      this.onToolSelect?.('seed_bag');
    } else if (code === 'Digit4' || key === '4') {
      this.onToolSelect?.('hand');
    }

    // Q: previous seed
    if (code === 'KeyQ' || key === 'q' || key === 'Q') {
      this.onCycleSeed?.(-1);
    }

    // E: next seed & interact
    if (code === 'KeyE' || key === 'e' || key === 'E') {
      this.onCycleSeed?.(1);
      this.onInteract?.();
    }

    // Escape
    if (code === 'Escape' || key === 'Escape') {
      this.onEscape?.();
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    const code = e.code || e.key;
    const key = e.key;

    this.pressedKeys.delete(code);
    if (key) {
      this.pressedKeys.delete(key);
    }
  }
}
