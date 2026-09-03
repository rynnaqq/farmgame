import { describe, expect, it } from 'vitest';
import {
  FARM_BED_IDS,
  FARM_BEDS,
  FARM_FENCE,
  legacyGridToPlacement,
  placementToWorldPoint,
  worldPointToPlacement,
} from './farmLayout';

describe('farmLayout', () => {
  it('defines four separated 6.0 x 5.4 beds', () => {
    expect(FARM_BED_IDS).toEqual([
      'north-west',
      'north-east',
      'south-west',
      'south-east',
    ]);
    expect(FARM_BEDS['north-west']).toMatchObject({
      centerX: -3.8,
      centerZ: -3.5,
      width: 6,
      depth: 5.4,
    });
    expect(FARM_BEDS['south-east']).toMatchObject({ centerX: 3.8, centerZ: 3.5 });
    expect(FARM_BEDS['north-east'].centerX - 3 - (FARM_BEDS['north-west'].centerX + 3))
      .toBeCloseTo(1.6, 6);
    expect(FARM_BEDS['south-west'].centerZ - 2.7 - (FARM_BEDS['north-west'].centerZ + 2.7))
      .toBeCloseTo(1.6, 6);
  });

  it('keeps every fence collider at least 0.9 from bed frames', () => {
    const eastFrame = FARM_BEDS['north-east'].centerX + 3;
    const eastFenceInner = FARM_FENCE.eastX - FARM_FENCE.thickness / 2;
    const southFrame = FARM_BEDS['south-east'].centerZ + 2.7;
    const southFenceInner = FARM_FENCE.frontZ - FARM_FENCE.thickness / 2;
    expect(eastFenceInner - eastFrame).toBeCloseTo(1.03, 6);
    expect(southFenceInner - southFrame).toBeCloseTo(1.03, 6);
  });

  it('round-trips an exact click and rejects frame/corridor points', () => {
    const placement = worldPointToPlacement({ x: -4.1374, z: -3.0126 });
    expect(placement).toEqual({ bedId: 'north-west', localX: -0.337, localZ: 0.487 });
    expect(placementToWorldPoint(placement!, 0.2)).toEqual({
      x: -4.137,
      y: 0.2,
      z: -3.013,
    });
    expect(worldPointToPlacement({ x: 0, z: 0 })).toBeNull();
    expect(worldPointToPlacement({ x: -6.75, z: -3.5 })).toBeNull();
  });

  it('maps all 64 legacy slots to unique safe placements', () => {
    const points = Array.from({ length: 64 }, (_, index) => {
      const placement = legacyGridToPlacement(Math.floor(index / 8), index % 8);
      return placementToWorldPoint(placement);
    });
    expect(new Set(points.map((p) => p.x + ':' + p.z)).size).toBe(64);
    for (let a = 0; a < points.length; a += 1) {
      for (let b = a + 1; b < points.length; b += 1) {
        expect(Math.hypot(points[a].x - points[b].x, points[a].z - points[b].z))
          .toBeGreaterThanOrEqual(1.1);
      }
    }
  });
});
