export const FARM_BED_IDS = [
  'north-west',
  'north-east',
  'south-west',
  'south-east',
] as const;

export type FarmBedId = (typeof FARM_BED_IDS)[number];

export interface CropPlacement {
  bedId: FarmBedId;
  localX: number;
  localZ: number;
}

export interface FarmBedDefinition {
  id: FarmBedId;
  centerX: number;
  centerZ: number;
  width: 6;
  depth: 5.4;
  soilHeight: number;
  plantingInset: 0.45;
}

const makeBed = (
  id: FarmBedId,
  centerX: number,
  centerZ: number
): FarmBedDefinition => ({
  id,
  centerX,
  centerZ,
  width: 6,
  depth: 5.4,
  soilHeight: 0.22,
  plantingInset: 0.45,
});

export const FARM_BEDS: Record<FarmBedId, FarmBedDefinition> = {
  'north-west': makeBed('north-west', -3.8, -3.5),
  'north-east': makeBed('north-east', 3.8, -3.5),
  'south-west': makeBed('south-west', -3.8, 3.5),
  'south-east': makeBed('south-east', 3.8, 3.5),
};

export const FARM_FENCE = {
  westX: -7.95,
  eastX: 7.95,
  backZ: -7.35,
  frontZ: 7.35,
  thickness: 0.24,
  height: 1.3,
  gateWidth: 2.2,
  segments: [
    { id: 'west', position: [-7.95, 0.65, 0] as const, size: [0.24, 1.3, 14.7] as const },
    { id: 'east', position: [7.95, 0.65, 0] as const, size: [0.24, 1.3, 14.7] as const },
    { id: 'back', position: [0, 0.65, -7.35] as const, size: [15.9, 1.3, 0.24] as const },
    { id: 'front-west', position: [-4.525, 0.65, 7.35] as const, size: [6.85, 1.3, 0.24] as const },
    { id: 'front-east', position: [4.525, 0.65, 7.35] as const, size: [6.85, 1.3, 0.24] as const },
  ],
} as const;

export const FARM_OUTER_BOUNDS = {
  minX: -6.8,
  maxX: 6.8,
  minZ: -6.2,
  maxZ: 6.2,
} as const;

const LOCAL_MIN_X = -2.55;
const LOCAL_MAX_X = 2.55;
const LOCAL_MIN_Z = -2.25;
const LOCAL_MAX_Z = 2.25;

function roundPlacement(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function isFarmBedId(value: unknown): value is FarmBedId {
  return typeof value === 'string' && FARM_BED_IDS.includes(value as FarmBedId);
}

export function isPlacementInsideBed(placement: CropPlacement): boolean {
  return (
    isFarmBedId(placement.bedId) &&
    Number.isFinite(placement.localX) &&
    Number.isFinite(placement.localZ) &&
    placement.localX >= LOCAL_MIN_X &&
    placement.localX <= LOCAL_MAX_X &&
    placement.localZ >= LOCAL_MIN_Z &&
    placement.localZ <= LOCAL_MAX_Z
  );
}

export function worldPointToPlacement(point: { x: number; z: number }): CropPlacement | null {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) return null;
  for (const bedId of FARM_BED_IDS) {
    const bed = FARM_BEDS[bedId];
    const rawLocalX = point.x - bed.centerX;
    const rawLocalZ = point.z - bed.centerZ;
    if (
      rawLocalX < LOCAL_MIN_X ||
      rawLocalX > LOCAL_MAX_X ||
      rawLocalZ < LOCAL_MIN_Z ||
      rawLocalZ > LOCAL_MAX_Z
    ) {
      continue;
    }
    return {
      bedId,
      localX: roundPlacement(rawLocalX),
      localZ: roundPlacement(rawLocalZ),
    };
  }
  return null;
}

export function placementToWorldPoint(
  placement: CropPlacement,
  y = 0
): { x: number; y: number; z: number } {
  const bed = FARM_BEDS[placement.bedId];
  return {
    x: roundPlacement(bed.centerX + placement.localX),
    y,
    z: roundPlacement(bed.centerZ + placement.localZ),
  };
}

export function legacyGridToPlacement(row: number, col: number): CropPlacement {
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row > 7 || col < 0 || col > 7) {
    throw new RangeError('Legacy row and col must be integers from 0 through 7');
  }
  const northSouth = row < 4 ? 'north' : 'south';
  const westEast = col < 4 ? 'west' : 'east';
  return {
    bedId: (northSouth + '-' + westEast) as FarmBedId,
    localX: ((col % 4) - 1.5) * 1.2,
    localZ: ((row % 4) - 1.5) * 1.2,
  };
}

export function isInsideFarmStudExclusion(x: number, z: number, padding = 0.25): boolean {
  return (
    x >= FARM_OUTER_BOUNDS.minX - padding &&
    x <= FARM_OUTER_BOUNDS.maxX + padding &&
    z >= FARM_OUTER_BOUNDS.minZ - padding &&
    z <= FARM_OUTER_BOUNDS.maxZ + padding
  );
}
