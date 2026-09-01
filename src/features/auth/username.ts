/**
 * Username validation and normalization (PRD §7.1 AUTH-02/AUTH-03).
 */

const USERNAME_PATTERN = /^[A-Za-z0-9]{3,16}$/

export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 72

export type UsernameResult =
  | { valid: true; canonical: string }
  | { valid: false; reason: 'empty' | 'too_short' | 'too_long' | 'invalid_chars' }

export type PasswordResult = { valid: true } | { valid: false; reason: 'empty' | 'too_short' | 'too_long' }

/** Trimmed input is canonicalized to lowercase for uniqueness. */
export function normalizeUsername(raw: string): { canonical: string; trimmed: string } {
  const trimmed = raw.trim()
  return { canonical: trimmed.toLowerCase(), trimmed }
}

/** Validates against ^[A-Za-z0-9]{3,16}$ after trimming (AUTH-02). */
export function validateUsername(raw: string): UsernameResult {
  const { trimmed } = normalizeUsername(raw)
  if (trimmed.length === 0) return { valid: false, reason: 'empty' }
  if (trimmed.length < 3) return { valid: false, reason: 'too_short' }
  if (trimmed.length > 16) return { valid: false, reason: 'too_long' }
  if (!USERNAME_PATTERN.test(trimmed)) return { valid: false, reason: 'invalid_chars' }
  return { valid: true, canonical: trimmed.toLowerCase() }
}

/** Passwords must contain 8–72 characters (AUTH-06). */
export function validatePassword(raw: string): PasswordResult {
  if (raw.length === 0) return { valid: false, reason: 'empty' }
  if (raw.length < MIN_PASSWORD_LENGTH) return { valid: false, reason: 'too_short' }
  if (raw.length > MAX_PASSWORD_LENGTH) return { valid: false, reason: 'too_long' }
  return { valid: true }
}

/**
 * The internal synthetic email maps the canonical username and must never
 * be displayed as the player's email (AUTH-04).
 */
export function toInternalEmail(canonical: string): string {
  return `${canonical}@game.internal`
}

export type UsernameInvalidReason = 'empty' | 'too_short' | 'too_long' | 'invalid_chars'
export type PasswordInvalidReason = 'empty' | 'too_short' | 'too_long'

export function usernameErrorMessage(reason: UsernameInvalidReason): string {
  switch (reason) {
    case 'empty':
      return 'Username is required.'
    case 'too_short':
      return 'Username must be at least 3 characters.'
    case 'too_long':
      return 'Username must be at most 16 characters.'
    case 'invalid_chars':
      return 'Username may only contain letters and numbers.'
  }
}

export function passwordErrorMessage(reason: PasswordInvalidReason): string {
  switch (reason) {
    case 'empty':
      return 'Password is required.'
    case 'too_short':
      return 'Password must be at least 8 characters.'
    case 'too_long':
      return 'Password must be at most 72 characters.'
  }
}
