import {
  ChartColumn,
  Ellipsis,
  FileText,
  TrendingUp,
  TriangleAlert,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthProvider.tsx';
import { RepositoryProvider } from '../data/RepositoryProvider.tsx';
import { ResumeGate } from '../doctor/session/ResumeGate.tsx';
import { SyncProvider } from '../offline/SyncProvider.tsx';
import {
  useSyncLoginMessage,
  useSyncStatus,
} from '../offline/useSyncStatus.ts';
import { ds } from '../styles/tokens.ts';
import { PracticeBanner } from '../tour/PracticeBanner.tsx';
import { TourProvider } from '../tour/TourProvider.tsx';
import { useTour } from '../tour/useTour.ts';
import { type Tab, TabBar } from '../ui/TabBar.tsx';

export const DOCTOR_TABS: readonly Tab[] = [
  { to: '/', label: 'Students', Icon: Users, end: true },
  { to: '/history', label: 'History', Icon: FileText },
  { to: '/stats', label: 'Stats', Icon: ChartColumn },
  { to: '/progress', label: 'Progress', Icon: TrendingUp },
  { to: '/more', label: 'More', Icon: Ellipsis },
];

/** When a sync finds the login has ended: say why, keep everything, and offer to log in. */
function LoginNeededBanner() {
  const { state, waiting } = useSyncStatus();
  const message = useSyncLoginMessage();
  const { expireLogin } = useAuth();
  if (state !== 'login_needed') return null;
  const kept =
    waiting === 1 ? '1 saved item is kept' : `${waiting} saved items are kept`;
  return (
    <div
      role="alert"
      style={{
        background: ds.warmDk,
        color: ds.txW,
        padding: 'calc(10px + env(safe-area-inset-top)) 16px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
      }}
    >
      <TriangleAlert size={18} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13 }}>
        {message ?? 'Your login has ended.'} {kept} on this phone.
      </span>
      <button
        type="button"
        onClick={() => expireLogin(message)}
        style={{
          background: '#fff',
          color: ds.warmDk,
          border: 'none',
          borderRadius: 10,
          padding: '8px 10px',
          fontWeight: 700,
          minHeight: 40,
          cursor: 'pointer',
        }}
      >
        Log in
      </button>
    </div>
  );
}

/** The phone's storage, or the tour's throwaway storage during a practice session. */
function DoctorRepository({ children }: { children: ReactNode }) {
  const { practiceRepository } = useTour();
  return (
    <RepositoryProvider repository={practiceRepository ?? undefined}>
      {children}
    </RepositoryProvider>
  );
}

/** Phone-first: one column up to 500 px wide, the screen above and the tabs below. */
export function DoctorLayout() {
  return (
    <TourProvider>
      <DoctorRepository>
        <DoctorScreens />
      </DoctorRepository>
    </TourProvider>
  );
}

function DoctorScreens() {
  const { pathname } = useLocation();
  // A session in progress fills the screen, as in the prototype.
  const showTabs = !pathname.startsWith('/session');

  return (
    <SyncProvider>
      <ResumeGate>
        <div
          style={{
            height: '100dvh',
            maxWidth: 500,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            background: ds.surface,
            position: 'relative',
          }}
        >
          <PracticeBanner />
          <LoginNeededBanner />
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Outlet />
          </div>
          {showTabs && <TabBar tabs={DOCTOR_TABS} />}
        </div>
      </ResumeGate>
    </SyncProvider>
  );
}
