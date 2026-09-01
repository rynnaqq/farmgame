import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from '../../lib/supabase/client'
import { normalizeUsername, toInternalEmail, validateUsername, validatePassword } from './username'

/**
 * Auth service (PRD §7.1).
 * Wraps Supabase Auth with username/password semantics:
 * - signUp passes options.data.username so the account trigger can read it (AUTH-05)
 * - the synthetic internal email is never displayed (AUTH-04)
 * - one generic error for invalid login; USERNAME_TAKEN for duplicates (AUTH-08)
 */

export type AuthErrorCode =
  | 'USERNAME_TAKEN'
  | 'USERNAME_INVALID'
  | 'PASSWORD_INVALID'
  | 'AUTH_INVALID'
  | 'NETWORK'
  | 'UNKNOWN'

export interface AuthError {
  code: AuthErrorCode
  message: string
}

export type AuthResult<T> = { ok: true; data: T } | { ok: false; error: AuthError }

export interface VerdantProfile {
  id: string
  usernameCanonical: string
  usernameDisplay: string
  balance: number
  lifetimeEarned: number
  tutorialComplete: boolean
}

export interface AuthSession {
  userId: string
  email: string
  username: string
}

function isAuthErrorWithStatus(error: unknown, status: number): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status?: unknown }).status === status
  )
}

function toAuthError(error: unknown): AuthError {
  const message = error instanceof Error ? error.message : String(error)
  if (isAuthErrorWithStatus(error, 422) || /already been registered/i.test(message) || /already taken/i.test(message)) {
    return { code: 'USERNAME_TAKEN', message: 'That username is already taken.' }
  }
  if (isAuthErrorWithStatus(error, 400) && /invalid login credentials/i.test(message)) {
    return { code: 'AUTH_INVALID', message: 'Invalid username or password.' }
  }
  if (/failed to fetch|networkerror|fetch failed/i.test(message)) {
    return { code: 'NETWORK', message: 'Cannot reach the game server. Check your connection.' }
  }
  return { code: 'UNKNOWN', message: 'Something went wrong. Please try again.' }
}

export class AuthService {
  constructor(private readonly supabase: SupabaseClient = getSupabaseClient()) {}

  async signUp(rawUsername: string, password: string): Promise<AuthResult<AuthSession>> {
    const usernameCheck = validateUsername(rawUsername)
    if (!usernameCheck.valid) {
      return { ok: false, error: { code: 'USERNAME_INVALID', message: 'Invalid username format.' } }
    }
    const passwordCheck = validatePassword(password)
    if (!passwordCheck.valid) {
      return { ok: false, error: { code: 'PASSWORD_INVALID', message: 'Invalid password format.' } }
    }

    const { canonical, trimmed } = normalizeUsername(rawUsername)
    const email = toInternalEmail(canonical)

    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: trimmed },
      },
    })

    if (error) return { ok: false, error: toAuthError(error) }
    if (!data.session || !data.user) {
      return {
        ok: false,
        error: { code: 'UNKNOWN', message: 'Account created but the session is unavailable. Try logging in.' },
      }
    }

    return {
      ok: true,
      data: {
        userId: data.user.id,
        email,
        username: trimmed,
      },
    }
  }

  async logIn(rawUsername: string, password: string): Promise<AuthResult<AuthSession>> {
    const usernameCheck = validateUsername(rawUsername)
    if (!usernameCheck.valid) {
      return { ok: false, error: { code: 'USERNAME_INVALID', message: 'Invalid username or password.' } }
    }
    const { canonical, trimmed } = normalizeUsername(rawUsername)
    const email = toInternalEmail(canonical)

    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password })
    if (error) return { ok: false, error: toAuthError(error) }
    if (!data.session || !data.user) {
      return { ok: false, error: { code: 'AUTH_INVALID', message: 'Invalid username or password.' } }
    }
    return {
      ok: true,
      data: { userId: data.user.id, email, username: trimmed },
    }
  }

  async logOut(): Promise<void> {
    await this.supabase.auth.signOut()
  }

  async restoreSession(): Promise<AuthSession | null> {
    const { data } = await this.supabase.auth.getSession()
    const session = data.session
    if (!session?.user) return null
    const email = session.user.email ?? ''
    const canonical = email.split('@')[0] ?? ''
    const display = (session.user.user_metadata?.username as string | undefined) ?? canonical
    return { userId: session.user.id, email, username: display }
  }

  onAuthStateChange(callback: (event: string) => void): () => void {
    const { data } = this.supabase.auth.onAuthStateChange((event) => callback(event))
    return () => data.subscription.unsubscribe()
  }
}

let defaultService: AuthService | null = null

export function getAuthService(): AuthService {
  if (!defaultService) defaultService = new AuthService()
  return defaultService
}
