import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TouchInput } from './TouchInput';

/**
 * Feedback loop for: "swipe camera stuck while player is stationary".
 * These tests drive the real TouchInput -> onOrbit seam with the exact user
 * gesture pattern: stationary player, swipe on empty canvas area.
 */

describe('BUG: camera swipe stuck while stationary', () => {
  let touchInput: TouchInput;
  let targetEl: HTMLElement;
  let orbitSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    touchInput = new TouchInput();
    targetEl = document.createElement('div');
    document.body.appendChild(targetEl);
    orbitSpy = vi.fn();
    touchInput.onOrbit = orbitSpy;
    touchInput.attach(targetEl as unknown as HTMLElement);
  });

  afterEach(() => {
    touchInput.detach();
    targetEl.remove();
    vi.clearAllMocks();
  });

  /**
   * Pattern A: browser reports a large first move after pointerdown when the
   * finger lands near a screen edge or after a long-press. TouchInput stores
   * the landing position, but the FIRST pointermove can arrive with a huge
   * coordinate leap -> guard returns early WITHOUT updating the stored
   * position -> every subsequent move re-computes the SAME huge delta and is
   * rejected forever. Camera appears frozen ("stuck") while stationary.
   */
  it('Pattern A: recovers when the first move is a large leap (>150px) instead of rejecting all subsequent moves', () => {
    // Finger lands at (50, 50)
    targetEl.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 1,
        clientX: 50,
        clientY: 50,
        pointerType: 'touch',
      })
    );

    // First move reports a big leap (e.g. touch digitizer glitch / held finger drift)
    targetEl.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientX: 220,
        clientY: 50,
        pointerType: 'touch',
      })
    );
    // Guard rejects the leap, but MUST resync stored position so the next
    // small move works.
    // expect(orbitSpy).not.toHaveBeenCalled(); // the leap itself may be dropped

    // Subsequent SMALL moves must orbit the camera again (not stuck)
    targetEl.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientX: 230,
        clientY: 55,
        pointerType: 'touch',
      })
    );
    targetEl.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientX: 240,
        clientY: 60,
        pointerType: 'touch',
      })
    );

    expect(orbitSpy).toHaveBeenCalled();
  });

  /**
   * Pattern B: finger released outside the tracked element (or event target
   * removed) -> pointerup never fires on the listener target -> pointer stays
   * in activePointers forever -> next swipe is treated as a 2-pointer pinch
   * (zoom) instead of orbit. Camera "swipe" becomes permanently stuck as
   * pinch; user must refresh.
   */
  it('Pattern B: leaked first pointer (up event lost) does not turn a fresh swipe into a dead pinch', () => {
    // Stale pointer 1: down, but up event never reaches us (captured elsewhere)
    vi.useFakeTimers();
    targetEl.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        pointerType: 'touch',
      })
    );

    // User lifted that finger ~1s ago; its pointerup was lost. A real pinch
    // would place the second finger within the 400ms plausibility window, so
    // this delay marks pointer 1 as leaked.
    vi.advanceTimersByTime(600);

    // New swipe with pointer 2 (user lifted finger 1 off-listener, or OS
    // dropped the up event): should still orbit, not be swallowed by pinch.
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

    // If the stale pointer poisoned the gesture, this fails: no orbit call.
    expect(orbitSpy).toHaveBeenCalled();
    expect(touchInput.getActivePointerCount()).toBe(1);
    vi.useRealTimers();
  });

  /**
   * Pattern C: the pointerup/pointercancel of a previous swipe never reaches
   * us (canvas re-render, OS dropped the event). The leaked pointer must be
   * evicted as stale when a NEW pointer lands after a long idle, so the fresh
   * swipe still orbits instead of being swallowed as a dead 2-finger pinch.
   */
  it('Pattern C: evicts a leaked stale pointer so a fresh swipe still orbits', () => {
    targetEl.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        pointerType: 'touch',
      })
    );

    // Simulate the leaked pointer sitting idle past the stale threshold.
    vi.useFakeTimers();
    vi.advanceTimersByTime(3000);

    // Fresh swipe with a new pointer id
    targetEl.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 2,
        clientX: 300,
        clientY: 300,
        pointerType: 'touch',
      })
    );
    targetEl.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 2,
        clientX: 330,
        clientY: 305,
        pointerType: 'touch',
      })
    );

    expect(orbitSpy).toHaveBeenCalled();
    expect(touchInput.getActivePointerCount()).toBe(1);
    vi.useRealTimers();
  });
});
