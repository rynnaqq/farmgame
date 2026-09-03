import {
  FARM_BEDS,
  isFarmBedId,
  isPlacementInsideBed,
  type CropPlacement,
} from '../world/farmLayout';

export const MIN_PLANT_SPACING = 1.1;
export const MAX_ACTIVE_CROPS = 64;

export interface PlacementSlot {
  id: string;
  row: number;
  col: number;
  crop: { placement: CropPlacement } | null;
}

export type PlacementFailureReason =
  | 'invalid_placement'
  | 'outside_planting_area'
  | 'occupied_position'
  | 'farm_full';

export type PlacementValidation =
  | { ok: true }
  | { ok: false; reason: PlacementFailureReason };

export function placementDistance(a: CropPlacement, b: CropPlacement): number {
  const aw = FARM_BEDS[a.bedId];
  const bw = FARM_BEDS[b.bedId];
  return Math.hypot(
    (aw.centerX + a.localX) - (bw.centerX + b.localX),
    (aw.centerZ + a.localZ) - (bw.centerZ + b.localZ)
  );
}

export function findFirstEmptySlot<T extends PlacementSlot>(slots: readonly T[]): T | null {
  return [...slots]
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .find((slot) => slot.crop === null) ?? null;
}

export function validatePlantPlacement(
  placement: CropPlacement,
  slots: readonly PlacementSlot[]
): PlacementValidation {
  if (
    !placement ||
    typeof placement !== 'object' ||
    !isFarmBedId(placement.bedId) ||
    !Number.isFinite(placement.localX) ||
    !Number.isFinite(placement.localZ)
  ) {
    return { ok: false, reason: 'invalid_placement' };
  }
  if (!isPlacementInsideBed(placement)) {
    return { ok: false, reason: 'outside_planting_area' };
  }
  if (slots.filter((slot) => slot.crop !== null).length >= MAX_ACTIVE_CROPS) {
    return { ok: false, reason: 'farm_full' };
  }
  if (slots.some((slot) =>
    slot.crop !== null && placementDistance(placement, slot.crop.placement) < MIN_PLANT_SPACING
  )) {
    return { ok: false, reason: 'occupied_position' };
  }
  return { ok: true };
}

export function findNearestPlacedSlots<T extends PlacementSlot>(
  origin: CropPlacement,
  slots: readonly T[],
  limit: number,
  maxDistance: number,
  excludeId?: string
): T[] {
  return slots
    .filter((slot) => slot.crop !== null && slot.id !== excludeId)
    .map((slot) => ({ slot, distance: placementDistance(origin, slot.crop!.placement) }))
    .filter((entry) => entry.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance || a.slot.row - b.slot.row || a.slot.col - b.slot.col)
    .slice(0, limit)
    .map((entry) => entry.slot);
}
