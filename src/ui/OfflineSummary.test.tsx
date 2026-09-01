import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { OfflineSummary } from './OfflineSummary';
import { useUiStore, resetUiStore } from '../state/uiStore';

import type { OfflineSummaryData } from '../persistence/offlineSimulation';
import { audioManager } from '../game/audio/AudioManager';

describe('OfflineSummary Component', () => {
  const mockSummaryData: OfflineSummaryData = {
    elapsedMs: 3_600_000,
    formattedElapsed: '1h',
    maturedCrops: [
      { cropId: 'carrot', mutation: 'none', count: 3 },
      { cropId: 'tomato', mutation: 'gold', count: 1 },
    ],
    totalMaturedCount: 4,
    mutations: [{ cropId: 'tomato', mutation: 'gold', count: 1 }],
    dogHarvestsCount: 2,
    dogHarvests: [{ cropId: 'carrot', mutation: 'none', count: 2 }],
    hatchedPets: [{ petId: 'pet-1', type: 'dog' }],
    shouldDisplay: true,
  };

  beforeEach(() => {
    resetUiStore();
    vi.restoreAllMocks();
    vi.spyOn(audioManager, 'playSfx').mockImplementation(() => {});
  });

  it('renders nothing when activeModal is not offline_summary', () => {
    const { container } = render(<OfflineSummary />);
    expect(container.firstChild).toBeNull();
  });

  it('renders accessible dialog when activeModal is offline_summary', () => {
    useUiStore.getState().openModal('offline_summary', mockSummaryData);

    render(<OfflineSummary />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'offline-summary-title');
    expect(screen.getByTestId('offline-summary-title')).toHaveTextContent(/welcome back/i);
  });

  it('displays formatted elapsed time', () => {
    useUiStore.getState().openModal('offline_summary', mockSummaryData);

    render(<OfflineSummary />);

    const elapsedEl = screen.getByTestId('offline-elapsed-time');
    expect(elapsedEl).toBeInTheDocument();
    expect(elapsedEl).toHaveTextContent('1h');
  });

  it('renders itemized matured crops with crop names, counts, and mutation badges', () => {
    useUiStore.getState().openModal('offline_summary', mockSummaryData);

    render(<OfflineSummary />);

    const maturedSection = screen.getByTestId('offline-matured-section');
    expect(maturedSection).toBeInTheDocument();

    // Verify carrot (3) and tomato (1)
    expect(within(maturedSection).getByText(/carrot/i)).toBeInTheDocument();
    expect(within(maturedSection).getByText(/tomato/i)).toBeInTheDocument();

    // Gold mutation badge
    const goldBadge = screen.getByTestId('mutation-badge-gold');
    expect(goldBadge).toBeInTheDocument();
    expect(goldBadge).toHaveTextContent(/gold/i);
  });

  it('renders Dog auto-harvest section when dog harvests > 0', () => {
    useUiStore.getState().openModal('offline_summary', mockSummaryData);

    render(<OfflineSummary />);

    const dogSection = screen.getByTestId('offline-dog-harvests-section');
    expect(dogSection).toBeInTheDocument();
    expect(screen.getByTestId('offline-dog-harvest-count')).toHaveTextContent('2');
  });

  it('renders hatched pets section when pets hatched', () => {
    useUiStore.getState().openModal('offline_summary', mockSummaryData);

    render(<OfflineSummary />);

    const petSection = screen.getByTestId('offline-hatched-pets-section');
    expect(petSection).toBeInTheDocument();
    expect(within(petSection).getByText(/dog/i)).toBeInTheDocument();
  });

  it('renders empty state messages gracefully when no crops matured or pets hatched', () => {
    const emptySummary: OfflineSummaryData = {
      elapsedMs: 60_000,
      formattedElapsed: '1m',
      maturedCrops: [],
      totalMaturedCount: 0,
      mutations: [],
      dogHarvestsCount: 0,
      dogHarvests: [],
      hatchedPets: [],
      shouldDisplay: true,
    };
    useUiStore.getState().openModal('offline_summary', emptySummary);

    render(<OfflineSummary />);

    expect(screen.queryByTestId('offline-dog-harvests-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('offline-hatched-pets-section')).not.toBeInTheDocument();
    expect(screen.getByText(/no crops reached maturity/i)).toBeInTheDocument();
  });

  it('closes modal and plays sfx when dismiss button is clicked', () => {
    const onClose = vi.fn();
    useUiStore.getState().openModal('offline_summary', mockSummaryData);

    render(<OfflineSummary onClose={onClose} />);

    const dismissBtn = screen.getByTestId('offline-summary-dismiss-button');
    fireEvent.click(dismissBtn);

    expect(useUiStore.getState().activeModal).toBeNull();
    expect(audioManager.playSfx).toHaveBeenCalledWith('ui_click');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes modal on Escape key press', () => {
    const onClose = vi.fn();
    useUiStore.getState().openModal('offline_summary', mockSummaryData);

    render(<OfflineSummary onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(useUiStore.getState().activeModal).toBeNull();
    expect(onClose).toHaveBeenCalled();
  });

  it('closes modal when backdrop is clicked', () => {
    useUiStore.getState().openModal('offline_summary', mockSummaryData);

    render(<OfflineSummary />);

    const backdrop = screen.getByTestId('offline-summary-backdrop');
    fireEvent.click(backdrop);

    expect(useUiStore.getState().activeModal).toBeNull();
  });

  it('displays clock warning if clockMovedBackward is true', () => {
    const backwardSummary: OfflineSummaryData = {
      ...mockSummaryData,
      clockMovedBackward: true,
    };
    useUiStore.getState().openModal('offline_summary', backwardSummary);

    render(<OfflineSummary />);

    expect(screen.getByTestId('offline-clock-warning')).toBeInTheDocument();
    expect(screen.getByText(/clock was set backward/i)).toBeInTheDocument();
  });
});
