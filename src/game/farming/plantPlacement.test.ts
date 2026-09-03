import { describe, expect, it } from 'vitest';
import {
  findFirstEmptySlot,
  findNearestPlacedSlots,
  validatePlantPlacement,
  type PlacementSlot,
} from './plantPlacement';

const occupied = (
  id: string,
  row: number,
  col: number,
  localX: number,
  localZ: number
): PlacementSlot => ({
  id,
  row,
  col,
  crop: { placement: { bedId: 'north-west', localX, localZ } },
});

describe('plantPlacement', () => {
  it('rejects less than 1.1 and accepts exactly 1.1', () => {
    const slots = [occupied('plot-0-0', 0, 0, 0, 0)];
    expect(validatePlantPlacement(
      { bedId: 'north-west', localX: 1.099, localZ: 0 },
      slots
    )).toEqual({ ok: false, reason: 'occupied_position' });
    expect(validatePlantPlacement(
      { bedId: 'north-west', localX: 1.1, localZ: 0 },
      slots
    )).toEqual({ ok: true });
  });

  it('chooses the first empty slot by row then col', () => {
    const slots: PlacementSlot[] = [
      occupied('plot-0-1', 0, 1, 0, 0),
      { id: 'plot-1-0', row: 1, col: 0, crop: null },
      { id: 'plot-0-0', row: 0, col: 0, crop: null },
    ];
    expect(findFirstEmptySlot(slots)?.id).toBe('plot-0-0');
  });

  it('rejects the sixty-fifth active crop', () => {
    const slots = Array.from({ length: 64 }, (_, index) =>
      occupied('plot-' + Math.floor(index / 8) + '-' + (index % 8), Math.floor(index / 8), index % 8, 0, 0)
    );
    expect(validatePlantPlacement(
      { bedId: 'south-east', localX: 2, localZ: 2 },
      slots
    )).toEqual({ ok: false, reason: 'farm_full' });
  });

  it('orders spatial targets by distance and then slot identity', () => {
    const slots = [
      occupied('plot-0-2', 0, 2, 2, 0),
      occupied('plot-0-1', 0, 1, 1, 0),
      occupied('plot-0-0', 0, 0, -1, 0),
    ];
    expect(findNearestPlacedSlots(
      { bedId: 'north-west', localX: 0, localZ: 0 },
      slots,
      2,
      2.4
    ).map((slot) => slot.id)).toEqual(['plot-0-0', 'plot-0-1']);
  });
});
