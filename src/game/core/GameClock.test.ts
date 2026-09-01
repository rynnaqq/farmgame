import { describe, it, expect } from 'vitest';
import { GameClock } from './GameClock';

describe('GameClock', () => {
  it('should initialize with provided timestamp or default to Date.now()', () => {
    const customTime = 1700000000000;
    const clock = new GameClock(customTime);
    expect(clock.now()).toBe(customTime);

    const before = Date.now();
    const defaultClock = new GameClock();
    const after = Date.now();
    expect(defaultClock.now()).toBeGreaterThanOrEqual(before);
    expect(defaultClock.now()).toBeLessThanOrEqual(after);
  });

  it('should advance time correctly by specified milliseconds', () => {
    const clock = new GameClock(1000);
    clock.advance(500);
    expect(clock.now()).toBe(1500);

    clock.advance(2500);
    expect(clock.now()).toBe(4000);
  });

  it('should explicitly set time using setTime', () => {
    const clock = new GameClock(1000);
    clock.setTime(50000);
    expect(clock.now()).toBe(50000);
  });

  it('should ignore negative or non-positive advances', () => {
    const clock = new GameClock(1000);
    clock.advance(-500);
    expect(clock.now()).toBe(1000);

    clock.advance(0);
    expect(clock.now()).toBe(1000);
  });
});
