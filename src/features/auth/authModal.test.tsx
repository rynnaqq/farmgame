import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthModal } from './AuthModal';
import { useAuthStore } from './authStore';
import { getAuthService, type AuthService } from './authService';
import type { AuthResult, AuthSession } from './authService';

vi.mock('./authService', () => ({
  getAuthService: vi.fn(),
}));

vi.mock('../../game/audio/AudioManager', () => ({
  audioManager: { playSfx: vi.fn() },
}));

const mockGetAuthService = vi.mocked(getAuthService);

function makeService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    signUp: vi.fn(),
    logIn: vi.fn(),
    logOut: vi.fn(),
    restoreSession: vi.fn(),
    onAuthStateChange: vi.fn(() => () => {}),
    ...overrides,
  } as unknown as AuthService;
}

const session: AuthSession = {
  userId: 'user-1',
  email: 'farmerjoe@game.internal',
  username: 'FarmerJoe',
};

function ok(data: AuthSession): AuthResult<AuthSession> {
  return { ok: true, data };
}

describe('AuthModal (PRD §7.1)', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    useAuthStore.getState().resetForTests();
    useAuthStore.getState().setSession(null);
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders login mode by default with both tabs (AUTH-01)', () => {
    mockGetAuthService.mockReturnValue(makeService());
    render(<AuthModal />);
    expect(screen.getByRole('heading', { name: /Garden Island/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Register' })).toBeInTheDocument();
    expect(screen.queryByTestId('auth-recovery-warning')).not.toBeInTheDocument();
  });

  it('shows the recovery warning in register mode only (AUTH-10)', async () => {
    mockGetAuthService.mockReturnValue(makeService());
    render(<AuthModal />);
    await user.click(screen.getByRole('tab', { name: 'Register' }));
    expect(screen.getByTestId('auth-recovery-warning')).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Show password|Hide password/i, { selector: 'button' })
    ).toBeInTheDocument();
  });

  it('has an accessible password visibility toggle that flips label and input type (AUTH-06)', async () => {
    mockGetAuthService.mockReturnValue(makeService());
    render(<AuthModal />);
    const passwordInput = screen.getByTestId('auth-password-input') as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    const toggle = screen.getByTestId('auth-password-toggle');
    expect(toggle).toHaveAttribute('aria-label', 'Show password');
    await user.click(toggle);
    expect(passwordInput.type).toBe('text');
    expect(toggle).toHaveAttribute('aria-label', 'Hide password');
  });

  it('uses correct autocomplete attributes (AUTH-12)', async () => {
    mockGetAuthService.mockReturnValue(makeService());
    render(<AuthModal />);
    expect(screen.getByTestId('auth-username-input')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByTestId('auth-password-input')).toHaveAttribute(
      'autocomplete',
      'current-password'
    );
    await user.click(screen.getByRole('tab', { name: 'Register' }));
    expect(screen.getByTestId('auth-password-input')).toHaveAttribute(
      'autocomplete',
      'new-password'
    );
  });

  it('shows local validation errors and does not call the service', async () => {
    const service = makeService();
    mockGetAuthService.mockReturnValue(service);
    render(<AuthModal />);
    await user.type(screen.getByTestId('auth-username-input'), 'ab');
    await user.type(screen.getByTestId('auth-password-input'), 'short');
    await user.click(screen.getByTestId('auth-submit'));
    expect(await screen.findByText(/at least 3 characters/i)).toBeInTheDocument();
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(service.signUp).not.toHaveBeenCalled();
    expect(service.logIn).not.toHaveBeenCalled();
  });

  it('submits a valid registration with trimmed username and shows submit state (AUTH-05/AUTH-07)', async () => {
    const signUp = vi.fn().mockResolvedValue(ok(session));
    const service = makeService({ signUp });
    mockGetAuthService.mockReturnValue(service);
    render(<AuthModal />);

    await user.click(screen.getByRole('tab', { name: 'Register' }));
    await user.type(screen.getByTestId('auth-username-input'), '  FarmerJoe  ');
    await user.type(screen.getByTestId('auth-password-input'), 'hunter2hunter2');
    await user.click(screen.getByTestId('auth-submit'));

    await waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'));
    expect(signUp).toHaveBeenCalledWith('  FarmerJoe  ', 'hunter2hunter2');
  });

  it('shows one generic error for invalid login (AUTH-08)', async () => {
    const logIn = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'AUTH_INVALID', message: 'Invalid username or password.' },
    });
    const service = makeService({ logIn });
    mockGetAuthService.mockReturnValue(service);
    render(<AuthModal />);

    await user.type(screen.getByTestId('auth-username-input'), 'FarmerJoe');
    await user.type(screen.getByTestId('auth-password-input'), 'wrongwrong');
    await user.click(screen.getByTestId('auth-submit'));

    expect(await screen.findByTestId('auth-error')).toHaveTextContent(
      /Invalid username or password/i
    );
    expect(useAuthStore.getState().status).not.toBe('authenticated');
  });

  it('shows USERNAME_TAKEN message when the name is duplicated (AUTH-08)', async () => {
    const signUp = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'USERNAME_TAKEN', message: 'That username is already taken.' },
    });
    const service = makeService({ signUp });
    mockGetAuthService.mockReturnValue(service);
    render(<AuthModal />);

    await user.click(screen.getByRole('tab', { name: 'Register' }));
    await user.type(screen.getByTestId('auth-username-input'), 'FarmerJoe');
    await user.type(screen.getByTestId('auth-password-input'), 'hunter2hunter2');
    await user.click(screen.getByTestId('auth-submit'));

    expect(await screen.findByTestId('auth-error')).toHaveTextContent(/already taken/i);
  });
});

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().resetForTests();
    vi.clearAllMocks();
  });

  it('initializes unauthenticated when no session exists (AUTH-09)', async () => {
    mockGetAuthService.mockReturnValue(
      makeService({ restoreSession: vi.fn().mockResolvedValue(null) })
    );
    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(useAuthStore.getState().initialized).toBe(true);
  });

  it('restores an existing session on initialize (AUTH-09)', async () => {
    mockGetAuthService.mockReturnValue(
      makeService({ restoreSession: vi.fn().mockResolvedValue(session) })
    );
    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().session?.username).toBe('FarmerJoe');
  });

  it('register flow authenticates on success and reports failure', async () => {
    mockGetAuthService.mockReturnValue(
      makeService({ signUp: vi.fn().mockResolvedValue(ok(session)) })
    );
    const success = await useAuthStore.getState().submitRegister('FarmerJoe', 'hunter2hunter2');
    expect(success).toBe(true);
    expect(useAuthStore.getState().status).toBe('authenticated');

    useAuthStore.getState().resetForTests();
    mockGetAuthService.mockReturnValue(
      makeService({
        signUp: vi.fn().mockResolvedValue({
          ok: false,
          error: { code: 'USERNAME_TAKEN', message: 'That username is already taken.' },
        }),
      })
    );
    const failure = await useAuthStore.getState().submitRegister('FarmerJoe', 'hunter2hunter2');
    expect(failure).toBe(false);
    expect(useAuthStore.getState().error?.code).toBe('USERNAME_TAKEN');
  });
});
