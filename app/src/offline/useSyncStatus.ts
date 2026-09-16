import { useLiveQuery } from 'dexie-react-hooks';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { getPhoneDb } from './db.ts';
import type { EngineStatus, SyncEngine } from './sync.ts';

export type SyncState = 'idle' | 'syncing' | 'offline' | 'login_needed';

export type SyncStatus = {
  /** Items saved on the phone and not yet confirmed by the server. */
  waiting: number;
  /** Items the server refused for good. */
  needsAttention: number;
  lastSyncAt: string | null;
  state: SyncState;
};

export const SyncContext = createContext<SyncEngine | null>(null);

const IDLE: EngineStatus = {
  state: 'idle',
  lastSyncAt: null,
  loginMessage: null,
};
const noSubscription = () => () => undefined;

function useEngineStatus(): EngineStatus {
  const engine = useContext(SyncContext);
  return useSyncExternalStore(
    engine?.subscribe ?? noSubscription,
    () => engine?.getStatus() ?? IDLE,
  );
}

/** `navigator.onLine` is unreliable, so it only colours the badge; syncing always tries. */
function useOnlineFlag(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

export function useSyncStatus(): SyncStatus {
  const status = useEngineStatus();
  const online = useOnlineFlag();
  const waiting = useLiveQuery(() => getPhoneDb().outbox.count(), [], 0);
  const needsAttention = useLiveQuery(
    () => getPhoneDb().needsAttention.count(),
    [],
    0,
  );
  const state = status.state === 'idle' && !online ? 'offline' : status.state;
  return { waiting, needsAttention, lastSyncAt: status.lastSyncAt, state };
}

/** Why the last sync needed a new login, in the server's words. */
export function useSyncLoginMessage(): string | null {
  return useEngineStatus().loginMessage;
}
