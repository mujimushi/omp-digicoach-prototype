import {
  findPearlForAnswer,
  type Pearl,
  PearlIdPayload,
  type PushItemType,
  SessionDraft,
  type Student,
  StudentInput,
  TeachingSession,
} from '@omp/shared';
import { liveQuery } from 'dexie';
import type {
  NeedsAttentionItem,
  PearlInput,
  Repository,
  SessionFilter,
} from '../data/repository.ts';
import { getPhoneDb, type OutboxItem, type PhoneDb } from './db.ts';

export type DexieRepositoryOptions = {
  now?: () => Date;
  newId?: () => string;
};

function matchesSearch(student: Student, search: string): boolean {
  const text = search.trim().toLowerCase();
  if (text === '') return true;
  return (
    student.name.toLowerCase().includes(text) ||
    (student.pmdcNumber ?? '').toLowerCase().includes(text)
  );
}

/** The repository interface on IndexedDB. Every save stores the record and its outbox item in one transaction. */
export function createDexieRepository(
  db: PhoneDb,
  options: DexieRepositoryOptions = {},
): Repository {
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? (() => crypto.randomUUID());

  function outboxItem(
    type: PushItemType,
    payload: unknown,
    summary: string,
  ): OutboxItem {
    return {
      opId: newId(),
      type,
      payload,
      attempts: 0,
      createdAt: now().toISOString(),
      summary,
    };
  }

  async function listMyPearls(): Promise<Pearl[]> {
    const all = await db.pearls.toArray();
    return all
      .filter((pearl) => !pearl.deleted)
      .sort((a, b) => a.diagnosis.localeCompare(b.diagnosis));
  }

  return {
    async listStudents(search = '') {
      const all = await db.students.toArray();
      return all
        .filter((student) => matchesSearch(student, search))
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async getStudent(id) {
      const direct = await db.students.get(id);
      if (direct) return direct;
      const alias = await db.studentAliases.get(id);
      return alias ? db.students.get(alias.studentId) : undefined;
    },

    async saveStudent(input) {
      const clean = StudentInput.parse(input);
      const at = now().toISOString();
      return db.transaction('rw', [db.students, db.outbox], async () => {
        const existing = await db.students.get(clean.id);
        const student: Student = {
          ...clean,
          createdAt: existing?.createdAt ?? at,
          updatedAt: at,
        };
        await db.students.put(student);
        await db.outbox.add(
          outboxItem('student.upsert', clean, `Student ${clean.name}`),
        );
        return student;
      });
    },

    async loadDraft() {
      return (await db.drafts.get('current'))?.draft;
    },

    async saveDraft(draft) {
      await db.drafts.put({ key: 'current', draft: SessionDraft.parse(draft) });
    },

    async discardDraft() {
      await db.drafts.delete('current');
    },

    async completeSession(session) {
      const valid = TeachingSession.parse(session);
      await db.transaction(
        'rw',
        [db.sessions, db.outbox, db.drafts, db.students],
        async () => {
          const student = await db.students.get(valid.studentId);
          await db.sessions.put(valid);
          await db.outbox.add(
            outboxItem(
              'session.create',
              valid,
              `Session with ${student?.name ?? 'a student'} on ${valid.startedAt.slice(0, 10)}`,
            ),
          );
          await db.drafts.delete('current');
        },
      );
    },

    async listMySessions(filter: SessionFilter = {}) {
      const all = await db.sessions.orderBy('startedAt').reverse().toArray();
      return filter.studentId === undefined
        ? all
        : all.filter((s) => s.studentId === filter.studentId);
    },

    async getMySession(id) {
      return db.sessions.get(id);
    },

    listMyPearls,

    async findPearlForAnswer(text) {
      return findPearlForAnswer(await listMyPearls(), text);
    },

    async savePearl(input: PearlInput) {
      return db.transaction('rw', [db.pearls, db.outbox], async () => {
        const existing = await db.pearls.get(input.id);
        const pearl: Pearl = {
          id: input.id,
          diagnosis: input.diagnosis.trim(),
          points: [...input.points],
          timesUsed: existing?.timesUsed ?? 0,
          updatedAt: now().toISOString(),
          deleted: false,
        };
        await db.pearls.put(pearl);
        await db.outbox.add(
          outboxItem('pearl.upsert', pearl, `Pearl for ${pearl.diagnosis}`),
        );
        return pearl;
      });
    },

    async deletePearl(id) {
      const { id: pearlId } = PearlIdPayload.parse({ id });
      await db.transaction('rw', [db.pearls, db.outbox], async () => {
        const existing = await db.pearls.get(pearlId);
        if (!existing) return;
        await db.pearls.put({
          ...existing,
          deleted: true,
          updatedAt: now().toISOString(),
        });
        await db.outbox.add(
          outboxItem(
            'pearl.delete',
            { id: pearlId },
            `Deleting the pearl for ${existing.diagnosis}`,
          ),
        );
      });
    },

    async markPearlUsed(id) {
      const { id: pearlId } = PearlIdPayload.parse({ id });
      await db.transaction('rw', [db.pearls, db.outbox], async () => {
        const existing = await db.pearls.get(pearlId);
        if (!existing) return;
        await db.pearls.put({ ...existing, timesUsed: existing.timesUsed + 1 });
        await db.outbox.add(
          outboxItem(
            'pearl.use',
            { id: pearlId },
            `Using the pearl for ${existing.diagnosis}`,
          ),
        );
      });
    },

    subscribeWaitingCount(listener) {
      const subscription = liveQuery(() => db.outbox.count()).subscribe({
        next: listener,
      });
      return () => subscription.unsubscribe();
    },

    async listNeedsAttention(): Promise<NeedsAttentionItem[]> {
      const rows = await db.needsAttention.toArray();
      return rows.map(({ opId, type, code, summary, failedAt }) => ({
        opId,
        type,
        code,
        summary,
        failedAt,
      }));
    },
  };
}

/** The phone storage repository for the app. Lane 4B's screens switch to it by changing one import. */
export function createRepository(): Repository {
  return createDexieRepository(getPhoneDb());
}
