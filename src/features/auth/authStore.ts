import { create } from 'zustand'
import { getAuthService, type AuthError } from './authService'
import type { AuthSession } from './authService'

/**
 * Auth projection store (PRD §8.3: serializable application state only).
 * Holds session/UI state; the service owns Supabase calls so tests can mock it.
 */

export type AuthStatus = 'checking' | 'unauthenticated' | 'authenticated' | 'error'
export type AuthMode = 'login' | 'register'

export interface AuthStoreState {
  status: AuthStatus
  mode: AuthMode
  session: AuthSession | null
  error: AuthError | null
  isSubmitting: boolean
  initialized: boolean
  setMode: (mode: AuthMode) => void
  setSubmitting: (submitting: boolean) => void
  setSession: (session: AuthSession | null) => void
  setError: (error: AuthError | null) => void
  initialize: () => Promise<void>
  submitRegister: (username: string, password: string) => Promise<boolean>
  submitLogin: (username: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  resetForTests: () => void
}

interface AuthStoreActions {
  setMode: AuthStoreState['setMode']
  setSubmitting: AuthStoreState['setSubmitting']
  setSession: AuthStoreState['setSession']
  setError: AuthStoreState['setError']
}

const INITIAL: Pick<
  AuthStoreState,
  'status' | 'mode' | 'session' | 'error' | 'isSubmitting' | 'initialized'
> = {
  status: 'checking',
  mode: 'login',
  session: null,
  error: null,
  isSubmitting: false,
  initialized: false,
}

export const useAuthStore = create<AuthStoreState & AuthStoreActions>((set, get) => ({
  ...INITIAL,

  setMode: (mode) => set({ mode, error: null }),
  setSubmitting: (isSubmitting) => set({ isSubmitting }),
  setSession: (session) =>
    set(
      session
        ? { status: 'authenticated', session, error: null, initialized: true }
        : { status: 'unauthenticated', session: null, error: null }
    ),
  setError: (error) => set({ error, status: error ? 'error' : 'unauthenticated' }),

  initialize: async () => {
    if (get().initialized) return
    try {
      const session = await getAuthService().restoreSession()
      if (session) {
        set({ status: 'authenticated', session, initialized: true })
      } else {
        set({ status: 'unauthenticated', initialized: true })
      }
    } catch {
      set({ status: 'unauthenticated', initialized: true })
    }
  },

  submitRegister: async (username, password) => {
    set({ isSubmitting: true, error: null })
    try {
      const result = await getAuthService().signUp(username, password)
      if (!result.ok) {
        set({ error: result.error, isSubmitting: false })
        return false
      }
      set({ status: 'authenticated', session: result.data, isSubmitting: false, initialized: true })
      return true
    } catch (error) {
      set({
        error: { code: 'UNKNOWN', message: error instanceof Error ? error.message : 'Unexpected error.' },
        isSubmitting: false,
      })
      return false
    }
  },

  submitLogin: async (username, password) => {
    set({ isSubmitting: true, error: null })
    try {
      const result = await getAuthService().logIn(username, password)
      if (!result.ok) {
        set({ error: result.error, isSubmitting: false })
        return false
      }
      set({ status: 'authenticated', session: result.data, isSubmitting: false, initialized: true })
      return true
    } catch (error) {
      set({
        error: { code: 'UNKNOWN', message: error instanceof Error ? error.message : 'Unexpected error.' },
        isSubmitting: false,
      })
      return false
    }
  },

  signOut: async () => {
    try {
      await getAuthService().logOut()
    } finally {
      set({ ...INITIAL, status: 'unauthenticated', initialized: true })
    }
  },

  resetForTests: () => set({ ...INITIAL }),
}))
