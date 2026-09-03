import { describe, it, expect } from 'vitest';
import {
  parseFarmPatch,
  parsePatchPlacement,
  type FarmPatchTile,
} from './farmPatchProtocol';

interface RawTile {
  i: number;
  state: number;
  crop: string | null;
  plantedAt: string | null;
  readyAt: string | null;
  mutation: number;
  bedId: number | null;
  positionX: number | null;
  positionZ: number | null;
}

function makeActivePatch(placement: Partial<RawTile>) {
  return {
    ownerId: 'user-1',
    plotVersion: 9,
    tiles: [
      {
        i: 7,
        state: 3,
        crop: 'carrot',
        plantedAt: '2026-09-03T00:00:00Z',
        readyAt: '2026-09-03T00:01:00Z',
        mutation: 0,
        bedId: null,
        positionX: null,
        positionZ: null,
        ...placement,
      } satisfies RawTile,
    ],
  };
}

function makeEmptyPatch() {
  return {
    ownerId: 'user-1',
    plotVersion: 9,
    tiles: [
      {
        i: 0,
        state: 0,
        crop: null,
        plantedAt: null,
        readyAt: null,
        mutation: 0,
        bedId: null,
        positionX: null,
        positionZ: null,
      } satisfies RawTile,
    ],
  };
}

describe('farmPatchProtocol', () => {
  it('parses placement fields from farm patches', () => {
    const patch = parseFarmPatch({
      ownerId: 'user-1',
      plotVersion: 9,
      tiles: [
        {
          i: 7,
          state: 3,
          crop: 'carrot',
          plantedAt: '2026-09-03T00:00:00Z',
          readyAt: '2026-09-03T00:01:00Z',
          mutation: 0,
          bedId: 2,
          positionX: 0.123,
          positionZ: -0.456,
        },
      ],
    });
    const tile = patch.tiles[0] as FarmPatchTile;
    expect(tile.placement).toEqual({
      bedId: 'south-west',
      localX: 0.123,
      localZ: -0.456,
    });
    expect(tile.bedId).toBe(2);
    expect(tile.positionX).toBe(0.123);
    expect(tile.positionZ).toBe(-0.456);
  });

  it.each([
    [{ bedId: 4, positionX: 0, positionZ: 0 }],
    [{ bedId: 0, positionX: Number.NaN, positionZ: 0 }],
    [{ bedId: 0, positionX: 2.551, positionZ: 0 }],
    [{ bedId: 0, positionX: 0, positionZ: 2.251 }],
    [{ bedId: null, positionX: 0, positionZ: 0 }],
    [{ bedId: 0, positionX: null, positionZ: 0 }],
  ])('rejects an invalid active placement %s', (placement) => {
    expect(() => parseFarmPatch(makeActivePatch(placement))).toThrow('INVALID_PLACEMENT_PATCH');
  });

  it('allows null placement only for empty tiles', () => {
    expect(parseFarmPatch(makeEmptyPatch()).tiles[0].placement).toBeNull();
  });

  it('rejects an empty tile that still carries placement fields', () => {
    const patch = makeEmptyPatch();
    (patch.tiles[0] as RawTile).bedId = 1;
    expect(() => parseFarmPatch(patch)).toThrow('INVALID_PLACEMENT_PATCH');
  });

  it('accepts placement exactly on the bed-local bounds', () => {
    const patch = parseFarmPatch(
      makeActivePatch({ bedId: 3, positionX: 2.55, positionZ: 2.25 })
    );
    const tile = patch.tiles[0] as FarmPatchTile;
    expect(tile.placement).toEqual({
      bedId: 'south-east',
      localX: 2.55,
      localZ: 2.25,
    });
  });

  it('maps bed indices 0-3 to their bed ids', () => {
    const expected = ['north-west', 'north-east', 'south-west', 'south-east'] as const;
    expected.forEach((bedId, index) => {
      const patch = parseFarmPatch(makeActivePatch({ bedId: index, positionX: 0, positionZ: 0 }));
      expect((patch.tiles[0] as FarmPatchTile).placement?.bedId).toBe(bedId);
    });
  });

  it('validates patch shape: ownerId string, plotVersion integer, unique indices 0-63', () => {
    expect(() => parseFarmPatch({ ownerId: 1, plotVersion: 1, tiles: [] })).toThrow();
    expect(() => parseFarmPatch({ ownerId: 'u', plotVersion: -1, tiles: [] })).toThrow();
    expect(() =>
      parseFarmPatch({
        ownerId: 'u',
        plotVersion: 1,
        tiles: [makeActivePatch({ i: 64 }).tiles[0]],
      })
    ).toThrow();
    const dup = makeActivePatch({ i: 7 });
    expect(() =>
      parseFarmPatch({
        ownerId: 'u',
        plotVersion: 1,
        tiles: [dup.tiles[0], dup.tiles[0]],
      })
    ).toThrow();
  });

  it('parsePatchPlacement is usable standalone', () => {
    const tile: Omit<FarmPatchTile, 'placement'> = {
      i: 1,
      state: 3,
      crop: 'tomato',
      plantedAt: null,
      readyAt: null,
      mutation: 0,
      bedId: 1,
      positionX: 1.5,
      positionZ: -2.2,
    };
    expect(parsePatchPlacement(tile)).toEqual({
      bedId: 'north-east',
      localX: 1.5,
      localZ: -2.2,
    });
  });
});
