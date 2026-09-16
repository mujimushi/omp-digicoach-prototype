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
import { apiGet, apiSend, setUnauthorizedHandler } from '../api/client.ts';
import { ApiRequestError, NetworkError } from '../api/errors.ts';
import {
  assertLoginAllowed,
  cachedUser,
  clearPhoneData,
  LoginBlockedError,
  rememberUser,
} from '../offline/phone-auth.ts';

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous'; message: string | null }
  | { status: 'authenticated'; user: PublicUser; offline?: boolean };

export type AuthContextValue = {
  state: AuthState;
  user: PublicUser | null;
  login: (username: string, password: string) => Promise<PublicUser>;
  /** Ends the login and deletes everything on the phone. */
  logout: () => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
  /** Reloads the user from the server. */
  refresh: () => Promise<void>;
  /** Shows the login screen with a message, keeping everything on the phone. */
  expireLogin: (message: string | null) => void;
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
      try {
        await rememberUser(user);
      } catch (error) {
        if (!(error instanceof LoginBlockedError)) throw error;
        await apiSend('POST', '/api/auth/logout', {}, undefined, {
          redirectOnUnauthorized: false,
        }).catch(() => undefined);
        setState({ status: 'anonymous', message: error.message });
        return;
      }
      setState({ status: 'authenticated', user });
    } catch (error) {
      if (error instanceof NetworkError) {
        // No signal: open with the last user on this phone, as an installed app must.
        const user = await cachedUser().catch(() => undefined);
        setState(
          user
            ? { status: 'authenticated', user, offline: true }
            : {
                status: 'anonymous',
                message: 'No connection. The first login needs signal.',
              },
        );
        return;
      }
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
    await assertLoginAllowed(username);
    const user = await apiSend(
      'POST',
      '/api/auth/login',
      { username, password },
      PublicUserSchema,
      {
        redirectOnUnauthorized: false,
      },
    );
    try {
      await rememberUser(user);
    } catch (error) {
      await apiSend('POST', '/api/auth/logout', {}, undefined, {
        redirectOnUnauthorized: false,
      }).catch(() => undefined);
      throw error;
    }
    setState({ status: 'authenticated', user });
    return user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiSend('POST', '/api/auth/logout', {}, undefined, {
        redirectOnUnauthorized: false,
      });
    } catch {
      // Offline or already logged out: the phone's data still goes.
    } finally {
      await clearPhoneData().catch(() => undefined);
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

  const expireLogin = useCallback((message: string | null) => {
    setState({ status: 'anonymous', message });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      user: state.status === 'authenticated' ? state.user : null,
      login,
      logout,
      changePassword,
      refresh: loadUser,
      expireLogin,
    }),
    [state, login, logout, changePassword, loadUser, expireLogin],
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
