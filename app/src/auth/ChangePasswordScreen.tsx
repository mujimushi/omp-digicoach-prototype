import { LIMITS } from '@omp/shared';
import { KeyRound } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiRequestError, NetworkError } from '../api/client.ts';
import { ds } from '../styles/tokens.ts';
import { Button } from '../ui/Button.tsx';
import { Card } from '../ui/Card.tsx';
import { IconCircle } from '../ui/IconCircle.tsx';
import { TextField } from '../ui/TextField.tsx';
import { homeFor, useAuth, useUser } from './AuthProvider.tsx';

export function ChangePasswordScreen() {
  const user = useUser();
  const { changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tooShort = next.length > 0 && [...next].length < LIMITS.passwordMin;
  const mismatch = repeat.length > 0 && repeat !== next;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (tooShort || mismatch || next === '') return;
    setBusy(true);
    setError(null);
    try {
      await changePassword(current, next);
      navigate(homeFor({ ...user, mustChangePassword: false }), {
        replace: true,
      });
    } catch (caught) {
      if (caught instanceof NetworkError)
        setError('No connection. Try again with signal.');
      else if (caught instanceof ApiRequestError) setError(caught.message);
      else setError('The password was not changed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100%',
        background: ds.surface,
        padding: 'calc(24px + env(safe-area-inset-top)) 16px 32px',
      }}
    >
      <div style={{ maxWidth: 440, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <IconCircle Icon={KeyRound} color={ds.pri} size={44} />
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: ds.warmDk,
              margin: 0,
            }}
          >
            Choose your password
          </h1>
        </div>
        <Card style={{ marginBottom: 16 }}>
          <p
            style={{ fontSize: 14, color: ds.txB, margin: 0, lineHeight: 1.6 }}
          >
            {user.mustChangePassword
              ? 'You logged in with a temporary password. Choose your own before you continue.'
              : 'Change the password you log in with.'}{' '}
            Use at least {LIMITS.passwordMin} characters. A phrase of several
            words is easy to remember and hard to guess, such as “kettle on the
            ward window”.
          </p>
        </Card>
        <form onSubmit={onSubmit} noValidate>
          <Card>
            <TextField
              label={
                user.mustChangePassword
                  ? 'Temporary password'
                  : 'Current password'
              }
              type="password"
              credential
              value={current}
              onChange={setCurrent}
              autoComplete="current-password"
              required
            />
            <TextField
              label="New password"
              type="password"
              credential
              value={next}
              onChange={setNext}
              autoComplete="new-password"
              hint={`At least ${LIMITS.passwordMin} characters. No need for digits or symbols.`}
              error={
                tooShort
                  ? `Use at least ${LIMITS.passwordMin} characters.`
                  : null
              }
              required
            />
            <TextField
              label="New password again"
              type="password"
              credential
              value={repeat}
              onChange={setRepeat}
              autoComplete="new-password"
              error={mismatch ? 'The two new passwords are different.' : null}
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
          </Card>
          <Button
            type="submit"
            fullWidth
            disabled={
              busy ||
              current === '' ||
              next === '' ||
              repeat !== next ||
              tooShort
            }
            style={{ marginTop: 16 }}
          >
            {busy ? 'Saving…' : 'Save new password'}
          </Button>
        </form>
        <Button
          variant="ghost"
          fullWidth
          onClick={() => void logout()}
          style={{ marginTop: 8 }}
        >
          Log out
        </Button>
      </div>
    </main>
  );
}
