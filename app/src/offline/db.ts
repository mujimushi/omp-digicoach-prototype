import type {
  Pearl,
  PublicUser,
  PushItemType,
  PushRejectCode,
  SessionDraft,
  Student,
  StudentAlias,
  TeachingSession,
} from '@omp/shared';
import { Dexie, type DexieOptions, type EntityTable } from 'dexie';

export type OutboxItem = {
  /** Assigned by IndexedDB; items send in this order. */
  seq?: number;
  opId: string;
  type: PushItemType;
  payload: unknown;
  /** How many syncs have kept it back, for example while its student is unknown. */
  attempts: number;
  createdAt: string;
  /** What the item was, in words the doctor recognises. */
  summary: string;
};

export type NeedsAttentionRow = {
  opId: string;
  type: PushItemType;
  code: PushRejectCode;
  summary: string;
  failedAt: string;
  payload: unknown;
};

export type DraftRow = { key: 'current'; draft: SessionDraft };

export type MetaValues = {
  pullCursor: string;
  userId: string;
  user: PublicUser;
  lastSyncAt: string;
  /**
   * 'own' once the phone holds only this doctor's students. Phones set up while the student list was
   * shared (before 30 September 2026) hold every doctor's students until their next full pull.
   */
  studentScope: 'own';
};
export type MetaKey = keyof MetaValues;
export type MetaRow = { key: MetaKey; value: MetaValues[MetaKey] };

/** Storage on the phone, in IndexedDB. */
export class PhoneDb extends Dexie {
  students!: EntityTable<Student, 'id'>;
  studentAliases!: EntityTable<StudentAlias, 'aliasId'>;
  sessions!: EntityTable<TeachingSession, 'id'>;
  pearls!: EntityTable<Pearl, 'id'>;
  outbox!: EntityTable<OutboxItem, 'seq'>;
  needsAttention!: EntityTable<NeedsAttentionRow, 'opId'>;
  drafts!: EntityTable<DraftRow, 'key'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor(name = 'omp', options?: DexieOptions) {
    super(name, options);
    // A later change adds version(2) with an upgrade function and keeps this version as it is.
    this.version(1).stores({
      students: 'id, name, pmdcNumber, changeSeq',
      studentAliases: 'aliasId, studentId',
      sessions: 'id, startedAt, studentId',
      pearls: 'id, diagnosis',
      outbox: '++seq, &opId, type',
      needsAttention: 'opId',
      drafts: 'key',
      meta: 'key',
    });
  }

  async getMeta<K extends MetaKey>(key: K): Promise<MetaValues[K] | undefined> {
    const row = await this.meta.get(key);
    return row?.value as MetaValues[K] | undefined;
  }

  async setMeta<K extends MetaKey>(
    key: K,
    value: MetaValues[K],
  ): Promise<void> {
    await this.meta.put({ key, value });
  }

  /** Empties every table. */
  async clearAll(): Promise<void> {
    await this.transaction('rw', this.tables, async () => {
      await Promise.all(this.tables.map((table) => table.clear()));
    });
  }
}

let shared: PhoneDb | undefined;

/** The app's one phone database. */
export function getPhoneDb(): PhoneDb {
  shared ??= new PhoneDb();
  return shared;
}

/** Deletes the phone database, as at logout. The next `getPhoneDb()` opens a fresh one. */
export async function deletePhoneDb(): Promise<void> {
  const db = getPhoneDb();
  shared = undefined;
  await db.delete();
}
