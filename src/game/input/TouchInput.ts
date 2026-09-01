import type { CameraOrbitCallback, CameraZoomCallback } from './inputTypes';

interface PointerPosition {
  clientX: number;
  clientY: number;
}

export class TouchInput {
  private activePointers = new Map<number, PointerPosition>();
  private target: (Window & typeof globalThis) | HTMLElement | null = null;
  private attached = false;
  private lastPinchDistance: number | null = null;

  // Callbacks
  public onOrbit?: CameraOrbitCallback;
  public onZoom?: CameraZoomCallback;

  // Optional predicate to ignore touches starting on UI / joystick elements
  public isElementExcluded?: (el: Element | null) => boolean;

  private boundPointerDown = (e: PointerEvent) => this.handlePointerDown(e);
  private boundPointerMove = (e: PointerEvent) => this.handlePointerMove(e);
  private boundPointerUp = (e: PointerEvent) => this.handlePointerUp(e);
  private boundPointerCancel = (e: PointerEvent) => this.handlePointerCancel(e);
  private boundBlur = () => this.reset();

  public attach(target: (Window & typeof globalThis) | HTMLElement): void {
    if (this.attached) {
      this.detach();
    }

    this.target = target;
    this.target.addEventListener('pointerdown', this.boundPointerDown as EventListener);
    this.target.addEventListener('pointermove', this.boundPointerMove as EventListener);
    this.target.addEventListener('pointerup', this.boundPointerUp as EventListener);
    this.target.addEventListener('pointercancel', this.boundPointerCancel as EventListener);

    if (typeof window !== 'undefined') {
      window.addEventListener('blur', this.boundBlur);
    }

    this.attached = true;
  }

  public detach(): void {
    if (!this.attached || !this.target) return;

    this.target.removeEventListener('pointerdown', this.boundPointerDown as EventListener);
    this.target.removeEventListener('pointermove', this.boundPointerMove as EventListener);
    this.target.removeEventListener('pointerup', this.boundPointerUp as EventListener);
    this.target.removeEventListener('pointercancel', this.boundPointerCancel as EventListener);

    if (typeof window !== 'undefined') {
      window.removeEventListener('blur', this.boundBlur);
    }

    this.reset();
    this.target = null;
    this.attached = false;
  }

  public reset(): void {
    this.activePointers.clear();
    this.lastPinchDistance = null;
  }

  public getActivePointerCount(): number {
    return this.activePointers.size;
  }

  private handlePointerDown(e: PointerEvent): void {
    if (this.isElementExcluded && this.isElementExcluded(e.target as Element)) {
      return;
    }

    // Try to acquire pointer capture if available on element
    if (e.target && 'setPointerCapture' in (e.target as HTMLElement)) {
      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // Ignore in test/headless environments
      }
    }

    this.activePointers.set(e.pointerId, {
      clientX: e.clientX,
      clientY: e.clientY,
    });

    if (this.activePointers.size === 2) {
      this.lastPinchDistance = this.getPointersDistance();
    } else {
      this.lastPinchDistance = null;
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.activePointers.has(e.pointerId)) return;

    const prevPos = this.activePointers.get(e.pointerId)!;
    const deltaX = e.clientX - prevPos.clientX;
    const deltaY = e.clientY - prevPos.clientY;

    this.activePointers.set(e.pointerId, {
      clientX: e.clientX,
      clientY: e.clientY,
    });

    if (this.activePointers.size === 1) {
      // 1-finger drag -> Orbit camera
      this.onOrbit?.(deltaX, deltaY);
    } else if (this.activePointers.size === 2) {
      // 2-finger pinch -> Zoom camera
      const currentDist = this.getPointersDistance();
      if (this.lastPinchDistance !== null && currentDist !== null) {
        const deltaDist = currentDist - this.lastPinchDistance;
        this.onZoom?.(deltaDist);
      }
      this.lastPinchDistance = currentDist;
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    this.activePointers.delete(e.pointerId);

    if (e.target && 'releasePointerCapture' in (e.target as HTMLElement)) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    }

    if (this.activePointers.size === 2) {
      this.lastPinchDistance = this.getPointersDistance();
    } else {
      this.lastPinchDistance = null;
    }
  }

  private handlePointerCancel(e: PointerEvent): void {
    this.handlePointerUp(e);
  }

  private getPointersDistance(): number | null {
    if (this.activePointers.size < 2) return null;

    const values = Array.from(this.activePointers.values());
    const p1 = values[0];
    const p2 = values[1];

    return Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
  }
}
