import React from 'react';
import type { InputManager } from '../input/InputManager';
import { PlayerController } from './PlayerController';

export interface PlayerProps {
  initialPosition?: [number, number, number];
  inputManager?: InputManager;
  onFall?: () => void;
}

/**
 * Player Entity Component:
 * Composes the kinematic Rapier PlayerController, physics capsule collider,
 * and procedural low-poly gardener PlayerModel.
 */
export const Player: React.FC<PlayerProps> = ({
  initialPosition,
  inputManager,
  onFall,
}) => {
  return (
    <PlayerController
      initialPosition={initialPosition}
      inputManager={inputManager}
      onFall={onFall}
    />
  );
};
