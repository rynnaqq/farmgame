import { describe, it, expect } from 'vitest';
import {
  validateUsername,
  validatePassword,
  normalizeUsername,
  toInternalEmail,
  usernameErrorMessage,
  passwordErrorMessage,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from './username';

describe('normalizeUsername', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeUsername('  Verdant  ').trimmed).toBe('Verdant');
  });

  it('lowercases the canonical form', () => {
    expect(normalizeUsername('FarmLord').canonical).toBe('farmlord');
  });

  it('preserves display capitalization in the trimmed form', () => {
    expect(normalizeUsername('FarmLord').trimmed).toBe('FarmLord');
  });
});

describe('validateUsername (AUTH-02)', () => {
  it('accepts a 3-character alphanumeric username', () => {
    expect(validateUsername('abc')).toEqual({ valid: true, canonical: 'abc' });
  });

  it('accepts a 16-character alphanumeric username', () => {
    expect(validateUsername('a'.repeat(16))).toEqual({
      valid: true,
      canonical: 'a'.repeat(16),
    });
  });

  it('rejects an empty username', () => {
    expect(validateUsername('')).toEqual({ valid: false, reason: 'empty' });
  });

  it('rejects whitespace-only input as empty after trimming', () => {
    expect(validateUsername('   ')).toEqual({ valid: false, reason: 'empty' });
  });

  it('rejects fewer than 3 characters', () => {
    expect(validateUsername('ab')).toEqual({ valid: false, reason: 'too_short' });
  });

  it('rejects more than 16 characters', () => {
    expect(validateUsername('a'.repeat(17))).toEqual({ valid: false, reason: 'too_long' });
  });

  it('rejects spaces inside the username', () => {
    expect(validateUsername('Farm Lord')).toEqual({ valid: false, reason: 'invalid_chars' });
  });

  it('rejects punctuation', () => {
    expect(validateUsername('farm_lord!')).toEqual({ valid: false, reason: 'invalid_chars' });
  });

  it('rejects unicode confusables', () => {
    expect(validateUsername('Аlice')).toEqual({ valid: false, reason: 'invalid_chars' });
  });

  it('trims before validating', () => {
    expect(validateUsername('  verdant  ')).toEqual({ valid: true, canonical: 'verdant' });
  });
});

describe('validatePassword (AUTH-06)', () => {
  it('accepts an 8-character password', () => {
    expect(validatePassword('a'.repeat(MIN_PASSWORD_LENGTH))).toEqual({ valid: true });
  });

  it('accepts a 72-character password', () => {
    expect(validatePassword('a'.repeat(MAX_PASSWORD_LENGTH))).toEqual({ valid: true });
  });

  it('rejects empty passwords', () => {
    expect(validatePassword('')).toEqual({ valid: false, reason: 'empty' });
  });

  it('rejects passwords shorter than 8 characters', () => {
    expect(validatePassword('a'.repeat(7))).toEqual({ valid: false, reason: 'too_short' });
  });

  it('rejects passwords longer than 72 characters', () => {
    expect(validatePassword('a'.repeat(73))).toEqual({ valid: false, reason: 'too_long' });
  });
});

describe('toInternalEmail (AUTH-04)', () => {
  it('maps the canonical username to the internal domain', () => {
    expect(toInternalEmail('farmlord')).toBe('farmlord@game.internal');
  });
});

describe('error messages', () => {
  it('covers every username failure reason', () => {
    expect(usernameErrorMessage('empty')).toMatch(/required/i);
    expect(usernameErrorMessage('too_short')).toMatch(/3 characters/i);
    expect(usernameErrorMessage('too_long')).toMatch(/16 characters/i);
    expect(usernameErrorMessage('invalid_chars')).toMatch(/letters and numbers/i);
  });

  it('covers every password failure reason', () => {
    expect(passwordErrorMessage('empty')).toMatch(/required/i);
    expect(passwordErrorMessage('too_short')).toMatch(/8 characters/i);
    expect(passwordErrorMessage('too_long')).toMatch(/72 characters/i);
  });
});
