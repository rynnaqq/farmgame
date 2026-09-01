import { useGameStore } from '../state/gameStore';
import { useUiStore } from '../state/uiStore';
import { useSettingsStore } from '../state/settingsStore';
import { saveService } from '../persistence/saveService';
import {
  simulateOfflineProgression,
  type OfflineSummaryData,
} from '../persistence/offlineSimulation';
import { applyWeatherHydration } from '../game/weather/weatherSystem';
import { tillPlot, plantCrop, waterPlot, harvestCrop } from '../game/farming/farmingCommands';
import { hatchEgg } from '../game/pets/petSystem';
import type {
  SaveEnvelope,
  WeatherType,
  PlotId,
  CropId,
  MutationType,
  CommandResult,
  PetData,
  WeatherState,
} from '../state/storeTypes';

declare global {
  interface Window {
    __advanceGameTime?: (
      ms: number,
      showModal?: boolean
    ) => { updatedEnvelope: SaveEnvelope; summary: OfflineSummaryData };
    __setWeather?: (type: WeatherType, durationSeconds?: number) => WeatherState;
    __getGameState?: () => SaveEnvelope;
    __resetGame?: (seed?: number) => void;
    __tillPlot?: (plotId: PlotId) => CommandResult<{ plotId: PlotId }>;
    __plantCrop?: (plotId: PlotId, cropId: CropId) => CommandResult<{ cropId: CropId }>;
    __waterPlot?: (plotId: PlotId) => CommandResult<{ hydratedPlotIds: PlotId[] }>;
    __harvestCrop?: (
      plotId: PlotId
    ) => CommandResult<{ cropId: CropId; mutation: MutationType; saleValue: number }>;
    __addCoins?: (amount: number) => void;
    __setPlayerPosition?: (position: [number, number, number]) => void;
    __incubateEgg?: (eggId: string) => void;
    __hatchEgg?: (eggId: string) => CommandResult<{ pet: PetData }>;
    __openModal?: (
      modal: 'shop' | 'inventory' | 'settings' | 'offline_summary',
      data?: unknown
    ) => void;
    __closeModal?: () => void;
    __saveGame?: () => Promise<void>;
    __loadGame?: () => Promise<SaveEnvelope>;
    __saveService?: typeof saveService;
    __useGameStore?: typeof useGameStore;
    __useUiStore?: typeof useUiStore;
    __useSettingsStore?: typeof useSettingsStore;
    __testClockReady?: boolean;
    __DEBUG__?: boolean;
  }
}

/**
 * Deterministically advances the in-game clock by a specified duration in milliseconds.
 * Applies growth simulation, weather transitions, hydration, egg incubation, and dog auto-harvesting.
 */
export function advanceGameTime(
  ms: number,
  showModal: boolean = false
): { updatedEnvelope: SaveEnvelope; summary: OfflineSummaryData } {
  const store = useGameStore.getState();
  const simStartMs = store.lastSavedUtcMs > 0 ? store.lastSavedUtcMs : Date.now();
  const currentEnvelope = store.toSaveEnvelope(simStartMs);
  const targetTimestamp = simStartMs + ms;
  const { updatedEnvelope, summary } = simulateOfflineProgression(currentEnvelope, targetTimestamp);

  store.loadSaveEnvelope(updatedEnvelope);
  void saveService.saveImmediate(updatedEnvelope);

  if (showModal && summary.shouldDisplay) {
    useUiStore.getState().openModal('offline_summary', summary);
  }

  return { updatedEnvelope, summary };
}

/**
 * Explicitly sets active weather and optionally duration in seconds.
 */
export function setTestWeather(type: WeatherType, durationSeconds: number = 300): WeatherState {
  const store = useGameStore.getState();
  const now = store.lastSavedUtcMs > 0 ? store.lastSavedUtcMs : Date.now();
  const endsAt = now + durationSeconds * 1000;
  store.setWeather(type, now, endsAt);

  if (type === 'heavy_rain') {
    const updatedPlots = applyWeatherHydration(
      useGameStore.getState().farm.plots,
      type,
      endsAt,
      now
    );
    store.updatePlots(updatedPlots);
  }

  const updatedEnvelope = useGameStore.getState().toSaveEnvelope(now);
  void saveService.saveImmediate(updatedEnvelope);
  return useGameStore.getState().weather;
}

/**
 * Returns current snapshot of the game state as a SaveEnvelope.
 */
export function getTestGameState(): SaveEnvelope {
  return useGameStore.getState().toSaveEnvelope();
}

/**
 * Resets the entire game to clean starting conditions with an optional RNG seed.
 */
export function resetTestGame(seed?: number): void {
  useGameStore.getState().resetGame(seed);
  const cleanEnvelope = useGameStore.getState().toSaveEnvelope();
  void saveService.saveImmediate(cleanEnvelope);
}

/**
 * Installs all deterministic test helpers onto `window` for Playwright and automated suites.
 */
export function installTestClock(): boolean {
  if (typeof window === 'undefined') return false;

  window.__advanceGameTime = advanceGameTime;
  window.__setWeather = setTestWeather;
  window.__getGameState = getTestGameState;
  window.__resetGame = resetTestGame;
  window.__tillPlot = (plotId: PlotId) => tillPlot(plotId);
  window.__plantCrop = (plotId: PlotId, cropId: CropId) => plantCrop(plotId, cropId);
  window.__waterPlot = (plotId: PlotId) =>
    waterPlot(
      plotId,
      undefined,
      useGameStore.getState().farm.goldenWateringCanOwned,
      useGameStore.getState().weather.current
    );
  window.__harvestCrop = (plotId: PlotId) => harvestCrop(plotId);
  window.__addCoins = (amount: number) => {
    useGameStore.getState().addCoins(amount);
    void saveService.saveImmediate(useGameStore.getState().toSaveEnvelope());
  };
  window.__setPlayerPosition = (pos: [number, number, number]) => {
    useGameStore.getState().setPlayerPosition(pos);
  };
  window.__incubateEgg = (eggId: string) => {
    useGameStore.getState().setIncubatingEgg(eggId);
    void saveService.saveImmediate(useGameStore.getState().toSaveEnvelope());
  };
  window.__hatchEgg = (eggId: string) => {
    const res = hatchEgg(eggId);
    void saveService.saveImmediate(useGameStore.getState().toSaveEnvelope());
    return res;
  };
  window.__openModal = (modal, data) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useUiStore.getState().openModal(modal as any, data as any);
  };
  window.__closeModal = () => {
    useUiStore.getState().closeModal();
  };
  window.__saveGame = async () => {
    await saveService.saveImmediate(useGameStore.getState().toSaveEnvelope());
  };
  window.__loadGame = async () => {
    const { envelope } = await saveService.load();
    useGameStore.getState().loadSaveEnvelope(envelope);
    return envelope;
  };
  window.__saveService = saveService;
  window.__useGameStore = useGameStore;
  window.__useUiStore = useUiStore;
  window.__useSettingsStore = useSettingsStore;
  window.__testClockReady = true;
  window.__DEBUG__ = true;

  return true;
}

/**
 * Cleans up injected helpers from `window`.
 */
export function uninstallTestClock(): void {
  if (typeof window === 'undefined') return;
  delete window.__advanceGameTime;
  delete window.__setWeather;
  delete window.__getGameState;
  delete window.__resetGame;
  delete window.__tillPlot;
  delete window.__plantCrop;
  delete window.__waterPlot;
  delete window.__harvestCrop;
  delete window.__addCoins;
  delete window.__setPlayerPosition;
  delete window.__incubateEgg;
  delete window.__hatchEgg;
  delete window.__openModal;
  delete window.__closeModal;
  delete window.__saveGame;
  delete window.__loadGame;
  delete window.__saveService;
  delete window.__useGameStore;
  delete window.__useUiStore;
  delete window.__useSettingsStore;
  delete window.__testClockReady;
}
