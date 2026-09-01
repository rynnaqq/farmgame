import { describe, it, expect } from 'vitest';
import {
  getQualityParticleCapacity,
  createParticleBuffer,
  spawnParticle,
  recycleParticle,
  recycleAllParticles,
  updateParticleStep,
  spawnBurst,
  initRainParticles,
  initHeatMoteParticles,
  initBloodMoteParticles,
  stepRainParticles,
  stepHeatMoteParticles,
  stepBloodMoteParticles,
  stepBurstParticles,
  emitParticleBurst,
  subscribeParticleBursts,
  type ParticleBounds,
  type ParticleBurstEvent,
} from './particlePoolMath';

describe('Particle Pool Math & Buffer Management', () => {
  const defaultBounds: ParticleBounds = {
    minX: -14,
    maxX: 14,
    minY: 0,
    maxY: 16,
    minZ: -14,
    maxZ: 14,
  };

  describe('1. Quality-Scaled Capacity Calculations', () => {
    it('scales particle capacities according to quality level (Low 30%, Medium 65%, High 100%)', () => {
      const baseCount = 100;
      expect(getQualityParticleCapacity(baseCount, 'low')).toBe(30);
      expect(getQualityParticleCapacity(baseCount, 'medium')).toBe(65);
      expect(getQualityParticleCapacity(baseCount, 'high')).toBe(100);
    });

    it('correctly rounds capacities for rain particle base of 600', () => {
      const rainBase = 600;
      expect(getQualityParticleCapacity(rainBase, 'low')).toBe(180);
      expect(getQualityParticleCapacity(rainBase, 'medium')).toBe(390);
      expect(getQualityParticleCapacity(rainBase, 'high')).toBe(600);
    });

    it('handles base capacity of 0 or small values gracefully', () => {
      expect(getQualityParticleCapacity(0, 'low')).toBe(0);
      expect(getQualityParticleCapacity(1, 'low')).toBe(0);
      expect(getQualityParticleCapacity(5, 'low')).toBe(2);
      expect(getQualityParticleCapacity(5, 'medium')).toBe(3);
      expect(getQualityParticleCapacity(5, 'high')).toBe(5);
    });
  });

  describe('2. Particle Buffer Allocation and Lifecycle', () => {
    it('allocates pre-sized TypedArrays matching buffer capacity', () => {
      const capacity = 50;
      const buffer = createParticleBuffer(capacity);

      expect(buffer.capacity).toBe(50);
      expect(buffer.activeCount).toBe(0);
      expect(buffer.positions.length).toBe(50 * 3);
      expect(buffer.velocities.length).toBe(50 * 3);
      expect(buffer.scales.length).toBe(50);
      expect(buffer.lifetimes.length).toBe(50);
      expect(buffer.maxLifetimes.length).toBe(50);
      expect(buffer.colors.length).toBe(50 * 3);
      expect(buffer.active.length).toBe(50);
    });

    it('spawns a single particle and sets attributes accurately', () => {
      const buffer = createParticleBuffer(10);
      const index = spawnParticle(
        buffer,
        1,
        2,
        3, // pos
        0.1,
        0.2,
        0.3, // vel
        1.5, // scale
        2.0, // lifetime
        [1.0, 0.5, 0.2] // color
      );

      expect(index).toBe(0);
      expect(buffer.activeCount).toBe(1);
      expect(buffer.active[0]).toBe(1);
      expect(buffer.positions[0]).toBeCloseTo(1);
      expect(buffer.positions[1]).toBeCloseTo(2);
      expect(buffer.positions[2]).toBeCloseTo(3);
      expect(buffer.velocities[0]).toBeCloseTo(0.1);
      expect(buffer.velocities[1]).toBeCloseTo(0.2);
      expect(buffer.velocities[2]).toBeCloseTo(0.3);
      expect(buffer.scales[0]).toBeCloseTo(1.5);
      expect(buffer.lifetimes[0]).toBeCloseTo(2.0);
      expect(buffer.maxLifetimes[0]).toBeCloseTo(2.0);
      expect(buffer.colors[0]).toBeCloseTo(1.0);
      expect(buffer.colors[1]).toBeCloseTo(0.5);
      expect(buffer.colors[2]).toBeCloseTo(0.2);
    });

    it('recycles a specific particle and frees its slot', () => {
      const buffer = createParticleBuffer(5);
      spawnParticle(buffer, 0, 0, 0, 0, 0, 0, 1, 2);
      spawnParticle(buffer, 1, 1, 1, 0, 0, 0, 1, 2);
      expect(buffer.activeCount).toBe(2);

      recycleParticle(buffer, 0);
      expect(buffer.active[0]).toBe(0);
      expect(buffer.activeCount).toBe(1);

      // Next spawn should reuse the freed index 0
      const newIndex = spawnParticle(buffer, 9, 9, 9, 0, 0, 0, 1, 3);
      expect(newIndex).toBe(0);
      expect(buffer.positions[0]).toBeCloseTo(9);
      expect(buffer.activeCount).toBe(2);
    });

    it('recycles all particles on full reset', () => {
      const buffer = createParticleBuffer(5);
      spawnParticle(buffer, 0, 0, 0, 0, 0, 0, 1, 2);
      spawnParticle(buffer, 1, 1, 1, 0, 0, 0, 1, 2);
      spawnParticle(buffer, 2, 2, 2, 0, 0, 0, 1, 2);
      expect(buffer.activeCount).toBe(3);

      recycleAllParticles(buffer);
      expect(buffer.activeCount).toBe(0);
      for (let i = 0; i < buffer.capacity; i++) {
        expect(buffer.active[i]).toBe(0);
      }
    });

    it('handles buffer saturation when capacity is exceeded', () => {
      const buffer = createParticleBuffer(2);
      expect(spawnParticle(buffer, 0, 0, 0, 0, 0, 0, 1, 1)).toBe(0);
      expect(spawnParticle(buffer, 1, 1, 1, 0, 0, 0, 1, 1)).toBe(1);
      // Capacity full: returns -1 (or safely recycles oldest)
      const overflowIndex = spawnParticle(buffer, 2, 2, 2, 0, 0, 0, 1, 1);
      expect(overflowIndex).toBe(-1);
    });
  });

  describe('3. Velocity Step Calculations & Lifetime Expiration', () => {
    it('advances particle positions according to velocity and delta time', () => {
      const buffer = createParticleBuffer(5);
      spawnParticle(buffer, 0, 10, 0, 2, -5, 1, 1, 5);

      updateParticleStep(buffer, 0.5, defaultBounds);

      expect(buffer.positions[0]).toBeCloseTo(0 + 2 * 0.5); // 1.0
      expect(buffer.positions[1]).toBeCloseTo(10 - 5 * 0.5); // 7.5
      expect(buffer.positions[2]).toBeCloseTo(0 + 1 * 0.5); // 0.5
      expect(buffer.lifetimes[0]).toBeCloseTo(5 - 0.5); // 4.5
    });

    it('applies downward gravity acceleration to velocities when specified', () => {
      const buffer = createParticleBuffer(5);
      spawnParticle(buffer, 0, 5, 0, 0, 4, 0, 1, 2);

      updateParticleStep(buffer, 0.5, defaultBounds, { gravity: 9.8 });

      // vy_next = 4 - 9.8 * 0.5 = -0.9
      expect(buffer.velocities[1]).toBeCloseTo(-0.9);
      // y_next = 5 + (-0.9) * 0.5 = 4.55
      expect(buffer.positions[1]).toBeCloseTo(4.55);
    });

    it('automatically recycles burst particles when lifetime expires', () => {
      const buffer = createParticleBuffer(5);
      spawnParticle(buffer, 0, 5, 0, 0, 0, 0, 1, 0.5);

      // Advance by 0.3s -> still active
      const res1 = updateParticleStep(buffer, 0.3, defaultBounds);
      expect(res1.activeCount).toBe(1);
      expect(buffer.active[0]).toBe(1);

      // Advance by another 0.3s (total 0.6s > 0.5s) -> expired and recycled
      const res2 = updateParticleStep(buffer, 0.3, defaultBounds);
      expect(res2.activeCount).toBe(0);
      expect(res2.recycledCount).toBe(1);
      expect(buffer.active[0]).toBe(0);
    });

    it('recycles particles that cross bounds when respawnOnBounds is false', () => {
      const buffer = createParticleBuffer(5);
      spawnParticle(buffer, 0, 1, 0, 0, -5, 0, 1, 10); // Will hit y=0 in 0.2s

      const res = updateParticleStep(buffer, 0.5, defaultBounds, { respawnOnBounds: false });
      expect(res.activeCount).toBe(0);
      expect(res.recycledCount).toBe(1);
    });
  });

  describe('4. Weather Continuous Particle Systems', () => {
    describe('Rain Particles', () => {
      it('initializes rain particles within spawn bounding box with downward velocity', () => {
        const buffer = createParticleBuffer(20);
        initRainParticles(buffer, defaultBounds, 20);

        expect(buffer.activeCount).toBe(20);
        for (let i = 0; i < 20; i++) {
          expect(buffer.active[i]).toBe(1);
          expect(buffer.positions[i * 3]).toBeGreaterThanOrEqual(defaultBounds.minX);
          expect(buffer.positions[i * 3]).toBeLessThanOrEqual(defaultBounds.maxX);
          expect(buffer.positions[i * 3 + 1]).toBeGreaterThanOrEqual(defaultBounds.minY);
          expect(buffer.positions[i * 3 + 1]).toBeLessThanOrEqual(defaultBounds.maxY);
          expect(buffer.positions[i * 3 + 2]).toBeGreaterThanOrEqual(defaultBounds.minZ);
          expect(buffer.positions[i * 3 + 2]).toBeLessThanOrEqual(defaultBounds.maxZ);
          // Negative downward velocity
          expect(buffer.velocities[i * 3 + 1]).toBeLessThan(-5);
        }
      });

      it('wraps falling rain particles to top bound when hitting ground and calls splash callback', () => {
        const buffer = createParticleBuffer(5);
        spawnParticle(buffer, 2, 0.5, 3, 0, -10, 0, 1, 10);

        let splashCalled = false;
        let splashX = 0;
        let splashZ = 0;

        stepRainParticles(buffer, 0.1, defaultBounds, (x, z) => {
          splashCalled = true;
          splashX = x;
          splashZ = z;
        });

        expect(splashCalled).toBe(true);
        expect(splashX).toBeCloseTo(2);
        expect(splashZ).toBeCloseTo(3);
        // Particle y position reset to near top (defaultBounds.maxY)
        expect(buffer.positions[1]).toBeGreaterThanOrEqual(defaultBounds.maxY - 2);
      });
    });

    describe('Heat Haze Motes', () => {
      it('initializes heat motes within island bounds with upward drift and warm color', () => {
        const buffer = createParticleBuffer(15);
        initHeatMoteParticles(buffer, defaultBounds, 15);

        expect(buffer.activeCount).toBe(15);
        for (let i = 0; i < 15; i++) {
          expect(buffer.active[i]).toBe(1);
          // Positive upward drift velocity
          expect(buffer.velocities[i * 3 + 1]).toBeGreaterThan(0);
          // Warm amber color (r > 0.7, g > 0.3)
          expect(buffer.colors[i * 3]).toBeGreaterThan(0.7);
          expect(buffer.colors[i * 3 + 1]).toBeGreaterThan(0.3);
        }
      });

      it('animates horizontal sinusoidal wave motion and recycles/wraps at upper height limit', () => {
        const buffer = createParticleBuffer(5);
        spawnParticle(buffer, 0, defaultBounds.maxY - 0.2, 0, 0, 1.0, 0, 1, 5);

        stepHeatMoteParticles(buffer, 0.5, defaultBounds, 1.0);

        // Position wrapped back to lower y near ground
        expect(buffer.positions[1]).toBeLessThanOrEqual(defaultBounds.minY + 2);
      });
    });

    describe('Blood Moon Crimson Motes', () => {
      it('initializes crimson motes with red palette and slow upward drift', () => {
        const buffer = createParticleBuffer(10);
        initBloodMoteParticles(buffer, defaultBounds, 10);

        expect(buffer.activeCount).toBe(10);
        for (let i = 0; i < 10; i++) {
          // Crimson color (r > 0.6, g < 0.4)
          expect(buffer.colors[i * 3]).toBeGreaterThan(0.6);
          expect(buffer.colors[i * 3 + 1]).toBeLessThan(0.4);
        }
      });

      it('steps blood motes with undulating swirling motion', () => {
        const buffer = createParticleBuffer(5);
        spawnParticle(buffer, 0, 2, 0, 0.2, 0.5, 0.1, 1, 5);

        stepBloodMoteParticles(buffer, 0.1, defaultBounds, 0.5);

        expect(buffer.positions[1]).toBeGreaterThan(2);
      });
    });
  });

  describe('5. Gameplay Bursts (Splashes, Sparkles) & Event Dispatcher', () => {
    it('spawns a radial burst of particles from an origin position', () => {
      const buffer = createParticleBuffer(30);
      const origin: [number, number, number] = [3, 0.5, -2];

      const spawned = spawnBurst(buffer, 12, origin, {
        speedMin: 1.0,
        speedMax: 3.0,
        lifetimeMin: 0.5,
        lifetimeMax: 1.0,
        scaleMin: 0.1,
        scaleMax: 0.3,
        color: [0.3, 0.7, 1.0],
        gravity: 9.8,
      });

      expect(spawned).toBe(12);
      expect(buffer.activeCount).toBe(12);
      // All spawned particles start near origin
      for (let i = 0; i < 12; i++) {
        expect(buffer.positions[i * 3]).toBeCloseTo(3);
        expect(buffer.positions[i * 3 + 1]).toBeCloseTo(0.5);
        expect(buffer.positions[i * 3 + 2]).toBeCloseTo(-2);
        expect(buffer.colors[i * 3]).toBeCloseTo(0.3);
      }
    });

    it('steps burst particles with gravity and shrinks scale as lifetime decreases', () => {
      const buffer = createParticleBuffer(10);
      spawnBurst(buffer, 5, [0, 1, 0], {
        speedMin: 2.0,
        speedMax: 2.0,
        lifetimeMin: 1.0,
        lifetimeMax: 1.0,
        scaleMin: 0.5,
        scaleMax: 0.5,
        color: [1, 1, 0],
      });

      stepBurstParticles(buffer, 0.5, 9.8);

      expect(buffer.activeCount).toBe(5);
      // Scale should be reduced proportional to remaining life (0.5 remaining / 1.0 initial = 0.5x scale)
      expect(buffer.scales[0]).toBeCloseTo(0.25);
    });

    it('dispatches particle burst events to subscribers', () => {
      const eventsReceived: ParticleBurstEvent[] = [];
      const unsubscribe = subscribeParticleBursts((event) => {
        eventsReceived.push(event);
      });

      emitParticleBurst({
        type: 'splash',
        position: [1, 0, 2],
        count: 10,
      });

      emitParticleBurst({
        type: 'sparkle',
        position: [4, 0, 5],
        count: 15,
      });

      expect(eventsReceived).toHaveLength(2);
      expect(eventsReceived[0].type).toBe('splash');
      expect(eventsReceived[0].position).toEqual([1, 0, 2]);
      expect(eventsReceived[1].type).toBe('sparkle');

      unsubscribe();

      emitParticleBurst({
        type: 'splash',
        position: [0, 0, 0],
      });
      // Should not receive any more after unsubscribe
      expect(eventsReceived).toHaveLength(2);
    });
  });
});
