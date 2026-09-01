import { create } from 'zustand';
import {
  STARTING_COINS,
  STARTING_GRID_SIZE,
  STARTING_SEEDS,
  PLAYER_SPAWN_POSITION,
  CURRENT_SCHEMA_VERSION,
} from '../game/core/constants';
import type {
  CropId,
  PlotId,
  PlotData,
  ProduceStack,
  EggData,
  PetData,
  WeatherType,
  MutationType,
  PlayerState,
  FarmState,
  InventoryState,
  WeatherState,
  TutorialState,
  SaveEnvelope,
} from './storeTypes';

export function generateDefaultPlots(
  gridSize: 4 | 6 | 8,
  existingPlots: Record<PlotId, PlotData> = {}
): Record<PlotId, PlotData> {
  const plots: Record<PlotId, PlotData> = { ...existingPlots };
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const id: PlotId = `plot-${r}-${c}`;
      if (!plots[id]) {
        plots[id] = {
          id,
          row: r,
          col: c,
          tilled: false,
          crop: null,
          hydratedUntilUtcMs: 0,
        };
      }
    }
  }
  return plots;
}

export interface GameStoreState {
  player: PlayerState;
  farm: FarmState;
  inventory: InventoryState;
  weather: WeatherState;
  rngState: number;
  tutorial: TutorialState;
  isDirty: boolean;
  lastSavedUtcMs: number;

  // Plot Actions
  setPlot: (plot: PlotData) => void;
  updatePlots: (plots: PlotData[] | Record<PlotId, Partial<PlotData>>) => void;
  setPlotHydration: (plotId: PlotId, hydratedUntilUtcMs: number) => void;
  setGridSize: (size: 4 | 6 | 8) => void;

  // Economy Actions
  addCoins: (amount: number) => void;
  deductCoins: (amount: number) => boolean;
  setCoins: (coins: number) => void;
  setGoldenWateringCan: (owned: boolean) => void;

  // Inventory Actions
  addSeeds: (cropId: CropId, quantity: number) => void;
  deductSeed: (cropId: CropId, quantity?: number) => boolean;
  addProduce: (cropId: CropId, mutation: MutationType, quantity: number) => void;
  removeProduce: (cropId: CropId, mutation: MutationType, quantity: number) => boolean;
  clearAllProduce: () => ProduceStack[];
  addEgg: (egg: EggData) => void;
  removeEgg: (eggId: string) => void;
  setIncubatingEgg: (eggId: string | null) => void;
  updateEgg: (eggId: string, updates: Partial<EggData>) => void;
  addPet: (pet: PetData) => void;
  setEquippedPet: (petId: string | null) => void;

  // Player & Movement Actions
  setPlayerPosition: (position: [number, number, number]) => void;
  addDistance: (deltaUnits: number) => void;

  // Weather & RNG Actions
  setWeather: (weather: WeatherType, startedAtUtcMs: number, endsAtUtcMs: number) => void;
  setRngState: (state: number) => void;

  // Tutorial Actions
  completeTutorialStep: (step: string) => void;
  dismissTutorial: () => void;

  // Persistence Actions
  markClean: () => void;
  toSaveEnvelope: (nowUtcMs?: number) => SaveEnvelope;
  loadSaveEnvelope: (envelope: SaveEnvelope) => void;
  resetGame: (initialSeed?: number) => void;
}

function createInitialState(seed: number = 1) {
  return {
    player: {
      position: [...PLAYER_SPAWN_POSITION] as [number, number, number],
      coins: STARTING_COINS,
      totalDistance: 0,
    },
    farm: {
      gridSize: STARTING_GRID_SIZE as 4 | 6 | 8,
      plots: generateDefaultPlots(STARTING_GRID_SIZE as 4),
      goldenWateringCanOwned: false,
    },
    inventory: {
      seeds: { ...STARTING_SEEDS },
      produce: [] as ProduceStack[],
      eggs: [] as EggData[],
      pets: [] as PetData[],
      equippedPetId: null as string | null,
      incubatingEggId: null as string | null,
    },
    weather: {
      current: 'sunny' as WeatherType,
      startedAtUtcMs: 0,
      endsAtUtcMs: 0,
      previousWeather: null as WeatherType | null,
    },
    rngState: seed,
    tutorial: {
      completedSteps: [] as string[],
      dismissed: false,
    },
    isDirty: false,
    lastSavedUtcMs: 0,
  };
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  ...createInitialState(),

  setPlot: (plot: PlotData) => {
    set((state) => ({
      farm: {
        ...state.farm,
        plots: {
          ...state.farm.plots,
          [plot.id]: plot,
        },
      },
      isDirty: true,
    }));
  },

  updatePlots: (plotsInput) => {
    set((state) => {
      const newPlots = { ...state.farm.plots };
      if (Array.isArray(plotsInput)) {
        for (const plot of plotsInput) {
          newPlots[plot.id] = plot;
        }
      } else {
        for (const [id, partial] of Object.entries(plotsInput)) {
          if (newPlots[id]) {
            newPlots[id] = { ...newPlots[id], ...partial };
          }
        }
      }
      return {
        farm: {
          ...state.farm,
          plots: newPlots,
        },
        isDirty: true,
      };
    });
  },

  setPlotHydration: (plotId: PlotId, hydratedUntilUtcMs: number) => {
    set((state) => {
      const currentPlot = state.farm.plots[plotId];
      if (!currentPlot) return state;
      return {
        farm: {
          ...state.farm,
          plots: {
            ...state.farm.plots,
            [plotId]: {
              ...currentPlot,
              hydratedUntilUtcMs,
            },
          },
        },
        isDirty: true,
      };
    });
  },

  setGridSize: (size: 4 | 6 | 8) => {
    set((state) => ({
      farm: {
        ...state.farm,
        gridSize: size,
        plots: generateDefaultPlots(size, state.farm.plots),
      },
      isDirty: true,
    }));
  },

  addCoins: (amount: number) => {
    if (amount <= 0) return;
    set((state) => ({
      player: {
        ...state.player,
        coins: state.player.coins + Math.floor(amount),
      },
      isDirty: true,
    }));
  },

  deductCoins: (amount: number): boolean => {
    if (amount < 0) return false;
    const currentCoins = get().player.coins;
    if (currentCoins < amount) {
      return false;
    }
    set((state) => ({
      player: {
        ...state.player,
        coins: state.player.coins - Math.floor(amount),
      },
      isDirty: true,
    }));
    return true;
  },

  setCoins: (coins: number) => {
    set((state) => ({
      player: {
        ...state.player,
        coins: Math.max(0, Math.floor(coins)),
      },
      isDirty: true,
    }));
  },

  setGoldenWateringCan: (owned: boolean) => {
    set((state) => ({
      farm: {
        ...state.farm,
        goldenWateringCanOwned: owned,
      },
      isDirty: true,
    }));
  },

  addSeeds: (cropId: CropId, quantity: number) => {
    if (quantity <= 0) return;
    set((state) => ({
      inventory: {
        ...state.inventory,
        seeds: {
          ...state.inventory.seeds,
          [cropId]: (state.inventory.seeds[cropId] ?? 0) + quantity,
        },
      },
      isDirty: true,
    }));
  },

  deductSeed: (cropId: CropId, quantity: number = 1): boolean => {
    if (quantity <= 0) return false;
    const current = get().inventory.seeds[cropId] ?? 0;
    if (current < quantity) {
      return false;
    }
    set((state) => ({
      inventory: {
        ...state.inventory,
        seeds: {
          ...state.inventory.seeds,
          [cropId]: current - quantity,
        },
      },
      isDirty: true,
    }));
    return true;
  },

  addProduce: (cropId: CropId, mutation: MutationType, quantity: number) => {
    if (quantity <= 0) return;
    set((state) => {
      const produce = [...state.inventory.produce];
      const index = produce.findIndex(
        (p) => p.cropId === cropId && p.mutation === mutation
      );
      if (index >= 0) {
        produce[index] = {
          ...produce[index],
          quantity: produce[index].quantity + quantity,
        };
      } else {
        produce.push({ cropId, mutation, quantity });
      }
      return {
        inventory: {
          ...state.inventory,
          produce,
        },
        isDirty: true,
      };
    });
  },

  removeProduce: (cropId: CropId, mutation: MutationType, quantity: number): boolean => {
    if (quantity <= 0) return false;
    const produce = get().inventory.produce;
    const index = produce.findIndex(
      (p) => p.cropId === cropId && p.mutation === mutation
    );
    if (index === -1 || produce[index].quantity < quantity) {
      return false;
    }

    set((state) => {
      const nextProduce = [...state.inventory.produce];
      const target = nextProduce[index];
      if (target.quantity === quantity) {
        nextProduce.splice(index, 1);
      } else {
        nextProduce[index] = {
          ...target,
          quantity: target.quantity - quantity,
        };
      }
      return {
        inventory: {
          ...state.inventory,
          produce: nextProduce,
        },
        isDirty: true,
      };
    });
    return true;
  },

  clearAllProduce: (): ProduceStack[] => {
    const currentProduce = [...get().inventory.produce];
    set((state) => ({
      inventory: {
        ...state.inventory,
        produce: [],
      },
      isDirty: true,
    }));
    return currentProduce;
  },

  addEgg: (egg: EggData) => {
    set((state) => ({
      inventory: {
        ...state.inventory,
        eggs: [...state.inventory.eggs, egg],
      },
      isDirty: true,
    }));
  },

  removeEgg: (eggId: string) => {
    set((state) => ({
      inventory: {
        ...state.inventory,
        eggs: state.inventory.eggs.filter((e) => e.id !== eggId),
        incubatingEggId:
          state.inventory.incubatingEggId === eggId ? null : state.inventory.incubatingEggId,
      },
      isDirty: true,
    }));
  },

  setIncubatingEgg: (eggId: string | null) => {
    set((state) => ({
      inventory: {
        ...state.inventory,
        incubatingEggId: eggId,
        eggs: state.inventory.eggs.map((e) => ({
          ...e,
          incubating: e.id === eggId,
        })),
      },
      isDirty: true,
    }));
  },

  updateEgg: (eggId: string, updates: Partial<EggData>) => {
    set((state) => ({
      inventory: {
        ...state.inventory,
        eggs: state.inventory.eggs.map((e) =>
          e.id === eggId ? { ...e, ...updates } : e
        ),
      },
      isDirty: true,
    }));
  },

  addPet: (pet: PetData) => {
    set((state) => ({
      inventory: {
        ...state.inventory,
        pets: [...state.inventory.pets, pet],
      },
      isDirty: true,
    }));
  },

  setEquippedPet: (petId: string | null) => {
    set((state) => ({
      inventory: {
        ...state.inventory,
        equippedPetId: petId,
      },
      isDirty: true,
    }));
  },

  setPlayerPosition: (position: [number, number, number]) => {
    set((state) => ({
      player: {
        ...state.player,
        position,
      },
    }));
  },

  addDistance: (deltaUnits: number) => {
    if (deltaUnits <= 0) return;
    set((state) => {
      const incubatingId = state.inventory.incubatingEggId;
      const eggs = incubatingId
        ? state.inventory.eggs.map((egg) =>
            egg.id === incubatingId
              ? { ...egg, distanceTraveled: egg.distanceTraveled + deltaUnits }
              : egg
          )
        : state.inventory.eggs;

      return {
        player: {
          ...state.player,
          totalDistance: state.player.totalDistance + deltaUnits,
        },
        inventory: {
          ...state.inventory,
          eggs,
        },
      };
    });
  },

  setWeather: (weather: WeatherType, startedAtUtcMs: number, endsAtUtcMs: number) => {
    set((state) => ({
      weather: {
        previousWeather: state.weather.current,
        current: weather,
        startedAtUtcMs,
        endsAtUtcMs,
      },
      isDirty: true,
    }));
  },

  setRngState: (rngState: number) => {
    set({ rngState, isDirty: true });
  },

  completeTutorialStep: (step: string) => {
    set((state) => {
      if (state.tutorial.completedSteps.includes(step)) {
        return state;
      }
      return {
        tutorial: {
          ...state.tutorial,
          completedSteps: [...state.tutorial.completedSteps, step],
        },
        isDirty: true,
      };
    });
  },

  dismissTutorial: () => {
    set((state) => ({
      tutorial: {
        ...state.tutorial,
        dismissed: true,
      },
      isDirty: true,
    }));
  },

  markClean: () => {
    set({ isDirty: false });
  },

  toSaveEnvelope: (nowUtcMs: number = Date.now()): SaveEnvelope => {
    const state = get();
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      savedAtUtcMs: nowUtcMs,
      player: {
        position: [...state.player.position] as [number, number, number],
        coins: state.player.coins,
        totalDistance: state.player.totalDistance,
      },
      farm: {
        gridSize: state.farm.gridSize,
        plots: Object.values(state.farm.plots),
        goldenWateringCanOwned: state.farm.goldenWateringCanOwned,
      },
      inventory: {
        seeds: { ...state.inventory.seeds },
        produce: state.inventory.produce.map((p) => ({ ...p })),
        eggs: state.inventory.eggs.map((e) => ({ ...e })),
        pets: state.inventory.pets.map((p) => ({ ...p })),
        equippedPetId: state.inventory.equippedPetId,
        incubatingEggId: state.inventory.incubatingEggId,
      },
      weather: {
        current: state.weather.current,
        startedAtUtcMs: state.weather.startedAtUtcMs,
        endsAtUtcMs: state.weather.endsAtUtcMs,
        previousWeather: state.weather.previousWeather,
      },
      rngState: state.rngState,
      tutorial: {
        completedSteps: [...state.tutorial.completedSteps],
        dismissed: state.tutorial.dismissed,
      },
    };
  },

  loadSaveEnvelope: (envelope: SaveEnvelope) => {
    const plotsRecord: Record<PlotId, PlotData> = {};
    for (const plot of envelope.farm.plots) {
      plotsRecord[plot.id] = { ...plot };
    }

    set({
      player: {
        position: [...envelope.player.position] as [number, number, number],
        coins: envelope.player.coins,
        totalDistance: envelope.player.totalDistance,
      },
      farm: {
        gridSize: envelope.farm.gridSize,
        plots: plotsRecord,
        goldenWateringCanOwned: envelope.farm.goldenWateringCanOwned,
      },
      inventory: {
        seeds: { ...envelope.inventory.seeds },
        produce: envelope.inventory.produce.map((p) => ({ ...p })),
        eggs: envelope.inventory.eggs.map((e) => ({ ...e })),
        pets: envelope.inventory.pets.map((p) => ({ ...p })),
        equippedPetId: envelope.inventory.equippedPetId,
        incubatingEggId: envelope.inventory.incubatingEggId,
      },
      weather: {
        current: envelope.weather.current,
        startedAtUtcMs: envelope.weather.startedAtUtcMs,
        endsAtUtcMs: envelope.weather.endsAtUtcMs,
        previousWeather: envelope.weather.previousWeather ?? null,
      },
      rngState: envelope.rngState,
      tutorial: {
        completedSteps: [...envelope.tutorial.completedSteps],
        dismissed: envelope.tutorial.dismissed,
      },
      isDirty: false,
      lastSavedUtcMs: envelope.savedAtUtcMs,
    });
  },

  resetGame: (initialSeed: number = 1) => {
    set({
      ...createInitialState(initialSeed),
      isDirty: false,
    });
  },
}));

export function resetGameStore(initialSeed: number = 1): void {
  useGameStore.getState().resetGame(initialSeed);
}
