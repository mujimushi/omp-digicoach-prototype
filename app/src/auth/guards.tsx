import { ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router';
import { Splash } from '../layout/Splash.tsx';
import { ds } from '../styles/tokens.ts';
import { homeFor, useAuth } from './AuthProvider.tsx';

/** A logged-in user. One who must change their password always lands on the change screen. */
export function RequireLogin({ children }: { children?: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') return <Splash />;
  if (state.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (
    state.user.mustChangePassword &&
    location.pathname !== '/change-password'
  ) {
    return <Navigate to="/change-password" replace />;
  }
  return children ?? <Outlet />;
}

/** The doctor app. An admin who doesn't teach goes to the dashboard. */
export function RequireDoctorArea({ children }: { children?: ReactNode }) {
  const { user } = useAuth();
  if (user && !user.isDoctor) return <Navigate to={homeFor(user)} replace />;
  return children ?? <Outlet />;
}

/** The dashboard. Anyone else sees a not-allowed page; the server refuses the data regardless. */
export function RequireAdminArea({ children }: { children?: ReactNode }) {
  const { user } = useAuth();
  if (user && !user.isAdmin) return <NotAllowed />;
  return children ?? <Outlet />;
}

export function NotAllowed() {
  return (
    <main
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
        background: ds.surface,
      }}
    >
      <ShieldAlert size={40} color={ds.priText} />
      <h1 style={{ fontSize: 22, color: ds.warmDk, margin: '12px 0 6px' }}>
        This page is for the admin
      </h1>
      <p style={{ fontSize: 14, color: ds.txB, margin: '0 0 16px' }}>
        Your account can’t open the dashboard.
      </p>
      <Link to="/" style={{ color: ds.priText, fontWeight: 600 }}>
        Back to the app
      </Link>
    </main>
  );
}
