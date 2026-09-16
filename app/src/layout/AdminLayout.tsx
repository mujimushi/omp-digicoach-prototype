import {
  ChartColumn,
  Download,
  FileText,
  LogOut,
  Stethoscope,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { useAuth, useUser } from '../auth/AuthProvider.tsx';
import { ds } from '../styles/tokens.ts';
import { Logo } from './Logo.tsx';

const LINKS = [
  { to: '/admin', label: 'Overview', Icon: ChartColumn, end: true },
  { to: '/admin/doctors', label: 'Doctors', Icon: Stethoscope, end: false },
  { to: '/admin/students', label: 'Students', Icon: Users, end: false },
  { to: '/admin/sessions', label: 'Sessions', Icon: FileText, end: false },
  { to: '/admin/export', label: 'Export', Icon: Download, end: false },
] as const;

/** Desktop dashboard: side navigation, a top bar with the admin's name, and the page. */
export function AdminLayout({ children }: { children: ReactNode }) {
  const user = useUser();
  const { logout } = useAuth();

  return (
    <div
      className="admin-layout"
      style={{ minHeight: '100vh', display: 'flex', background: ds.surface }}
    >
      <nav
        aria-label="Dashboard"
        className="admin-nav"
        style={{
          width: 220,
          flexShrink: 0,
          background: ds.warmDk,
          color: ds.txW,
          padding: '20px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 8px 20px',
          }}
        >
          <Logo size={34} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>DigiCoach Admin</span>
        </div>
        {LINKS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 10,
              color: ds.txW,
              textDecoration: 'none',
              fontWeight: isActive ? 700 : 400,
              background: isActive ? 'rgba(255,255,255,0.16)' : 'transparent',
            })}
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header
          className="admin-topbar"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 16,
            padding: '12px 24px',
            background: '#fff',
            borderBottom: `1px solid ${ds.bd}`,
          }}
        >
          <span style={{ fontSize: 14, color: ds.txB }}>{user.name}</span>
          <button
            type="button"
            onClick={() => void logout()}
            style={{
              ...ds.btnSec,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              color: ds.warmDk,
              fontWeight: 600,
            }}
          >
            <LogOut size={16} />
            Log out
          </button>
        </header>
        <main style={{ flex: 1, padding: 24, minWidth: 0 }}>{children}</main>
      </div>
    </div>
  );
}
