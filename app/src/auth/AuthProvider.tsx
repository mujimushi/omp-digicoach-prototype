import { type PublicUser, PublicUser as PublicUserSchema } from '@omp/shared';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router';
import {
  ApiRequestError,
  apiGet,
  apiSend,
  setUnauthorizedHandler,
} from '../api/client.ts';

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous'; message: string | null }
  | { status: 'authenticated'; user: PublicUser };

export type AuthContextValue = {
  state: AuthState;
  user: PublicUser | null;
  login: (username: string, password: string) => Promise<PublicUser>;
  logout: () => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
  /** Reloads the user from the server. */
  refresh: () => Promise<void>;
};

/** Exported for tests, which provide a user without the server. */
export const AuthContext = createContext<AuthContextValue | null>(null);

/** Where a user belongs after logging in. */
export function homeFor(user: PublicUser): string {
  if (user.mustChangePassword) return '/change-password';
  return user.isDoctor ? '/' : '/admin';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const navigate = useNavigate();

  const loadUser = useCallback(async () => {
    try {
      const user = await apiGet('/api/me', PublicUserSchema, {
        redirectOnUnauthorized: false,
      });
      setState({ status: 'authenticated', user });
    } catch (error) {
      const message =
        error instanceof ApiRequestError && error.message !== 'Please log in.'
          ? error.message
          : null;
      setState({ status: 'anonymous', message });
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(
    () =>
      setUnauthorizedHandler(() => {
        setState({ status: 'anonymous', message: 'Please log in again.' });
        navigate('/login', { replace: true });
      }),
    [navigate],
  );

  const login = useCallback(async (username: string, password: string) => {
    const user = await apiSend(
      'POST',
      '/api/auth/login',
      { username, password },
      PublicUserSchema,
      { redirectOnUnauthorized: false },
    );
    setState({ status: 'authenticated', user });
    return user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiSend('POST', '/api/auth/logout', {}, undefined, {
        redirectOnUnauthorized: false,
      });
    } finally {
      setState({ status: 'anonymous', message: null });
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await apiSend('POST', '/api/me/password', {
        currentPassword,
        newPassword,
      });
      await loadUser();
    },
    [loadUser],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      user: state.status === 'authenticated' ? state.user : null,
      login,
      logout,
      changePassword,
      refresh: loadUser,
    }),
    [state, login, logout, changePassword, loadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth needs an AuthProvider');
  return value;
}

/** The logged-in user, for screens behind a guard. */
export function useUser(): PublicUser {
  const { user } = useAuth();
  if (!user) throw new Error('useUser needs a logged-in user');
  return user;
}
