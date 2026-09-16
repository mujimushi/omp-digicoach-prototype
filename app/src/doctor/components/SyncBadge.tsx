import { CloudOff, RefreshCw, TriangleAlert, UploadCloud } from 'lucide-react';
import { useSyncStatus } from '../../offline/useSyncStatus.ts';

/** How many saves are waiting to send, shown in the header. */
export function SyncBadge() {
  const { waiting, needsAttention, state } = useSyncStatus();

  let label: string;
  let Icon = UploadCloud;
  if (state === 'login_needed') {
    label = waiting > 0 ? `Log in to send ${waiting}` : 'Log in to sync';
    Icon = TriangleAlert;
  } else if (state === 'offline') {
    label = waiting > 0 ? `Offline · ${waiting} waiting` : 'Offline';
    Icon = CloudOff;
  } else if (state === 'syncing') {
    label = 'Sending…';
    Icon = RefreshCw;
  } else if (waiting > 0) {
    label = `${waiting} waiting`;
  } else {
    label = 'All sent';
  }

  return (
    <output
      aria-live="polite"
      data-testid="sync-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 10px',
        borderRadius: 14,
        background: 'rgba(61,46,92,0.55)',
        color: '#fff',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={14} />
      {label}
      {needsAttention > 0 && ` · ${needsAttention} to check`}
    </output>
  );
}
