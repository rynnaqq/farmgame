/**
 * 32-bit Seeded Random Number Generator using the xorshift32 algorithm.
 * Provides deterministic pseudo-random sequences for gameplay state (weather, mutations, egg rolls).
 */
export class SeededRNG {
  private state: number;

  constructor(seed: number = 1) {
    this.state = this.normalizeSeed(seed);
  }

  private normalizeSeed(seed: number): number {
    const uint32 = seed >>> 0;
    return uint32 === 0 ? 1 : uint32;
  }

  /**
   * Generates next positive 32-bit integer in range [1, 0xFFFFFFFF].
   */
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }

  /**
   * Returns a float in range [0, 1).
   */
  nextFloat(): number {
    return (this.next() - 1) / 4294967296;
  }

  /**
   * Returns an integer in range [min, max] inclusive.
   */
  range(min: number, max: number): number {
    const actualMin = Math.min(min, max);
    const actualMax = Math.max(min, max);
    if (actualMin === actualMax) return actualMin;
    const rangeSize = actualMax - actualMin + 1;
    const result = Math.floor(this.nextFloat() * rangeSize) + actualMin;
    return Math.min(Math.max(result, actualMin), actualMax);
  }

  /**
   * Retrieves the current 32-bit generator state for persistence.
   */
  getState(): number {
    return this.state >>> 0;
  }

  /**
   * Restores a previously saved generator state.
   */
  setState(state: number): void {
    this.state = this.normalizeSeed(state);
  }
}

/**
 * Generates a non-zero 32-bit cryptographically secure seed from browser crypto if available.
 */
export function generateCryptoSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const seed = array[0] >>> 0;
    return seed === 0 ? 1 : seed;
  }
  return Math.floor(Math.random() * 0xffffffff) + 1;
}
