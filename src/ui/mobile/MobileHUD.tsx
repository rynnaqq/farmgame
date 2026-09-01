import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { VirtualJoystick } from './VirtualJoystick';
import { MobileActionButton } from './MobileActionButton';
import { findNearestTargetPlot, isMerchantInRange } from './targetPlotFinder';
import { useSettingsStore } from '../../state/settingsStore';
import { useGameStore } from '../../state/gameStore';
import { useUiStore } from '../../state/uiStore';
import type { InputManager } from '../../game/input/InputManager';
import type { PlotId, ToolType } from '../../state/storeTypes';

export interface MobileHUDProps {
  inputManager?: InputManager;
  onPlotInteract?: (plotId: PlotId, tool: ToolType) => void;
  forceTouch?: boolean;
  className?: string;
}

/**
 * Checks whether the current device/viewport should display mobile touch controls.
 */
function checkIsTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;

  const hasCoarsePointer =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;

  const hasTouchCapability =
    'ontouchstart' in window ||
    (typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0);

  const isMobileWidth = window.innerWidth <= 768;

  return hasCoarsePointer || hasTouchCapability || isMobileWidth;
}

/**
 * Responsive Mobile Touch Controls HUD layer:
 * - Floating VirtualJoystick in bottom-left safe area
 * - Large Contextual Action Button in bottom-right safe area
 * - Non-blocking overlay container with pointer-events-none
 * - Continuous target plot & merchant proximity calculation
 */
export const MobileHUD: React.FC<MobileHUDProps> = ({
  inputManager,
  onPlotInteract,
  forceTouch,
  className = '',
}) => {
  const inputMode = useSettingsStore((state) => state.inputMode);
  const activeModal = useUiStore((state) => state.activeModal);
  const selectedTool = useUiStore((state) => state.selectedTool);

  const playerPosition = useGameStore((state) => state.player.position);
  const farmPlots = useGameStore((state) => state.farm.plots);
  const gridSize = useGameStore((state) => state.farm.gridSize);

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

  // Calculate nearest target plot in player forward cone & reach
  const playerYaw = inputManager ? inputManager.getCameraYaw() : 0;

  const targetPlotResult = useMemo(() => {
    return findNearestTargetPlot(
      playerPosition,
      playerYaw,
      farmPlots,
      gridSize,
      selectedTool,
      { filterByTool: false }
    );
  }, [playerPosition, playerYaw, farmPlots, gridSize, selectedTool]);

  // Check merchant proximity
  const nearMerchant = useMemo(() => {
    return isMerchantInRange(playerPosition);
  }, [playerPosition]);

  // Synchronize targeted plot ID with uiStore
  useEffect(() => {
    const currentTargeted = useUiStore.getState().targetedPlotId;
    const nextTargeted = targetPlotResult?.plot.id ?? null;
    if (currentTargeted !== nextTargeted) {
      useUiStore.getState().setTargetedPlot(nextTargeted);
    }
  }, [targetPlotResult]);

  const handleActionButton = useCallback(() => {
    if (nearMerchant) {
      useUiStore.getState().openModal('shop');
      return;
    }

    if (targetPlotResult) {
      onPlotInteract?.(targetPlotResult.plot.id, selectedTool);
    } else {
      useUiStore.getState().showToast('Move closer to a plot', 'info', 2000);
    }
  }, [nearMerchant, targetPlotResult, selectedTool, onPlotInteract]);

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
          <VirtualJoystick
            inputManager={inputManager}
            disabled={isModalOpen}
          />
        </div>

        {/* Lower-right: Contextual Action Button */}
        <div className="pointer-events-auto">
          <MobileActionButton
            selectedTool={selectedTool}
            hasTarget={targetPlotResult !== null}
            nearMerchant={nearMerchant}
            onAction={handleActionButton}
            disabled={isModalOpen}
          />
        </div>
      </div>
    </div>
  );
};
