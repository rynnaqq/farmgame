import { CURRENT_SCHEMA_VERSION } from '../game/core/constants';
import type { SaveEnvelope } from '../state/storeTypes';
import { parseSaveEnvelope } from './saveSchema';

export { CURRENT_SCHEMA_VERSION };

export type MigrationFn = (oldData: Record<string, unknown>) => Record<string, unknown>;

export interface MigrationResult {
  envelope: SaveEnvelope;
  migrated: boolean;
  fromVersion: number;
  toVersion: number;
}

/**
 * Migration registry: keyed by source schema version N, mapping to transformation function N -> N + 1.
 */
export const MIGRATIONS: Record<number, MigrationFn> = {
  // 0 -> 1 (Legacy / unversioned payload to Version 1)
  0: (data: Record<string, unknown>) => {
    const rawFarm = (data.farm as Record<string, unknown>) || {};
    let plots = rawFarm.plots;
    if (plots && !Array.isArray(plots) && typeof plots === 'object') {
      plots = Object.values(plots);
    }

    const rawInventory = (data.inventory as Record<string, unknown>) || {};
    const rawTutorial = (data.tutorial as Record<string, unknown>) || {};
    const rawWeather = (data.weather as Record<string, unknown>) || {};
    const rawPlayer = (data.player as Record<string, unknown>) || {};

    return {
      ...data,
      schemaVersion: 1,
      savedAtUtcMs: data.savedAtUtcMs,
      player: {
        position: rawPlayer.position,
        coins: rawPlayer.coins,
        totalDistance: rawPlayer.totalDistance ?? 0,
        ...rawPlayer,
      },
      farm: {
        gridSize: rawFarm.gridSize,
        plots: plots,
        goldenWateringCanOwned: rawFarm.goldenWateringCanOwned ?? false,
        ...rawFarm,
      },
      inventory: {
        seeds: rawInventory.seeds,
        produce: rawInventory.produce ?? [],
        eggs: rawInventory.eggs ?? [],
        pets: rawInventory.pets ?? [],
        equippedPetId: rawInventory.equippedPetId ?? null,
        incubatingEggId: rawInventory.incubatingEggId ?? null,
        ...rawInventory,
      },
      weather: {
        current: rawWeather.current,
        startedAtUtcMs: rawWeather.startedAtUtcMs,
        endsAtUtcMs: rawWeather.endsAtUtcMs,
        previousWeather: rawWeather.previousWeather ?? null,
        ...rawWeather,
      },
      rngState: data.rngState,
      tutorial: {
        completedSteps: rawTutorial.completedSteps ?? [],
        dismissed: rawTutorial.dismissed ?? false,
        ...rawTutorial,
      },
    };
  },
};

/**
 * Runs all applicable migrations sequentially on raw data up to CURRENT_SCHEMA_VERSION,
 * then validates through Zod schema.
 */
export function runSaveMigrations(rawPayload: unknown): MigrationResult {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    throw new Error('Invalid save payload: payload must be a non-null object');
  }

  const record = { ...(rawPayload as Record<string, unknown>) };
  const rawVersion = record.schemaVersion;
  const initialVersion =
    typeof rawVersion === 'number' && Number.isFinite(rawVersion) ? rawVersion : 0;

  if (initialVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported save schema version: ${initialVersion}. Current supported version is ${CURRENT_SCHEMA_VERSION}.`
    );
  }

  let currentVersion = initialVersion;
  let migratedData = record;

  while (currentVersion < CURRENT_SCHEMA_VERSION) {
    const migration = MIGRATIONS[currentVersion];
    if (!migration) {
      throw new Error(
        `Missing migration from schema version ${currentVersion} to ${currentVersion + 1}`
      );
    }
    migratedData = migration(migratedData);
    currentVersion += 1;
  }

  const validatedEnvelope = parseSaveEnvelope(migratedData);

  return {
    envelope: validatedEnvelope,
    migrated: initialVersion !== CURRENT_SCHEMA_VERSION,
    fromVersion: initialVersion,
    toVersion: CURRENT_SCHEMA_VERSION,
  };
}

/**
 * Migrates and validates save data, returning a valid SaveEnvelope.
 */
export function migrateSaveEnvelope(rawPayload: unknown): SaveEnvelope {
  return runSaveMigrations(rawPayload).envelope;
}
