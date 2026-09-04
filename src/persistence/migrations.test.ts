import { describe, it, expect } from 'vitest';
import { migrateSaveEnvelope, runSaveMigrations, CURRENT_SCHEMA_VERSION } from './migrations';
import { createDefaultSaveEnvelope } from './saveSchema';

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

  it('migrates v1 grid plots to v2 free-placement plots', () => {
    const v1Save = {
      schemaVersion: 1,
      savedAtUtcMs: 1700000000000,
      player: { position: [0, 0.5, 0], coins: 250, totalDistance: 0 },
      farm: {
        gridSize: 4,
        plots: [
          {
            id: 'plot-1-2',
            row: 1,
            col: 2,
            tilled: true,
            crop: {
              cropId: 'carrot',
              plantedAtUtcMs: 1700000000000,
              growthProgressSec: 10,
              mutation: 'none',
            },
            hydratedUntilUtcMs: 1700000060000,
          },
          {
            id: 'plot-0-0',
            row: 0,
            col: 0,
            tilled: false,
            crop: null,
            hydratedUntilUtcMs: 0,
          },
        ],
        goldenWateringCanOwned: true,
      },
      inventory: {
        seeds: { carrot: 3, tomato: 0, pumpkin: 0, golden_berry: 0, starfruit: 0 },
        produce: [],
        eggs: [],
        pets: [],
        equippedPetId: null,
        incubatingEggId: null,
      },
      weather: {
        current: 'sunny',
        startedAtUtcMs: 1700000000000,
        endsAtUtcMs: 1700000240000,
        previousWeather: null,
      },
      rngState: 42,
      tutorial: { completedSteps: [], dismissed: false },
    };

    const result = runSaveMigrations(v1Save);
    expect(result.migrated).toBe(true);
    expect(result.fromVersion).toBe(1);
    expect(result.toVersion).toBe(2);

    const farm = result.envelope.farm;
    // Only the planted plot survives; empty soil is dropped
    expect(farm.plots).toHaveLength(1);
    expect(farm.nextPlotNumber).toBe(2);
    expect(farm.goldenWateringCanOwned).toBe(true);

    const plot = farm.plots[0];
    expect(plot.id).toBe('crop-1');
    // row 1, col 2 on the old 8-based grid: x = (2-3.5)*1.55 - 1.8
    expect(plot.x).toBeCloseTo(-4.125, 3);
    expect(plot.z).toBeCloseTo(-3.875, 3);
    expect(plot.crop.cropId).toBe('carrot');
    expect(plot.crop.growthProgressSec).toBe(10);
    expect(plot.hydratedUntilUtcMs).toBe(1700000060000);
  });

  it('migrates legacy v0 save (missing schemaVersion) to v2 envelope', () => {
    const legacyV0Data = {
      // No schemaVersion
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
          {
            id: 'plot-2-1',
            row: 2,
            col: 1,
            tilled: true,
            crop: {
              cropId: 'tomato',
              plantedAtUtcMs: 1690000000000,
              growthProgressSec: 20,
              mutation: 'none',
            },
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
      // Missing tutorial in legacy payload
    };

    const result = runSaveMigrations(legacyV0Data);
    expect(result.migrated).toBe(true);
    expect(result.fromVersion).toBe(0);
    expect(result.toVersion).toBe(2);
    expect(result.envelope.schemaVersion).toBe(2);
    expect(result.envelope.player.coins).toBe(250);
    expect(result.envelope.tutorial).toBeDefined();
    expect(result.envelope.tutorial.completedSteps).toEqual([]);
    expect(result.envelope.tutorial.dismissed).toBe(false);
    // Empty v0 plot dropped; planted tomato converted to free plot
    expect(result.envelope.farm.plots).toHaveLength(1);
    expect(result.envelope.farm.plots[0].id).toBe('crop-1');
    expect(result.envelope.farm.plots[0].crop.cropId).toBe('tomato');
    expect(result.envelope.farm.nextPlotNumber).toBe(2);

    const direct = migrateSaveEnvelope(legacyV0Data);
    expect(direct.schemaVersion).toBe(2);
    expect(direct.player.coins).toBe(250);
  });

  it('migrates schemaVersion: 0 explicitly specified to v1', () => {
    const v0Explicit = {
      schemaVersion: 0,
      savedAtUtcMs: 1690000000000,
      player: {
        position: [0, 0.5, 0],
        coins: 500,
        totalDistance: 50,
      },
      farm: {
        gridSize: 4,
        plots: [],
        goldenWateringCanOwned: false,
      },
      inventory: {
        seeds: { carrot: 0, tomato: 0, pumpkin: 0, golden_berry: 0, starfruit: 0 },
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
      rngState: 99,
      tutorial: {
        completedSteps: ['welcome'],
        dismissed: true,
      },
    };

    const result = runSaveMigrations(v0Explicit);
    expect(result.migrated).toBe(true);
    expect(result.envelope.schemaVersion).toBe(2);
    expect(result.envelope.player.coins).toBe(500);
    expect(result.envelope.tutorial.completedSteps).toEqual(['welcome']);
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
});
