import { useRegisterSW } from 'virtual:pwa-register/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { RefreshCw } from 'lucide-react';
import { ds } from '../styles/tokens.ts';
import { getPhoneDb } from './db.ts';

export type UpdatePromptViewProps = {
  needRefresh: boolean;
  hasDraft: boolean;
  onReload: () => void;
};

/** Offers the new version, but never while a session is in progress. */
export function UpdatePromptView({
  needRefresh,
  hasDraft,
  onReload,
}: UpdatePromptViewProps) {
  if (!needRefresh || hasDraft) return null;
  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 'calc(84px + env(safe-area-inset-bottom))',
        maxWidth: 468,
        margin: '0 auto',
        zIndex: 250,
        background: ds.warmDk,
        color: ds.txW,
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 8px 24px rgba(61,46,92,0.35)',
      }}
    >
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>
        A new version is ready
      </span>
      <button
        type="button"
        onClick={onReload}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: '#fff',
          color: ds.warmDk,
          border: 'none',
          borderRadius: 10,
          padding: '8px 12px',
          minHeight: 40,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        <RefreshCw size={14} />
        Reload
      </button>
    </div>
  );
}

/** Registers the service worker and shows the update prompt once no draft is open. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  // Until the phone answers, assume a draft exists, so no prompt interrupts a session.
  const hasDraft = useLiveQuery(
    async () => (await getPhoneDb().drafts.count()) > 0,
    [],
    true,
  );
  return (
    <UpdatePromptView
      needRefresh={needRefresh}
      hasDraft={hasDraft}
      onReload={() => void updateServiceWorker(true)}
    />
  );
}
