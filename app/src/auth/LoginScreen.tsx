import { APP_NAME } from '@omp/shared';
import { Lock, User } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { ApiRequestError, NetworkError } from '../api/errors.ts';
import { InstallNotice } from '../install/InstallNotice.tsx';
import { Logo } from '../layout/Logo.tsx';
import { Splash } from '../layout/Splash.tsx';
import { LoginBlockedError } from '../offline/phone-auth.ts';
import { ds } from '../styles/tokens.ts';
import { Button } from '../ui/Button.tsx';
import { TextField } from '../ui/TextField.tsx';
import { homeFor, useAuth } from './AuthProvider.tsx';

function loginErrorMessage(error: unknown): string {
  if (error instanceof LoginBlockedError) return error.message;
  if (error instanceof NetworkError) {
    return 'No connection. The first login needs signal.';
  }
  if (error instanceof ApiRequestError) {
    if (error.code === 'too_many_attempts') return error.message;
    if (error.code === 'invalid_credentials')
      return 'Wrong username or password.';
  }
  return 'Login failed. Try again.';
}

/** Copied from the prototype's `Login`, without the Full Name field. */
export function LoginScreen() {
  const { state, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === 'loading') return <Splash />;
  if (state.status === 'authenticated')
    return <Navigate to={homeFor(state.user)} replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(username, password);
      const from = (location.state as { from?: string } | null)?.from;
      const wanted =
        from && !user.mustChangePassword && from !== '/login'
          ? from
          : homeFor(user);
      navigate(wanted, { replace: true });
    } catch (caught) {
      setError(loginErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const notice = state.message;

  return (
    <main
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: ds.gradHdr,
        padding: 'calc(40px + env(safe-area-inset-top)) 24px 32px',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          maxWidth: 420,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.9)',
            borderRadius: '50%',
            padding: 10,
            display: 'flex',
          }}
        >
          <Logo size={56} />
        </div>
        <h1
          style={{
            color: ds.txW,
            fontSize: 26,
            fontWeight: 700,
            margin: '14px 0 2px',
          }}
        >
          {APP_NAME}
        </h1>
        <p style={{ color: ds.txW, fontSize: 14, margin: 0 }}>
          Your Pocket Teaching Coach
        </p>
        <div style={{ width: '100%', marginTop: 20 }}>
          <InstallNotice />
        </div>

        <form
          onSubmit={onSubmit}
          style={{ width: '100%', marginTop: 24 }}
          noValidate
        >
          <div style={{ ...ds.card, padding: '22px 18px 8px' }}>
            {notice && (
              <p
                role="status"
                style={{
                  background: ds.bdL,
                  color: ds.warmDk,
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 13,
                  margin: '0 0 14px',
                }}
              >
                {notice}
              </p>
            )}
            <TextField
              label="Username"
              value={username}
              onChange={setUsername}
              autoComplete="username"
              autoCapitalize="none"
              icon={<User size={16} color={ds.txMuted} />}
              required
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              icon={<Lock size={16} color={ds.txMuted} />}
              required
            />
            {error && (
              <p
                role="alert"
                style={{ color: ds.redText, fontSize: 13, margin: '0 0 12px' }}
              >
                {error}
              </p>
            )}
          </div>
          <Button
            type="submit"
            fullWidth
            disabled={busy || username.trim() === '' || password === ''}
            style={{ marginTop: 16, padding: 16, fontSize: 16 }}
          >
            {busy ? 'Logging in…' : 'Log In'}
          </Button>
        </form>
        <p
          style={{
            color: ds.txW,
            fontSize: 13,
            marginTop: 14,
            textAlign: 'center',
          }}
        >
          Forgot your password? Ask the admin to reset it.
        </p>
      </div>
    </main>
  );
}
