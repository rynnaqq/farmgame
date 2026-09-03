import { describe, it, expect } from 'vitest';
import { getGameMode, isLocalMode, isVerdantMode, DEFAULT_GAME_MODE } from './gameMode';

describe('gameMode', () => {
  it('defaults to local when env is missing', () => {
    expect(getGameMode({})).toBe('local');
    expect(DEFAULT_GAME_MODE).toBe('local');
  });

  it('resolves explicit local and verdant values', () => {
    expect(getGameMode({ VITE_GAME_MODE: 'local' })).toBe('local');
    expect(getGameMode({ VITE_GAME_MODE: 'verdant' })).toBe('verdant');
  });

  it('normalizes case and whitespace', () => {
    expect(getGameMode({ VITE_GAME_MODE: '  VERDANT  ' })).toBe('verdant');
    expect(getGameMode({ VITE_GAME_MODE: 'Local' })).toBe('local');
  });

  it('falls back to local for unknown values', () => {
    expect(getGameMode({ VITE_GAME_MODE: 'mmo' })).toBe('local');
    expect(getGameMode({ VITE_GAME_MODE: '' })).toBe('local');
  });

  it('exposes boolean helpers', () => {
    expect(isLocalMode({ VITE_GAME_MODE: 'local' })).toBe(true);
    expect(isVerdantMode({ VITE_GAME_MODE: 'verdant' })).toBe(true);
    expect(isVerdantMode({})).toBe(false);
  });
});
