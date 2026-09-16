import {
  ChartColumn,
  Ellipsis,
  FileText,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Outlet, useLocation } from 'react-router';
import { RepositoryProvider } from '../data/RepositoryProvider.tsx';
import { ResumeGate } from '../doctor/session/ResumeGate.tsx';
import { ds } from '../styles/tokens.ts';
import { type Tab, TabBar } from '../ui/TabBar.tsx';

export const DOCTOR_TABS: readonly Tab[] = [
  { to: '/', label: 'Students', Icon: Users, end: true },
  { to: '/history', label: 'History', Icon: FileText },
  { to: '/stats', label: 'Stats', Icon: ChartColumn },
  { to: '/progress', label: 'Progress', Icon: TrendingUp },
  { to: '/more', label: 'More', Icon: Ellipsis },
];

/** Phone-first: one column up to 500 px wide, the screen above and the tabs below. */
export function DoctorLayout() {
  const { pathname } = useLocation();
  // A session in progress fills the screen, as in the prototype.
  const showTabs = !pathname.startsWith('/session');

  return (
    <RepositoryProvider>
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
    </RepositoryProvider>
  );
}
