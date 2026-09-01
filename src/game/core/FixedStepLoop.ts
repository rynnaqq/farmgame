/**
 * FixedStepLoop provides fixed-timestep simulation updates with frame delta accumulation,
 * sub-step capping to prevent the spiral of death, and interpolation alpha computation for rendering.
 */
export class FixedStepLoop {
  readonly stepMs: number;
  readonly maxSubSteps: number;
  private updateFn: (dt: number) => void;
  private accumulator: number = 0;

  constructor(
    stepMs: number = 1000 / 60,
    maxSubSteps: number = 5,
    updateFn: (dt: number) => void = () => {}
  ) {
    this.stepMs = stepMs;
    this.maxSubSteps = maxSubSteps;
    this.updateFn = updateFn;
  }

  /**
   * Steps the simulation forward by accumulating real frame delta time (in ms).
   * Executes up to `maxSubSteps` fixed sub-steps.
   *
   * @param frameDeltaMs Real-time elapsed milliseconds since the last frame.
   * @returns Number of simulation sub-steps executed this frame.
   */
  step(frameDeltaMs: number): number {
    if (frameDeltaMs <= 0 || isNaN(frameDeltaMs)) {
      return 0;
    }

    this.accumulator += frameDeltaMs;
    let executedSteps = 0;
    const dt = this.stepMs / 1000;

    while (this.accumulator >= this.stepMs && executedSteps < this.maxSubSteps) {
      this.updateFn(dt);
      this.accumulator -= this.stepMs;
      executedSteps++;
    }

    // Spiral of death prevention: if frame delta was too large and exceeded maxSubSteps,
    // discard excess accumulator so we don't lag perpetually behind real-time.
    if (executedSteps >= this.maxSubSteps && this.accumulator > this.stepMs) {
      this.accumulator = this.accumulator % this.stepMs;
    }

    return executedSteps;
  }

  /**
   * Returns the interpolation alpha in range [0, 1) representing the remaining fraction
   * between the previous and next fixed physics/simulation steps.
   */
  getAlpha(): number {
    if (this.stepMs <= 0) return 0;
    return Math.max(0, Math.min(1, this.accumulator / this.stepMs));
  }

  /**
   * Resets the accumulated delta time to zero.
   */
  reset(): void {
    this.accumulator = 0;
  }
}
