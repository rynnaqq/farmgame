import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useGameStore } from '../state/gameStore';
import { useUiStore } from '../state/uiStore';
import { useSettingsStore } from '../state/settingsStore';
import { audioManager } from '../game/audio/AudioManager';

export interface TutorialProps {
  forceTouch?: boolean;
  className?: string;
  onDismiss?: () => void;
}

interface TutorialStepData {
  id: string;
  title: string;
  icon: string;
  desktopText: string;
  mobileText: string;
}

const TUTORIAL_STEPS: TutorialStepData[] = [
  {
    id: 'move_camera',
    title: 'Movement & Camera',
    icon: '🧭',
    desktopText:
      'Use WASD or Arrow Keys to move your farmer. Hold Right-Click and drag (or use Q/E keys) to rotate the camera around the island. Use the scroll wheel to zoom.',
    mobileText:
      'Use the virtual joystick on the bottom-left to move your farmer. Drag anywhere on screen to rotate the camera, and pinch with two fingers to zoom.',
  },
  {
    id: 'planting',
    title: 'Seed Selection & Planting',
    icon: '🌱',
    desktopText:
      'Select the Seed Bag (Key 2), pick your crop seed from the picker (Carrot, Tomato, etc.), and click on any soil plot to plant. No tilling needed!',
    mobileText:
      'Select the Seed Bag from the toolbelt, choose your seeds from the picker popover, and tap any soil plot to plant. No tilling needed!',
  },
  {
    id: 'watering',
    title: 'Watering & Hydration',
    icon: '💧',
    desktopText:
      'Select the Watering Can (Key 1) and click planted crops to water them. Hydrated soil keeps crops thriving and accelerates growth!',
    mobileText:
      'Select the Watering Can from the toolbelt and tap your planted crops to water them. Keep plots hydrated to watch your crops grow!',
  },
  {
    id: 'harvesting_selling',
    title: 'Harvesting & Selling',
    icon: '🌾',
    desktopText:
      'When crops are fully grown and glowing, switch to the Harvest tool (Key 3) and click to harvest. Visit the Merchant Shop to sell produce for coins!',
    mobileText:
      'When crops are fully grown and sparkling, tap with the Harvest tool to harvest. Visit the Merchant Shop (or open your inventory) to sell your produce for coins!',
  },
  {
    id: 'weather_pets',
    title: 'Weather & Pet Companions',
    icon: '🐾',
    desktopText:
      'Watch out for dynamic weather like Heavy Rain, Heatwaves, and Blood Moons for rare crop mutations! Buy eggs at the Merchant Shop to hatch pet companions (Dogs, Bees, Pigs) that grant farming perks.',
    mobileText:
      'Keep an eye on the weather forecast for rare crop mutations! Visit the Merchant Shop to buy companion eggs and hatch pets that grant special farming perks and speed boosts.',
  },
];

function checkIsTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;

  const hasCoarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

  const hasTouchCapability =
    'ontouchstart' in window ||
    (typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0);

  const isMobileWidth = window.innerWidth <= 768;

  return hasCoarsePointer || hasTouchCapability || isMobileWidth;
}

/**
 * 5-step interactive/skippable onboarding tutorial with device-aware instructions
 * (desktop WASD vs mobile joystick/touch) and persistence in gameStore.
 */
export const Tutorial: React.FC<TutorialProps> = ({ forceTouch, className = '', onDismiss }) => {
  const tutorial = useGameStore((state) => state.tutorial);
  const activeModal = useUiStore((state) => state.activeModal);
  const inputMode = useSettingsStore((state) => state.inputMode);

  const [stepIndex, setStepIndex] = useState<number>(0);

  // Device detection
  const isTouch = useMemo(() => {
    if (forceTouch !== undefined) return forceTouch;
    if (inputMode === 'touch') return true;
    if (inputMode === 'desktop') return false;
    return checkIsTouchDevice();
  }, [forceTouch, inputMode]);

  // Handle dismissal
  const handleDismiss = useCallback(() => {
    audioManager.playSfx('ui_click');
    useGameStore.getState().dismissTutorial();
    if (activeModal === 'tutorial') {
      useUiStore.getState().closeModal();
    }
    onDismiss?.();
  }, [activeModal, onDismiss]);

  // Escape key listener to dismiss
  useEffect(() => {
    const isVisible = activeModal === 'tutorial' || (!tutorial.dismissed && activeModal === null);

    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModal, tutorial.dismissed, handleDismiss]);

  // Reset step index when tutorial modal opens
  useEffect(() => {
    if (activeModal === 'tutorial') {
      setStepIndex(0);
    }
  }, [activeModal]);

  // Determine visibility
  // If dismissed and not actively opened as a modal, don't show
  if (tutorial.dismissed && activeModal !== 'tutorial') {
    return null;
  }

  // If another modal (like shop, inventory, settings) is active, do not overlap
  if (activeModal !== null && activeModal !== 'tutorial') {
    return null;
  }

  const currentStep = TUTORIAL_STEPS[stepIndex] ?? TUTORIAL_STEPS[0];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === TUTORIAL_STEPS.length - 1;

  const handleNext = () => {
    audioManager.playSfx('ui_click');
    useGameStore.getState().completeTutorialStep(currentStep.id);
    if (isLastStep) {
      handleDismiss();
    } else {
      setStepIndex((prev) => Math.min(TUTORIAL_STEPS.length - 1, prev + 1));
    }
  };

  const handleBack = () => {
    audioManager.playSfx('ui_click');
    setStepIndex((prev) => Math.max(0, prev - 1));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-sm pointer-events-auto animate-in fade-in duration-200"
      data-testid="tutorial-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        data-testid="tutorial-card"
        className={`relative w-full max-w-lg rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/40 p-5 sm:p-6 shadow-2xl shadow-emerald-950/50 flex flex-col gap-4 text-slate-100 ${className}`}
      >
        {/* Header with Title, Icon & Step Indicator */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl sm:text-3xl" role="img" aria-hidden="true">
              {currentStep.icon}
            </span>
            <div>
              <h2
                id="tutorial-title"
                data-testid="tutorial-title"
                className="text-lg sm:text-xl font-extrabold text-emerald-300 font-mono tracking-wide"
              >
                {currentStep.title}
              </h2>
              <span className="text-[11px] font-medium text-slate-400">
                {isTouch ? 'Mobile / Touch Controls' : 'Desktop Controls'}
              </span>
            </div>
          </div>

          <div
            data-testid="tutorial-step-indicator"
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800/80 border border-emerald-500/30 text-xs font-mono font-bold text-emerald-300"
          >
            Step {stepIndex + 1} of {TUTORIAL_STEPS.length}
          </div>
        </div>

        {/* Step Progress Dots */}
        <div
          className="flex items-center justify-center gap-1.5 py-1"
          aria-label={`Step progress: ${stepIndex + 1} of ${TUTORIAL_STEPS.length}`}
        >
          {TUTORIAL_STEPS.map((step, idx) => (
            <button
              key={step.id}
              type="button"
              onClick={() => setStepIndex(idx)}
              aria-label={`Go to step ${idx + 1}: ${step.title}`}
              className={`h-2 rounded-full transition-all duration-200 ${
                idx === stepIndex
                  ? 'w-6 bg-emerald-400 shadow-sm shadow-emerald-400/50'
                  : idx < stepIndex
                    ? 'w-2 bg-emerald-700/60'
                    : 'w-2 bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Body Text (Device-Aware) */}
        <div
          data-testid="tutorial-body"
          className="text-sm sm:text-base text-slate-200 leading-relaxed min-h-[4.5rem] bg-slate-950/40 rounded-xl p-3.5 border border-white/5"
        >
          {isTouch ? currentStep.mobileText : currentStep.desktopText}
        </div>

        {/* Footer Actions: Skip, Back, Next / Finish */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10 mt-1">
          <button
            type="button"
            data-testid="tutorial-skip-button"
            onClick={handleDismiss}
            className="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 outline-none cursor-pointer"
          >
            Skip Tutorial
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="tutorial-back-button"
              disabled={isFirstStep}
              onClick={handleBack}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold border transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer ${
                isFirstStep
                  ? 'opacity-40 border-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-800 hover:bg-slate-700 border-white/10 text-slate-200 hover:text-white'
              }`}
            >
              Back
            </button>

            <button
              type="button"
              data-testid="tutorial-next-button"
              onClick={handleNext}
              className="px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-900/40 border border-emerald-400/40 transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 cursor-pointer"
            >
              {isLastStep ? 'Start Farming!' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
