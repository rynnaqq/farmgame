import { describe, it, expect } from 'vitest';
import { SeededRNG, generateCryptoSeed } from './rng';

describe('SeededRNG', () => {
  it('should initialize with default non-zero seed and produce positive uint32 integers', () => {
    const rng = new SeededRNG();
    const val1 = rng.next();
    const val2 = rng.next();

    expect(val1).toBeGreaterThan(0);
    expect(val1).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(val1)).toBe(true);
    expect(val2).toBeGreaterThan(0);
    expect(val2).toBeLessThanOrEqual(0xffffffff);
    expect(val1).not.toBe(val2);
  });

  it('should produce identical deterministic sequence for identical seed', () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);

    const seq1 = [rng1.next(), rng1.next(), rng1.next(), rng1.next()];
    const seq2 = [rng2.next(), rng2.next(), rng2.next(), rng2.next()];

    expect(seq1).toEqual(seq2);
  });

  it('should produce different sequences for different seeds', () => {
    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(54321);

    const seq1 = [rng1.next(), rng1.next(), rng1.next()];
    const seq2 = [rng2.next(), rng2.next(), rng2.next()];

    expect(seq1).not.toEqual(seq2);
  });

  it('should generate floats strictly in range [0, 1)', () => {
    const rng = new SeededRNG(9876);
    for (let i = 0; i < 1000; i++) {
      const f = rng.nextFloat();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it('should generate integers within specified range [min, max] inclusive', () => {
    const rng = new SeededRNG(1337);
    const results = new Set<number>();
    const min = 10;
    const max = 15;

    for (let i = 0; i < 200; i++) {
      const val = rng.range(min, max);
      expect(val).toBeGreaterThanOrEqual(min);
      expect(val).toBeLessThanOrEqual(max);
      expect(Number.isInteger(val)).toBe(true);
      results.add(val);
    }

    // Should cover all values in the range across 200 iterations
    for (let v = min; v <= max; v++) {
      expect(results.has(v)).toBe(true);
    }
  });

  it('should handle min === max and swapped min/max in range()', () => {
    const rng = new SeededRNG(42);
    expect(rng.range(5, 5)).toBe(5);

    const swapped = rng.range(20, 10);
    expect(swapped).toBeGreaterThanOrEqual(10);
    expect(swapped).toBeLessThanOrEqual(20);
  });

  it('should allow getting and setting state for persistence', () => {
    const rng1 = new SeededRNG(777);
    // Burn 5 numbers
    for (let i = 0; i < 5; i++) {
      rng1.next();
    }

    const savedState = rng1.getState();
    expect(savedState).toBeGreaterThan(0);

    const nextThree1 = [rng1.next(), rng1.next(), rng1.next()];

    // Create a new RNG and restore state
    const rng2 = new SeededRNG(1);
    rng2.setState(savedState);
    const nextThree2 = [rng2.next(), rng2.next(), rng2.next()];

    expect(nextThree2).toEqual(nextThree1);
    expect(rng2.getState()).toBe(rng1.getState());
  });

  it('should gracefully handle zero or negative seeds by normalizing to non-zero uint32', () => {
    const rngZero = new SeededRNG(0);
    expect(rngZero.getState()).not.toBe(0);
    const val0 = rngZero.next();
    expect(val0).toBeGreaterThan(0);

    const rngNeg = new SeededRNG(-100);
    expect(rngNeg.getState()).toBeGreaterThan(0);
    const valNeg = rngNeg.next();
    expect(valNeg).toBeGreaterThan(0);

    // Setting state to 0 should also normalize
    rngZero.setState(0);
    expect(rngZero.getState()).not.toBe(0);
    expect(rngZero.next()).toBeGreaterThan(0);
  });

  it('generateCryptoSeed should return a valid non-zero uint32 seed', () => {
    const seed1 = generateCryptoSeed();
    const seed2 = generateCryptoSeed();

    expect(seed1).toBeGreaterThan(0);
    expect(seed1).toBeLessThanOrEqual(0xffffffff);
    expect(seed2).toBeGreaterThan(0);
    expect(seed2).toBeLessThanOrEqual(0xffffffff);
  });
});
