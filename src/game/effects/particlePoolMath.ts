import type { QualityLevel } from '../core/constants';

// ============================================================================
// Types and Interfaces
// ============================================================================

export type ParticleType =
  'rain' | 'rain_splash' | 'heat_mote' | 'blood_mote' | 'splash' | 'sparkle';

export interface ParticleBuffer {
  capacity: number;
  activeCount: number;
  positions: Float32Array; // [x, y, z, x, y, z, ...]
  velocities: Float32Array; // [vx, vy, vz, vx, vy, vz, ...]
  scales: Float32Array; // [currentScale, ...]
  baseScales: Float32Array; // [initialScale, ...]
  lifetimes: Float32Array; // [remainingLifeSec, ...]
  maxLifetimes: Float32Array; // [initialLifeSec, ...]
  colors: Float32Array; // [r, g, b, r, g, b, ...]
  active: Uint8Array; // [1 = alive, 0 = dead]
  phases: Float32Array; // for sinusoidal movement variation
}

export interface ParticleBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface StepOptions {
  gravity?: number;
  drag?: number;
  respawnOnBounds?: boolean;
  respawnY?: number;
}

export interface BurstConfig {
  speedMin?: number;
  speedMax?: number;
  lifetimeMin?: number;
  lifetimeMax?: number;
  scaleMin?: number;
  scaleMax?: number;
  color?: [number, number, number];
  gravity?: number;
}

export interface ParticleBurstEvent {
  type: 'splash' | 'sparkle' | 'rain_splash';
  position: [number, number, number];
  count?: number;
  color?: [number, number, number] | string;
  scale?: number;
}

// ============================================================================
// Quality Scaling
// ============================================================================

/**
 * Calculates quality-scaled particle capacity according to farm.md specs:
 * Low: 30%, Medium: 65%, High: 100%.
 */
export function getQualityParticleCapacity(
  baseCapacity: number,
  quality: QualityLevel | 'low' | 'medium' | 'high'
): number {
  if (baseCapacity <= 0) return 0;
  switch (quality) {
    case 'low':
      return Math.round(baseCapacity * 0.3);
    case 'medium':
      return Math.round(baseCapacity * 0.65);
    case 'high':
    case 'auto':
    default:
      return Math.round(baseCapacity * 1.0);
  }
}

// ============================================================================
// Buffer Creation and Management
// ============================================================================

/**
 * Preallocates continuous TypedArrays for zero per-frame allocation.
 */
export function createParticleBuffer(capacity: number): ParticleBuffer {
  const cap = Math.max(1, capacity);
  return {
    capacity: cap,
    activeCount: 0,
    positions: new Float32Array(cap * 3),
    velocities: new Float32Array(cap * 3),
    scales: new Float32Array(cap),
    baseScales: new Float32Array(cap),
    lifetimes: new Float32Array(cap),
    maxLifetimes: new Float32Array(cap),
    colors: new Float32Array(cap * 3),
    active: new Uint8Array(cap),
    phases: new Float32Array(cap),
  };
}

/**
 * Spawns a single particle into the buffer if a free slot exists.
 * Returns the index of the spawned particle, or -1 if full.
 */
export function spawnParticle(
  buffer: ParticleBuffer,
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
  scale: number,
  lifetime: number,
  color?: [number, number, number],
  phase?: number
): number {
  let targetIndex = -1;

  for (let i = 0; i < buffer.capacity; i++) {
    if (buffer.active[i] === 0) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex === -1) {
    return -1;
  }

  const pIdx = targetIndex * 3;
  buffer.positions[pIdx] = x;
  buffer.positions[pIdx + 1] = y;
  buffer.positions[pIdx + 2] = z;

  buffer.velocities[pIdx] = vx;
  buffer.velocities[pIdx + 1] = vy;
  buffer.velocities[pIdx + 2] = vz;

  buffer.scales[targetIndex] = scale;
  buffer.baseScales[targetIndex] = scale;
  buffer.lifetimes[targetIndex] = lifetime;
  buffer.maxLifetimes[targetIndex] = lifetime;

  if (color) {
    buffer.colors[pIdx] = color[0];
    buffer.colors[pIdx + 1] = color[1];
    buffer.colors[pIdx + 2] = color[2];
  } else {
    buffer.colors[pIdx] = 1.0;
    buffer.colors[pIdx + 1] = 1.0;
    buffer.colors[pIdx + 2] = 1.0;
  }

  buffer.phases[targetIndex] = phase ?? Math.random() * Math.PI * 2;
  buffer.active[targetIndex] = 1;
  buffer.activeCount++;

  return targetIndex;
}

/**
 * Recycles a single particle, marking its slot as available.
 */
export function recycleParticle(buffer: ParticleBuffer, index: number): void {
  if (index >= 0 && index < buffer.capacity && buffer.active[index] === 1) {
    buffer.active[index] = 0;
    buffer.scales[index] = 0;
    buffer.lifetimes[index] = 0;
    buffer.activeCount = Math.max(0, buffer.activeCount - 1);
  }
}

/**
 * Recycles all particles, resetting the buffer.
 */
export function recycleAllParticles(buffer: ParticleBuffer): void {
  buffer.active.fill(0);
  buffer.scales.fill(0);
  buffer.lifetimes.fill(0);
  buffer.activeCount = 0;
}

// ============================================================================
// Simulation Steps
// ============================================================================

/**
 * Advances particle positions and lifetimes by deltaSec.
 */
export function updateParticleStep(
  buffer: ParticleBuffer,
  deltaSec: number,
  bounds: ParticleBounds,
  options?: StepOptions
): { activeCount: number; recycledCount: number } {
  let recycledCount = 0;
  const gravity = options?.gravity ?? 0;
  const respawnOnBounds = options?.respawnOnBounds ?? false;

  for (let i = 0; i < buffer.capacity; i++) {
    if (buffer.active[i] === 0) continue;

    const pIdx = i * 3;

    // Apply gravity
    if (gravity !== 0) {
      buffer.velocities[pIdx + 1] -= gravity * deltaSec;
    }

    // Advance position
    buffer.positions[pIdx] += buffer.velocities[pIdx] * deltaSec;
    buffer.positions[pIdx + 1] += buffer.velocities[pIdx + 1] * deltaSec;
    buffer.positions[pIdx + 2] += buffer.velocities[pIdx + 2] * deltaSec;

    // Advance lifetime
    buffer.lifetimes[i] -= deltaSec;

    const posX = buffer.positions[pIdx];
    const posY = buffer.positions[pIdx + 1];
    const posZ = buffer.positions[pIdx + 2];

    const outOfBounds =
      posX < bounds.minX ||
      posX > bounds.maxX ||
      posY < bounds.minY ||
      posY > bounds.maxY ||
      posZ < bounds.minZ ||
      posZ > bounds.maxZ;

    if (buffer.lifetimes[i] <= 0 || outOfBounds) {
      if (respawnOnBounds) {
        // Wrap / re-spawn particle within bounds
        buffer.positions[pIdx] = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
        buffer.positions[pIdx + 1] = options?.respawnY ?? bounds.maxY;
        buffer.positions[pIdx + 2] = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
        buffer.lifetimes[i] = buffer.maxLifetimes[i];
      } else {
        recycleParticle(buffer, i);
        recycledCount++;
      }
    }
  }

  return { activeCount: buffer.activeCount, recycledCount };
}

// ============================================================================
// Continuous Weather Particles
// ============================================================================

/**
 * Initializes rain particles distributed throughout the island volume.
 */
export function initRainParticles(
  buffer: ParticleBuffer,
  bounds: ParticleBounds,
  count: number
): void {
  recycleAllParticles(buffer);
  const targetCount = Math.min(count, buffer.capacity);

  for (let i = 0; i < targetCount; i++) {
    const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
    const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
    const z = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);

    const vx = (Math.random() - 0.5) * 0.5;
    const vy = -14.0 - Math.random() * 6.0; // Falling at 14-20 units/sec
    const vz = (Math.random() - 0.5) * 0.5;

    const scale = 0.08 + Math.random() * 0.06;
    const lifetime = 10.0;
    const color: [number, number, number] = [0.72, 0.82, 0.95];

    spawnParticle(buffer, x, y, z, vx, vy, vz, scale, lifetime, color);
  }
}

/**
 * Steps falling rain particles and triggers splashes when hitting ground.
 */
export function stepRainParticles(
  buffer: ParticleBuffer,
  deltaSec: number,
  bounds: ParticleBounds,
  onSplash?: (x: number, z: number) => void
): void {
  for (let i = 0; i < buffer.capacity; i++) {
    if (buffer.active[i] === 0) continue;

    const pIdx = i * 3;
    buffer.positions[pIdx] += buffer.velocities[pIdx] * deltaSec;
    buffer.positions[pIdx + 1] += buffer.velocities[pIdx + 1] * deltaSec;
    buffer.positions[pIdx + 2] += buffer.velocities[pIdx + 2] * deltaSec;

    // Hit ground
    if (buffer.positions[pIdx + 1] <= bounds.minY) {
      if (onSplash) {
        onSplash(buffer.positions[pIdx], buffer.positions[pIdx + 2]);
      }
      // Respawn near top
      buffer.positions[pIdx] = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      buffer.positions[pIdx + 1] = bounds.maxY - Math.random() * 1.5;
      buffer.positions[pIdx + 2] = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
    }
  }
}

/**
 * Initializes heat motes with warm amber colors and upward drift.
 */
export function initHeatMoteParticles(
  buffer: ParticleBuffer,
  bounds: ParticleBounds,
  count: number
): void {
  recycleAllParticles(buffer);
  const targetCount = Math.min(count, buffer.capacity);

  for (let i = 0; i < targetCount; i++) {
    const x = (bounds.minX + Math.random() * (bounds.maxX - bounds.minX)) * 0.85;
    const y = bounds.minY + 0.2 + Math.random() * (bounds.maxY - bounds.minY - 0.4);
    const z = (bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ)) * 0.85;

    const vx = (Math.random() - 0.5) * 0.3;
    const vy = 0.4 + Math.random() * 0.6; // Upward drift
    const vz = (Math.random() - 0.5) * 0.3;

    const scale = 0.1 + Math.random() * 0.08;
    const lifetime = 8.0;
    const color: [number, number, number] = [
      1.0,
      0.65 + Math.random() * 0.2,
      0.15 + Math.random() * 0.1,
    ];

    spawnParticle(buffer, x, y, z, vx, vy, vz, scale, lifetime, color, Math.random() * Math.PI * 2);
  }
}

/**
 * Steps heat motes with horizontal sinusoidal shimmer and wraps at height limit.
 */
export function stepHeatMoteParticles(
  buffer: ParticleBuffer,
  deltaSec: number,
  bounds: ParticleBounds,
  elapsedTime: number
): void {
  for (let i = 0; i < buffer.capacity; i++) {
    if (buffer.active[i] === 0) continue;

    const pIdx = i * 3;
    const phase = buffer.phases[i];
    const wave = Math.sin(phase + elapsedTime * 2.5) * 0.4;

    buffer.positions[pIdx] += (buffer.velocities[pIdx] + wave) * deltaSec;
    buffer.positions[pIdx + 1] += buffer.velocities[pIdx + 1] * deltaSec;
    buffer.positions[pIdx + 2] += buffer.velocities[pIdx + 2] * deltaSec;

    // Wrap at top
    if (buffer.positions[pIdx + 1] >= bounds.maxY) {
      buffer.positions[pIdx] = (bounds.minX + Math.random() * (bounds.maxX - bounds.minX)) * 0.85;
      buffer.positions[pIdx + 1] = bounds.minY + 0.2 + Math.random() * 0.5;
      buffer.positions[pIdx + 2] =
        (bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ)) * 0.85;
    }
  }
}

/**
 * Initializes blood moon crimson motes.
 */
export function initBloodMoteParticles(
  buffer: ParticleBuffer,
  bounds: ParticleBounds,
  count: number
): void {
  recycleAllParticles(buffer);
  const targetCount = Math.min(count, buffer.capacity);

  for (let i = 0; i < targetCount; i++) {
    const x = (bounds.minX + Math.random() * (bounds.maxX - bounds.minX)) * 0.9;
    const y = bounds.minY + 0.5 + Math.random() * (bounds.maxY - bounds.minY - 1.0);
    const z = (bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ)) * 0.9;

    const vx = (Math.random() - 0.5) * 0.4;
    const vy = 0.3 + Math.random() * 0.5;
    const vz = (Math.random() - 0.5) * 0.4;

    const scale = 0.12 + Math.random() * 0.08;
    const lifetime = 10.0;
    const color: [number, number, number] = [
      0.85 + Math.random() * 0.15,
      0.1 + Math.random() * 0.1,
      0.2 + Math.random() * 0.15,
    ];

    spawnParticle(buffer, x, y, z, vx, vy, vz, scale, lifetime, color, Math.random() * Math.PI * 2);
  }
}

/**
 * Steps blood moon crimson motes with swirling undulating motion.
 */
export function stepBloodMoteParticles(
  buffer: ParticleBuffer,
  deltaSec: number,
  bounds: ParticleBounds,
  elapsedTime: number
): void {
  for (let i = 0; i < buffer.capacity; i++) {
    if (buffer.active[i] === 0) continue;

    const pIdx = i * 3;
    const phase = buffer.phases[i];
    const swirlX = Math.cos(phase + elapsedTime * 1.8) * 0.3;
    const swirlZ = Math.sin(phase + elapsedTime * 1.8) * 0.3;

    buffer.positions[pIdx] += (buffer.velocities[pIdx] + swirlX) * deltaSec;
    buffer.positions[pIdx + 1] += buffer.velocities[pIdx + 1] * deltaSec;
    buffer.positions[pIdx + 2] += (buffer.velocities[pIdx + 2] + swirlZ) * deltaSec;

    // Wrap at top
    if (buffer.positions[pIdx + 1] >= bounds.maxY) {
      buffer.positions[pIdx] = (bounds.minX + Math.random() * (bounds.maxX - bounds.minX)) * 0.9;
      buffer.positions[pIdx + 1] = bounds.minY + 0.5 + Math.random() * 0.5;
      buffer.positions[pIdx + 2] =
        (bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ)) * 0.9;
    }
  }
}

// ============================================================================
// Gameplay Bursts
// ============================================================================

/**
 * Spawns radial burst of particles from an origin position.
 */
export function spawnBurst(
  buffer: ParticleBuffer,
  count: number,
  origin: [number, number, number],
  config?: BurstConfig
): number {
  const speedMin = config?.speedMin ?? 1.5;
  const speedMax = config?.speedMax ?? 3.5;
  const lifetimeMin = config?.lifetimeMin ?? 0.6;
  const lifetimeMax = config?.lifetimeMax ?? 1.2;
  const scaleMin = config?.scaleMin ?? 0.1;
  const scaleMax = config?.scaleMax ?? 0.25;
  const color = config?.color ?? [1.0, 1.0, 1.0];

  let spawned = 0;

  for (let i = 0; i < count; i++) {
    // Spherical / hemispherical velocity distribution
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * (Math.PI / 2); // mostly upwards
    const speed = speedMin + Math.random() * (speedMax - speedMin);

    const vx = Math.cos(theta) * Math.sin(phi) * speed;
    const vy = Math.cos(phi) * speed + 0.5; // upward bias
    const vz = Math.sin(theta) * Math.sin(phi) * speed;

    const lifetime = lifetimeMin + Math.random() * (lifetimeMax - lifetimeMin);
    const scale = scaleMin + Math.random() * (scaleMax - scaleMin);

    const idx = spawnParticle(
      buffer,
      origin[0],
      origin[1],
      origin[2],
      vx,
      vy,
      vz,
      scale,
      lifetime,
      color
    );

    if (idx !== -1) {
      spawned++;
    } else {
      break; // Buffer full
    }
  }

  return spawned;
}

/**
 * Steps burst particles with gravity and shrinks scale as lifetime expires.
 */
export function stepBurstParticles(buffer: ParticleBuffer, deltaSec: number, gravity = 9.8): void {
  for (let i = 0; i < buffer.capacity; i++) {
    if (buffer.active[i] === 0) continue;

    const pIdx = i * 3;

    // Apply gravity
    buffer.velocities[pIdx + 1] -= gravity * deltaSec;

    // Advance position
    buffer.positions[pIdx] += buffer.velocities[pIdx] * deltaSec;
    buffer.positions[pIdx + 1] += buffer.velocities[pIdx + 1] * deltaSec;
    buffer.positions[pIdx + 2] += buffer.velocities[pIdx + 2] * deltaSec;

    // Advance lifetime
    buffer.lifetimes[i] -= deltaSec;

    if (buffer.lifetimes[i] <= 0) {
      recycleParticle(buffer, i);
    } else {
      // Fade/shrink scale according to remaining life ratio
      const ratio = Math.max(0, buffer.lifetimes[i] / buffer.maxLifetimes[i]);
      buffer.scales[i] = buffer.baseScales[i] * ratio;
    }
  }
}

// ============================================================================
// Particle Burst Event Bus
// ============================================================================

type BurstListener = (event: ParticleBurstEvent) => void;
const burstListeners = new Set<BurstListener>();

export function subscribeParticleBursts(listener: BurstListener): () => void {
  burstListeners.add(listener);
  return () => {
    burstListeners.delete(listener);
  };
}

export function emitParticleBurst(event: ParticleBurstEvent): void {
  burstListeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // Ignore listener error
    }
  });
}
