import { describe, it, expect } from 'vitest';
import {
  migrateSaveEnvelope,
  runSaveMigrations,
  CURRENT_SCHEMA_VERSION,
} from './migrations';
import { createDefaultSaveEnvelope } from './saveSchema';

describe('migrations (Save Schema Migration Pipeline)', () => {
  it('passes through valid version 1 save envelopes without modification', () => {
    const v1Save = createDefaultSaveEnvelope(1700000000000, 123);
    const result = runSaveMigrations(v1Save);

    expect(result.migrated).toBe(false);
    expect(result.fromVersion).toBe(1);
    expect(result.toVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.envelope).toEqual(v1Save);

    const direct = migrateSaveEnvelope(v1Save);
    expect(direct).toEqual(v1Save);
  });

  it('migrates legacy v0 save (missing schemaVersion) to v1 envelope', () => {
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
    expect(result.toVersion).toBe(1);
    expect(result.envelope.schemaVersion).toBe(1);
    expect(result.envelope.player.coins).toBe(250);
    expect(result.envelope.tutorial).toBeDefined();
    expect(result.envelope.tutorial.completedSteps).toEqual([]);
    expect(result.envelope.tutorial.dismissed).toBe(false);

    const direct = migrateSaveEnvelope(legacyV0Data);
    expect(direct.schemaVersion).toBe(1);
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
    expect(result.envelope.schemaVersion).toBe(1);
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
