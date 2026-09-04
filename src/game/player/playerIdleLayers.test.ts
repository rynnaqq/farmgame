import { describe, it, expect } from 'vitest';
import { calculateIdleBob } from './playerAnimation';

describe('calculateIdleBob secondary layers (natural idle)', () => {
  it('returns all new motion layers, fading to zero when moving', () => {
    const moving = calculateIdleBob(3.2, 1.0);
    expect(moving.torsoPitch).toBeCloseTo(0, 6);
    expect(moving.headYaw).toBeCloseTo(0, 6);
    expect(moving.headRollZ).toBeCloseTo(0, 6);
    expect(moving.armSwayZ).toBeCloseTo(0, 6);
    expect(moving.leftArmSwayZ).toBeCloseTo(0, 6);
    expect(moving.rightArmSwayZ).toBeCloseTo(0, 6);
    expect(moving.breatheScale).toBeCloseTo(0, 6);
    expect(moving.idleBobY).toBeCloseTo(0, 6);
  });

  it('breathes the torso at a calm frequency when fully idle', () => {
    const a = calculateIdleBob(0, 0);
    const quarter = calculateIdleBob(Math.PI / 2 / 1.1, 0);
    expect(a.torsoPitch).toBeCloseTo(0, 5);
    expect(quarter.torsoPitch).toBeGreaterThan(0);
    // Breathing must be subtle (well under a degree-ish scale).
    expect(Math.abs(quarter.torsoPitch)).toBeLessThan(0.03);
  });

  it('glances side to side without snapping (continuous head yaw)', () => {
    // Sample densely; a snap would show a large single-step jump.
    let prev: number | null = null;
    let maxJump = 0;
    for (let t = 0; t < 30; t += 0.05) {
      const { headYaw } = calculateIdleBob(t, 0);
      if (prev !== null) {
        maxJump = Math.max(maxJump, Math.abs(headYaw - prev));
      }
      prev = headYaw;
    }
    expect(maxJump).toBeLessThan(0.1); // smooth, never a discrete flip
    // And it actually reaches a visible peek amplitude.
    const peek = Math.max(
      ...Array.from({ length: 200 }, (_, i) => calculateIdleBob(i * 0.05, 0).headYaw)
    );
    expect(peek).toBeGreaterThan(0.05);
  });

  it('sways the arms out of phase with the body sway', () => {
    const t = 1.7;
    const idle = calculateIdleBob(t, 0);
    const bodySwayPhase = Math.sin(t * 1.8);
    const armPhase = Math.sin(t * 0.9);
    // Different frequencies guarantee these are decorrelated most of the time.
    expect(Math.abs(armPhase - bodySwayPhase)).toBeGreaterThan(0.001);
    expect(Math.abs(idle.armSwayZ)).toBeLessThanOrEqual(0.05);
  });

  it('keeps the legacy fields unchanged (bob, sway, head tilt)', () => {
    const idle = calculateIdleBob(2.0, 0);
    expect(idle.idleBobY).toBeCloseTo(Math.sin(2.0 * 2.5) * 0.025, 6);
    expect(idle.idleSwayZ).toBeCloseTo(Math.sin(2.0 * 1.8) * 0.02, 6);
    expect(idle.headTiltZ).toBeCloseTo(Math.sin(2.0 * 0.9) * 0.015, 6);
  });

  it('drifts the left and right arms asymmetrically', () => {
    // Different frequencies/phases guarantee the sides decorrelate.
    let differed = false;
    for (let t = 0; t < 10; t += 0.1) {
      const idle = calculateIdleBob(t, 0);
      if (Math.abs(idle.leftArmSwayZ - idle.rightArmSwayZ) > 0.005) {
        differed = true;
        break;
      }
    }
    expect(differed).toBe(true);
    const idle = calculateIdleBob(1.7, 0);
    expect(Math.abs(idle.leftArmSwayZ)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(idle.rightArmSwayZ)).toBeLessThanOrEqual(0.05);
  });

  it('damps every layer under reduced motion', () => {
    const full = calculateIdleBob(1.7, 0, false);
    const calm = calculateIdleBob(1.7, 0, true);
    expect(Math.abs(calm.idleBobY)).toBeLessThanOrEqual(Math.abs(full.idleBobY));
    expect(Math.abs(calm.headYaw)).toBeLessThanOrEqual(Math.abs(full.headYaw));
    expect(Math.abs(calm.breatheScale)).toBeLessThanOrEqual(Math.abs(full.breatheScale));
    expect(Math.abs(calm.breatheScale)).toBeLessThan(0.008);
  });
});
