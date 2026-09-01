/// <reference types="vite/client" />

declare global {
  interface Window {
    __DEBUG__?: boolean;
    __testClockReady?: boolean;
    __advanceGameTime?: (
      ms: number,
      showModal?: boolean
    ) => {
      updatedEnvelope: import('./state/storeTypes').SaveEnvelope;
      summary: import('./persistence/offlineSimulation').OfflineSummaryData;
    };
    __setWeather?: (
      type: import('./state/storeTypes').WeatherType,
      durationSeconds?: number
    ) => import('./state/storeTypes').WeatherState;
    __getGameState?: () => import('./state/storeTypes').SaveEnvelope;
    __resetGame?: (seed?: number) => void;
    __advanceDistance?: (deltaUnits: number) => void;
    __tillPlot?: (
      plotId: import('./state/storeTypes').PlotId
    ) => import('./state/storeTypes').CommandResult<{ plotId: import('./state/storeTypes').PlotId }>;
    __plantCrop?: (
      plotId: import('./state/storeTypes').PlotId,
      cropId: import('./state/storeTypes').CropId
    ) => import('./state/storeTypes').CommandResult<{ cropId: import('./state/storeTypes').CropId }>;
    __waterPlot?: (
      plotId: import('./state/storeTypes').PlotId
    ) => import('./state/storeTypes').CommandResult<{
      hydratedPlotIds: import('./state/storeTypes').PlotId[];
    }>;
    __harvestCrop?: (
      plotId: import('./state/storeTypes').PlotId
    ) => import('./state/storeTypes').CommandResult<{
      cropId: import('./state/storeTypes').CropId;
      mutation: import('./state/storeTypes').MutationType;
      saleValue: number;
    }>;
    __addCoins?: (amount: number) => void;
    __setPlayerPosition?: (position: [number, number, number]) => void;
    __incubateEgg?: (eggId: string) => void;
    __hatchEgg?: (
      eggId: string
    ) => import('./state/storeTypes').CommandResult<{ pet: import('./state/storeTypes').PetData }>;
    __openModal?: (
      modal: 'shop' | 'inventory' | 'settings' | 'offline_summary',
      data?: unknown
    ) => void;
    __closeModal?: () => void;
    __saveGame?: () => Promise<void>;
    __loadGame?: () => Promise<import('./state/storeTypes').SaveEnvelope>;
    __saveService?: typeof import('./persistence/saveService').saveService;
    __useGameStore?: typeof import('./state/gameStore').useGameStore;
    __useUiStore?: typeof import('./state/uiStore').useUiStore;
    __useSettingsStore?: typeof import('./state/settingsStore').useSettingsStore;
  }
}

export {};
