import {
  PUSH_BATCH_MAX,
  type PullResponse,
  type PushItem,
  type PushResponse,
  type PushResult,
  type SessionDraft,
} from '@omp/shared';
import { ApiRequestError, NetworkError } from '../api/errors.ts';
import type { OutboxItem, PhoneDb } from './db.ts';

export type SyncApi = {
  push(items: PushItem[]): Promise<PushResponse>;
  pull(cursor: string): Promise<PullResponse>;
};

export type SyncState = 'idle' | 'syncing' | 'offline' | 'login_needed';

export type EngineStatus = {
  state: SyncState;
  lastSyncAt: string | null;
  /** The server's words when a sync needed a new login, such as "This account has been switched off." */
  loginMessage: string | null;
};

export type SyncEngineOptions = {
  db: PhoneDb;
  api: SyncApi;
  now?: () => Date;
  /** Screens reload their data. */
  onChanged?: () => void;
  onPasswordChangeRequired?: () => void;
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

/** After a network error or a 5xx: 5 s, 15 s, 60 s, then every 5 minutes. */
export const RETRY_DELAYS_MS = [5_000, 15_000, 60_000, 300_000] as const;

export type SyncEngine = {
  /** Runs one sync. A second call during a run waits for the first. */
  syncNow(): Promise<void>;
  getStatus(): EngineStatus;
  subscribe(listener: () => void): () => void;
  /** After the doctor logs in again. */
  clearLoginNeeded(): void;
  stop(): void;
};

function studentIdOf(item: OutboxItem): string | undefined {
  if (item.type !== 'student.upsert') return undefined;
  return (item.payload as { id?: string }).id;
}

/** Replaces a student ID made on this phone with the server's ID, everywhere, in one transaction. */
export async function remapStudentId(
  db: PhoneDb,
  oldId: string,
  newId: string,
): Promise<void> {
  if (oldId === newId) return;
  await db.transaction(
    'rw',
    [db.students, db.studentAliases, db.sessions, db.drafts, db.outbox],
    async () => {
      const old = await db.students.get(oldId);
      if (old) {
        await db.students.delete(oldId);
        if (!(await db.students.get(newId)))
          await db.students.put({ ...old, id: newId });
      }
      await db.studentAliases.put({ aliasId: oldId, studentId: newId });
      await db.sessions
        .where('studentId')
        .equals(oldId)
        .modify({ studentId: newId });

      const draft = await db.drafts.get('current');
      if (draft?.draft.studentId === oldId) {
        const updated: SessionDraft = { ...draft.draft, studentId: newId };
        await db.drafts.put({ key: 'current', draft: updated });
      }

      await db.outbox.toCollection().modify((item) => {
        const payload = item.payload as { id?: string; studentId?: string };
        if (item.type === 'student.upsert' && payload.id === oldId) {
          item.payload = { ...payload, id: newId };
        }
        if (item.type === 'session.create' && payload.studentId === oldId) {
          item.payload = { ...payload, studentId: newId };
        }
      });
    },
  );
}

async function applyResults(
  db: PhoneDb,
  batch: OutboxItem[],
  results: PushResult[],
  now: Date,
) {
  const bySeq = new Map(batch.map((item) => [item.opId, item]));
  for (const result of results) {
    const item = bySeq.get(result.opId);
    if (!item || item.seq === undefined) continue;
    const seq = item.seq;

    if (result.status === 'applied' || result.status === 'duplicate') {
      await db.outbox.delete(seq);
      const oldId = studentIdOf(item);
      if (oldId && result.mappedStudentId && result.mappedStudentId !== oldId) {
        await remapStudentId(db, oldId, result.mappedStudentId);
      }
    } else if (result.code === 'unknown_student') {
      await db.outbox.update(seq, { attempts: item.attempts + 1 });
    } else {
      await db.transaction('rw', [db.outbox, db.needsAttention], async () => {
        await db.needsAttention.put({
          opId: item.opId,
          type: item.type,
          code: result.code ?? 'validation_failed',
          summary: item.summary,
          failedAt: now.toISOString(),
          payload: item.payload,
        });
        await db.outbox.delete(seq);
      });
    }
  }
}

/** Records waiting to send stay as the doctor saved them until the server confirms them. */
async function pendingIds(
  db: PhoneDb,
): Promise<{ students: Set<string>; pearls: Set<string> }> {
  const items = await db.outbox.toArray();
  const students = new Set<string>();
  const pearls = new Set<string>();
  for (const item of items) {
    const id = (item.payload as { id?: string }).id;
    if (!id) continue;
    if (item.type === 'student.upsert') students.add(id);
    if (item.type.startsWith('pearl.')) pearls.add(id);
  }
  return { students, pearls };
}

async function mergePull(
  db: PhoneDb,
  pulled: PullResponse,
  now: Date,
): Promise<boolean> {
  const pending = await pendingIds(db);
  await db.transaction(
    'rw',
    [db.students, db.studentAliases, db.sessions, db.pearls, db.meta],
    async () => {
      await db.students.bulkPut(
        pulled.students.filter((s) => !pending.students.has(s.id)),
      );
      await db.studentAliases.bulkPut(pulled.studentAliases);
      await db.sessions.bulkPut(pulled.sessions);
      for (const pearl of pulled.pearls) {
        if (pending.pearls.has(pearl.id)) continue;
        if (pearl.deleted) await db.pearls.delete(pearl.id);
        else await db.pearls.put(pearl);
      }
      await db.setMeta('pullCursor', pulled.cursor);
      await db.setMeta('lastSyncAt', now.toISOString());
    },
  );
  // A student this phone added under another ID is now known by the server's ID.
  for (const alias of pulled.studentAliases) {
    if (
      (await db.students.get(alias.aliasId)) ||
      (await db.sessions.where('studentId').equals(alias.aliasId).count())
    ) {
      await remapStudentId(db, alias.aliasId, alias.studentId);
    }
  }
  return (
    pulled.students.length +
      pulled.studentAliases.length +
      pulled.sessions.length +
      pulled.pearls.length >
    0
  );
}

function toPushItem(item: OutboxItem): PushItem {
  return {
    opId: item.opId,
    type: item.type,
    payload: item.payload,
  } as PushItem;
}

export function createSyncEngine(options: SyncEngineOptions): SyncEngine {
  const { db, api } = options;
  const now = options.now ?? (() => new Date());
  const setTimer = options.setTimer ?? ((run, ms) => setTimeout(run, ms));
  const clearTimer =
    options.clearTimer ??
    ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  let status: EngineStatus = {
    state: 'idle',
    lastSyncAt: null,
    loginMessage: null,
  };
  const listeners = new Set<() => void>();
  let running: Promise<void> | null = null;
  let failures = 0;
  let retryHandle: unknown;
  let stopped = false;

  void db.getMeta('lastSyncAt').then((lastSyncAt) => {
    if (lastSyncAt && status.lastSyncAt === null) setStatus({ lastSyncAt });
  });

  function setStatus(patch: Partial<EngineStatus>) {
    status = { ...status, ...patch };
    for (const listener of listeners) listener();
  }

  function scheduleRetry() {
    if (stopped) return;
    const delay =
      RETRY_DELAYS_MS[Math.min(failures, RETRY_DELAYS_MS.length - 1)] ??
      300_000;
    failures += 1;
    clearTimer(retryHandle);
    retryHandle = setTimer(() => void syncNow(), delay);
  }

  async function run(): Promise<void> {
    if (status.state === 'login_needed' || stopped) return;
    setStatus({ state: 'syncing' });
    try {
      let lastSeq = 0;
      for (;;) {
        const batch = await db.outbox
          .where('seq')
          .above(lastSeq)
          .limit(PUSH_BATCH_MAX)
          .toArray();
        if (batch.length === 0) break;
        const response = await api.push(batch.map(toPushItem));
        await applyResults(db, batch, response.results, now());
        lastSeq = batch.at(-1)?.seq ?? lastSeq;
        options.onChanged?.();
      }

      const cursor = (await db.getMeta('pullCursor')) ?? '';
      let pulled: PullResponse;
      try {
        pulled = await api.pull(cursor);
      } catch (error) {
        // A cursor the server doesn't know: start again from the beginning.
        if (error instanceof ApiRequestError && error.code === 'bad_cursor') {
          pulled = await api.pull('');
        } else {
          throw error;
        }
      }
      if (await mergePull(db, pulled, now())) options.onChanged?.();

      failures = 0;
      clearTimer(retryHandle);
      setStatus({ state: 'idle', lastSyncAt: now().toISOString() });
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        setStatus({ state: 'login_needed', loginMessage: error.message });
        return;
      }
      if (
        error instanceof ApiRequestError &&
        error.code === 'password_change_required'
      ) {
        setStatus({ state: 'idle' });
        options.onPasswordChangeRequired?.();
        return;
      }
      if (
        error instanceof NetworkError ||
        (error instanceof ApiRequestError && error.status >= 500)
      ) {
        setStatus({ state: 'offline' });
        scheduleRetry();
        return;
      }
      setStatus({ state: 'idle' });
      scheduleRetry();
    }
  }

  function syncNow(): Promise<void> {
    running ??= run().finally(() => {
      running = null;
    });
    return running;
  }

  return {
    syncNow,
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clearLoginNeeded() {
      setStatus({ state: 'idle', loginMessage: null });
    },
    stop() {
      stopped = true;
      clearTimer(retryHandle);
    },
  };
}
