import {
  BookOpen,
  ChevronRight,
  LogOut,
  type LucideIcon,
  Star,
  TriangleAlert,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth, useUser } from '../../auth/AuthProvider.tsx';
import { ds } from '../../styles/tokens.ts';
import { Button } from '../../ui/Button.tsx';
import { Card } from '../../ui/Card.tsx';
import { IconCircle } from '../../ui/IconCircle.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { APP_VERSION } from '../session/draft.ts';
import { useRepositoryQuery } from '../useRepositoryQuery.ts';

function MenuLink({
  to,
  label,
  detail,
  Icon,
  colour,
}: {
  to: string;
  label: string;
  detail: string;
  Icon: LucideIcon;
  colour: string;
}) {
  return (
    <li style={{ marginBottom: 8 }}>
      <Link
        to={to}
        style={{
          ...ds.card,
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          textDecoration: 'none',
        }}
      >
        <IconCircle Icon={Icon} color={colour} />
        <span style={{ flex: 1 }}>
          <span
            style={{
              display: 'block',
              fontSize: 15,
              fontWeight: 700,
              color: ds.tx,
            }}
          >
            {label}
          </span>
          <span
            style={{
              display: 'block',
              fontSize: 13,
              color: ds.txB,
              marginTop: 2,
            }}
          >
            {detail}
          </span>
        </span>
        <ChevronRight size={16} color={ds.txL} />
      </Link>
    </li>
  );
}

/** Pearls, About, the install guide, items needing attention, the app version and Log out. */
export function MoreScreen({ installGuide }: { installGuide?: ReactNode }) {
  const user = useUser();
  const { logout } = useAuth();
  const pearls = useRepositoryQuery((repo) => repo.listMyPearls(), []);
  const attention = useRepositoryQuery((repo) => repo.listNeedsAttention(), []);
  const pearlCount = pearls.data?.length ?? 0;
  const problems = attention.data ?? [];

  return (
    <>
      <ScreenHeader title="More" subtitle={user.name} />
      <div style={{ flex: 1, padding: '0 16px 24px' }}>
        {installGuide}
        {problems.length > 0 && (
          <Card accent={ds.red} style={{ marginBottom: 12 }}>
            <h2
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 15,
                color: ds.redText,
                margin: '0 0 6px',
              }}
            >
              <TriangleAlert size={16} />
              {problems.length === 1
                ? '1 item needs attention'
                : `${problems.length} items need attention`}
            </h2>
            <p style={{ fontSize: 13, color: ds.txB, margin: '0 0 8px' }}>
              The server refused these. Ask the admin if you’re not sure what to
              do.
            </p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {problems.map((item) => (
                <li
                  key={item.opId}
                  style={{ fontSize: 13, color: ds.tx, marginBottom: 4 }}
                >
                  {item.summary}
                </li>
              ))}
            </ul>
          </Card>
        )}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          <MenuLink
            to="/pearls"
            label="Teaching pearls"
            detail={
              pearlCount === 1 ? '1 pearl saved' : `${pearlCount} pearls saved`
            }
            Icon={Star}
            colour={ds.gold}
          />
          <MenuLink
            to="/about"
            label="About OMP"
            detail="The five steps and the rating scale"
            Icon={BookOpen}
            colour={ds.pri}
          />
        </ul>
        <Button
          variant="secondary"
          fullWidth
          icon={<LogOut size={16} />}
          onClick={() => void logout()}
          style={{ marginTop: 16 }}
        >
          Log out
        </Button>
        <p
          style={{
            textAlign: 'center',
            fontSize: 12,
            color: ds.txMuted,
            margin: '20px 0 0',
          }}
        >
          OMP DigiCoach version {APP_VERSION}
        </p>
      </div>
    </>
  );
}
