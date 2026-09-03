import { describe, it, expect } from 'vitest';
import {
  saveEnvelopeSchema,
  validateSaveEnvelope,
  safeParseSaveEnvelope,
  parseSaveEnvelope,
  createDefaultSaveEnvelope,
  isSaveEnvelopeValid,
} from './saveSchema';
import type { SaveEnvelope } from '../state/storeTypes';

describe('saveSchema (Zod Persistence Validation)', () => {
  it('validates a default generated save envelope successfully', () => {
    const defaultSave = createDefaultSaveEnvelope(1700000000000, 42);
    expect(defaultSave.schemaVersion).toBe(2);
    expect(defaultSave.savedAtUtcMs).toBe(1700000000000);
    expect(defaultSave.rngState).toBe(42);
    expect(defaultSave.player.coins).toBe(100);
    expect(defaultSave.farm.gridSize).toBe(8);
    expect(defaultSave.farm.plots.length).toBe(64);

    const parseResult = safeParseSaveEnvelope(defaultSave);
    expect(parseResult.success).toBe(true);
    expect(isSaveEnvelopeValid(defaultSave)).toBe(true);

    const validated = parseSaveEnvelope(defaultSave);
    expect(validated.player.coins).toBe(100);
  });

  it('rejects negative coins', () => {
    const defaultSave = createDefaultSaveEnvelope();
    const invalidSave = {
      ...defaultSave,
      player: {
        ...defaultSave.player,
        coins: -50,
      },
    };

    const result = validateSaveEnvelope(invalidSave);
    expect(result.success).toBe(false);
    expect(isSaveEnvelopeValid(invalidSave)).toBe(false);
    expect(() => parseSaveEnvelope(invalidSave)).toThrow();
  });

  it('rejects NaN and Infinity numbers in player state', () => {
    const defaultSave = createDefaultSaveEnvelope();

    const nanCoins = {
      ...defaultSave,
      player: { ...defaultSave.player, coins: NaN },
    };
    expect(safeParseSaveEnvelope(nanCoins).success).toBe(false);

    const infDistance = {
      ...defaultSave,
      player: { ...defaultSave.player, totalDistance: Infinity },
    };
    expect(safeParseSaveEnvelope(infDistance).success).toBe(false);

    const nanPosition = {
      ...defaultSave,
      player: {
        ...defaultSave.player,
        position: [0, NaN, 0] as unknown as [number, number, number],
      },
    };
    expect(safeParseSaveEnvelope(nanPosition).success).toBe(false);
  });

  it('rejects farm grid sizes other than 8', () => {
    const defaultSave = createDefaultSaveEnvelope();

    const invalidGrid5 = {
      ...defaultSave,
      farm: { ...defaultSave.farm, gridSize: 5 as unknown as 8 },
    };
    expect(safeParseSaveEnvelope(invalidGrid5).success).toBe(false);

    const invalidGrid4 = {
      ...defaultSave,
      farm: { ...defaultSave.farm, gridSize: 4 as unknown as 8 },
    };
    expect(safeParseSaveEnvelope(invalidGrid4).success).toBe(false);
  });

  it('requires exactly 64 plots with row/col within 0..7', () => {
    const defaultSave = createDefaultSaveEnvelope();

    const shortFarm = {
      ...defaultSave,
      farm: { ...defaultSave.farm, plots: defaultSave.farm.plots.slice(0, 32) },
    };
    expect(safeParseSaveEnvelope(shortFarm).success).toBe(false);

    const badRow = {
      ...defaultSave,
      farm: {
        ...defaultSave.farm,
        plots: defaultSave.farm.plots.map((p, i) =>
          i === 0 ? { ...p, row: 9 } : p
        ),
      },
    };
    expect(safeParseSaveEnvelope(badRow).success).toBe(false);
  });

  it('rejects unknown crop IDs, weather types, mutation types, pet types, and egg types', () => {
    const defaultSave = createDefaultSaveEnvelope();

    const invalidProduce = {
      ...defaultSave,
      inventory: {
        ...defaultSave.inventory,
        produce: [
          { cropId: 'watermelon' as unknown as 'carrot', mutation: 'none' as const, quantity: 5 },
        ],
      },
    };
    expect(safeParseSaveEnvelope(invalidProduce).success).toBe(false);

    const invalidWeather = {
      ...defaultSave,
      weather: { ...defaultSave.weather, current: 'tornado' as unknown as 'sunny' },
    };
    expect(safeParseSaveEnvelope(invalidWeather).success).toBe(false);

    const invalidMutation = {
      ...defaultSave,
      farm: {
        ...defaultSave.farm,
        plots: [
          {
            id: 'plot-0-0',
            row: 0,
            col: 0,
            hydratedUntilUtcMs: 1000,
            crop: {
              cropId: 'carrot' as const,
              plantedAtUtcMs: 1000,
              growthProgressSec: 10,
              mutation: 'nuclear' as unknown as 'gold',
              placement: { bedId: 'north-west' as const, localX: 0, localZ: 0 },
            },
          },
        ],
      },
    };
    expect(safeParseSaveEnvelope(invalidMutation).success).toBe(false);

    const invalidPet = {
      ...defaultSave,
      inventory: {
        ...defaultSave.inventory,
        pets: [{ id: 'pet-1', type: 'dragon' as unknown as 'dog', acquiredAtUtcMs: 1000 }],
      },
    };
    expect(safeParseSaveEnvelope(invalidPet).success).toBe(false);

    const invalidEgg = {
      ...defaultSave,
      inventory: {
        ...defaultSave.inventory,
        eggs: [
          {
            id: 'egg-1',
            type: 'legendary' as unknown as 'common',
            purchasedAtUtcMs: 1000,
            outcome: 'dog' as const,
            incubating: false,
            elapsedIncubationSec: 0,
            distanceTraveled: 0,
          },
        ],
      },
    };
    expect(safeParseSaveEnvelope(invalidEgg).success).toBe(false);
  });

  it('rejects negative seed inventory and negative produce quantity', () => {
    const defaultSave = createDefaultSaveEnvelope();

    const negativeSeed = {
      ...defaultSave,
      inventory: {
        ...defaultSave.inventory,
        seeds: { ...defaultSave.inventory.seeds, carrot: -5 },
      },
    };
    expect(safeParseSaveEnvelope(negativeSeed).success).toBe(false);

    const negativeProduce = {
      ...defaultSave,
      inventory: {
        ...defaultSave.inventory,
        produce: [{ cropId: 'carrot' as const, mutation: 'none' as const, quantity: -2 }],
      },
    };
    expect(safeParseSaveEnvelope(negativeProduce).success).toBe(false);
  });

  it('requires placement on every active crop and enforces bed-local bounds', () => {
    const defaultSave = createDefaultSaveEnvelope();

    const missingPlacement = {
      ...defaultSave,
      farm: {
        ...defaultSave.farm,
        plots: defaultSave.farm.plots.map((p, i) =>
          i === 0
            ? {
                ...p,
                crop: {
                  cropId: 'carrot' as const,
                  plantedAtUtcMs: 1000,
                  growthProgressSec: 0,
                  mutation: 'none' as const,
                },
              }
            : p
        ),
      },
    };
    expect(safeParseSaveEnvelope(missingPlacement).success).toBe(false);

    const outOfBounds = {
      ...defaultSave,
      farm: {
        ...defaultSave.farm,
        plots: defaultSave.farm.plots.map((p, i) =>
          i === 0
            ? {
                ...p,
                crop: {
                  cropId: 'carrot' as const,
                  plantedAtUtcMs: 1000,
                  growthProgressSec: 0,
                  mutation: 'none' as const,
                  placement: { bedId: 'north-west' as const, localX: 3.1, localZ: 0 },
                },
              }
            : p
        ),
      },
    };
    expect(safeParseSaveEnvelope(outOfBounds).success).toBe(false);
  });

  it('rounds persisted free placement to three decimals', () => {
    const save = createDefaultSaveEnvelope(1000, 7);
    save.farm.plots[0].crop = {
      cropId: 'carrot',
      plantedAtUtcMs: 1000,
      growthProgressSec: 0,
      mutation: 'none',
      placement: { bedId: 'south-east', localX: 0.12349, localZ: -0.98751 },
    };
    const parsed = parseSaveEnvelope(save);
    expect(parsed.farm.plots[0].crop?.placement).toEqual({
      bedId: 'south-east',
      localX: 0.123,
      localZ: -0.988,
    });
    expect('tilled' in parsed.farm.plots[0]).toBe(false);
  });

  it('strips or ignores unknown extra top-level and nested properties gracefully', () => {
    const defaultSave = createDefaultSaveEnvelope();
    const saveWithExtras = {
      ...defaultSave,
      unknownExtraField: 'some_junk',
      player: {
        ...defaultSave.player,
        extraPlayerField: 12345,
      },
    };

    const result = saveEnvelopeSchema.safeParse(saveWithExtras);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as unknown as Record<string, unknown>).unknownExtraField).toBeUndefined();
    }
  });

  it('validates pet and egg data structures with equipped references', () => {
    const defaultSave = createDefaultSaveEnvelope();
    const saveWithPetsAndEggs: SaveEnvelope = {
      ...defaultSave,
      inventory: {
        ...defaultSave.inventory,
        pets: [
          { id: 'pet-dog-1', type: 'dog', acquiredAtUtcMs: 1700000000000 },
          { id: 'pet-bee-1', type: 'bee', acquiredAtUtcMs: 1700000001000 },
        ],
        equippedPetId: 'pet-dog-1',
        eggs: [
          {
            id: 'egg-rare-1',
            type: 'rare',
            purchasedAtUtcMs: 1700000002000,
            outcome: 'pig',
            incubating: true,
            elapsedIncubationSec: 45,
            distanceTraveled: 60,
          },
        ],
        incubatingEggId: 'egg-rare-1',
      },
    };

    const parsed = parseSaveEnvelope(saveWithPetsAndEggs);
    expect(parsed.inventory.equippedPetId).toBe('pet-dog-1');
    expect(parsed.inventory.incubatingEggId).toBe('egg-rare-1');
    expect(parsed.inventory.pets.length).toBe(2);
    expect(parsed.inventory.eggs.length).toBe(1);
  });
});
