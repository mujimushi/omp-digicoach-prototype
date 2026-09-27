import {
  findPearlForAnswer,
  type Pearl,
  SessionDraft,
  type Student,
  StudentInput,
  TeachingSession,
} from '@omp/shared';
import type { PearlInput, Repository } from '../data/repository.ts';

export const PRACTICE_STUDENT_NAME = 'Practice Learner';

/**
 * Storage for the tour's practice session. It lives in memory and queues nothing, so no practice
 * record reaches IndexedDB, the outbox or the server. It forgets everything when the tour ends.
 */
export function createPracticeRepository(): Repository {
  const at = new Date().toISOString();
  const practiceStudent: Student = {
    id: crypto.randomUUID(),
    name: PRACTICE_STUDENT_NAME,
    pmdcNumber: null,
    level: 'house_officer',
    year: null,
    createdAt: at,
    updatedAt: at,
  };
  const students = new Map([[practiceStudent.id, practiceStudent]]);
  const sessions: TeachingSession[] = [];
  const pearls = new Map<string, Pearl>();
  let draft: SessionDraft | undefined;

  const livePearls = () =>
    [...pearls.values()]
      .filter((pearl) => !pearl.deleted)
      .sort((a, b) => a.diagnosis.localeCompare(b.diagnosis));

  return {
    async listStudents(search = '') {
      const text = search.trim().toLowerCase();
      return [...students.values()]
        .filter((s) => s.name.toLowerCase().includes(text))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async getStudent(id) {
      return students.get(id);
    },
    async saveStudent(input) {
      const clean = StudentInput.parse(input);
      const now = new Date().toISOString();
      const student: Student = {
        ...clean,
        createdAt: students.get(clean.id)?.createdAt ?? now,
        updatedAt: now,
      };
      students.set(student.id, student);
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
      sessions.push(TeachingSession.parse(session));
      draft = undefined;
    },
    async listMySessions(filter = {}) {
      return sessions
        .filter(
          (s) =>
            filter.studentId === undefined || s.studentId === filter.studentId,
        )
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    },
    async getMySession(id) {
      return sessions.find((s) => s.id === id);
    },
    async listMyPearls() {
      return livePearls();
    },
    async findPearlForAnswer(text) {
      return findPearlForAnswer(livePearls(), text);
    },
    async savePearl(input: PearlInput) {
      const pearl: Pearl = {
        id: input.id,
        diagnosis: input.diagnosis.trim(),
        points: [...input.points],
        timesUsed: pearls.get(input.id)?.timesUsed ?? 0,
        updatedAt: new Date().toISOString(),
        deleted: false,
      };
      pearls.set(pearl.id, pearl);
      return pearl;
    },
    async deletePearl(id) {
      const pearl = pearls.get(id);
      if (pearl) pearls.set(id, { ...pearl, deleted: true });
    },
    async markPearlUsed(id) {
      const pearl = pearls.get(id);
      if (pearl) pearls.set(id, { ...pearl, timesUsed: pearl.timesUsed + 1 });
    },
    subscribeWaitingCount(listener) {
      listener(0);
      return () => undefined;
    },
    async listNeedsAttention() {
      return [];
    },
  };
}
