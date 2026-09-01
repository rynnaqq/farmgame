import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  JOYSTICK_BASE_DIAMETER,
  JOYSTICK_BASE_DIAMETER_SMALL,
  JOYSTICK_KNOB_DIAMETER,
  JOYSTICK_MAX_TRAVEL,
} from '../../game/core/constants';
import { useUiStore } from '../../state/uiStore';
import type { InputManager } from '../../game/input/InputManager';

export interface VirtualJoystickProps {
  inputManager?: InputManager;
  className?: string;
  disabled?: boolean;
}

/**
 * Translucent fixed virtual joystick for mobile touch controls:
 * - Positioned in bottom-left safe area
 * - Responsive base diameter (112px default, 96px for screen width < 380px)
 * - 48px knob with 42px max radial travel
 * - Single active pointer tracking with pointer capture
 * - Robust cleanup on cancel, blur, lost capture, and modal opening
 * - Synchronizes with InputManager and uiStore
 */
export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({
  inputManager,
  className = '',
  disabled = false,
}) => {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  // Screen width tracking for small devices (<380px)
  const [baseDiameter, setBaseDiameter] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 380) {
      return JOYSTICK_BASE_DIAMETER_SMALL;
    }
    return JOYSTICK_BASE_DIAMETER;
  });

  const activeModal = useUiStore((state) => state.activeModal);

  // Handle window resize for dynamic base scaling
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 380) {
        setBaseDiameter(JOYSTICK_BASE_DIAMETER_SMALL);
      } else {
        setBaseDiameter(JOYSTICK_BASE_DIAMETER);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const resetJoystick = useCallback(() => {
    activePointerIdRef.current = null;

    if (knobRef.current) {
      knobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
    }

    useUiStore.getState().setJoystickActive(false);
    useUiStore.getState().setJoystickVector({ x: 0, y: 0 });
    inputManager?.setJoystickVector(0, 0, false);
  }, [inputManager]);

  // Cancel joystick when a modal opens or disabled prop changes
  useEffect(() => {
    if (activeModal !== null || disabled) {
      resetJoystick();
    }
  }, [activeModal, disabled, resetJoystick]);

  // Window blur cleanup
  useEffect(() => {
    const handleBlur = () => resetJoystick();
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [resetJoystick]);

  // Native lostpointercapture listener for DOM events
  useEffect(() => {
    const el = baseRef.current;
    if (!el) return;

    const handleNativeLostCapture = (e: Event) => {
      const pointerEvent = e as PointerEvent;
      if (
        pointerEvent.pointerId === undefined ||
        activePointerIdRef.current === null ||
        activePointerIdRef.current === pointerEvent.pointerId
      ) {
        resetJoystick();
      }
    };

    el.addEventListener('lostpointercapture', handleNativeLostCapture);
    return () => el.removeEventListener('lostpointercapture', handleNativeLostCapture);
  }, [resetJoystick]);

  const updateKnobAndVector = (clientX: number, clientY: number) => {
    if (!baseRef.current) return;

    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    const maxTravel = JOYSTICK_MAX_TRAVEL;
    const clampedDist = Math.min(dist, maxTravel);

    const knobX = dist > 0 ? (dx / dist) * clampedDist : 0;
    const knobY = dist > 0 ? (dy / dist) * clampedDist : 0;

    if (knobRef.current) {
      knobRef.current.style.transform = `translate3d(${knobX}px, ${knobY}px, 0)`;
    }

    // Normalized vector [-1, 1]
    const rawX = dx / maxTravel;
    const rawY = dy / maxTravel;
    const mag = Math.hypot(rawX, rawY);

    const normX = mag > 1.0 ? rawX / mag : rawX;
    const normY = mag > 1.0 ? rawY / mag : rawY;

    useUiStore.getState().setJoystickVector({ x: normX, y: normY });
    inputManager?.setJoystickVector(normX, normY, true);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || activeModal !== null) return;
    // Only accept single pointer
    if (activePointerIdRef.current !== null) return;

    e.preventDefault();
    e.stopPropagation();

    activePointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // Ignored if pointer capture is unsupported or already released
    }

    useUiStore.getState().setJoystickActive(true);
    updateKnobAndVector(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;

    e.preventDefault();
    e.stopPropagation();
    updateKnobAndVector(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;

    e.preventDefault();
    e.stopPropagation();

    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      // Ignored
    }

    resetJoystick();
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    resetJoystick();
  };

  const handleLostPointerCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (
      e.pointerId === undefined ||
      activePointerIdRef.current === null ||
      activePointerIdRef.current === e.pointerId
    ) {
      resetJoystick();
    }
  };

  return (
    <div
      ref={baseRef}
      data-testid="virtual-joystick-base"
      aria-label="Virtual Joystick Controller"
      role="group"
      className={`relative select-none pointer-events-auto rounded-full bg-slate-900/40 backdrop-blur-md border-2 border-white/20 flex items-center justify-center shadow-lg transition-opacity duration-150 active:border-sky-400/50 ${
        disabled || activeModal !== null ? 'opacity-40 pointer-events-none' : 'opacity-90'
      } ${className}`}
      style={{
        width: `${baseDiameter}px`,
        height: `${baseDiameter}px`,
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handleLostPointerCapture}
    >
      {/* Inner guide ring */}
      <div
        className="absolute inset-2 rounded-full border border-white/10 pointer-events-none"
        aria-hidden="true"
      />

      {/* Floating joystick knob */}
      <div
        ref={knobRef}
        data-testid="virtual-joystick-knob"
        className="absolute rounded-full bg-gradient-to-b from-sky-400 to-sky-600 border-2 border-white/80 shadow-md pointer-events-none will-change-transform flex items-center justify-center"
        style={{
          width: `${JOYSTICK_KNOB_DIAMETER}px`,
          height: `${JOYSTICK_KNOB_DIAMETER}px`,
          transform: 'translate3d(0px, 0px, 0)',
        }}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-white/60 pointer-events-none" />
      </div>
    </div>
  );
};
