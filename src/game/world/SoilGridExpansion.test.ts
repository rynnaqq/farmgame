import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, resetGameStore, generateDefaultPlots } from '../../state/gameStore';
import { buyGridExpansion, buyUpgrade } from '../economy/economyCommands';
import { EXPANSION_1_COST, EXPANSION_2_COST, MAX_GRID_SIZE } from '../core/constants';
import { getPlotId, getPlotPosition, getGridBounds, getLockedPlotSlots } from './gridCoordinates';
import {
  EXPANSION_WAVE_RING_DELAY_MS,
  EXPANSION_WAVE_TOTAL_MAX_DURATION_MS,
  EXPANSION_WAVE_PLOT_DURATION_MS,
  calculateRingDistance,
  calculateExpansionRing,
  calculateWaveDelay,
  calculateWaveTimings,
  easeOutBounce,
  easeOutBack,
  calculatePlotExpansionScale,
  isPlotInExpansionWave,
  getExpansionWaveDuration,
} from './expansionAnimation';

describe('Task 17: Island Grid Expansion System', () => {
  beforeEach(() => {
    resetGameStore(42);
  });

  // =========================================================================
  // 1. Plot ID & State Preservation During Expansions
  // =========================================================================
  describe('1. Plot ID and State Preservation', () => {
    it('preserves all existing plot data and IDs when expanding from 4x4 to 6x6', () => {
      const store = useGameStore.getState();
      store.setGridSize(4);
      store.setCoins(1000);

      // Customize a few 4x4 plots
      store.setPlot({
        id: 'plot-0-0',
        row: 0,
        col: 0,
        tilled: true,
        crop: {
          cropId: 'carrot',
          growthProgressSec: 25,
          plantedAtUtcMs: 1000,
          mutation: 'gold',
        },
        hydratedUntilUtcMs: 50000,
      });

      store.setPlot({
        id: 'plot-1-2',
        row: 1,
        col: 2,
        tilled: true,
        crop: {
          cropId: 'tomato',
          growthProgressSec: 60,
          plantedAtUtcMs: 2000,
          mutation: 'cosmic',
        },
        hydratedUntilUtcMs: 80000,
      });

      store.setPlot({
        id: 'plot-3-3',
        row: 3,
        col: 3,
        tilled: true,
        crop: null,
        hydratedUntilUtcMs: 12000,
      });

      // Expand to 6x6
      const result = buyGridExpansion();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.newGridSize).toBe(6);
        expect(result.value.cost).toBe(EXPANSION_1_COST);
      }

      const updatedPlots = useGameStore.getState().farm.plots;
      expect(useGameStore.getState().farm.gridSize).toBe(6);
      expect(Object.keys(updatedPlots).length).toBe(36);

      // Verify customized 4x4 plots are completely unchanged
      const p00 = updatedPlots['plot-0-0'];
      expect(p00).toBeDefined();
      expect(p00.id).toBe('plot-0-0');
      expect(p00.row).toBe(0);
      expect(p00.col).toBe(0);
      expect(p00.tilled).toBe(true);
      expect(p00.crop?.cropId).toBe('carrot');
      expect(p00.crop?.growthProgressSec).toBe(25);
      expect(p00.crop?.mutation).toBe('gold');
      expect(p00.hydratedUntilUtcMs).toBe(50000);

      const p12 = updatedPlots['plot-1-2'];
      expect(p12).toBeDefined();
      expect(p12.id).toBe('plot-1-2');
      expect(p12.row).toBe(1);
      expect(p12.col).toBe(2);
      expect(p12.tilled).toBe(true);
      expect(p12.crop?.cropId).toBe('tomato');
      expect(p12.crop?.growthProgressSec).toBe(60);
      expect(p12.crop?.mutation).toBe('cosmic');
      expect(p12.hydratedUntilUtcMs).toBe(80000);

      const p33 = updatedPlots['plot-3-3'];
      expect(p33).toBeDefined();
      expect(p33.id).toBe('plot-3-3');
      expect(p33.tilled).toBe(true);
      expect(p33.crop).toBeNull();
      expect(p33.hydratedUntilUtcMs).toBe(12000);

      // Verify all 20 newly unlocked plots are initialized with correct default structure
      let newPlotCount = 0;
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
          const id = getPlotId(r, c);
          const plot = updatedPlots[id];
          expect(plot).toBeDefined();
          expect(plot.id).toBe(`plot-${r}-${c}`);
          expect(plot.row).toBe(r);
          expect(plot.col).toBe(c);

          if (r >= 4 || c >= 4) {
            newPlotCount++;
            expect(plot.tilled).toBe(false);
            expect(plot.crop).toBeNull();
            expect(plot.hydratedUntilUtcMs).toBe(0);
          }
        }
      }
      expect(newPlotCount).toBe(20);
    });

    it('preserves all 36 plot states when expanding from 6x6 to 8x8', () => {
      const store = useGameStore.getState();
      store.setGridSize(6);
      store.setCoins(5000);

      // Customize plot in the 6x6 expansion ring
      store.setPlot({
        id: 'plot-4-5',
        row: 4,
        col: 5,
        tilled: true,
        crop: {
          cropId: 'pumpkin',
          growthProgressSec: 150,
          plantedAtUtcMs: 3000,
          mutation: 'giant',
        },
        hydratedUntilUtcMs: 99000,
      });

      store.setPlot({
        id: 'plot-5-5',
        row: 5,
        col: 5,
        tilled: true,
        crop: {
          cropId: 'golden_berry',
          growthProgressSec: 280,
          plantedAtUtcMs: 4000,
          mutation: 'gold',
        },
        hydratedUntilUtcMs: 120000,
      });

      // Expand to 8x8
      const result = buyGridExpansion();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.newGridSize).toBe(8);
        expect(result.value.cost).toBe(EXPANSION_2_COST);
      }

      const updatedPlots = useGameStore.getState().farm.plots;
      expect(useGameStore.getState().farm.gridSize).toBe(8);
      expect(Object.keys(updatedPlots).length).toBe(64);

      // Verify custom plots in 6x6 area preserved
      const p45 = updatedPlots['plot-4-5'];
      expect(p45).toBeDefined();
      expect(p45.tilled).toBe(true);
      expect(p45.crop?.cropId).toBe('pumpkin');
      expect(p45.crop?.mutation).toBe('giant');

      const p55 = updatedPlots['plot-5-5'];
      expect(p55).toBeDefined();
      expect(p55.tilled).toBe(true);
      expect(p55.crop?.cropId).toBe('golden_berry');
      expect(p55.crop?.mutation).toBe('gold');

      // Verify all 28 new 8x8 plots exist with valid IDs
      let newPlotCount = 0;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const id = getPlotId(r, c);
          const plot = updatedPlots[id];
          expect(plot).toBeDefined();
          expect(plot.id).toBe(`plot-${r}-${c}`);
          if (r >= 6 || c >= 6) {
            newPlotCount++;
            expect(plot.tilled).toBe(false);
            expect(plot.crop).toBeNull();
            expect(plot.hydratedUntilUtcMs).toBe(0);
          }
        }
      }
      expect(newPlotCount).toBe(28);
    });

    it('generateDefaultPlots pure function preserves existing map', () => {
      const existing = {
        'plot-0-0': {
          id: 'plot-0-0' as const,
          row: 0,
          col: 0,
          tilled: true,
          crop: null,
          hydratedUntilUtcMs: 12345,
        },
      };

      const result = generateDefaultPlots(6, existing);
      expect(Object.keys(result).length).toBe(36);
      expect(result['plot-0-0'].tilled).toBe(true);
      expect(result['plot-0-0'].hydratedUntilUtcMs).toBe(12345);
      expect(result['plot-5-5'].tilled).toBe(false);
    });

    it('supports buyUpgrade expansion aliases and preserves plots', () => {
      useGameStore.getState().setCoins(5000);
      useGameStore.getState().setGridSize(4);

      const res6x6 = buyUpgrade('expansion_6x6');
      expect(res6x6.ok).toBe(true);
      expect(useGameStore.getState().farm.gridSize).toBe(6);
      expect(Object.keys(useGameStore.getState().farm.plots).length).toBe(36);

      const res8x8 = buyUpgrade('expansion_8x8');
      expect(res8x8.ok).toBe(true);
      expect(useGameStore.getState().farm.gridSize).toBe(8);
      expect(Object.keys(useGameStore.getState().farm.plots).length).toBe(64);
    });
  });

  // =========================================================================
  // 2. Ring Distance Calculations
  // =========================================================================
  describe('2. Ring Distance Calculations', () => {
    it('calculates ring distance from center using Chebyshev max metric', () => {
      // With center = 0
      expect(calculateRingDistance(0, 0, 0)).toBe(0);
      expect(calculateRingDistance(4, 2, 0)).toBe(4);
      expect(calculateRingDistance(2, 4, 0)).toBe(4);
      expect(calculateRingDistance(5, 5, 0)).toBe(5);
      expect(calculateRingDistance(7, 3, 0)).toBe(7);

      // With symmetric center = 3.5 (8x8 center)
      expect(calculateRingDistance(3, 3, 3.5)).toBeCloseTo(0.5, 5);
      expect(calculateRingDistance(4, 4, 3.5)).toBeCloseTo(0.5, 5);
      expect(calculateRingDistance(0, 0, 3.5)).toBeCloseTo(3.5, 5);
      expect(calculateRingDistance(7, 7, 3.5)).toBeCloseTo(3.5, 5);
      expect(calculateRingDistance(0, 7, 3.5)).toBeCloseTo(3.5, 5);
      expect(calculateRingDistance(7, 0, 3.5)).toBeCloseTo(3.5, 5);
    });

    it('supports 2D center coordinate object { row, col }', () => {
      const center = { row: 3.5, col: 3.5 };
      expect(calculateRingDistance(3, 3, center)).toBeCloseTo(0.5, 5);
      expect(calculateRingDistance(0, 3, center)).toBeCloseTo(3.5, 5);
      expect(calculateRingDistance(3, 7, center)).toBeCloseTo(3.5, 5);
    });

    it('calculates expansion ring index relative to base grid size', () => {
      // In 4x4 -> 6x6 expansion (base = 4):
      // Plots in ring 4 (row 4 or col 4) have ring index 0
      expect(calculateExpansionRing(4, 0, 4)).toBe(0);
      expect(calculateExpansionRing(0, 4, 4)).toBe(0);
      expect(calculateExpansionRing(4, 4, 4)).toBe(0);
      expect(calculateExpansionRing(4, 3, 4)).toBe(0);

      // Plots in ring 5 (row 5 or col 5) have ring index 1
      expect(calculateExpansionRing(5, 0, 4)).toBe(1);
      expect(calculateExpansionRing(0, 5, 4)).toBe(1);
      expect(calculateExpansionRing(5, 5, 4)).toBe(1);
      expect(calculateExpansionRing(5, 4, 4)).toBe(1);

      // In 6x6 -> 8x8 expansion (base = 6):
      // Plots in ring 6 have ring index 0
      expect(calculateExpansionRing(6, 0, 6)).toBe(0);
      expect(calculateExpansionRing(6, 6, 6)).toBe(0);
      // Plots in ring 7 have ring index 1
      expect(calculateExpansionRing(7, 2, 6)).toBe(1);
      expect(calculateExpansionRing(7, 7, 6)).toBe(1);
    });

    it('identifies whether a plot is in the newly unlocked expansion wave', () => {
      // Transition from 4 to 6
      expect(isPlotInExpansionWave(0, 0, 4, 6)).toBe(false);
      expect(isPlotInExpansionWave(3, 3, 4, 6)).toBe(false);
      expect(isPlotInExpansionWave(4, 0, 4, 6)).toBe(true);
      expect(isPlotInExpansionWave(0, 4, 4, 6)).toBe(true);
      expect(isPlotInExpansionWave(5, 5, 4, 6)).toBe(true);
      expect(isPlotInExpansionWave(6, 6, 4, 6)).toBe(false); // beyond 6x6

      // Transition from 6 to 8
      expect(isPlotInExpansionWave(4, 4, 6, 8)).toBe(false);
      expect(isPlotInExpansionWave(5, 5, 6, 8)).toBe(false);
      expect(isPlotInExpansionWave(6, 0, 6, 8)).toBe(true);
      expect(isPlotInExpansionWave(7, 7, 6, 8)).toBe(true);
      expect(isPlotInExpansionWave(8, 8, 6, 8)).toBe(false);
    });
  });

  // =========================================================================
  // 3. Delay Timing & Wave Duration Constraints (60ms/ring, <= 600ms total)
  // =========================================================================
  describe('3. Delay Timing & Wave Duration Constraints', () => {
    it('delays each distance ring by exactly 60ms', () => {
      expect(EXPANSION_WAVE_RING_DELAY_MS).toBe(60);
      expect(calculateWaveDelay(0)).toBe(0);
      expect(calculateWaveDelay(1)).toBe(60);
      expect(calculateWaveDelay(2)).toBe(120);
      expect(calculateWaveDelay(3)).toBe(180);
    });

    it('ensures total expansion wave duration completes in <= 600ms', () => {
      expect(EXPANSION_WAVE_TOTAL_MAX_DURATION_MS).toBe(600);

      // For 4x4 -> 6x6 (2 rings: 0 and 1)
      const duration4to6 = getExpansionWaveDuration(4, 6);
      expect(duration4to6).toBeLessThanOrEqual(600);
      expect(duration4to6).toBeGreaterThan(0);

      // For 6x6 -> 8x8 (2 rings: 0 and 1)
      const duration6to8 = getExpansionWaveDuration(6, 8);
      expect(duration6to8).toBeLessThanOrEqual(600);
      expect(duration6to8).toBeGreaterThan(0);

      // Full wave timing breakdown
      const timings = calculateWaveTimings(4, 6, 1000);
      expect(timings.startTimeMs).toBe(1000);
      expect(timings.totalDurationMs).toBeLessThanOrEqual(600);
      expect(timings.endTimeMs).toBe(1000 + timings.totalDurationMs);

      // Ring 0 starts at t = 1000
      const ring0 = timings.ringTimings.get(0);
      expect(ring0?.startTimeMs).toBe(1000);

      // Ring 1 starts at t = 1060
      const ring1 = timings.ringTimings.get(1);
      expect(ring1?.startTimeMs).toBe(1060);
    });

    it('calculates correct timings for 6x6 -> 8x8 transition', () => {
      const timings = calculateWaveTimings(6, 8, 5000);
      expect(timings.startTimeMs).toBe(5000);
      expect(timings.totalDurationMs).toBeLessThanOrEqual(600);
      expect(timings.ringTimings.get(0)?.startTimeMs).toBe(5000);
      expect(timings.ringTimings.get(1)?.startTimeMs).toBe(5060);
    });
  });

  // =========================================================================
  // 4. Scale Factor & Bounce Ease-Out Math
  // =========================================================================
  describe('4. Scale Factor & Easing Mathematics', () => {
    it('easeOutBounce produces valid range [0, 1.1] with f(0)=0 and f(1)=1', () => {
      expect(easeOutBounce(0)).toBe(0);
      expect(easeOutBounce(1)).toBeCloseTo(1, 4);

      // Intermediate values monotonically or bouncingly progress
      const mid = easeOutBounce(0.5);
      expect(mid).toBeGreaterThan(0);
      expect(mid).toBeLessThanOrEqual(1.1);

      // Sampling curve across 0..1
      for (let t = 0; t <= 1; t += 0.1) {
        const val = easeOutBounce(t);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1.1);
      }
    });

    it('easeOutBack produces overshoot bounce settling cleanly to 1.0', () => {
      expect(easeOutBack(0)).toBe(0);
      expect(easeOutBack(1)).toBe(1);

      // Overshoot check: near t=0.7, value exceeds 1.0 for bounce effect
      const peak = easeOutBack(0.7);
      expect(peak).toBeGreaterThan(1.0);

      // Clamped behavior for t < 0 and t > 1
      expect(easeOutBack(-0.5)).toBe(0);
      expect(easeOutBack(1.5)).toBe(1);
    });

    it('calculates plot expansion scale across wave timeline', () => {
      const waveStart = 1000;
      const ringIndex = 1; // 60ms delay
      const ringDelay = 60;
      const plotDuration = EXPANSION_WAVE_PLOT_DURATION_MS;

      // Before plot start time (< 1060ms): scale is 0
      expect(calculatePlotExpansionScale(900, waveStart, ringIndex, ringDelay, plotDuration)).toBe(
        0
      );
      expect(calculatePlotExpansionScale(1059, waveStart, ringIndex, ringDelay, plotDuration)).toBe(
        0
      );

      // At start (1060ms): scale is 0
      expect(calculatePlotExpansionScale(1060, waveStart, ringIndex, ringDelay, plotDuration)).toBe(
        0
      );

      // Midway (1060 + plotDuration/2): scale is progressing > 0.5
      const midScale = calculatePlotExpansionScale(
        1060 + plotDuration / 2,
        waveStart,
        ringIndex,
        ringDelay,
        plotDuration
      );
      expect(midScale).toBeGreaterThan(0.5);

      // Overshoot phase: scale can exceed 1.0 slightly (bounce)
      const overshootScale = calculatePlotExpansionScale(
        1060 + plotDuration * 0.75,
        waveStart,
        ringIndex,
        ringDelay,
        plotDuration
      );
      expect(overshootScale).toBeGreaterThan(0.9);

      // After completion (>= 1060 + plotDuration): scale is exactly 1.0
      expect(
        calculatePlotExpansionScale(
          1060 + plotDuration,
          waveStart,
          ringIndex,
          ringDelay,
          plotDuration
        )
      ).toBe(1.0);
      expect(calculatePlotExpansionScale(2000, waveStart, ringIndex, ringDelay, plotDuration)).toBe(
        1.0
      );
    });
  });

  // =========================================================================
  // 5. Boundary Layout Consistency
  // =========================================================================
  describe('5. Boundary Layout and Locked Plot Slots', () => {
    it('decreases locked slot count consistently across expansions', () => {
      const locked4 = getLockedPlotSlots(4, MAX_GRID_SIZE);
      expect(locked4.length).toBe(48);

      const locked6 = getLockedPlotSlots(6, MAX_GRID_SIZE);
      expect(locked6.length).toBe(28);

      const locked8 = getLockedPlotSlots(8, MAX_GRID_SIZE);
      expect(locked8.length).toBe(0);
    });

    it('positions locked plot slots exactly at designated grid positions', () => {
      const locked4 = getLockedPlotSlots(4, 8);
      for (const slot of locked4) {
        const expectedPos = getPlotPosition(slot.row, slot.col, 8);
        expect(slot.position[0]).toBeCloseTo(expectedPos[0], 5);
        expect(slot.position[1]).toBeCloseTo(expectedPos[1], 5);
        expect(slot.position[2]).toBeCloseTo(expectedPos[2], 5);
      }
    });

    it('active and locked slots partition the 8x8 grid with zero overlap or omission', () => {
      for (const currentSize of [4, 6, 8] as const) {
        const activeIds = new Set<string>();
        for (let r = 0; r < currentSize; r++) {
          for (let c = 0; c < currentSize; c++) {
            activeIds.add(getPlotId(r, c));
          }
        }

        const lockedSlots = getLockedPlotSlots(currentSize, 8);
        const lockedIds = new Set(lockedSlots.map((s) => s.id));

        // No overlap
        for (const id of activeIds) {
          expect(lockedIds.has(id)).toBe(false);
        }

        // Total covers entire 64 slots
        expect(activeIds.size + lockedIds.size).toBe(64);
      }
    });

    it('computes symmetric bounds centered on origin for all grid tiers', () => {
      for (const size of [4, 6, 8] as const) {
        const bounds = getGridBounds(size);
        expect(bounds.minX + bounds.maxX).toBeCloseTo(0, 5);
        expect(bounds.minZ + bounds.maxZ).toBeCloseTo(0, 5);
        expect(bounds.width).toBeCloseTo(bounds.depth, 5);
      }
    });
  });
});
