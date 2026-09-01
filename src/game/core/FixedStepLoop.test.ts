import { describe, it, expect, vi } from 'vitest';
import { FixedStepLoop } from './FixedStepLoop';

describe('FixedStepLoop', () => {
  const STEP_MS = 1000 / 60; // 16.666... ms
  const DT_SEC = 1 / 60;

  it('should run updateFn once when frame delta equals stepMs', () => {
    const updateFn = vi.fn();
    const loop = new FixedStepLoop(STEP_MS, 5, updateFn);

    const steps = loop.step(STEP_MS);
    expect(steps).toBe(1);
    expect(updateFn).toHaveBeenCalledTimes(1);
    expect(updateFn).toHaveBeenCalledWith(expect.closeTo(DT_SEC, 5));
    expect(loop.getAlpha()).toBeCloseTo(0, 5);
  });

  it('should not run updateFn if frame delta is less than stepMs but accumulate time', () => {
    const updateFn = vi.fn();
    const loop = new FixedStepLoop(STEP_MS, 5, updateFn);

    const halfStep = STEP_MS / 2;
    const steps = loop.step(halfStep);
    expect(steps).toBe(0);
    expect(updateFn).toHaveBeenCalledTimes(0);
    expect(loop.getAlpha()).toBeCloseTo(0.5, 3);

    // Second half step should trigger update
    const steps2 = loop.step(halfStep);
    expect(steps2).toBe(1);
    expect(updateFn).toHaveBeenCalledTimes(1);
    expect(loop.getAlpha()).toBeCloseTo(0, 3);
  });

  it('should run multiple sub-steps for large frame delta', () => {
    const updateFn = vi.fn();
    const loop = new FixedStepLoop(STEP_MS, 5, updateFn);

    const steps = loop.step(STEP_MS * 3.4);
    expect(steps).toBe(3);
    expect(updateFn).toHaveBeenCalledTimes(3);
    expect(loop.getAlpha()).toBeCloseTo(0.4, 3);
  });

  it('should cap execution at maxSubSteps to prevent spiral of death and clamp excess accumulator', () => {
    const updateFn = vi.fn();
    const maxSubSteps = 5;
    const loop = new FixedStepLoop(STEP_MS, maxSubSteps, updateFn);

    // Provide huge delta (e.g. 500ms = 30 steps)
    const steps = loop.step(500);
    expect(steps).toBe(maxSubSteps);
    expect(updateFn).toHaveBeenCalledTimes(maxSubSteps);

    // Alpha should stay in [0, 1) and not accumulate 25 steps into the next frame
    expect(loop.getAlpha()).toBeGreaterThanOrEqual(0);
    expect(loop.getAlpha()).toBeLessThan(1);
  });

  it('should reset accumulator and alpha with reset()', () => {
    const updateFn = vi.fn();
    const loop = new FixedStepLoop(STEP_MS, 5, updateFn);

    loop.step(STEP_MS * 0.75);
    expect(loop.getAlpha()).toBeCloseTo(0.75, 3);

    loop.reset();
    expect(loop.getAlpha()).toBe(0);
  });

  it('should handle zero or negative frame delta without running updates', () => {
    const updateFn = vi.fn();
    const loop = new FixedStepLoop(STEP_MS, 5, updateFn);

    expect(loop.step(0)).toBe(0);
    expect(loop.step(-100)).toBe(0);
    expect(updateFn).not.toHaveBeenCalled();
    expect(loop.getAlpha()).toBe(0);
  });
});
