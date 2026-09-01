import type {
  CropId,
  WeatherType,
  MutationType,
  PetType,
  EggType,
  QualityLevel,
} from '../game/core/constants';

export type {
  CropId,
  WeatherType,
  MutationType,
  PetType,
  EggType,
  QualityLevel,
};

export type PlotId = string;

export type CropStage = 'sprout' | 'mid' | 'grown';

export type PlotState = 'untilled' | 'tilled' | 'planted' | 'watered' | 'harvestable';

export type ToolType = 'trowel' | 'watering_can' | 'seed_bag' | 'scythe' | 'hand';

export type CommandFailureReason =
  | 'out_of_range'
  | 'invalid_plot_state'
  | 'insufficient_seeds'
  | 'insufficient_coins'
  | 'inventory_full'
  | 'plot_locked'
  | 'wrong_tool'
  | 'not_mature'
  | 'max_pets_reached'
  | 'already_owned'
  | 'already_incubating'
  | 'unknown';

export type CommandResult<T = undefined> =
  | { ok: true; value: T; message?: string }
  | { ok: false; reason: CommandFailureReason; message: string };

export interface CropData {
  cropId: CropId;
  plantedAtUtcMs: number;
  growthProgressSec: number;
  mutation: MutationType;
}

export interface PlotData {
  id: PlotId;
  row: number;
  col: number;
  tilled: boolean;
  crop: CropData | null;
  hydratedUntilUtcMs: number;
}

export interface ProduceStack {
  cropId: CropId;
  mutation: MutationType;
  quantity: number;
}

export interface PetData {
  id: string;
  type: PetType;
  acquiredAtUtcMs: number;
}

export interface EggData {
  id: string;
  type: EggType;
  purchasedAtUtcMs: number;
  outcome: PetType;
  incubating: boolean;
  elapsedIncubationSec: number;
  distanceTraveled: number;
}

export interface PlayerState {
  position: [number, number, number];
  coins: number;
  totalDistance: number;
}

export interface FarmState {
  gridSize: 4 | 6 | 8;
  plots: Record<PlotId, PlotData>;
  goldenWateringCanOwned: boolean;
}

export interface InventoryState {
  seeds: Record<CropId, number>;
  produce: ProduceStack[];
  eggs: EggData[];
  pets: PetData[];
  equippedPetId: string | null;
  incubatingEggId: string | null;
}

export interface WeatherState {
  current: WeatherType;
  startedAtUtcMs: number;
  endsAtUtcMs: number;
  previousWeather: WeatherType | null;
}

export interface TutorialState {
  completedSteps: string[];
  dismissed: boolean;
}

export interface SaveEnvelope {
  schemaVersion: number;
  savedAtUtcMs: number;
  player: {
    position: [number, number, number];
    coins: number;
    totalDistance: number;
  };
  farm: {
    gridSize: 4 | 6 | 8;
    plots: PlotData[];
    goldenWateringCanOwned: boolean;
  };
  inventory: {
    seeds: Record<CropId, number>;
    produce: ProduceStack[];
    eggs: EggData[];
    pets: PetData[];
    equippedPetId: string | null;
    incubatingEggId: string | null;
  };
  weather: {
    current: WeatherType;
    startedAtUtcMs: number;
    endsAtUtcMs: number;
    previousWeather?: WeatherType | null;
  };
  rngState: number;
  tutorial: {
    completedSteps: string[];
    dismissed: boolean;
  };
}

export interface SettingsState {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  quality: QualityLevel;
  effectiveQuality: 'low' | 'medium' | 'high';
  reducedMotion: boolean;
  haptics: boolean;
  inputMode: 'auto' | 'desktop' | 'touch';
  cameraSensitivity: number;
  invertY: boolean;
}

export type ModalType =
  | 'shop'
  | 'settings'
  | 'offline_summary'
  | 'tutorial'
  | 'reset_confirm';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  timestamp: number;
}

export interface UiState {
  activeModal: ModalType | null;
  modalData: unknown;
  toasts: ToastItem[];
  activeToast: ToastItem | null;
  isJoystickActive: boolean;
  joystickVector: { x: number; y: number };
  selectedTool: ToolType;
  selectedSeed: CropId;
  hoveredPlotId: PlotId | null;
  targetedPlotId: PlotId | null;
}
