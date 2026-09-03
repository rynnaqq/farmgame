import type {
  SaveEnvelope,
  PlotData,
  PlotId,
  CropId,
  MutationType,
  PetType,
  WeatherState,
  ProduceStack,
  PetData,
} from '../state/storeTypes';

import { SeededRNG } from '../game/core/rng';
import {
  MAX_OFFLINE_PROGRESSION_MS,
  DOG_OFFLINE_HARVEST_DELAY_SEC,
  EGG_HATCH_TIME_SEC,
  RAIN_HYDRATION_BUFFER_MS,
} from '../game/core/constants';
import { getCropDefinition } from '../game/farming/cropDefinitions';
import {
  getEffectiveGrowthMultiplier,
  isPlotHydratedForGrowth,
  rollMutation,
} from '../game/farming/growthSystem';
import { rollNextWeather } from '../game/weather/weatherSystem';

export interface MaturedCropSummary {
  cropId: CropId;
  mutation: MutationType;
  count: number;
}

export interface HatchedPetSummary {
  petId: string;
  type: PetType;
}

export interface OfflineSummaryData {
  elapsedMs: number;
  formattedElapsed: string;
  maturedCrops: MaturedCropSummary[];
  totalMaturedCount: number;
  mutations: Array<{ cropId: CropId; mutation: MutationType; count: number }>;
  dogHarvestsCount: number;
  dogHarvests: MaturedCropSummary[];
  hatchedPets: HatchedPetSummary[];
  shouldDisplay: boolean;
  clockMovedBackward?: boolean;
}

export interface OfflineSimulationResult {
  updatedEnvelope: SaveEnvelope;
  summary: OfflineSummaryData;
}

/**
 * Formats elapsed millisecond duration into a clean human-readable string.
 * Examples:
 * - 45,000ms -> "45s"
 * - 90,000ms -> "1m 30s"
 * - 120,000ms -> "2m"
 * - 3,600,000ms -> "1h"
 * - 5,400,000ms -> "1h 30m"
 * - 86,400,000ms -> "24h"
 */
export function formatOfflineDuration(ms: number): string {
  const safeMs = Math.max(0, Math.floor(ms));
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

interface InternalMaturedEvent {
  plotId: PlotId;
  cropId: CropId;
  mutation: MutationType;
}

interface InternalDogHarvest {
  plotId: PlotId;
  cropId: CropId;
  mutation: MutationType;
  harvestAtMs: number;
}

/**
 * Deterministically simulates offline progress using event-boundary progression:
 * - Clamps elapsed time: clamp(nowUtcMs - savedAtUtcMs, 0, 24h).
 * - Backward clock protection: 0ms elapsed, non-blocking warning, saves current nowUtcMs.
 * - Deterministic weather reconstruction with SeededRNG replay.
 * - Hydration windows & Heavy Rain automatic farm hydration.
 * - Companion pet perks (Bee growth multiplier, Pig mutation multiplier, Dog auto-harvest).
 * - Maturity triggers and mutation rolls at the exact moment progress reaches 100%.
 * - Egg incubation progression and auto-hatching/equipping.
 * - Idempotent result commitment.
 */
export function simulateOfflineProgression(
  saveEnvelope: SaveEnvelope,
  nowUtcMs: number = Date.now()
): OfflineSimulationResult {
  const rawElapsedMs = nowUtcMs - saveEnvelope.savedAtUtcMs;

  // 1. Clock moved backward
  if (rawElapsedMs < 0) {
    const updatedEnvelope: SaveEnvelope = {
      ...saveEnvelope,
      savedAtUtcMs: nowUtcMs,
    };
    return {
      updatedEnvelope,
      summary: {
        elapsedMs: 0,
        formattedElapsed: '0s',
        maturedCrops: [],
        totalMaturedCount: 0,
        mutations: [],
        dogHarvestsCount: 0,
        dogHarvests: [],
        hatchedPets: [],
        shouldDisplay: false,
        clockMovedBackward: true,
      },
    };
  }

  // 2. Zero elapsed time (immediate reload / no offline duration)
  if (rawElapsedMs === 0) {
    const updatedEnvelope: SaveEnvelope = {
      ...saveEnvelope,
      savedAtUtcMs: nowUtcMs,
    };
    return {
      updatedEnvelope,
      summary: {
        elapsedMs: 0,
        formattedElapsed: '0s',
        maturedCrops: [],
        totalMaturedCount: 0,
        mutations: [],
        dogHarvestsCount: 0,
        dogHarvests: [],
        hatchedPets: [],
        shouldDisplay: false,
      },
    };
  }

  // 3. Cap credited offline time at 24 hours (86,400,000 ms)
  const elapsedMs = Math.min(rawElapsedMs, MAX_OFFLINE_PROGRESSION_MS);
  const simStartMs = saveEnvelope.savedAtUtcMs;
  const simEndMs = simStartMs + elapsedMs;

  // Working state initialization
  const rng = new SeededRNG(saveEnvelope.rngState);
  const weather: WeatherState = {
    ...saveEnvelope.weather,
    previousWeather: saveEnvelope.weather.previousWeather ?? null,
  };

  const plots: Record<PlotId, PlotData> = {};
  const initiallyMaturePlotIds = new Set<PlotId>();

  for (const plot of saveEnvelope.farm.plots) {
    const clonedPlot: PlotData = {
      ...plot,
      crop: plot.crop ? { ...plot.crop } : null,
    };
    plots[plot.id] = clonedPlot;

    if (clonedPlot.crop) {
      const def = getCropDefinition(clonedPlot.crop.cropId);
      if (def && clonedPlot.crop.growthProgressSec >= def.baseGrowthSec) {
        initiallyMaturePlotIds.add(clonedPlot.id);
      }
    }
  }

  const inventory = {
    seeds: { ...saveEnvelope.inventory.seeds },
    produce: saveEnvelope.inventory.produce.map((p) => ({ ...p })),
    eggs: saveEnvelope.inventory.eggs.map((e) => ({ ...e })),
    pets: saveEnvelope.inventory.pets.map((p) => ({ ...p })),
    equippedPetId: saveEnvelope.inventory.equippedPetId,
    incubatingEggId: saveEnvelope.inventory.incubatingEggId,
  };

  const getEquippedPetType = (): PetType | null => {
    if (!inventory.equippedPetId) return null;
    const pet = inventory.pets.find((p) => p.id === inventory.equippedPetId);
    return pet ? pet.type : null;
  };

  const maturedEvents: InternalMaturedEvent[] = [];
  const dogHarvestsList: ProduceStack[] = [];
  const hatchedPetsList: HatchedPetSummary[] = [];
  const pendingDogHarvests = new Map<PlotId, InternalDogHarvest>();

  // If Dog is equipped from the beginning, schedule Dog harvests for already-mature plots
  if (getEquippedPetType() === 'dog') {
    for (const plotId of initiallyMaturePlotIds) {
      const plot = plots[plotId];
      if (plot && plot.crop) {
        pendingDogHarvests.set(plotId, {
          plotId,
          cropId: plot.crop.cropId,
          mutation: plot.crop.mutation,
          harvestAtMs: simStartMs + DOG_OFFLINE_HARVEST_DELAY_SEC * 1000,
        });
      }
    }
  }

  let currentTime = simStartMs;

  // Chronological Event Boundary Simulation Loop
  while (currentTime < simEndMs) {
    const currentWeather = weather.current;
    const equippedPet = getEquippedPetType();
    const growthMult = getEffectiveGrowthMultiplier(currentWeather, equippedPet);

    // 1. Identify earliest upcoming event boundary
    let nextEventTime = simEndMs;

    // Boundary: Weather expiration
    if (weather.endsAtUtcMs > currentTime) {
      nextEventTime = Math.min(nextEventTime, weather.endsAtUtcMs);
    }

    // Boundary: Incubating egg completion
    const incubatingEgg = inventory.incubatingEggId
      ? inventory.eggs.find((e) => e.id === inventory.incubatingEggId && e.incubating)
      : null;

    if (incubatingEgg && incubatingEgg.elapsedIncubationSec < EGG_HATCH_TIME_SEC) {
      const remSec = EGG_HATCH_TIME_SEC - incubatingEgg.elapsedIncubationSec;
      const hatchAtMs = currentTime + remSec * 1000;
      if (hatchAtMs > currentTime) {
        nextEventTime = Math.min(nextEventTime, hatchAtMs);
      }
    }

    // Boundary: Plot hydration expiry & crop maturity
    const plotIds = Object.keys(plots);
    for (const plotId of plotIds) {
      const plot = plots[plotId];
      if (!plot.crop) continue;

      const cropDef = getCropDefinition(plot.crop.cropId);
      if (!cropDef || plot.crop.growthProgressSec >= cropDef.baseGrowthSec) continue;

      if (currentWeather === 'heavy_rain') {
        const remGrowthSec = cropDef.baseGrowthSec - plot.crop.growthProgressSec;
        const timeToMatureMs = (remGrowthSec / growthMult) * 1000;
        const matureAtMs = currentTime + timeToMatureMs;
        if (matureAtMs > currentTime) {
          nextEventTime = Math.min(nextEventTime, matureAtMs);
        }
      } else {
        if (plot.hydratedUntilUtcMs > currentTime) {
          nextEventTime = Math.min(nextEventTime, plot.hydratedUntilUtcMs);

          const remGrowthSec = cropDef.baseGrowthSec - plot.crop.growthProgressSec;
          const timeToMatureMs = (remGrowthSec / growthMult) * 1000;
          const matureAtMs = currentTime + timeToMatureMs;
          if (matureAtMs > currentTime && matureAtMs <= plot.hydratedUntilUtcMs) {
            nextEventTime = Math.min(nextEventTime, matureAtMs);
          }
        }
      }
    }

    // Boundary: Dog auto-harvests
    for (const harvest of pendingDogHarvests.values()) {
      if (harvest.harvestAtMs > currentTime) {
        nextEventTime = Math.min(nextEventTime, harvest.harvestAtMs);
      }
    }

    // Advance timeline to next event boundary
    const dtMs = nextEventTime - currentTime;
    if (dtMs > 0) {
      const dtSec = dtMs / 1000;

      // Advance egg incubation
      if (incubatingEgg) {
        incubatingEgg.elapsedIncubationSec = Math.min(
          EGG_HATCH_TIME_SEC,
          incubatingEgg.elapsedIncubationSec + dtSec
        );
      }

      // Advance plot growth
      for (const plotId of plotIds) {
        const plot = plots[plotId];
        if (!plot.crop) continue;

        const cropDef = getCropDefinition(plot.crop.cropId);
        if (!cropDef || plot.crop.growthProgressSec >= cropDef.baseGrowthSec) continue;

        const isHydrated = isPlotHydratedForGrowth(plot, currentWeather, currentTime);
        if (isHydrated) {
          const deltaGrowth = dtSec * growthMult;
          plot.crop.growthProgressSec = Math.min(
            cropDef.baseGrowthSec,
            plot.crop.growthProgressSec + deltaGrowth
          );
        }
      }

      currentTime = nextEventTime;
    }

    // 2. Process triggers active at currentTime

    // A. Egg hatching
    if (incubatingEgg && incubatingEgg.elapsedIncubationSec >= EGG_HATCH_TIME_SEC) {
      const eggIndex = inventory.eggs.findIndex((e) => e.id === incubatingEgg.id);
      if (eggIndex >= 0) {
        inventory.eggs.splice(eggIndex, 1);
      }
      inventory.incubatingEggId = null;

      const newPet: PetData = {
        id: `pet-${incubatingEgg.outcome}-${currentTime}-${inventory.pets.length + 1}-${rng.getState()}`,
        type: incubatingEgg.outcome,
        acquiredAtUtcMs: currentTime,
      };

      inventory.pets.push(newPet);
      hatchedPetsList.push({ petId: newPet.id, type: newPet.type });

      // Auto-equip if no pet is currently equipped
      if (!inventory.equippedPetId) {
        inventory.equippedPetId = newPet.id;

        // If newly hatched pet is Dog, schedule harvests for any existing mature crops
        if (newPet.type === 'dog') {
          for (const plotId of Object.keys(plots)) {
            const plot = plots[plotId];
            if (plot.crop) {
              const cropDef = getCropDefinition(plot.crop.cropId);
              if (cropDef && plot.crop.growthProgressSec >= cropDef.baseGrowthSec) {
                if (!pendingDogHarvests.has(plot.id)) {
                  pendingDogHarvests.set(plot.id, {
                    plotId: plot.id,
                    cropId: plot.crop.cropId,
                    mutation: plot.crop.mutation,
                    harvestAtMs: currentTime + DOG_OFFLINE_HARVEST_DELAY_SEC * 1000,
                  });
                }
              }
            }
          }
        }
      }
    }

    // B. Crop maturity and mutation rolls in deterministic sorted plot order
    const sortedPlotIds = Object.keys(plots).sort();
    for (const plotId of sortedPlotIds) {
      const plot = plots[plotId];
      if (!plot.crop) continue;

      const cropDef = getCropDefinition(plot.crop.cropId);
      if (!cropDef) continue;

      if (plot.crop.growthProgressSec >= cropDef.baseGrowthSec) {
        const isAlreadyHandled =
          initiallyMaturePlotIds.has(plotId) || maturedEvents.some((e) => e.plotId === plotId);

        if (!isAlreadyHandled) {
          const rolledMutation = rollMutation(currentWeather, getEquippedPetType(), rng);
          plot.crop.mutation = rolledMutation;

          maturedEvents.push({
            plotId,
            cropId: plot.crop.cropId,
            mutation: rolledMutation,
          });

          if (getEquippedPetType() === 'dog') {
            pendingDogHarvests.set(plotId, {
              plotId,
              cropId: plot.crop.cropId,
              mutation: rolledMutation,
              harvestAtMs: currentTime + DOG_OFFLINE_HARVEST_DELAY_SEC * 1000,
            });
          }
        }
      }
    }

    // C. Dog auto-harvest execution
    if (getEquippedPetType() === 'dog') {
      const readyHarvestEntries = Array.from(pendingDogHarvests.entries()).filter(
        ([_, harvest]) => harvest.harvestAtMs <= currentTime
      );

      for (const [plotId, harvest] of readyHarvestEntries) {
        const plot = plots[plotId];
        if (plot && plot.crop) {
          const existingStack = inventory.produce.find(
            (p) => p.cropId === harvest.cropId && p.mutation === harvest.mutation
          );
          if (existingStack) {
            existingStack.quantity += 1;
          } else {
            inventory.produce.push({
              cropId: harvest.cropId,
              mutation: harvest.mutation,
              quantity: 1,
            });
          }

          plot.crop = null;
          dogHarvestsList.push({
            cropId: harvest.cropId,
            mutation: harvest.mutation,
            quantity: 1,
          });
        }
        pendingDogHarvests.delete(plotId);
      }
    } else {
      pendingDogHarvests.clear();
    }

    // D. Weather transition
    if (weather.endsAtUtcMs <= currentTime) {
      const roll = rollNextWeather(weather.current, rng);
      weather.previousWeather = weather.current;
      weather.current = roll.nextWeather;
      weather.startedAtUtcMs = currentTime;
      weather.endsAtUtcMs = currentTime + roll.durationSeconds * 1000;

      if (weather.current === 'heavy_rain') {
        const rainExpiry = weather.endsAtUtcMs + RAIN_HYDRATION_BUFFER_MS;
        for (const plotId of Object.keys(plots)) {
          const plot = plots[plotId];
          if (plot.crop && plot.hydratedUntilUtcMs < rainExpiry) {
            plot.hydratedUntilUtcMs = rainExpiry;
          }
        }
      }
    }
  }

  // 4. Align timestamps when 24h cap was applied
  const excessMs = nowUtcMs - simEndMs;
  if (excessMs > 0) {
    weather.startedAtUtcMs += excessMs;
    weather.endsAtUtcMs += excessMs;
    for (const plot of Object.values(plots)) {
      if (plot.hydratedUntilUtcMs > simEndMs) {
        plot.hydratedUntilUtcMs += excessMs;
      }
    }
  }

  // 5. Construct updated SaveEnvelope
  const updatedPlots = saveEnvelope.farm.plots.map((p) => plots[p.id] ?? p);
  const updatedEnvelope: SaveEnvelope = {
    ...saveEnvelope,
    savedAtUtcMs: nowUtcMs,
    farm: {
      ...saveEnvelope.farm,
      plots: updatedPlots,
    },
    inventory,
    weather,
    rngState: rng.getState(),
  };

  // 6. Aggregate summary data
  const maturedCropsMap = new Map<string, MaturedCropSummary>();
  for (const event of maturedEvents) {
    const key = `${event.cropId}_${event.mutation}`;
    const existing = maturedCropsMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      maturedCropsMap.set(key, {
        cropId: event.cropId,
        mutation: event.mutation,
        count: 1,
      });
    }
  }
  const maturedCrops = Array.from(maturedCropsMap.values());

  const mutationsMap = new Map<string, { cropId: CropId; mutation: MutationType; count: number }>();
  for (const event of maturedEvents) {
    if (event.mutation !== 'none') {
      const key = `${event.cropId}_${event.mutation}`;
      const existing = mutationsMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        mutationsMap.set(key, {
          cropId: event.cropId,
          mutation: event.mutation,
          count: 1,
        });
      }
    }
  }
  const mutations = Array.from(mutationsMap.values());

  const dogHarvestsMap = new Map<string, MaturedCropSummary>();
  let dogHarvestsCount = 0;
  for (const harvest of dogHarvestsList) {
    dogHarvestsCount += harvest.quantity;
    const key = `${harvest.cropId}_${harvest.mutation}`;
    const existing = dogHarvestsMap.get(key);
    if (existing) {
      existing.count += harvest.quantity;
    } else {
      dogHarvestsMap.set(key, {
        cropId: harvest.cropId,
        mutation: harvest.mutation,
        count: harvest.quantity,
      });
    }
  }
  const dogHarvests = Array.from(dogHarvestsMap.values());

  const totalMaturedCount = maturedEvents.length;
  const hasEvents = totalMaturedCount > 0 || dogHarvestsCount > 0 || hatchedPetsList.length > 0;
  const shouldDisplay = elapsedMs >= 30_000 && hasEvents;

  const summary: OfflineSummaryData = {
    elapsedMs,
    formattedElapsed: formatOfflineDuration(elapsedMs),
    maturedCrops,
    totalMaturedCount,
    mutations,
    dogHarvestsCount,
    dogHarvests,
    hatchedPets: hatchedPetsList,
    shouldDisplay,
  };

  return {
    updatedEnvelope,
    summary,
  };
}
