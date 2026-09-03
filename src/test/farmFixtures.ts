import type { CropData, PlotData, PlotId } from '../state/storeTypes';
import type { CropPlacement } from '../game/world/farmLayout';

export const DEFAULT_TEST_PLACEMENT: CropPlacement = {
  bedId: 'north-west',
  localX: 0,
  localZ: 0,
};

export function createTestCrop(overrides: Partial<CropData> = {}): CropData {
  return {
    cropId: 'carrot',
    plantedAtUtcMs: 0,
    growthProgressSec: 0,
    mutation: 'none',
    placement: DEFAULT_TEST_PLACEMENT,
    ...overrides,
  };
}

export function createPlacedPlot(
  id: PlotId,
  placement: CropPlacement,
  cropOverrides: Partial<CropData> = {}
): PlotData {
  const match = /^plot-(\d+)-(\d+)$/.exec(id);
  if (!match) throw new Error('Test plot id must use plot-row-col');
  return {
    id,
    row: Number(match[1]),
    col: Number(match[2]),
    crop: createTestCrop({ placement, ...cropOverrides }),
    hydratedUntilUtcMs: 0,
  };
}

export function createMaturePlot(id: PlotId, placement: CropPlacement): PlotData {
  return createPlacedPlot(id, placement, { growthProgressSec: 45 });
}
