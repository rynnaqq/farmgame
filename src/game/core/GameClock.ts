/**
 * GameClock manages simulated time in milliseconds.
 * Decouples game logic from system wall-clock time and allows deterministic fast-forwarding/advancing.
 */
export class GameClock {
  private timeUtcMs: number;

  constructor(initialTimeUtcMs: number = Date.now()) {
    this.timeUtcMs = initialTimeUtcMs;
  }

  /**
   * Returns current simulated UTC timestamp in milliseconds.
   */
  now(): number {
    return this.timeUtcMs;
  }

  /**
   * Advances the clock by a given duration in milliseconds.
   */
  advance(ms: number): void {
    if (ms > 0) {
      this.timeUtcMs += ms;
    }
  }

  /**
   * Explicitly sets the clock to a specific UTC timestamp in milliseconds.
   */
  setTime(utcMs: number): void {
    this.timeUtcMs = utcMs;
  }
}
