import type {
  PlotData,
  PlotId,
  WeatherState,
  WeatherType,
  MutationType,
} from '../../state/storeTypes';
import type { SeededRNG } from '../core/rng';
import {
  ALL_WEATHER_TYPES,
  INITIAL_WEATHER,
  RAIN_HYDRATION_BUFFER_MS,
  WEATHER_CONFIGS,
  WEATHER_DURATION_MAX_SEC,
  WEATHER_DURATION_MIN_SEC,
  WEATHER_TRANSITION_DURATION_MS,
  type WeatherDefinition,
} from './weatherDefinitions';

/**
 * Creates the initial weather state for a new game or uninitialized state.
 * Initial weather is always Sunny, lasting a randomized duration between 180s and 300s.
 */
export function createInitialWeatherState(nowMs: number, rng?: SeededRNG): WeatherState {
  const durationSeconds = rng
    ? rng.range(WEATHER_DURATION_MIN_SEC, WEATHER_DURATION_MAX_SEC)
    : 240;

  return {
    current: INITIAL_WEATHER,
    startedAtUtcMs: nowMs,
    endsAtUtcMs: nowMs + durationSeconds * 1000,
    previousWeather: null,
  };
}

/**
 * Selects the next weather state deterministically using weighted random distribution,
 * strictly excluding the current weather to guarantee no consecutive repeats.
 */
export function rollNextWeather(
  currentWeather: WeatherType,
  rng: SeededRNG
): { nextWeather: WeatherType; durationSeconds: number } {
  // Exclude current weather to enforce the strict non-repeat invariant
  const candidateTypes = ALL_WEATHER_TYPES.filter((w) => w !== currentWeather);

  const candidateWeights = candidateTypes.map((type) => ({
    type,
    weight: WEATHER_CONFIGS[type].weight,
  }));

  const totalWeight = candidateWeights.reduce((acc, item) => acc + item.weight, 0);
  const roll = rng.nextFloat() * totalWeight;

  let accumulated = 0;
  let selectedWeather: WeatherType = candidateTypes[0];

  for (const item of candidateWeights) {
    accumulated += item.weight;
    if (roll < accumulated) {
      selectedWeather = item.type;
      break;
    }
  }

  const durationSeconds = rng.range(WEATHER_DURATION_MIN_SEC, WEATHER_DURATION_MAX_SEC);

  return {
    nextWeather: selectedWeather,
    durationSeconds,
  };
}

export interface AdvanceWeatherResult {
  state: WeatherState;
  transitioned: boolean;
}

/**
 * Advances weather state based on elapsed time.
 * If the current weather duration has expired (nowMs >= endsAtUtcMs), rolls the next weather state.
 */
export function advanceWeather(
  weatherState: WeatherState,
  _deltaSeconds: number,
  rng: SeededRNG,
  nowMs: number
): AdvanceWeatherResult {
  if (nowMs < weatherState.endsAtUtcMs) {
    return {
      state: weatherState,
      transitioned: false,
    };
  }

  const { nextWeather, durationSeconds } = rollNextWeather(weatherState.current, rng);

  const nextState: WeatherState = {
    current: nextWeather,
    startedAtUtcMs: nowMs,
    endsAtUtcMs: nowMs + durationSeconds * 1000,
    previousWeather: weatherState.current,
  };

  return {
    state: nextState,
    transitioned: true,
  };
}

/**
 * Applies weather-induced hydration to farm plots.
 * Heavy Rain continuously hydrates all tilled plots and guarantees hydration
 * persists until 20 seconds after the rain ends (weatherEndMs + 20s buffer).
 * Untilled plots do not hold hydration.
 */
export function applyWeatherHydration(
  plots: Record<PlotId, PlotData>,
  weather: WeatherType,
  weatherEndMs: number,
  _nowMs: number
): Record<PlotId, PlotData> {
  if (weather !== 'heavy_rain') {
    return plots;
  }

  const targetHydrationExpiry = weatherEndMs + RAIN_HYDRATION_BUFFER_MS;
  let hasChanges = false;
  const updatedPlots: Record<PlotId, PlotData> = {};

  for (const plotId of Object.keys(plots)) {
    const plot = plots[plotId];
    if (plot.tilled && plot.hydratedUntilUtcMs < targetHydrationExpiry) {
      hasChanges = true;
      updatedPlots[plotId] = {
        ...plot,
        hydratedUntilUtcMs: targetHydrationExpiry,
      };
    } else {
      updatedPlots[plotId] = plot;
    }
  }

  return hasChanges ? updatedPlots : plots;
}

/**
 * Returns the manual hydration duration (in seconds) applied by the watering can under active weather.
 * Heatwave reduces duration to 60 seconds; all other weathers use standard 120 seconds.
 */
export function getManualWaterDuration(weather: WeatherType): number {
  const config = WEATHER_CONFIGS[weather];
  return config ? config.manualWaterDurationSec : 120;
}

/**
 * Returns the manual hydration duration in milliseconds.
 */
export function getManualWaterDurationMs(weather: WeatherType): number {
  return getManualWaterDuration(weather) * 1000;
}

/**
 * Retrieves the growth multiplier for a given weather type.
 */
export function getWeatherGrowthMultiplier(weather: WeatherType): number {
  const config = WEATHER_CONFIGS[weather];
  return config ? config.growthMultiplier : 1.0;
}

/**
 * Retrieves the mutation config (type and chance) for a given weather type.
 */
export function getWeatherMutationConfig(weather: WeatherType): {
  mutationType: MutationType;
  chance: number;
} {
  const config = WEATHER_CONFIGS[weather] ?? WEATHER_CONFIGS.sunny;
  return {
    mutationType: config.mutationType,
    chance: config.mutationChance,
  };
}

/**
 * Computes remaining time in milliseconds for the current weather period.
 */
export function getWeatherRemainingMs(weatherState: WeatherState, nowMs: number): number {
  return Math.max(0, weatherState.endsAtUtcMs - nowMs);
}

/**
 * Checks whether the weather is currently in its visual crossfade transition window.
 */
export function isWeatherTransitioning(
  weatherState: WeatherState,
  nowMs: number,
  transitionDurationMs: number = WEATHER_TRANSITION_DURATION_MS
): boolean {
  if (!weatherState.previousWeather) {
    return false;
  }
  return nowMs - weatherState.startedAtUtcMs <= transitionDurationMs;
}

/**
 * Retrieves the complete configuration definition for a weather type.
 */
export function getWeatherDefinition(weather: WeatherType): WeatherDefinition {
  return WEATHER_CONFIGS[weather] ?? WEATHER_CONFIGS.sunny;
}
