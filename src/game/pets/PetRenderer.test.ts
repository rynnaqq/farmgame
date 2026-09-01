import { describe, it, expect } from 'vitest';
import {
  distance2D,
  distance3D,
  shouldTeleport,
  clampFollowDistance,
  calculateTrailingTarget,
  computePetTargetYaw,
  normalizeAngle,
  lerpPetAngle,
  calculateBeeAnimation,
  calculateDogAnimation,
  calculatePigAnimation,
  calculateEggAnimation,
  PET_FOLLOW_MIN_DISTANCE,
  PET_FOLLOW_MAX_DISTANCE,
  PET_DEFAULT_FOLLOW_DISTANCE,
  PET_TELEPORT_DISTANCE,
  BEE_WING_FLUTTER_FREQ_HZ,
  BEE_HOVER_Y_BASE,
  DOG_TAIL_WAG_FREQ,
  PIG_TROT_FREQ,
  EGG_WOBBLE_FREQ,
} from './petSteeringMath';
import { PetModel } from './PetModel';
import { EggRenderer } from './EggRenderer';
import { PetRenderer } from './PetRenderer';

describe('Task 26: Procedural Pet Renderer, Egg Renderer & Steering', () => {
  describe('Constants & Configuration', () => {
    it('defines expected follow distance constraints and teleport threshold', () => {
      expect(PET_FOLLOW_MIN_DISTANCE).toBe(1.5);
      expect(PET_FOLLOW_MAX_DISTANCE).toBe(2.2);
      expect(PET_DEFAULT_FOLLOW_DISTANCE).toBe(1.85);
      expect(PET_TELEPORT_DISTANCE).toBe(12.0);
    });

    it('defines expected animation frequencies', () => {
      expect(BEE_WING_FLUTTER_FREQ_HZ).toBe(30);
      expect(BEE_HOVER_Y_BASE).toBe(1.35);
      expect(DOG_TAIL_WAG_FREQ).toBe(16.0);
      expect(PIG_TROT_FREQ).toBe(12.0);
      expect(EGG_WOBBLE_FREQ).toBe(8.0);
    });
  });

  describe('Distance & Teleport Math', () => {
    it('computes 2D Euclidean distance on XZ plane correctly with arrays and objects', () => {
      const p1: [number, number, number] = [0, 5, 0];
      const p2: [number, number, number] = [3, 10, 4];
      expect(distance2D(p1, p2)).toBeCloseTo(5.0, 4);

      const obj1 = { x: 1, z: 2 };
      const obj2 = { x: 4, z: 6 };
      expect(distance2D(obj1, obj2)).toBeCloseTo(5.0, 4);
    });

    it('computes 3D Euclidean distance correctly', () => {
      const p1: [number, number, number] = [1, 2, 3];
      const p2: [number, number, number] = [4, 6, 3];
      expect(distance3D(p1, p2)).toBeCloseTo(5.0, 4);
    });

    it('returns false when pet is within teleport distance threshold (<= 12.0)', () => {
      expect(shouldTeleport([0, 0, 0], [0, 0, 0])).toBe(false);
      expect(shouldTeleport([0, 0, 0], [6, 0, 8])).toBe(false); // distance 10
      expect(shouldTeleport([0, 0, 0], [12, 0, 0])).toBe(false);
    });

    it('returns true when pet exceeds teleport distance threshold (> 12.0)', () => {
      expect(shouldTeleport([0, 0, 0], [12.05, 0, 0])).toBe(true);
      expect(shouldTeleport([0, 0, 0], [10, 0, 10])).toBe(true); // distance ~14.14
      expect(shouldTeleport([0, 0, 0], [50, 0, 50])).toBe(true);
    });
  });

  describe('Follow Distance Clamping', () => {
    it('clamps distances below 1.5 to 1.5 units', () => {
      expect(clampFollowDistance(0)).toBe(1.5);
      expect(clampFollowDistance(1.2)).toBe(1.5);
      expect(clampFollowDistance(-5)).toBe(1.5);
    });

    it('clamps distances above 2.2 to 2.2 units', () => {
      expect(clampFollowDistance(2.5)).toBe(2.2);
      expect(clampFollowDistance(10.0)).toBe(2.2);
    });

    it('retains distances within [1.5, 2.2]', () => {
      expect(clampFollowDistance(1.5)).toBe(1.5);
      expect(clampFollowDistance(1.85)).toBe(1.85);
      expect(clampFollowDistance(2.2)).toBe(2.2);
    });
  });

  describe('Trailing Target Offset Calculation', () => {
    it('computes position behind player facing North (-Z, yaw = PI)', () => {
      const playerPos: [number, number, number] = [0, 0, 0];
      const target = calculateTrailingTarget(playerPos, Math.PI, 2.0);
      expect(target[0]).toBeCloseTo(0, 4);
      expect(target[2]).toBeCloseTo(2.0, 4);
    });

    it('computes position behind player facing South (+Z, yaw = 0)', () => {
      const playerPos: [number, number, number] = [0, 0, 0];
      const target = calculateTrailingTarget(playerPos, 0, 2.0);
      expect(target[0]).toBeCloseTo(0, 4);
      expect(target[2]).toBeCloseTo(-2.0, 4);
    });

    it('computes position behind player facing East (+X, yaw = PI/2)', () => {
      const playerPos: [number, number, number] = [5, 1, 5];
      const target = calculateTrailingTarget(playerPos, Math.PI / 2, 2.0);
      expect(target[0]).toBeCloseTo(3.0, 4);
      expect(target[1]).toBeCloseTo(1.0, 4);
      expect(target[2]).toBeCloseTo(5.0, 4);
    });

    it('computes position behind player facing West (-X, yaw = -PI/2)', () => {
      const playerPos: [number, number, number] = [5, 1, 5];
      const target = calculateTrailingTarget(playerPos, -Math.PI / 2, 2.0);
      expect(target[0]).toBeCloseTo(7.0, 4);
      expect(target[1]).toBeCloseTo(1.0, 4);
      expect(target[2]).toBeCloseTo(5.0, 4);
    });
  });

  describe('Angle Normalization & Shortest Arc Interpolation', () => {
    it('normalizes angles into [-PI, PI]', () => {
      expect(normalizeAngle(0)).toBeCloseTo(0, 5);
      expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI, 5);
      expect(normalizeAngle(-Math.PI * 3)).toBeCloseTo(-Math.PI, 5);
    });

    it('interpolates along shortest arc across the +-PI boundary', () => {
      const angle1 = Math.PI - 0.1;
      const angle2 = -Math.PI + 0.1;
      const interpolated = lerpPetAngle(angle1, angle2, 0.5);
      expect(Math.abs(interpolated)).toBeCloseTo(Math.PI, 2);
    });

    it('orients pet to face movement direction when moving', () => {
      const petPos: [number, number, number] = [0, 0, 0];
      const playerPos: [number, number, number] = [10, 0, 10];
      const moveVx = 1.0;
      const moveVz = 0.0;
      const targetYaw = computePetTargetYaw(petPos, { x: moveVx, z: moveVz }, playerPos, 0);
      expect(targetYaw).toBeCloseTo(Math.PI / 2, 4);
    });

    it('orients pet to face player when stationary', () => {
      const petPos: [number, number, number] = [0, 0, 0];
      const playerPos: [number, number, number] = [0, 0, 4];
      const targetYaw = computePetTargetYaw(petPos, { x: 0, z: 0 }, playerPos, 0);
      expect(targetYaw).toBeCloseTo(0, 4);
    });
  });

  describe('Bee Procedural Animations', () => {
    it('generates high frequency wing flutter at 30Hz', () => {
      const at0 = calculateBeeAnimation(0);
      const at1_120 = calculateBeeAnimation(1 / 120); // 90 deg phase of 30Hz
      const at1_60 = calculateBeeAnimation(1 / 60); // 180 deg phase

      expect(at0.wingPitchLeft).toBeCloseTo(0, 2);
      expect(Math.abs(at1_120.wingPitchLeft)).toBeGreaterThan(0.35);
      expect(at1_60.wingPitchLeft).toBeCloseTo(0, 2);
    });

    it('computes hovering bob offset within shoulder height range Y ~ 1.2 - 1.55', () => {
      for (let t = 0; t < 2; t += 0.1) {
        const anim = calculateBeeAnimation(t);
        expect(anim.hoverY).toBeGreaterThanOrEqual(1.2);
        expect(anim.hoverY).toBeLessThanOrEqual(1.55);
      }
    });

    it('includes antenna wobble oscillation', () => {
      const anim = calculateBeeAnimation(0.2);
      expect(anim.antennaWobble).toBeDefined();
    });
  });

  describe('Dog Procedural Animations', () => {
    it('synchronizes diagonal leg pairs for quadruped trotting', () => {
      const anim = calculateDogAnimation(0.3, 3.5, false);
      expect(anim.legPitchFrontLeft).toBeCloseTo(anim.legPitchBackRight, 3);
      expect(anim.legPitchFrontRight).toBeCloseTo(anim.legPitchBackLeft, 3);
      expect(anim.legPitchFrontLeft).toBeCloseTo(-anim.legPitchFrontRight, 3);
    });

    it('wags tail at fast cadence, amplified when moving or auto-harvesting', () => {
      const idle = calculateDogAnimation(0.2, 0, false);
      const walk = calculateDogAnimation(0.2, 2.0, false);
      const harvest = calculateDogAnimation(0.2, 0, true);

      expect(idle.tailWagYaw).toBeDefined();
      expect(walk.tailWagYaw).toBeDefined();
      expect(harvest.harvestBounceY).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Pig Procedural Animations', () => {
    it('trots with 4 stubby legs when moving', () => {
      const anim = calculatePigAnimation(0.4, 3.0);
      expect(anim.legPitchFrontLeft).toBeCloseTo(anim.legPitchBackRight, 3);
      expect(anim.legPitchFrontRight).toBeCloseTo(anim.legPitchBackLeft, 3);
      expect(anim.trotBounceY).toBeGreaterThan(0);
      expect(anim.snoutTwitchY).toBeDefined();
      expect(anim.tailCurlRotation).toBeDefined();
    });

    it('rests legs when stationary', () => {
      const idle = calculatePigAnimation(0.4, 0);
      expect(idle.legPitchFrontLeft).toBe(0);
      expect(idle.legPitchFrontRight).toBe(0);
      expect(idle.trotBounceY).toBe(0);
    });
  });

  describe('Egg Procedural Animations', () => {
    it('remains steady when not incubating', () => {
      const anim = calculateEggAnimation(1.0, 0.4, false);
      expect(anim.wobbleRollZ).toBe(0);
      expect(anim.wobblePitchX).toBe(0);
      expect(anim.isHatchingShake).toBe(false);
      expect(anim.glowIntensity).toBe(0);
      expect(anim.crackStage).toBe(0);
    });

    it('wobbles and progresses crack stages as incubation increases', () => {
      const stage0 = calculateEggAnimation(0.2, 0.2, true);
      expect(stage0.crackStage).toBe(0);

      const stage1 = calculateEggAnimation(0.2, 0.55, true);
      expect(stage1.crackStage).toBe(1);

      const stage2 = calculateEggAnimation(0.2, 0.85, true);
      expect(stage2.crackStage).toBe(2);

      const stage3 = calculateEggAnimation(0.2, 1.0, true);
      expect(stage3.crackStage).toBe(3);
      expect(stage3.isHatchingShake).toBe(true);
      expect(stage3.glowIntensity).toBeGreaterThan(0.5);
    });
  });

  describe('Component Export & Structure Verification', () => {
    it('exports PetModel, EggRenderer, and PetRenderer as React components', () => {
      expect(typeof PetModel).toBe('function');
      expect(typeof EggRenderer).toBe('function');
      expect(typeof PetRenderer).toBe('function');
    });
  });
});
