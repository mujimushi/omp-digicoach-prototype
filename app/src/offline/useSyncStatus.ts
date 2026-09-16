export type SyncState = 'idle' | 'syncing' | 'offline' | 'login_needed';

export type SyncStatus = {
  /** Items saved on the phone and not yet confirmed by the server. */
  waiting: number;
  /** Items the server refused for good. */
  needsAttention: number;
  lastSyncAt: string | null;
  state: SyncState;
};

/** Placeholder until lane 4C: nothing waits and nothing syncs. The type is final. */
export function useSyncStatus(): SyncStatus {
  return { waiting: 0, needsAttention: 0, lastSyncAt: null, state: 'idle' };
}
