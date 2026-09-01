/**
 * Expansion Animation Pure Helper Functions & Math
 * Defined in accordance with game design specifications (farm.md 6.2, 10.5).
 */

export const EXPANSION_WAVE_RING_DELAY_MS = 60;
export const EXPANSION_WAVE_PLOT_DURATION_MS = 380;
export const EXPANSION_WAVE_TOTAL_MAX_DURATION_MS = 600;

export interface RingTiming {
  ringIndex: number;
  delayMs: number;
  startTimeMs: number;
  endTimeMs: number;
}

export interface WaveTimings {
  startTimeMs: number;
  totalDurationMs: number;
  endTimeMs: number;
  maxRing: number;
  ringTimings: Map<number, RingTiming>;
}

/**
 * Calculates Chebyshev distance: max(|row - centerRow|, |col - centerCol|).
 */
export function calculateRingDistance(
  row: number,
  col: number,
  center: number | { row: number; col: number } = 0
): number {
  const centerRow = typeof center === 'number' ? center : center.row;
  const centerCol = typeof center === 'number' ? center : center.col;
  return Math.max(Math.abs(row - centerRow), Math.abs(col - centerCol));
}

/**
 * Calculates ring index relative to expansion base grid size.
 * For example in 4 -> 6 expansion:
 * row=4 or col=4 -> ring 0
 * row=5 or col=5 -> ring 1
 */
export function calculateExpansionRing(
  row: number,
  col: number,
  previousGridSize: number = 4
): number {
  const maxCoord = Math.max(row, col);
  return Math.max(0, maxCoord - previousGridSize);
}

/**
 * Calculates start delay in ms for a given distance ring.
 */
export function calculateWaveDelay(
  ring: number,
  ringDelayMs: number = EXPANSION_WAVE_RING_DELAY_MS
): number {
  return Math.max(0, ring) * ringDelayMs;
}

/**
 * Determines if a plot coordinate was newly unlocked in the transition from previousGridSize to newGridSize.
 */
export function isPlotInExpansionWave(
  row: number,
  col: number,
  previousGridSize: number,
  newGridSize: number
): boolean {
  const inNewGrid = row >= 0 && row < newGridSize && col >= 0 && col < newGridSize;
  const wasInPrevGrid = row >= 0 && row < previousGridSize && col >= 0 && col < previousGridSize;
  return inNewGrid && !wasInPrevGrid;
}

/**
 * Calculates the total duration of the expansion wave in milliseconds.
 * Always constrained to <= EXPANSION_WAVE_TOTAL_MAX_DURATION_MS (600ms).
 */
export function getExpansionWaveDuration(
  previousGridSize: number,
  newGridSize: number,
  ringDelayMs: number = EXPANSION_WAVE_RING_DELAY_MS,
  plotDurationMs: number = EXPANSION_WAVE_PLOT_DURATION_MS
): number {
  const ringsCount = Math.max(1, newGridSize - previousGridSize);
  const maxRingIndex = ringsCount - 1;
  const calculated = maxRingIndex * ringDelayMs + plotDurationMs;
  return Math.min(EXPANSION_WAVE_TOTAL_MAX_DURATION_MS, calculated);
}

/**
 * Calculates wave start, end, and per-ring timings for an expansion event.
 */
export function calculateWaveTimings(
  previousGridSize: number,
  newGridSize: number,
  startTimeMs: number,
  ringDelayMs: number = EXPANSION_WAVE_RING_DELAY_MS,
  plotDurationMs: number = EXPANSION_WAVE_PLOT_DURATION_MS
): WaveTimings {
  const ringsCount = Math.max(1, newGridSize - previousGridSize);
  const maxRing = ringsCount - 1;
  const totalDurationMs = getExpansionWaveDuration(
    previousGridSize,
    newGridSize,
    ringDelayMs,
    plotDurationMs
  );
  const endTimeMs = startTimeMs + totalDurationMs;

  const ringTimings = new Map<number, RingTiming>();
  for (let ring = 0; ring <= maxRing; ring++) {
    const delay = calculateWaveDelay(ring, ringDelayMs);
    const ringStart = startTimeMs + delay;
    const ringEnd = Math.min(endTimeMs, ringStart + plotDurationMs);
    ringTimings.set(ring, {
      ringIndex: ring,
      delayMs: delay,
      startTimeMs: ringStart,
      endTimeMs: ringEnd,
    });
  }

  return {
    startTimeMs,
    totalDurationMs,
    endTimeMs,
    maxRing,
    ringTimings,
  };
}

/**
 * Ease-out bounce function.
 * Produces smooth bouncing settling at 1.0.
 */
export function easeOutBounce(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  const n1 = 7.5625;
  const d1 = 2.75;

  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    const t2 = t - 1.5 / d1;
    return n1 * t2 * t2 + 0.75;
  } else if (t < 2.5 / d1) {
    const t2 = t - 2.25 / d1;
    return n1 * t2 * t2 + 0.9375;
  } else {
    const t2 = t - 2.625 / d1;
    return n1 * t2 * t2 + 0.984375;
  }
}

/**
 * Ease-out back function (overshoot spring).
 * Overshoots slightly past 1.0 around t=0.7 and settles back to 1.0 at t=1.0.
 */
export function easeOutBack(t: number, overshoot: number = 1.70158): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  const c1 = overshoot;
  const c3 = c1 + 1;
  const tMinus1 = t - 1;
  return 1 + c3 * Math.pow(tMinus1, 3) + c1 * Math.pow(tMinus1, 2);
}

/**
 * Calculates current scale factor (0.0 to ~1.1 to 1.0) for a plot in an active expansion wave.
 */
export function calculatePlotExpansionScale(
  nowMs: number,
  waveStartMs: number,
  ringIndex: number,
  ringDelayMs: number = EXPANSION_WAVE_RING_DELAY_MS,
  plotDurationMs: number = EXPANSION_WAVE_PLOT_DURATION_MS,
  overshoot: number = 1.70158
): number {
  const delay = calculateWaveDelay(ringIndex, ringDelayMs);
  const plotStart = waveStartMs + delay;
  const plotEnd = plotStart + plotDurationMs;

  if (nowMs <= plotStart) {
    return 0;
  }
  if (nowMs >= plotEnd) {
    return 1.0;
  }

  const t = (nowMs - plotStart) / plotDurationMs;
  return easeOutBack(t, overshoot);
}
