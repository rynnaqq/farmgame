import { describe, it, expect } from 'vitest';
import { migrateSaveEnvelope, runSaveMigrations, CURRENT_SCHEMA_VERSION } from './migrations';
import { createDefaultSaveEnvelope } from './saveSchema';

/**
 * Builds a valid version-1 save envelope (old 4x4 farm with `tilled` flag and
 * crops that carry no placement) for use as migration input.
 */
function createVersionOneFixture(): Record<string, unknown> {
  const plots = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      plots.push({
        id: `plot-${row}-${col}`,
        row,
        col,
        tilled: true,
        crop: null,
        hydratedUntilUtcMs: 0,
      });
    }
  }
  return {
    schemaVersion: 1,
    savedAtUtcMs: 1690000000000,
    player: {
      position: [0, 0, 0],
      coins: 100,
      totalDistance: 0,
    },
    farm: {
      gridSize: 4,
      plots,
      goldenWateringCanOwned: false,
    },
    inventory: {
      seeds: { carrot: 5, tomato: 0, pumpkin: 0, golden_berry: 0, starfruit: 0 },
      produce: [],
      eggs: [],
      pets: [],
      equippedPetId: null,
      incubatingEggId: null,
    },
    weather: {
      current: 'sunny',
      startedAtUtcMs: 1690000000000,
      endsAtUtcMs: 1690000240000,
      previousWeather: null,
    },
    rngState: 1,
    tutorial: {
      completedSteps: [],
      dismissed: false,
    },
  };
}

describe('migrations (Save Schema Migration Pipeline)', () => {
  it('passes through valid version 2 save envelopes without modification', () => {
    const v2Save = createDefaultSaveEnvelope(1700000000000, 123);
    const result = runSaveMigrations(v2Save);

    expect(result.migrated).toBe(false);
    expect(result.fromVersion).toBe(2);
    expect(result.toVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.envelope).toEqual(v2Save);

    const direct = migrateSaveEnvelope(v2Save);
    expect(direct).toEqual(v2Save);
  });

  it('migrates v1 crops to deterministic v2 placements without losing values', () => {
    const v1 = createVersionOneFixture();
    (v1.player as { coins: number }).coins = 731;
    (v1.farm as { gridSize: number }).gridSize = 4;
    const plots = (v1.farm as { plots: Array<Record<string, unknown>> }).plots;
    plots[0] = {
      id: 'plot-0-0',
      row: 0,
      col: 0,
      tilled: true,
      crop: {
        cropId: 'tomato',
        plantedAtUtcMs: 1234,
        growthProgressSec: 0.45,
        mutation: 'gold',
      },
      hydratedUntilUtcMs: 9876,
    };

    const result = runSaveMigrations(v1);

    expect(result.toVersion).toBe(2);
    expect(result.migrated).toBe(true);
    expect(result.envelope.farm.gridSize).toBe(8);
    expect(result.envelope.farm.plots).toHaveLength(64);
    expect(result.envelope.farm.plots[0]).toEqual({
      id: 'plot-0-0',
      row: 0,
      col: 0,
      crop: {
        cropId: 'tomato',
        plantedAtUtcMs: 1234,
        growthProgressSec: 0.45,
        mutation: 'gold',
        placement: {
          bedId: 'north-west',
          localX: -1.8,
          localZ: -1.8,
        },
      },
      hydratedUntilUtcMs: 9876,
    });
    expect(result.envelope.player.coins).toBe(731);

    // Idempotent: a v2 envelope round-trips through migrations unchanged.
    expect(runSaveMigrations(result.envelope)).toEqual({
      envelope: result.envelope,
      migrated: false,
      fromVersion: 2,
      toVersion: 2,
    });
  });

  it('drops the tilled flag and resets empty-slot hydration during migration', () => {
    const v1 = createVersionOneFixture();
    const plots = (v1.farm as { plots: Array<Record<string, unknown>> }).plots;
    // Empty tilled slot with stale hydration must be normalized.
    plots[1] = {
      id: 'plot-0-1',
      row: 0,
      col: 1,
      tilled: true,
      crop: null,
      hydratedUntilUtcMs: 4444,
    };

    const result = runSaveMigrations(v1);
    const migrated = result.envelope.farm.plots.find((p) => p.id === 'plot-0-1');

    expect(migrated).toBeDefined();
    expect('tilled' in (migrated as object)).toBe(false);
    expect(migrated?.crop).toBeNull();
    expect(migrated?.hydratedUntilUtcMs).toBe(0);
  });

  it('migrates legacy v0 save (missing schemaVersion) through v1 to v2', () => {
    const legacyV0Data: Record<string, unknown> = {
      savedAtUtcMs: 1690000000000,
      player: {
        position: [0, 0.5, 0],
        coins: 250,
        totalDistance: 15.5,
      },
      farm: {
        gridSize: 4,
        plots: [
          {
            id: 'plot-0-0',
            row: 0,
            col: 0,
            tilled: true,
            crop: null,
            hydratedUntilUtcMs: 0,
          },
        ],
        goldenWateringCanOwned: false,
      },
      inventory: {
        seeds: {
          carrot: 10,
          tomato: 5,
          pumpkin: 0,
          golden_berry: 0,
          starfruit: 0,
        },
        produce: [],
        eggs: [],
        pets: [],
        equippedPetId: null,
        incubatingEggId: null,
      },
      weather: {
        current: 'sunny',
        startedAtUtcMs: 1690000000000,
        endsAtUtcMs: 1690000240000,
      },
      rngState: 42,
    };

    const result = runSaveMigrations(legacyV0Data);
    expect(result.migrated).toBe(true);
    expect(result.fromVersion).toBe(0);
    expect(result.toVersion).toBe(2);
    expect(result.envelope.schemaVersion).toBe(2);
    expect(result.envelope.player.coins).toBe(250);
    expect(result.envelope.farm.gridSize).toBe(8);
    expect(result.envelope.farm.plots).toHaveLength(64);
    expect(result.envelope.tutorial.completedSteps).toEqual([]);

    const direct = migrateSaveEnvelope(legacyV0Data);
    expect(direct.schemaVersion).toBe(2);
    expect(direct.player.coins).toBe(250);
  });

  it('throws an error when encountering unsupported future schema versions', () => {
    const futureSave = {
      schemaVersion: 99,
      savedAtUtcMs: 1700000000000,
      player: { position: [0, 0, 0], coins: 1000, totalDistance: 0 },
    };

    expect(() => migrateSaveEnvelope(futureSave)).toThrow(/unsupported.*version/i);
  });

  it('throws an error on non-object or unreadable corrupt data', () => {
    expect(() => migrateSaveEnvelope(null)).toThrow();
    expect(() => migrateSaveEnvelope('corrupt_string')).toThrow();
    expect(() => migrateSaveEnvelope(12345)).toThrow();
    expect(() => migrateSaveEnvelope(undefined)).toThrow();
  });

  it('rejects a v2 payload whose crop is missing placement', () => {
    const v2 = createDefaultSaveEnvelope(1000, 7) as unknown as Record<string, unknown>;
    const farm = v2.farm as { plots: Array<Record<string, unknown>> };
    farm.plots[0] = {
      id: 'plot-0-0',
      row: 0,
      col: 0,
      crop: {
        cropId: 'carrot',
        plantedAtUtcMs: 1000,
        growthProgressSec: 0,
        mutation: 'none',
      },
      hydratedUntilUtcMs: 0,
    };

    expect(() => runSaveMigrations(v2)).toThrow();
  });
});
