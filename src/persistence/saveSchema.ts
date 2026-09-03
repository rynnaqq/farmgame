import { z } from 'zod';
import type { SaveEnvelope } from '../state/storeTypes';
import {
  STARTING_COINS,
  STARTING_SEEDS,
  PLAYER_SPAWN_POSITION,
  CURRENT_SCHEMA_VERSION,
} from '../game/core/constants';
import { generateDefaultPlots } from '../state/gameStore';

export const cropIdSchema = z.enum(['carrot', 'tomato', 'pumpkin', 'golden_berry', 'starfruit']);
export const weatherTypeSchema = z.enum(['sunny', 'heavy_rain', 'heatwave', 'blood_moon']);
export const mutationTypeSchema = z.enum(['none', 'gold', 'giant', 'cosmic']);
export const petTypeSchema = z.enum(['dog', 'bee', 'pig']);
export const eggTypeSchema = z.enum(['common', 'rare']);

const round3 = (value: number) => Math.round(value * 1000) / 1000;

export const cropPlacementSchema = z.object({
  bedId: z.enum(['north-west', 'north-east', 'south-west', 'south-east']),
  localX: z.number().finite().min(-2.55).max(2.55).transform(round3),
  localZ: z.number().finite().min(-2.25).max(2.25).transform(round3),
});

export const cropDataSchema = z.object({
  cropId: cropIdSchema,
  plantedAtUtcMs: z.number().int().nonnegative().finite(),
  growthProgressSec: z.number().nonnegative().finite(),
  mutation: mutationTypeSchema,
  placement: cropPlacementSchema,
});

export const plotDataSchema = z.object({
  id: z.string().min(1),
  row: z.number().int().min(0).max(7),
  col: z.number().int().min(0).max(7),
  crop: cropDataSchema.nullable(),
  hydratedUntilUtcMs: z.number().int().nonnegative().finite(),
});

export const produceStackSchema = z.object({
  cropId: cropIdSchema,
  mutation: mutationTypeSchema,
  quantity: z.number().int().positive().finite(),
});

export const petDataSchema = z.object({
  id: z.string().min(1),
  type: petTypeSchema,
  acquiredAtUtcMs: z.number().int().nonnegative().finite(),
});

export const eggDataSchema = z.object({
  id: z.string().min(1),
  type: eggTypeSchema,
  purchasedAtUtcMs: z.number().int().nonnegative().finite(),
  outcome: petTypeSchema,
  incubating: z.boolean(),
  elapsedIncubationSec: z.number().nonnegative().finite(),
  distanceTraveled: z.number().nonnegative().finite(),
});

export const playerSaveSchema = z.object({
  position: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
  coins: z.number().int().nonnegative().finite(),
  totalDistance: z.number().nonnegative().finite(),
});

export const farmSaveSchema = z.object({
  gridSize: z.literal(8),
  plots: z.array(plotDataSchema).length(64),
  goldenWateringCanOwned: z.boolean(),
});

export const seedsSaveSchema = z.object({
  carrot: z.number().int().nonnegative().finite(),
  tomato: z.number().int().nonnegative().finite(),
  pumpkin: z.number().int().nonnegative().finite(),
  golden_berry: z.number().int().nonnegative().finite(),
  starfruit: z.number().int().nonnegative().finite(),
});

export const inventorySaveSchema = z.object({
  seeds: seedsSaveSchema,
  produce: z.array(produceStackSchema),
  eggs: z.array(eggDataSchema),
  pets: z.array(petDataSchema),
  equippedPetId: z.string().nullable(),
  incubatingEggId: z.string().nullable(),
});

export const weatherSaveSchema = z.object({
  current: weatherTypeSchema,
  startedAtUtcMs: z.number().int().nonnegative().finite(),
  endsAtUtcMs: z.number().int().nonnegative().finite(),
  previousWeather: weatherTypeSchema.nullable().optional(),
});

export const tutorialSaveSchema = z.object({
  completedSteps: z.array(z.string()),
  dismissed: z.boolean(),
});

export const saveEnvelopeSchema = z.object({
  schemaVersion: z.literal(2),
  savedAtUtcMs: z.number().int().nonnegative().finite(),
  player: playerSaveSchema,
  farm: farmSaveSchema,
  inventory: inventorySaveSchema,
  weather: weatherSaveSchema,
  rngState: z.number().finite(),
  tutorial: tutorialSaveSchema,
});

export type ValidatedSaveEnvelope = z.infer<typeof saveEnvelopeSchema>;

/**
 * Private schema describing legacy version-1 payloads (old 4/6/8 grid farms with
 * a `tilled` flag and crops that carry no placement). Used exclusively as
 * migration input; runtime and persistence only ever produce version 2.
 */
const legacyPlotDataSchema = z.object({
  id: z.string().min(1),
  row: z.number().int().nonnegative().finite(),
  col: z.number().int().nonnegative().finite(),
  tilled: z.boolean().optional(),
  crop: cropDataSchema.omit({ placement: true }).nullable(),
  hydratedUntilUtcMs: z.number().int().nonnegative().finite(),
});

const versionOneEnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  savedAtUtcMs: z.number().int().nonnegative().finite(),
  player: playerSaveSchema,
  farm: z.object({
    gridSize: z.union([z.literal(4), z.literal(6), z.literal(8)]),
    plots: z.array(legacyPlotDataSchema),
    goldenWateringCanOwned: z.boolean(),
  }),
  inventory: inventorySaveSchema,
  weather: weatherSaveSchema,
  rngState: z.number().finite(),
  tutorial: tutorialSaveSchema,
});

export type VersionOneEnvelope = z.infer<typeof versionOneEnvelopeSchema>;

export function parseVersionOneEnvelope(data: unknown): VersionOneEnvelope {
  return versionOneEnvelopeSchema.parse(data);
}

export function safeParseSaveEnvelope(data: unknown): z.SafeParseReturnType<unknown, SaveEnvelope> {
  return saveEnvelopeSchema.safeParse(data) as z.SafeParseReturnType<unknown, SaveEnvelope>;
}

export function validateSaveEnvelope(
  data: unknown
): { success: true; data: SaveEnvelope } | { success: false; error: z.ZodError } {
  const result = saveEnvelopeSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data as SaveEnvelope };
  }
  return { success: false, error: result.error };
}

export function parseSaveEnvelope(data: unknown): SaveEnvelope {
  return saveEnvelopeSchema.parse(data) as SaveEnvelope;
}

export function isSaveEnvelopeValid(data: unknown): boolean {
  return saveEnvelopeSchema.safeParse(data).success;
}

export function createDefaultSaveEnvelope(
  savedAtUtcMs: number = Date.now(),
  initialSeed: number = 1
): SaveEnvelope {
  const defaultPlotsMap = generateDefaultPlots();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    savedAtUtcMs,
    player: {
      position: [...PLAYER_SPAWN_POSITION] as [number, number, number],
      coins: STARTING_COINS,
      totalDistance: 0,
    },
    farm: {
      gridSize: 8,
      plots: Object.values(defaultPlotsMap),
      goldenWateringCanOwned: false,
    },
    inventory: {
      seeds: { ...STARTING_SEEDS },
      produce: [],
      eggs: [],
      pets: [],
      equippedPetId: null,
      incubatingEggId: null,
    },
    weather: {
      current: 'sunny',
      startedAtUtcMs: savedAtUtcMs,
      endsAtUtcMs: savedAtUtcMs + 240 * 1000,
      previousWeather: null,
    },
    rngState: initialSeed,
    tutorial: {
      completedSteps: [],
      dismissed: false,
    },
  };
}
