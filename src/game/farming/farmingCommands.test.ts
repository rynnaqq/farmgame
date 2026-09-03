import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, resetGameStore } from '../../state/gameStore';
import { plantCropAt, waterCrop, harvestCrop, executeCropAction } from './farmingCommands';
import { createPlacedPlot, createMaturePlot } from '../../test/farmFixtures';
import { worldPointToPlacement, placementToWorldPoint } from '../world/farmLayout';
import {
  HYDRATION_DURATION_BASIC_MS,
  HYDRATION_DURATION_HEATWAVE_MS,
  CROPS,
  MUTATION_MULTIPLIERS,
} from '../core/constants';
import type { CropPlacement } from '../world/farmLayout';
import type { CropId } from '../../state/storeTypes';

const BASE_NOW = 1700000000000;

function seedCropAt(placement: CropPlacement, cropId: CropId = 'carrot') {
  const result = plantCropAt(placement, cropId, undefined, BASE_NOW);
  expect(result.ok).toBe(true);
  return result;
}

function seedMatureCropAt(placement: CropPlacement, cropId: CropId = 'carrot') {
  const result = seedCropAt(placement, cropId);
  const store = useGameStore.getState();
  const plot = store.farm.plots[result.ok ? result.value.slotId : 'plot-0-0'];
  store.setPlot({
    ...plot,
    crop: { ...plot.crop!, growthProgressSec: CROPS[cropId].baseGrowthSec },
  });
  return result;
}

describe('plantCropAt', () => {
  beforeEach(() => {
    resetGameStore(12345);
  });

  it('plants directly at the exact valid point without Till or Water', () => {
    const before = useGameStore.getState().inventory.seeds.carrot;
    const placement = { bedId: 'south-west' as const, localX: 0.347, localZ: -1.284 };
    const result = plantCropAt(placement, 'carrot', undefined, 4000);
    expect(result).toEqual({
      ok: true,
      value: { cropId: 'carrot', slotId: 'plot-0-0' },
      message: 'Carrot ditanam',
    });
    expect(useGameStore.getState().farm.plots['plot-0-0'].crop?.placement).toEqual(placement);
    expect(useGameStore.getState().inventory.seeds.carrot).toBe(before - 1);
  });

  it.each([
    [
      { bedId: 'north-west' as const, localX: 2.7, localZ: 0 },
      'outside_planting_area',
      'Tanam di area tanah',
    ],
    [
      { bedId: 'north-west' as const, localX: 0.5, localZ: 0 },
      'occupied_position',
      'Terlalu dekat dengan tanaman lain',
    ],
  ])('does not deduct seeds on %s rejection', (placement, reason, message) => {
    seedCropAt({ bedId: 'north-west', localX: 0, localZ: 0 });
    const before = useGameStore.getState();
    const result = plantCropAt(placement as CropPlacement, 'carrot');
    expect(result).toEqual({ ok: false, reason, message });
    expect(useGameStore.getState().inventory.seeds).toEqual(before.inventory.seeds);
    expect(useGameStore.getState().farm.plots).toEqual(before.farm.plots);
  });

  it('rejects the sixty-fifth active crop with farm_full and keeps seeds', () => {
    const store = useGameStore.getState();
    store.setCoins(100000);
    store.addSeeds('carrot', 200);

    // Place 64 crops spread across beds at safe spacing (>= 1.1 apart).
    const xs = [-2.2, -1.1, 0, 1.1, 2.2];
    const zs = [-2.2, -1.1, 0, 1.1, 2.2];
    let placed = 0;
    outer: for (const bedId of ['north-west', 'north-east', 'south-west', 'south-east'] as const) {
      for (const x of xs) {
        for (const z of zs) {
          if (placed >= 64) break outer;
          const result = plantCropAt({ bedId, localX: x, localZ: z }, 'carrot');
          if (result.ok) placed += 1;
        }
      }
    }
    expect(placed).toBe(64);

    const seedsBefore = useGameStore.getState().inventory.seeds.carrot;
    const result = plantCropAt({ bedId: 'south-east', localX: 2, localZ: 2 }, 'carrot');
    expect(result).toEqual({
      ok: false,
      reason: 'farm_full',
      message: 'Kebun penuh (64/64)',
    });
    expect(useGameStore.getState().inventory.seeds.carrot).toBe(seedsBefore);
  });

  it('rejects invalid placements and unknown crop ids', () => {
    const invalid = plantCropAt(
      { bedId: 'north-west', localX: NaN, localZ: 0 },
      'carrot'
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.reason).toBe('invalid_placement');
      expect(invalid.message).toBe('Posisi tanam tidak valid');
    }

    const unknown = plantCropAt(
      { bedId: 'north-west', localX: 0, localZ: 0 },
      'dragonfruit' as unknown as CropId
    );
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.reason).toBe('unknown');
    }
  });

  it('fails with out_of_range when the player is too far', () => {
    const result = plantCropAt(
      { bedId: 'north-west', localX: 0, localZ: 0 },
      'carrot',
      [50, 0, 50]
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('out_of_range');
    }
  });

  it('fails with insufficient_seeds when the seed bag is empty', () => {
    const store = useGameStore.getState();
    store.setPlot({
      ...store.farm.plots['plot-0-0'],
      crop: null,
    });
    const seeds = { ...store.inventory.seeds, carrot: 0 };
    useGameStore.getState().resetGame();
    const fresh = useGameStore.getState();
    fresh.setCoins(100);
    // Drain carrots
    for (let i = 0; i < 5; i += 1) {
      plantCropAt(
        { bedId: 'north-west', localX: -2.4 + i * 1.2, localZ: -2.1 },
        'carrot'
      );
    }
    expect(useGameStore.getState().inventory.seeds.carrot).toBe(0);
    void seeds;

    const result = plantCropAt({ bedId: 'south-east', localX: 0, localZ: 0 }, 'carrot');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('insufficient_seeds');
    }
  });
});

describe('waterCrop', () => {
  beforeEach(() => {
    resetGameStore(12345);
  });

  it('waters a planted crop for 120s under sunny weather', () => {
    const slotId = seedCropAt({ bedId: 'north-west', localX: 0, localZ: 0 }).ok
      ? useGameStore.getState().farm.plots['plot-0-0'].id
      : 'plot-0-0';

    const result = waterCrop(slotId, { isGoldenCan: false, weather: 'sunny', nowMs: BASE_NOW });
    expect(result).toEqual({
      ok: true,
      value: { hydratedPlotIds: [slotId] },
      message: 'Tanaman disiram',
    });
    expect(useGameStore.getState().farm.plots[slotId].hydratedUntilUtcMs).toBe(
      BASE_NOW + HYDRATION_DURATION_BASIC_MS
    );
  });

  it('uses 60s hydration during heatwave weather', () => {
    const slotId = 'plot-0-0';
    seedCropAt({ bedId: 'north-west', localX: 0, localZ: 0 });

    const result = waterCrop(slotId, { isGoldenCan: false, weather: 'heatwave', nowMs: BASE_NOW });
    expect(result.ok).toBe(true);
    expect(useGameStore.getState().farm.plots[slotId].hydratedUntilUtcMs).toBe(
      BASE_NOW + HYDRATION_DURATION_HEATWAVE_MS
    );
  });

  it('fails when the target has no crop', () => {
    const result = waterCrop('plot-0-0', { nowMs: BASE_NOW });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid_plot_state');
      expect(result.message).toBe('Tidak ada tanaman untuk disiram');
    }
  });

  it('golden water selects source plus no more than eight closest crops within 2.4', () => {
    useGameStore.getState().addSeeds('carrot', 20);
    // Source at the center; ring of 8 crops at 1.2 spacing (all >= 1.1 apart),
    // plus one farther crop at exactly 2.4 that must be excluded by the limit of 8.
    seedCropAt({ bedId: 'north-west', localX: 0, localZ: 0 });
    const ring: Array<[number, number]> = [
      [-1.2, -1.2],
      [0, -1.2],
      [1.2, -1.2],
      [-1.2, 0],
      [1.2, 0],
      [-1.2, 1.2],
      [0, 1.2],
      [1.2, 1.2],
    ];
    for (const [x, z] of ring) {
      const res = plantCropAt({ bedId: 'north-west', localX: x, localZ: z }, 'carrot');
      expect(res.ok).toBe(true);
    }
    const far = plantCropAt({ bedId: 'north-west', localX: 2.4, localZ: 0 }, 'carrot');
    expect(far.ok).toBe(true);

    const result = waterCrop('plot-0-0', { isGoldenCan: true, weather: 'sunny', nowMs: BASE_NOW });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.hydratedPlotIds).toHaveLength(9);
      expect(result.value.hydratedPlotIds[0]).toBe('plot-0-0');
      const farSlot = far.ok ? far.value.slotId : 'plot-x';
      expect(result.value.hydratedPlotIds).not.toContain(farSlot);
    }
  });

  it('fails with out_of_range when the player is too far', () => {
    seedCropAt({ bedId: 'north-west', localX: 0, localZ: 0 });
    const result = waterCrop('plot-0-0', { playerPos: [50, 0, 50], nowMs: BASE_NOW });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('out_of_range');
    }
  });
});

describe('harvestCrop', () => {
  beforeEach(() => {
    resetGameStore(12345);
  });

  it('clears crop placement and permits replanting at the same point', () => {
    const placement = { bedId: 'north-east' as const, localX: 0, localZ: 0 };
    const result = seedMatureCropAt(placement);
    const slotId = result.ok ? result.value.slotId : 'plot-0-0';

    expect(harvestCrop(slotId).ok).toBe(true);
    expect(useGameStore.getState().farm.plots[slotId].crop).toBeNull();
    expect(useGameStore.getState().farm.plots[slotId].hydratedUntilUtcMs).toBe(0);

    const replant = plantCropAt(placement, 'carrot');
    expect(replant.ok).toBe(true);
  });

  it('credits produce and sale value on harvest', () => {
    seedMatureCropAt({ bedId: 'south-west', localX: 1, localZ: 1 });
    const result = harvestCrop('plot-0-0');
    expect(result).toMatchObject({
      ok: true,
      value: { cropId: 'carrot', mutation: 'none', saleValue: CROPS.carrot.baseSalePrice },
    });
    expect(useGameStore.getState().inventory.produce).toEqual([
      { cropId: 'carrot', mutation: 'none', quantity: 1 },
    ]);
  });

  it('computes mutation sale value (cosmic starfruit 15x)', () => {
    resetGameStore(12345);
    useGameStore.getState().addSeeds('starfruit', 1);
    const planted = plantCropAt({ bedId: 'south-east', localX: 0, localZ: 0 }, 'starfruit');
    expect(planted.ok).toBe(true);
    const slotId = planted.ok ? planted.value.slotId : 'plot-0-0';
    const plot = useGameStore.getState().farm.plots[slotId];
    useGameStore.getState().setPlot({
      ...plot,
      crop: {
        ...plot.crop!,
        growthProgressSec: CROPS.starfruit.baseGrowthSec,
        mutation: 'cosmic',
      },
    });

    const result = harvestCrop(slotId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.saleValue).toBe(
        CROPS.starfruit.baseSalePrice * MUTATION_MULTIPLIERS.cosmic
      );
    }
  });

  it('fails when crop is not mature', () => {
    seedCropAt({ bedId: 'north-west', localX: 0, localZ: 0 });
    const result = harvestCrop('plot-0-0');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('not_mature');
      expect(result.message).toMatch(/not ready/i);
    }
    expect(useGameStore.getState().farm.plots['plot-0-0'].crop).not.toBeNull();
  });

  it('rapid double-harvest yields exactly one crop', () => {
    seedMatureCropAt({ bedId: 'north-west', localX: 0, localZ: 0 });
    const first = harvestCrop('plot-0-0');
    const second = harvestCrop('plot-0-0');
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);

    const produce = useGameStore.getState().inventory.produce;
    expect(produce).toHaveLength(1);
    expect(produce[0].quantity).toBe(1);
  });
});

describe('executeCropAction dispatcher', () => {
  beforeEach(() => {
    resetGameStore(12345);
  });

  it('dispatches watering_can to waterCrop', () => {
    seedCropAt({ bedId: 'north-west', localX: 0, localZ: 0 });
    const result = executeCropAction('plot-0-0', 'watering_can', {
      weather: 'heatwave',
      nowMs: BASE_NOW,
    });
    expect(result.ok).toBe(true);
    expect(useGameStore.getState().farm.plots['plot-0-0'].hydratedUntilUtcMs).toBe(
      BASE_NOW + HYDRATION_DURATION_HEATWAVE_MS
    );
  });

  it('dispatches hand and scythe to harvestCrop', () => {
    seedMatureCropAt({ bedId: 'north-west', localX: 0, localZ: 0 });
    const result = executeCropAction('plot-0-0', 'hand');
    expect(result.ok).toBe(true);
    expect(useGameStore.getState().farm.plots['plot-0-0'].crop).toBeNull();
  });

  it('returns wrong_tool for seed_bag on a crop slot', () => {
    seedMatureCropAt({ bedId: 'north-west', localX: 0, localZ: 0 });
    const result = executeCropAction('plot-0-0', 'seed_bag');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('wrong_tool');
      expect(result.message).toBe('Pilih Water atau Harvest');
    }
  });

  it('returns plot_locked for unknown slots', () => {
    const result = executeCropAction('plot-nonexistent', 'watering_can');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('plot_locked');
    }
  });
});

describe('farmFixtures contract', () => {
  it('builds placed and mature plots with valid placements', () => {
    const placed = createPlacedPlot('plot-3-3', {
      bedId: 'south-east',
      localX: 1,
      localZ: -1,
    });
    expect(placed.crop?.placement).toEqual({ bedId: 'south-east', localX: 1, localZ: -1 });

    const mature = createMaturePlot('plot-2-2', { bedId: 'north-east', localX: 0, localZ: 0 });
    expect(mature.crop?.growthProgressSec).toBe(45);
    expect(() => createPlacedPlot('bad-id', { bedId: 'north-east', localX: 0, localZ: 0 })).toThrow();
  });
});

describe('click-to-render regression', () => {
  beforeEach(() => {
    resetGameStore(12345);
  });

  it('renders a successful plant within 0.01 world unit of the click', () => {
    const clicked = { x: 4.314, z: 2.111 };
    const placement = worldPointToPlacement(clicked);
    expect(placement).not.toBeNull();
    const result = plantCropAt(placement!, 'carrot', undefined, 1000);
    expect(result.ok).toBe(true);
    const crop = useGameStore.getState().farm.plots['plot-0-0'].crop!;
    const rendered = placementToWorldPoint(crop.placement);
    expect(Math.hypot(rendered.x - clicked.x, rendered.z - clicked.z)).toBeLessThanOrEqual(0.01);
  });

  it('persists placement exactly through toSaveEnvelope and loadSaveEnvelope round-trip', () => {
    const placement: CropPlacement = {
      bedId: 'south-west',
      localX: -2.534,
      localZ: 2.247,
    };
    const planted = plantCropAt(placement, 'carrot', undefined, 1000);
    expect(planted.ok).toBe(true);

    const envelope = useGameStore.getState().toSaveEnvelope(2000);
    const restoredPlot = envelope.farm.plots.find((p) => p.crop !== null);
    expect(restoredPlot?.crop?.placement).toEqual(placement);

    resetGameStore();
    useGameStore.getState().loadSaveEnvelope(envelope);
    const restored = useGameStore
      .getState()
      .farm.plots[planted.ok ? planted.value.slotId : 'plot-0-0'];
    expect(restored.crop?.placement).toEqual(placement);
  });
});
