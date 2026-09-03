import type { CropPlacement, FarmBedId } from '../world/farmLayout';
import { isPlacementInsideBed } from '../world/farmLayout';

const BED_BY_INDEX: Record<number, FarmBedId> = {
  0: 'north-west',
  1: 'north-east',
  2: 'south-west',
  3: 'south-east',
};

export interface FarmPatchTile {
  i: number;
  state: number;
  crop: string | null;
  plantedAt: string | null;
  readyAt: string | null;
  mutation: number;
  bedId: number | null;
  positionX: number | null;
  positionZ: number | null;
  placement: CropPlacement | null;
}

export interface FarmPatch {
  ownerId: string;
  plotVersion: number;
  tiles: FarmPatchTile[];
}

/**
 * Converts the raw bed/placement columns of a patch tile into a validated
 * CropPlacement. Active tiles must carry a complete, in-bounds placement;
 * empty tiles must carry all three columns as null.
 */
export function parsePatchPlacement(tile: Omit<FarmPatchTile, 'placement'>): CropPlacement | null {
  if (tile.crop === null) {
    if (tile.bedId !== null || tile.positionX !== null || tile.positionZ !== null) {
      throw new Error('INVALID_PLACEMENT_PATCH');
    }
    return null;
  }
  const bedId = tile.bedId === null ? undefined : BED_BY_INDEX[tile.bedId];
  const placement = {
    bedId,
    localX: tile.positionX,
    localZ: tile.positionZ,
  };
  if (
    !bedId ||
    typeof placement.localX !== 'number' ||
    !Number.isFinite(placement.localX) ||
    typeof placement.localZ !== 'number' ||
    !Number.isFinite(placement.localZ) ||
    !isPlacementInsideBed(placement as CropPlacement)
  ) {
    throw new Error('INVALID_PLACEMENT_PATCH');
  }
  return placement as CropPlacement;
}

/**
 * Parses and validates a farm patch payload (realtime broadcast or snapshot
 * plot). Rejects malformed owners/versions, out-of-range or duplicated tile
 * indices, and active tiles without a valid placement.
 */
export function parseFarmPatch(raw: unknown): FarmPatch {
  if (!raw || typeof raw !== 'object') {
    throw new Error('INVALID_FARM_PATCH');
  }
  const patch = raw as {
    ownerId?: unknown;
    plotVersion?: unknown;
    tiles?: unknown;
  };

  if (typeof patch.ownerId !== 'string' || patch.ownerId.length === 0) {
    throw new Error('INVALID_FARM_PATCH');
  }
  if (
    typeof patch.plotVersion !== 'number' ||
    !Number.isInteger(patch.plotVersion) ||
    patch.plotVersion < 0
  ) {
    throw new Error('INVALID_FARM_PATCH');
  }
  if (!Array.isArray(patch.tiles)) {
    throw new Error('INVALID_FARM_PATCH');
  }

  const seenIndices = new Set<number>();
  const tiles: FarmPatchTile[] = patch.tiles.map((rawTile) => {
    const tile = rawTile as Omit<FarmPatchTile, 'placement'>;
    if (
      !tile ||
      typeof tile.i !== 'number' ||
      !Number.isInteger(tile.i) ||
      tile.i < 0 ||
      tile.i > 63
    ) {
      throw new Error('INVALID_FARM_PATCH');
    }
    if (seenIndices.has(tile.i)) {
      throw new Error('INVALID_FARM_PATCH');
    }
    seenIndices.add(tile.i);

    return { ...tile, placement: parsePatchPlacement(tile) };
  });

  return {
    ownerId: patch.ownerId,
    plotVersion: patch.plotVersion,
    tiles,
  };
}
