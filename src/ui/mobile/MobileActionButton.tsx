import React from 'react';
import { useSettingsStore } from '../../state/settingsStore';
import { useUiStore } from '../../state/uiStore';
import type { ToolType } from '../../state/storeTypes';

export interface MobileActionButtonProps {
  selectedTool?: ToolType;
  hasTarget?: boolean;
  nearMerchant?: boolean;
  onAction?: () => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Large contextual touch action button for mobile farming and interactions:
 * - Minimum 56x56 CSS pixel tap target
 * - Dynamic icon and label based on active tool or merchant proximity
 * - Seed Bag shows a passive "Tap Soil" hint: planting happens by tapping the soil,
 *   never via this button.
 * - Haptic feedback (15ms pulse) when enabled in settings
 * - Located in bottom-right safe area
 */
export const MobileActionButton: React.FC<MobileActionButtonProps> = ({
  selectedTool = 'seed_bag',
  hasTarget = false,
  nearMerchant = false,
  onAction,
  className = '',
  disabled = false,
}) => {
  const hapticsEnabled = useSettingsStore((state) => state.haptics);
  const activeModal = useUiStore((state) => state.activeModal);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled || activeModal !== null) return;

    // Trigger haptic vibration (15ms) if supported and enabled
    if (
      hapticsEnabled &&
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    ) {
      try {
        navigator.vibrate(15);
      } catch {
        // Ignore vibration failure on unsupported browsers
      }
    }

    if (nearMerchant) {
      useUiStore.getState().openModal('shop');
    }

    onAction?.();
  };

  // Determine button title, aria-label, and icon
  let actionLabel = 'Action';
  let badgeText = '';
  let iconSvg: React.ReactNode = null;
  const isActionReady = (hasTarget || nearMerchant) && selectedTool !== 'seed_bag';

  if (nearMerchant) {
    actionLabel = 'Merchant Shop';
    badgeText = 'Shop';
    iconSvg = (
      <svg
        className="w-7 h-7 text-amber-300"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    );
  } else {
    switch (selectedTool) {
      case 'watering_can':
        actionLabel = 'Water Crop';
        badgeText = 'Water';
        iconSvg = (
          <svg
            className="w-7 h-7 text-cyan-300"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" fill="currentColor" fillOpacity="0.2" />
          </svg>
        );
        break;

      case 'seed_bag':
        actionLabel = 'Tap Soil';
        badgeText = 'Tap Soil';
        iconSvg = (
          <svg
            className="w-7 h-7 text-emerald-300"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22v-9" />
            <path d="M12 13a5 5 0 0 1 5-5c3 0 3 4 3 4s-4 0-4 4a5 5 0 0 1-4-3z" />
            <path d="M12 13a5 5 0 0 0-5-5c-3 0-3 4-3 4s4 0 4 4a5 5 0 0 0 4-3z" />
          </svg>
        );
        break;

      case 'scythe':
        actionLabel = 'Harvest Crop';
        badgeText = 'Harvest';
        iconSvg = (
          <svg
            className="w-7 h-7 text-yellow-300"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 21l9-9" />
            <path d="M12 12c2-4 6-7 10-7 0 6-4 10-10 10" fill="currentColor" fillOpacity="0.2" />
          </svg>
        );
        break;

      case 'hand':
      default:
        actionLabel = 'Harvest Crop';
        badgeText = 'Harvest';
        iconSvg = (
          <svg
            className="w-7 h-7 text-amber-100"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
            <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
            <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
          </svg>
        );
        break;
    }
  }

  const isPassiveHint = selectedTool === 'seed_bag' && !nearMerchant;
  const isInteractive = !disabled && activeModal === null && !isPassiveHint;

  return (
    <button
      type="button"
      data-testid="mobile-action-button"
      aria-label={actionLabel}
      disabled={!isInteractive}
      onClick={handleClick}
      className={`min-w-[56px] min-h-[56px] w-16 h-16 pointer-events-auto select-none rounded-full flex flex-col items-center justify-center relative shadow-xl transition-all duration-150 active:scale-95 touch-none ${
        isActionReady
          ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white border-2 border-emerald-300 ring-4 ring-emerald-400/30'
          : 'bg-slate-900/60 text-white/70 border-2 border-white/20'
      } ${!isInteractive ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'opacity-95'} ${className}`}
    >
      {/* Visual pulse glow when in action range */}
      {isActionReady && isInteractive && (
        <span
          className="absolute -inset-1 rounded-full bg-emerald-400/20 animate-ping pointer-events-none"
          aria-hidden="true"
        />
      )}

      <div className="relative z-10 flex flex-col items-center pointer-events-none">
        {iconSvg}
        <span className="text-[10px] font-bold tracking-tight uppercase leading-none mt-0.5 opacity-90">
          {badgeText}
        </span>
      </div>
    </button>
  );
};
