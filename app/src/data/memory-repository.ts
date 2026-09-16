import {
  findPearlForAnswer,
  type Pearl,
  PearlIdPayload,
  type PushItem,
  SessionDraft,
  type Student,
  StudentInput,
  TeachingSession,
} from '@omp/shared';
import type {
  NeedsAttentionItem,
  PearlInput,
  Repository,
  SessionFilter,
} from './repository.ts';

export type MemoryRepositoryData = {
  /** The logged-in doctor. Only their sessions and pearls are visible. */
  doctorId: string;
  students?: readonly Student[];
  sessions?: readonly { doctorId: string; session: TeachingSession }[];
  pearls?: readonly { doctorId: string; pearl: Pearl }[];
  now?: () => Date;
  newId?: () => string;
};

export type MemoryRepository = Repository & {
  /** Items queued for the server, in order. For tests. */
  readonly outbox: readonly PushItem[];
};

function matchesSearch(student: Student, search: string): boolean {
  const text = search.trim().toLowerCase();
  if (text === '') return true;
  return (
    student.name.toLowerCase().includes(text) ||
    (student.pmdcNumber ?? '').toLowerCase().includes(text)
  );
}

/**
 * The repository interface held in memory. Doctor screens are built against it, and component
 * tests use it. The app build never includes it.
 */
export function createMemoryRepository(
  data: MemoryRepositoryData,
): MemoryRepository {
  const now = data.now ?? (() => new Date());
  const newId = data.newId ?? (() => crypto.randomUUID());
  const students = new Map(data.students?.map((s) => [s.id, s]) ?? []);
  const sessions = (data.sessions ?? []).map((entry) => ({ ...entry }));
  const pearls = new Map(
    (data.pearls ?? []).map((entry) => [entry.pearl.id, { ...entry }]),
  );
  const outbox: PushItem[] = [];
  const needsAttention: NeedsAttentionItem[] = [];
  const listeners = new Set<(count: number) => void>();
  let draft: SessionDraft | undefined;

  function enqueue(item: Omit<PushItem, 'opId'>) {
    outbox.push({ ...item, opId: newId() } as PushItem);
    for (const listener of listeners) listener(outbox.length);
  }

  function listMyPearls(): Pearl[] {
    return [...pearls.values()]
      .filter(
        (entry) => entry.doctorId === data.doctorId && !entry.pearl.deleted,
      )
      .map((entry) => entry.pearl)
      .sort((a, b) => a.diagnosis.localeCompare(b.diagnosis));
  }

  function ownPearl(id: string) {
    const entry = pearls.get(id);
    return entry && entry.doctorId === data.doctorId ? entry : undefined;
  }

  return {
    get outbox() {
      return outbox;
    },

    async listStudents(search = '') {
      return [...students.values()]
        .filter((student) => matchesSearch(student, search))
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async getStudent(id) {
      return students.get(id);
    },

    async saveStudent(input) {
      const clean = StudentInput.parse(input);
      const at = now().toISOString();
      const existing = students.get(clean.id);
      const student: Student = {
        ...clean,
        createdAt: existing?.createdAt ?? at,
        updatedAt: at,
      };
      students.set(student.id, student);
      enqueue({ type: 'student.upsert', payload: clean });
      return student;
    },

    async loadDraft() {
      return draft && structuredClone(draft);
    },

    async saveDraft(next) {
      draft = structuredClone(SessionDraft.parse(next));
    },

    async discardDraft() {
      draft = undefined;
    },

    async completeSession(session) {
      const valid = TeachingSession.parse(session);
      sessions.push({ doctorId: data.doctorId, session: valid });
      draft = undefined;
      enqueue({ type: 'session.create', payload: valid });
    },

    async listMySessions(filter: SessionFilter = {}) {
      return sessions
        .filter((entry) => entry.doctorId === data.doctorId)
        .map((entry) => entry.session)
        .filter(
          (session) =>
            filter.studentId === undefined ||
            session.studentId === filter.studentId,
        )
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    },

    async getMySession(id) {
      return sessions.find(
        (entry) => entry.doctorId === data.doctorId && entry.session.id === id,
      )?.session;
    },

    async listMyPearls() {
      return listMyPearls();
    },

    async findPearlForAnswer(text) {
      return findPearlForAnswer(listMyPearls(), text);
    },

    async savePearl(input: PearlInput) {
      const existing = ownPearl(input.id);
      if (pearls.has(input.id) && !existing) {
        throw new Error('That pearl belongs to another doctor');
      }
      const pearl: Pearl = {
        id: input.id,
        diagnosis: input.diagnosis.trim(),
        points: [...input.points],
        timesUsed: existing?.pearl.timesUsed ?? 0,
        updatedAt: now().toISOString(),
        deleted: false,
      };
      pearls.set(pearl.id, { doctorId: data.doctorId, pearl });
      enqueue({ type: 'pearl.upsert', payload: pearl });
      return pearl;
    },

    async deletePearl(id) {
      const entry = ownPearl(PearlIdPayload.parse({ id }).id);
      if (!entry) return;
      entry.pearl = {
        ...entry.pearl,
        deleted: true,
        updatedAt: now().toISOString(),
      };
      enqueue({ type: 'pearl.delete', payload: { id } });
    },

    async markPearlUsed(id) {
      const entry = ownPearl(PearlIdPayload.parse({ id }).id);
      if (!entry) return;
      entry.pearl = { ...entry.pearl, timesUsed: entry.pearl.timesUsed + 1 };
      enqueue({ type: 'pearl.use', payload: { id } });
    },

    subscribeWaitingCount(listener) {
      listeners.add(listener);
      listener(outbox.length);
      return () => {
        listeners.delete(listener);
      };
    },

    async listNeedsAttention() {
      return [...needsAttention];
    },
  };
}
