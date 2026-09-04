import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useUiStore, resetUiStore } from './uiStore';

describe('useUiStore', () => {
  beforeEach(() => {
    resetUiStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('has standard initial UI state', () => {
      const state = useUiStore.getState();
      expect(state.activeModal).toBeNull();
      expect(state.modalData).toBeNull();
      expect(state.toasts).toEqual([]);
      expect(state.activeToast).toBeNull();
      expect(state.isJoystickActive).toBe(false);
      expect(state.joystickVector).toEqual({ x: 0, y: 0 });
      expect(state.selectedTool).toBe('watering_can');
      expect(state.selectedSeed).toBe('carrot');
      expect(state.hoveredPlotId).toBeNull();
      expect(state.targetedPlotId).toBeNull();
    });
  });

  describe('Modal Actions', () => {
    it('opens and closes modals, clearing joystick state on modal open', () => {
      useUiStore.getState().setJoystickActive(true);
      useUiStore.getState().setJoystickVector({ x: 0.5, y: -0.5 });

      useUiStore.getState().openModal('shop', { tab: 'seeds' });
      const state = useUiStore.getState();
      expect(state.activeModal).toBe('shop');
      expect(state.modalData).toEqual({ tab: 'seeds' });
      expect(state.isJoystickActive).toBe(false);
      expect(state.joystickVector).toEqual({ x: 0, y: 0 });

      useUiStore.getState().closeModal();
      expect(useUiStore.getState().activeModal).toBeNull();
      expect(useUiStore.getState().modalData).toBeNull();
    });
  });

  describe('Toast Actions', () => {
    it('shows and auto-dismisses toasts with auto-expiry timer', () => {
      useUiStore.getState().showToast('Planted Carrot', 'success', 2000);

      let state = useUiStore.getState();
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].message).toBe('Planted Carrot');
      expect(state.toasts[0].type).toBe('success');
      expect(state.activeToast?.message).toBe('Planted Carrot');

      vi.advanceTimersByTime(2100);

      state = useUiStore.getState();
      expect(state.toasts).toHaveLength(0);
      expect(state.activeToast).toBeNull();
    });

    it('deduplicates identical toast messages within 1.5s window', () => {
      useUiStore.getState().showToast('Not enough coins!', 'warning');
      useUiStore.getState().showToast('Not enough coins!', 'warning');
      useUiStore.getState().showToast('Not enough coins!', 'warning');

      expect(useUiStore.getState().toasts).toHaveLength(1);
    });

    it('caps active toasts at 3', () => {
      useUiStore.getState().showToast('Msg 1', 'info', 0);
      vi.advanceTimersByTime(1600);
      useUiStore.getState().showToast('Msg 2', 'info', 0);
      vi.advanceTimersByTime(1600);
      useUiStore.getState().showToast('Msg 3', 'info', 0);
      vi.advanceTimersByTime(1600);
      useUiStore.getState().showToast('Msg 4', 'info', 0);

      const toasts = useUiStore.getState().toasts;
      expect(toasts).toHaveLength(3);
      expect(toasts.map((t) => t.message)).toEqual(['Msg 2', 'Msg 3', 'Msg 4']);
    });

    it('dismisses specific toast by ID or all toasts if no ID', () => {
      useUiStore.getState().showToast('Message A', 'info', 0);
      const id = useUiStore.getState().toasts[0].id;
      useUiStore.getState().dismissToast(id);
      expect(useUiStore.getState().toasts).toHaveLength(0);

      useUiStore.getState().showToast('Message B', 'info', 0);
      useUiStore.getState().dismissToast();
      expect(useUiStore.getState().toasts).toHaveLength(0);
    });
  });

  describe('Control Actions', () => {
    it('sets tool and seed selection', () => {
      useUiStore.getState().setSelectedTool('watering_can');
      expect(useUiStore.getState().selectedTool).toBe('watering_can');

      useUiStore.getState().setSelectedSeed('pumpkin');
      expect(useUiStore.getState().selectedSeed).toBe('pumpkin');
    });

    it('sets hovered and targeted plot IDs', () => {
      useUiStore.getState().setHoveredPlot('plot-2-3');
      expect(useUiStore.getState().hoveredPlotId).toBe('plot-2-3');

      useUiStore.getState().setTargetedPlot('plot-1-1');
      expect(useUiStore.getState().targetedPlotId).toBe('plot-1-1');
    });
  });
});
