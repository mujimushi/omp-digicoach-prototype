import { liveQuery } from 'dexie';
import { type ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useUser } from '../auth/AuthProvider.tsx';
import { useRepositoryContext } from '../data/RepositoryProvider.tsx';
import { getPhoneDb } from './db.ts';
import { httpSyncApi } from './http-sync-api.ts';
import { requestPersistentStorage } from './phone-auth.ts';
import { createSyncEngine, type SyncEngine } from './sync.ts';
import { SyncContext } from './useSyncStatus.ts';

export const SAVE_SYNC_DELAY_MS = 2_000;
export const VISIBLE_SYNC_INTERVAL_MS = 60_000;

/**
 * Runs the sync engine for the logged-in doctor: at start (which follows login), when the
 * connection returns, when the page becomes visible, 2 seconds after a save, and every 60 seconds
 * while visible. No Background Sync: iPhones don't have it.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const userId = useUser().id;
  const { notifyChanged } = useRepositoryContext();
  const navigate = useNavigate();
  const [engine, setEngine] = useState<SyncEngine | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: one engine per logged-in user
  useEffect(() => {
    const created = createSyncEngine({
      db: getPhoneDb(),
      api: httpSyncApi,
      onChanged: notifyChanged,
      onPasswordChangeRequired: () => navigate('/change-password'),
    });
    setEngine(created);
    void requestPersistentStorage();
    void created.syncNow();

    const visible = () => document.visibilityState === 'visible';
    const onOnline = () => void created.syncNow();
    const onVisibility = () => {
      if (visible()) void created.syncNow();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);
    const interval = setInterval(() => {
      if (visible()) void created.syncNow();
    }, VISIBLE_SYNC_INTERVAL_MS);

    let lastCount = -1;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    const subscription = liveQuery(() => getPhoneDb().outbox.count()).subscribe(
      {
        next: (count) => {
          if (lastCount >= 0 && count > lastCount) {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(
              () => void created.syncNow(),
              SAVE_SYNC_DELAY_MS,
            );
          }
          lastCount = count;
        },
      },
    );

    return () => {
      created.stop();
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(interval);
      clearTimeout(saveTimer);
      subscription.unsubscribe();
      setEngine(null);
    };
  }, [userId]);

  return <SyncContext.Provider value={engine}>{children}</SyncContext.Provider>;
}
