import React, { useState, useEffect, useMemo } from 'react';
import { VirtualJoystick } from './VirtualJoystick';
import { useSettingsStore } from '../../state/settingsStore';
import { useUiStore } from '../../state/uiStore';
import type { InputManager } from '../../game/input/InputManager';

export interface MobileHUDProps {
  inputManager?: InputManager;
  forceTouch?: boolean;
  className?: string;
}

/**
 * Checks whether the current device/viewport should display mobile touch controls.
 */
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
 * Responsive Mobile Touch Controls HUD layer:
 * - Floating VirtualJoystick in bottom-left safe area
 * - Jump button in bottom-right safe area
 * - Non-blocking overlay container with pointer-events-none
 *
 * Farming uses direct plot taps (no reach rule) and tool switching via the
 * Toolbelt; the shop opens by tapping the merchant NPC directly.
 */
export const MobileHUD: React.FC<MobileHUDProps> = ({
  inputManager,
  forceTouch,
  className = '',
}) => {
  const inputMode = useSettingsStore((state) => state.inputMode);
  const activeModal = useUiStore((state) => state.activeModal);

  const [isTouchEnvironment, setIsTouchEnvironment] = useState<boolean>(() => {
    return forceTouch !== undefined ? forceTouch : checkIsTouchDevice();
  });

  // Keep touch detection up to date with resize / media query changes
  useEffect(() => {
    if (forceTouch !== undefined) {
      setIsTouchEnvironment(forceTouch);
      return;
    }

    const handleResize = () => {
      setIsTouchEnvironment(checkIsTouchDevice());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [forceTouch]);

  // Determine if HUD should be visible based on settings and environment
  const shouldRender = useMemo(() => {
    if (forceTouch === true) return true;
    if (forceTouch === false) return false;
    if (inputMode === 'touch') return true;
    if (inputMode === 'desktop') return false;
    return isTouchEnvironment;
  }, [inputMode, isTouchEnvironment, forceTouch]);

  if (!shouldRender) {
    return null;
  }

  const isModalOpen = activeModal !== null;

  return (
    <div
      data-testid="mobile-hud-container"
      data-modal-open={isModalOpen ? 'true' : 'false'}
      className={`fixed inset-0 pointer-events-none z-20 flex flex-col justify-end p-4 select-none ${className}`}
      style={{
        paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Bottom controls row */}
      <div className="w-full flex items-end justify-between pointer-events-none">
        {/* Lower-left: Virtual Joystick */}
        <div className="pointer-events-auto">
          <VirtualJoystick inputManager={inputManager} disabled={isModalOpen} />
        </div>

        {/* Lower-right: Jump Button (Circular with Up Arrow ↑) */}
        <div className="pointer-events-auto flex flex-col items-center gap-3">
          <button
            type="button"
            data-testid="mobile-jump-button"
            aria-label="Jump"
            disabled={isModalOpen}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              inputManager?.triggerJump();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className={`w-16 h-16 rounded-full bg-slate-900/90 hover:bg-slate-800/90 active:scale-90 border-2 border-white/40 text-white shadow-2xl flex items-center justify-center cursor-pointer transition-transform duration-100 ${
              isModalOpen ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            <svg
              className="w-8 h-8 text-white stroke-[2.5]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
