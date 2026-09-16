import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';
import { ds } from '../styles/tokens.ts';

export type Tab = {
  to: string;
  label: string;
  Icon: LucideIcon;
  end?: boolean;
};

/** The doctor app's bottom tabs, copied from the prototype. */
export function TabBar({ tabs }: { tabs: readonly Tab[] }) {
  return (
    <nav
      aria-label="Main"
      style={{
        display: 'flex',
        borderTop: `1px solid ${ds.bd}`,
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(12px)',
        padding: '6px 0 calc(10px + env(safe-area-inset-bottom))',
        flexShrink: 0,
      }}
    >
      {tabs.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end ?? false}
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            padding: '8px 0 0',
            minHeight: 48,
            textDecoration: 'none',
            color: isActive ? ds.priText : ds.txMuted,
          })}
        >
          {({ isActive }) => (
            <>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
              <span style={{ fontSize: 11, fontWeight: isActive ? 700 : 400 }}>
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
