import { create } from 'zustand';
import type {
  CropId,
  PlotId,
  ToolType,
  ModalType,
  ToastType,
  ToastItem,
  UiState,
} from './storeTypes';

export interface UiStoreState extends UiState {
  openModal: (modal: ModalType, data?: unknown) => void;
  closeModal: () => void;
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
  dismissToast: (id?: string) => void;
  setJoystickActive: (active: boolean) => void;
  setJoystickVector: (vector: { x: number; y: number }) => void;
  setSelectedTool: (tool: ToolType) => void;
  setSelectedSeed: (seed: CropId) => void;
  setPlantArmed: (armed: boolean) => void;
  /** Select a seed and arm planting mode. */
  armSeed: (seed: CropId) => void;
  /** Disarm planting mode (keeps the selected seed). */
  disarmPlant: () => void;
  setHoveredPlot: (plotId: PlotId | null) => void;
  setTargetedPlot: (plotId: PlotId | null) => void;
  setIsFirstPerson: (isFirstPerson: boolean) => void;
  resetUi: () => void;
}

let toastIdCounter = 0;
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();

function createInitialUiState(): UiState {
  return {
    activeModal: null,
    modalData: null,
    toasts: [],
    activeToast: null,
    isJoystickActive: false,
    joystickVector: { x: 0, y: 0 },
    selectedTool: 'watering_can',
    selectedSeed: 'carrot',
    plantArmed: false,
    hoveredPlotId: null,
    targetedPlotId: null,
    isFirstPerson: false,
  };
}

export const useUiStore = create<UiStoreState>((set, get) => ({
  ...createInitialUiState(),

  openModal: (modal: ModalType, data: unknown = null) => {
    set({
      activeModal: modal,
      modalData: data,
      isJoystickActive: false,
      joystickVector: { x: 0, y: 0 },
    });
  },

  closeModal: () => {
    set({
      activeModal: null,
      modalData: null,
    });
  },

  showToast: (message: string, type: ToastType = 'info', durationMs: number = 3000) => {
    const state = get();
    const now = Date.now();

    // Deduplicate repeated messages within 1.5 seconds
    const recentDuplicate = state.toasts.find(
      (t) => t.message === message && now - t.timestamp < 1500
    );
    if (recentDuplicate) return;

    const id = `toast-${++toastIdCounter}-${now}`;
    const newToast: ToastItem = { id, message, type, timestamp: now };

    // Maintain max 3 toasts
    const updatedToasts = [...state.toasts.slice(-2), newToast];

    set({
      toasts: updatedToasts,
      activeToast: newToast,
    });

    if (durationMs > 0 && typeof setTimeout !== 'undefined') {
      const timer = setTimeout(() => {
        get().dismissToast(id);
        toastTimers.delete(id);
      }, durationMs);
      toastTimers.set(id, timer);
    }
  },

  dismissToast: (id?: string) => {
    set((state) => {
      if (!id) {
        return { toasts: [], activeToast: null };
      }
      const updated = state.toasts.filter((t) => t.id !== id);
      return {
        toasts: updated,
        activeToast: updated.length > 0 ? updated[updated.length - 1] : null,
      };
    });
  },

  setJoystickActive: (isJoystickActive: boolean) => {
    set((state) => ({
      isJoystickActive,
      joystickVector: isJoystickActive ? state.joystickVector : { x: 0, y: 0 },
    }));
  },

  setJoystickVector: (vector: { x: number; y: number }) => {
    set({ joystickVector: vector });
  },

  setSelectedTool: (selectedTool: ToolType) => {
    set({ selectedTool });
  },

  setSelectedSeed: (selectedSeed: CropId) => {
    set({ selectedSeed });
  },

  setPlantArmed: (plantArmed: boolean) => {
    set({ plantArmed });
  },

  armSeed: (seed: CropId) => {
    set({ selectedSeed: seed, plantArmed: true });
  },

  disarmPlant: () => {
    set({ plantArmed: false });
  },

  setHoveredPlot: (hoveredPlotId: PlotId | null) => {
    set({ hoveredPlotId });
  },

  setTargetedPlot: (targetedPlotId: PlotId | null) => {
    set({ targetedPlotId });
  },

  setIsFirstPerson: (isFirstPerson: boolean) => {
    if (get().isFirstPerson !== isFirstPerson) {
      set({ isFirstPerson });
    }
  },

  resetUi: () => {
    for (const timer of toastTimers.values()) {
      clearTimeout(timer);
    }
    toastTimers.clear();
    set(createInitialUiState());
  },
}));

export function resetUiStore(): void {
  useUiStore.getState().resetUi();
}
