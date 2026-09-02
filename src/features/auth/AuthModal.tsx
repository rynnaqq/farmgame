import type React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from './authStore';
import {
  validateUsername,
  validatePassword,
  usernameErrorMessage,
  passwordErrorMessage,
} from './username';
import { audioManager } from '../../game/audio/AudioManager';

/**
 * Auth modal (PRD §7.1 AUTH-01..AUTH-12).
 * Login/Register tabs, accessible password visibility toggle, Caps Lock warning,
 * recovery warning for new accounts, and duplicate-submit protection.
 */

export const AuthModal: React.FC = () => {
  const mode = useAuthStore((state) => state.mode);
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);
  const isSubmitting = useAuthStore((state) => state.isSubmitting);
  const setMode = useAuthStore((state) => state.setMode);
  const setSubmitting = useAuthStore((state) => state.setSubmitting);
  const submitRegister = useAuthStore((state) => state.submitRegister);
  const submitLogin = useAuthStore((state) => state.submitLogin);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [localErrors, setLocalErrors] = useState<{ username?: string; password?: string }>({});

  const dialogRef = useRef<HTMLDivElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status !== 'checking') usernameRef.current?.focus();
  }, [status]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof event.getModifierState === 'function') {
      setCapsLockOn(event.getModifierState('CapsLock'));
    }
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (isSubmitting) return;

      const nextLocal: { username?: string; password?: string } = {};
      const usernameCheck = validateUsername(username);
      if (!usernameCheck.valid) nextLocal.username = usernameErrorMessage(usernameCheck.reason);
      const passwordCheck = validatePassword(password);
      if (!passwordCheck.valid) nextLocal.password = passwordErrorMessage(passwordCheck.reason);
      setLocalErrors(nextLocal);
      if (nextLocal.username || nextLocal.password) return;

      setSubmitting(true);
      audioManager.playSfx('ui_click');
      const succeeded =
        mode === 'register'
          ? await submitRegister(username, password)
          : await submitLogin(username, password);
      if (!succeeded) {
        setSubmitting(false);
      }
    },
    [isSubmitting, mode, password, setSubmitting, submitLogin, submitRegister, username]
  );

  const handleModeSwitch = useCallback(
    (nextMode: 'login' | 'register') => {
      setMode(nextMode);
      setLocalErrors({});
      setUsername('');
      setPassword('');
    },
    [setMode]
  );

  const inputBase =
    'w-full rounded-lg border bg-white/95 text-stone-900 placeholder-stone-400 px-3 py-2.5 text-base focus:outline-none focus:ring-2';

  const renderFieldError = (message?: string) =>
    message ? (
      <p className="text-xs text-red-600 mt-1" role="alert">
        {message}
      </p>
    ) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-sm p-4"
      data-testid="auth-modal-backdrop"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="w-full max-w-sm rounded-2xl bg-gradient-to-b from-emerald-50 to-lime-50 border-4 border-emerald-800/90 shadow-2xl p-5 font-game select-none"
        data-testid="auth-modal"
      >
        <h2
          id="auth-modal-title"
          className="text-center text-2xl font-bold text-emerald-900 tracking-wide"
        >
          🌿 Garden Island
        </h2>
        <p className="text-center text-xs text-emerald-700/80 mt-1 mb-4">
          {mode === 'register' ? 'Create your farmer account' : 'Welcome back, farmer'}
        </p>

        <div className="flex gap-2 mb-4" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => handleModeSwitch('login')}
            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${
              mode === 'login'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            onClick={() => handleModeSwitch('register')}
            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-colors ${
              mode === 'register'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="auth-username" className="block text-sm font-bold text-emerald-900 mb-1">
            Username
          </label>
          <input
            id="auth-username"
            ref={usernameRef}
            type="text"
            autoComplete="username"
            inputMode="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="FarmerJoe"
            aria-invalid={Boolean(localErrors.username)}
            aria-describedby={localErrors.username ? 'auth-username-error' : undefined}
            className={`${inputBase} ${
              localErrors.username
                ? 'border-red-400 focus:ring-red-300'
                : 'border-emerald-300 focus:ring-emerald-400'
            }`}
            data-testid="auth-username-input"
          />
          {renderFieldError(localErrors.username)}

          <label
            htmlFor="auth-password"
            className="block text-sm font-bold text-emerald-900 mt-3 mb-1"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="auth-password"
              type={passwordVisible ? 'text' : 'password'}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="At least 8 characters"
              aria-invalid={Boolean(localErrors.password)}
              aria-describedby={localErrors.password ? 'auth-password-error' : undefined}
              className={`${inputBase} pr-12 ${
                localErrors.password
                  ? 'border-red-400 focus:ring-red-300'
                  : 'border-emerald-300 focus:ring-emerald-400'
              }`}
              data-testid="auth-password-input"
            />
            <button
              type="button"
              onClick={() => setPasswordVisible((visible) => !visible)}
              aria-label={passwordVisible ? 'Hide password' : 'Show password'}
              aria-pressed={passwordVisible}
              className="absolute inset-y-0 right-0 px-3 text-sm font-bold text-emerald-700 hover:text-emerald-900"
              data-testid="auth-password-toggle"
            >
              {passwordVisible ? 'Hide' : 'Show'}
            </button>
          </div>
          {capsLockOn ? (
            <p
              className="text-xs text-amber-600 mt-1 font-bold"
              data-testid="auth-capslock-warning"
            >
              ⚠ Caps Lock is on
            </p>
          ) : null}
          {renderFieldError(localErrors.password)}

          {error ? (
            <p
              className="text-sm text-red-700 bg-red-100 border border-red-300 rounded-lg px-3 py-2 mt-3"
              role="alert"
              data-testid="auth-error"
            >
              {error.message}
            </p>
          ) : null}

          {mode === 'register' ? (
            <p
              className="text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 mt-3"
              data-testid="auth-recovery-warning"
            >
              ⚠ Write your password down somewhere safe. Password recovery is not available in this
              version, and we never ask for your email.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="w-full mt-4 py-2.5 rounded-lg font-bold text-base bg-emerald-600 text-white shadow hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="auth-submit"
          >
            {isSubmitting ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
};
