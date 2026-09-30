import {
  BookOpen,
  ChevronRight,
  Compass,
  LogOut,
  type LucideIcon,
  Star,
  TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth, useUser } from '../../auth/AuthProvider.tsx';
import { useSyncStatus } from '../../offline/useSyncStatus.ts';
import { ds } from '../../styles/tokens.ts';
import { useTour } from '../../tour/useTour.ts';
import { Button } from '../../ui/Button.tsx';
import { Card } from '../../ui/Card.tsx';
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx';
import { IconCircle } from '../../ui/IconCircle.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { APP_VERSION } from '../session/draft.ts';
import { useRepositoryQuery } from '../useRepositoryQuery.ts';

type MenuRowProps = {
  label: string;
  detail: string;
  Icon: LucideIcon;
  colour: string;
};

function MenuRowContent({ label, detail, Icon, colour }: MenuRowProps) {
  return (
    <>
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
    </>
  );
}

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
        <MenuRowContent
          label={label}
          detail={detail}
          Icon={Icon}
          colour={colour}
        />
      </Link>
    </li>
  );
}

function MenuItem({
  onClick,
  label,
  detail,
  Icon,
  colour,
}: {
  onClick: () => void;
  label: string;
  detail: string;
  Icon: LucideIcon;
  colour: string;
}) {
  return (
    <li style={{ marginBottom: 8 }}>
      <button
        type="button"
        onClick={onClick}
        style={{
          ...ds.card,
          width: '100%',
          border: 'none',
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <MenuRowContent
          label={label}
          detail={detail}
          Icon={Icon}
          colour={colour}
        />
      </button>
    </li>
  );
}

/** Pearls, About, the install guide, items needing attention, the app version and Log out. */
export function MoreScreen() {
  const user = useUser();
  const { logout } = useAuth();
  const pearls = useRepositoryQuery((repo) => repo.listMyPearls(), []);
  const attention = useRepositoryQuery((repo) => repo.listNeedsAttention(), []);
  const pearlCount = pearls.data?.length ?? 0;
  const problems = attention.data ?? [];
  const { waiting } = useSyncStatus();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const tour = useTour();

  return (
    <>
      <ScreenHeader title="More" subtitle={user.name} />
      <div style={{ flex: 1, padding: '0 16px 24px' }}>
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
          {tour.available && (
            <MenuItem
              onClick={tour.startTour}
              label="App tour"
              detail="A short guided practice session"
              Icon={Compass}
              colour={ds.teal}
            />
          )}
        </ul>
        <Button
          variant="secondary"
          fullWidth
          icon={<LogOut size={16} />}
          onClick={() => {
            if (waiting > 0) setConfirmLogout(true);
            else void logout();
          }}
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
      <ConfirmDialog
        open={confirmLogout}
        title={
          waiting === 1
            ? '1 item hasn’t been sent'
            : `${waiting} items haven’t been sent`
        }
        confirmLabel="Log out and delete them"
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => {
          setConfirmLogout(false);
          void logout();
        }}
      >
        Logging out deletes everything saved on this phone, including these.
        Find signal and wait for them to send first.
      </ConfirmDialog>
    </>
  );
}
