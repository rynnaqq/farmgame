/**
 * Mutable, non-React per-frame player transform channel.
 *
 * The PlayerController writes the exact rigid-body transform here every frame
 * (60+ fps) and the FollowCamera reads it every frame — with zero zustand
 * notifications and zero React re-renders. The zustand gameStore keeps a
 * throttled copy (~10 Hz) for gameplay UI (mobile target highlighting,
 * merchant proximity, persistence); nothing render-critical may depend on the
 * throttled copy.
 */
export interface PlayerTransform {
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** Smoothed horizontal speed in units/sec (drives locomotion anims). */
  speed: number;
}

export const playerTransform: PlayerTransform = {
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  speed: 0,
};
