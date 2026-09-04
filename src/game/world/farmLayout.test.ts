import { describe, it, expect } from 'vitest';
import {
  FARM_BOUNDS,
  MIN_CROP_SPACING,
  GOLDEN_WATERING_CAN_RADIUS_WORLD,
  roundCoord,
  createPlotId,
  isInsidePlantingArea,
  findSpacingViolation,
  findPlotsInRadius,
} from './farmLayout';
import type { PlotData, PlotId } from '../../state/storeTypes';

function makePlot(id: string, x: number, z: number): PlotData {
  return {
    id,
    x,
    z,
    crop: {
      cropId: 'carrot',
      plantedAtUtcMs: 0,
      growthProgressSec: 0,
      mutation: 'none',
    },
    hydratedUntilUtcMs: 0,
  };
}

describe('farmLayout - Free-Placement Farm Geometry', () => {
  it('defines farm bounds covering both soil beds', () => {
    expect(FARM_BOUNDS.minX).toBeLessThan(FARM_BOUNDS.maxX);
    expect(FARM_BOUNDS.minZ).toBeLessThan(FARM_BOUNDS.maxZ);
    expect(MIN_CROP_SPACING).toBe(1.1);
    expect(GOLDEN_WATERING_CAN_RADIUS_WORLD).toBeGreaterThan(MIN_CROP_SPACING);
  });

  it('roundCoords quantizes to 3 decimals and creates deterministic ids', () => {
    expect(roundCoord(1.23456)).toBe(1.235);
    expect(roundCoord(-2.55555)).toBe(-2.556);
    expect(createPlotId(1)).toBe('crop-1');
    expect(createPlotId(42)).toBe('crop-42');
  });

  it('accepts points inside the farm land and rejects outside points', () => {
    expect(isInsidePlantingArea(0, 0)).toBe(true);
    expect(isInsidePlantingArea(FARM_BOUNDS.minX, FARM_BOUNDS.minZ)).toBe(true);
    expect(isInsidePlantingArea(FARM_BOUNDS.maxX, FARM_BOUNDS.maxZ)).toBe(true);
    expect(isInsidePlantingArea(50, 50)).toBe(false);
    expect(isInsidePlantingArea(FARM_BOUNDS.minX - 0.1, 0)).toBe(false);
    expect(isInsidePlantingArea(NaN, 0)).toBe(false);
    expect(isInsidePlantingArea(0, Infinity)).toBe(false);
  });

  it('detects spacing violations closer than MIN_CROP_SPACING', () => {
    const plots: Record<PlotId, PlotData> = {
      'crop-1': makePlot('crop-1', 0, 0),
    };
    expect(findSpacingViolation(0.5, 0, plots)).toBe('crop-1');
    expect(findSpacingViolation(1.1, 0, plots)).toBeNull();
    expect(findSpacingViolation(5, 5, plots)).toBeNull();
    expect(findSpacingViolation(0, 0, {})).toBeNull();
  });

  it('finds plots within a radius for area watering', () => {
    const plots: Record<PlotId, PlotData> = {
      'crop-1': makePlot('crop-1', 0, 0),
      'crop-2': makePlot('crop-2', 2.0, 0),
      'crop-3': makePlot('crop-3', 6.0, 0),
    };
    const near = findPlotsInRadius(0, 0, plots, GOLDEN_WATERING_CAN_RADIUS_WORLD);
    expect(near.map((p) => p.id).sort()).toEqual(['crop-1', 'crop-2']);
  });
});
