import type {
  CropId,
  MutationType,
  PetType,
  PlotData,
  PlotId,
  WeatherType,
} from '../../state/storeTypes';
import { PET_PERKS, WEATHER_CONFIGS } from '../core/constants';
import type { SeededRNG } from '../core/rng';
import { getCropDefinition } from './cropDefinitions';

/**
 * Retrieves the base growth multiplier for the active weather type.
 * Sunny: 1.0, Heavy Rain: 1.15, Heatwave: 1.25, Blood Moon: 1.05
 */
export function getWeatherGrowthMultiplier(weather: WeatherType): number {
  const config = WEATHER_CONFIGS[weather];
  return config ? config.growthMultiplier : 1.0;
}

/**
 * Retrieves the growth speed multiplier granted by the equipped companion pet.
 * Bee: 1.15x growth speed.
 */
export function getPetGrowthMultiplier(equippedPet: PetType | null): number {
  if (equippedPet === 'bee') {
    return PET_PERKS.bee.growthSpeedMultiplier;
  }
  return 1.0;
}

/**
 * Computes the combined effective growth multiplier.
 * effectiveGrowthDelta = hydratedDelta * weatherGrowthMultiplier * petGrowthMultiplier
 */
export function getEffectiveGrowthMultiplier(
  weather: WeatherType,
  equippedPet: PetType | null
): number {
  return getWeatherGrowthMultiplier(weather) * getPetGrowthMultiplier(equippedPet);
}

/**
 * Evaluates whether a plot is hydrated and eligible to advance growth.
 * - Heavy rain automatically hydrates all plots.
 * - Otherwise, plot must have active hydration (hydratedUntilUtcMs > nowMs).
 */
export function isPlotHydratedForGrowth(
  plot: PlotData,
  weather: WeatherType,
  nowMs: number
): boolean {
  return weather === 'heavy_rain' || plot.hydratedUntilUtcMs > nowMs;
}

/**
 * Evaluates the mutation target and chance for a crop maturing under the current conditions.
 * Pig pet provides a +20% relative bonus to mutation probability.
 */
export function getMutationChance(
  weather: WeatherType,
  equippedPet: PetType | null
): { mutationType: MutationType; chance: number } {
  const config = WEATHER_CONFIGS[weather] ?? WEATHER_CONFIGS.sunny;
  let chance = config.mutationChance;
  if (equippedPet === 'pig') {
    chance *= PET_PERKS.pig.mutationChanceMultiplier;
  }
  return {
    mutationType: config.mutationType,
    chance: Math.max(0, Math.min(1.0, chance)),
  };
}

/**
 * Performs a deterministic mutation roll at crop maturity using exactly 1 float from SeededRNG.
 */
export function rollMutation(
  weather: WeatherType,
  equippedPet: PetType | null,
  rng: SeededRNG
): MutationType {
  const { mutationType, chance } = getMutationChance(weather, equippedPet);
  const roll = rng.nextFloat();
  if (roll < chance) {
    return mutationType;
  }
  return 'none';
}

export interface AdvancePlotGrowthResult {
  plot: PlotData;
  matured: boolean;
}

/**
 * Advances growth simulation for a single plot over a fixed or variable delta time.
 * - Dry plots experience zero growth progress.
 * - Growth progress is clamped to crop baseGrowthSec.
 * - Triggers mutation roll exactly once when progress transitions from < 100% to 100%.
 * - Never re-rolls mutation on subsequent ticks once mature.
 */
export function advancePlotGrowth(
  plot: PlotData,
  deltaSeconds: number,
  weather: WeatherType,
  equippedPet: PetType | null,
  rng: SeededRNG,
  nowMs: number
): AdvancePlotGrowthResult {
  if (!plot.crop || deltaSeconds <= 0) {
    return { plot, matured: false };
  }

  const cropDef = getCropDefinition(plot.crop.cropId);
  if (!cropDef) {
    return { plot, matured: false };
  }

  const currentProgress = plot.crop.growthProgressSec;
  const targetDuration = cropDef.baseGrowthSec;

  // Already mature: do not advance or re-trigger maturity
  if (currentProgress >= targetDuration) {
    return { plot, matured: false };
  }

  // Check hydration requirement
  const hydrated = isPlotHydratedForGrowth(plot, weather, nowMs);
  if (!hydrated) {
    return { plot, matured: false };
  }

  const growthMultiplier = getEffectiveGrowthMultiplier(weather, equippedPet);
  const effectiveGrowthDelta = deltaSeconds * growthMultiplier;
  const newProgress = Math.min(targetDuration, currentProgress + effectiveGrowthDelta);
  const didMature = newProgress >= targetDuration;

  let finalMutation = plot.crop.mutation;
  if (didMature) {
    finalMutation = rollMutation(weather, equippedPet, rng);
  }

  const updatedPlot: PlotData = {
    ...plot,
    crop: {
      ...plot.crop,
      growthProgressSec: newProgress,
      mutation: finalMutation,
    },
  };

  return {
    plot: updatedPlot,
    matured: didMature,
  };
}

export interface MaturedPlotEvent {
  plotId: PlotId;
  cropId: CropId;
  mutation: MutationType;
}

export interface TickFarmGrowthResult {
  updatedPlots: Record<PlotId, PlotData>;
  maturedPlots: MaturedPlotEvent[];
}

/**
 * Advances growth for all plots on the farm in deterministic order, collecting any maturity events.
 */
export function tickFarmGrowth(
  plots: Record<PlotId, PlotData>,
  deltaSeconds: number,
  weather: WeatherType,
  equippedPet: PetType | null,
  rng: SeededRNG,
  nowMs: number
): TickFarmGrowthResult {
  const updatedPlots: Record<PlotId, PlotData> = {};
  const maturedPlots: MaturedPlotEvent[] = [];

  // Sort plot IDs to guarantee deterministic iteration order and RNG consumption
  const sortedPlotIds = Object.keys(plots).sort();

  for (const plotId of sortedPlotIds) {
    const originalPlot = plots[plotId];
    const { plot, matured } = advancePlotGrowth(
      originalPlot,
      deltaSeconds,
      weather,
      equippedPet,
      rng,
      nowMs
    );

    updatedPlots[plotId] = plot;

    if (matured && plot.crop) {
      maturedPlots.push({
        plotId,
        cropId: plot.crop.cropId,
        mutation: plot.crop.mutation,
      });
    }
  }

  return {
    updatedPlots,
    maturedPlots,
  };
}
