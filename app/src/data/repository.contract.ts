import type {
  Pearl,
  SessionDraft,
  Student,
  TeachingSession,
} from '@omp/shared';
import { createFixtures } from '@omp/shared/fixtures';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Repository } from './repository.ts';

export type ContractSeed = {
  doctorId: string;
  /** Records already on the phone from an earlier sync; not waiting to send. */
  students: Student[];
  sessions: TeachingSession[];
  pearls: Pearl[];
};

export type RepositoryFactory = (seed: ContractSeed) => Promise<Repository>;

async function expectWaiting(repository: Repository, expected: number) {
  let latest: number | undefined;
  const unsubscribe = repository.subscribeWaitingCount((count) => {
    latest = count;
  });
  try {
    await vi.waitFor(() => expect(latest).toBe(expected));
  } finally {
    unsubscribe();
  }
}

function draftFor(id: string, studentId: string): SessionDraft {
  return {
    id,
    studentId,
    department: 'medicine',
    caseType: 'long_case',
    learnerLevel: 'medical_student',
    learnerYear: '3rd',
    timer: {
      startedAtMs: 1_758_000_000_000,
      runningSinceMs: 1_758_000_042_000,
      activeMs: 41_999,
      pausedMs: 20_001,
      pausedSinceMs: null,
      stepActiveMs: [10_000, 30_000, 1_999, 0, 0],
      currentStep: 3,
      finishedAtMs: null,
    },
    stage: 'steps',
    ratings: [3, 4, null, null, null],
    step1: { learnerAnswer: 'Pneumonia' },
    step2: { mode: 'deep' },
    step3: { points: ['CURB-65', '', 'oxygen', '', ''] },
    step4: { starters: ['', '', ''], tags: [] },
    step5: { starters: ['', '', ''], actionPlan: '' },
    log: { diagnosis: '', learnerGaveDiagnosis: null, usefulness: null },
    savedAtMs: 1_758_000_050_000,
  };
}

/**
 * Behaviour every repository must show. The memory repository runs it in phase 2; the phone
 * storage repository runs the same suite in lane 4C.
 */
export function describeRepositoryContract(
  name: string,
  create: RepositoryFactory,
) {
  describe(`${name}: repository contract`, () => {
    const fixtures = createFixtures(5);
    const doctorId = fixtures.uuid();
    const ahmed = fixtures.makeStudent({
      name: 'Ahmed Khan',
      pmdcNumber: '12345-P',
      level: 'medical_student',
      year: '3rd',
    });
    const zainab = fixtures.makeStudent({
      name: 'Zainab Ali',
      pmdcNumber: null,
      level: 'resident',
      year: null,
    });
    const older = fixtures.makeSession({
      studentId: ahmed.id,
      startedAt: '2026-09-01T04:00:00.000Z',
    });
    const newer = fixtures.makeSession({
      studentId: zainab.id,
      learnerLevel: 'resident',
      learnerYear: null,
      startedAt: '2026-09-10T04:00:00.000Z',
    });
    const pneumonia = fixtures.makePearl({
      diagnosis: 'Pneumonia',
      timesUsed: 2,
    });
    const cap = fixtures.makePearl({
      diagnosis: 'Community acquired pneumonia',
      timesUsed: 0,
    });

    let repository: Repository;

    beforeEach(async () => {
      repository = await create({
        doctorId,
        students: [zainab, ahmed],
        sessions: [older, newer],
        pearls: [pneumonia, cap],
      });
    });

    describe('students', () => {
      it('lists students sorted by name, and nothing is waiting at first', async () => {
        const names = (await repository.listStudents()).map((s) => s.name);
        expect(names).toEqual(['Ahmed Khan', 'Zainab Ali']);
        await expectWaiting(repository, 0);
      });

      it('saveStudent then listStudents finds the student', async () => {
        const input = fixtures.makeStudentInput({ name: 'Maryam Butt' });
        await repository.saveStudent(input);

        const found = await repository.listStudents('maryam');
        expect(found.map((s) => s.id)).toEqual([input.id]);
        expect(await repository.getStudent(input.id)).toMatchObject({
          name: 'Maryam Butt',
        });
        await expectWaiting(repository, 1);
      });

      it('searches by name or PMDC number, ignoring case', async () => {
        expect(
          (await repository.listStudents('AHMED')).map((s) => s.id),
        ).toEqual([ahmed.id]);
        expect(
          (await repository.listStudents('12345-p')).map((s) => s.id),
        ).toEqual([ahmed.id]);
        expect(await repository.listStudents('nobody')).toEqual([]);
      });

      it('cleans the name and PMDC number before storing', async () => {
        const input = fixtures.makeStudentInput({
          name: '  Hina   Shah ',
          pmdcNumber: ' 99887-d ',
          level: 'house_officer',
          year: null,
        });
        const saved = await repository.saveStudent(input);
        expect(saved).toMatchObject({
          name: 'Hina Shah',
          pmdcNumber: '99887-D',
        });
      });

      it('a correction updates the student without adding another, and queues it', async () => {
        await repository.saveStudent({
          id: ahmed.id,
          name: 'Ahmed Khan Niazi',
          pmdcNumber: ahmed.pmdcNumber,
          level: 'medical_student',
          year: '4th',
        });

        const all = await repository.listStudents();
        expect(all).toHaveLength(2);
        expect(await repository.getStudent(ahmed.id)).toMatchObject({
          name: 'Ahmed Khan Niazi',
          year: '4th',
        });
        await expectWaiting(repository, 1);
      });

      it('refuses a year for a resident and stores nothing', async () => {
        const input = fixtures.makeStudentInput({
          level: 'resident',
          year: '2nd',
        });
        await expect(repository.saveStudent(input)).rejects.toThrow();
        expect(await repository.getStudent(input.id)).toBeUndefined();
        await expectWaiting(repository, 0);
      });

      it('returns undefined for an unknown student', async () => {
        expect(await repository.getStudent(fixtures.uuid())).toBeUndefined();
      });
    });

    describe('the session in progress', () => {
      it('has no draft at first', async () => {
        expect(await repository.loadDraft()).toBeUndefined();
      });

      it('gives back a saved draft unchanged, with every timer number intact', async () => {
        const draft = draftFor(fixtures.uuid(), ahmed.id);
        await repository.saveDraft(draft);
        expect(await repository.loadDraft()).toEqual(draft);
      });

      it('keeps only the latest draft', async () => {
        const draft = draftFor(fixtures.uuid(), ahmed.id);
        await repository.saveDraft(draft);
        await repository.saveDraft({ ...draft, stage: 'log', savedAtMs: 9 });
        expect(await repository.loadDraft()).toMatchObject({
          stage: 'log',
          savedAtMs: 9,
        });
      });

      it('discardDraft removes the draft and queues nothing', async () => {
        await repository.saveDraft(draftFor(fixtures.uuid(), ahmed.id));
        await repository.discardDraft();
        expect(await repository.loadDraft()).toBeUndefined();
        await expectWaiting(repository, 0);
      });

      it('completeSession removes the draft and raises the waiting count by one', async () => {
        const session = fixtures.makeSession({ studentId: ahmed.id });
        await repository.saveDraft(draftFor(session.id, ahmed.id));

        await repository.completeSession(session);

        expect(await repository.loadDraft()).toBeUndefined();
        expect(await repository.getMySession(session.id)).toEqual(session);
        await expectWaiting(repository, 1);
      });

      it('completeSession refuses an invalid session and keeps the draft', async () => {
        const session = fixtures.makeSession({ studentId: ahmed.id });
        const draft = draftFor(session.id, ahmed.id);
        await repository.saveDraft(draft);

        await expect(
          repository.completeSession({ ...session, overtimeSeconds: 999 }),
        ).rejects.toThrow();

        expect(await repository.loadDraft()).toEqual(draft);
        expect(await repository.getMySession(session.id)).toBeUndefined();
        await expectWaiting(repository, 0);
      });
    });

    describe('own history', () => {
      it('lists sessions newest first', async () => {
        const ids = (await repository.listMySessions()).map((s) => s.id);
        expect(ids).toEqual([newer.id, older.id]);
      });

      it('filters by student', async () => {
        const ids = (
          await repository.listMySessions({ studentId: ahmed.id })
        ).map((s) => s.id);
        expect(ids).toEqual([older.id]);
      });

      it('finds one session by ID', async () => {
        expect(await repository.getMySession(older.id)).toEqual(older);
        expect(await repository.getMySession(fixtures.uuid())).toBeUndefined();
      });
    });

    describe('pearls', () => {
      it('lists own pearls sorted by diagnosis', async () => {
        const list = await repository.listMyPearls();
        expect(list.map((p) => p.diagnosis)).toEqual([
          'Community acquired pneumonia',
          'Pneumonia',
        ]);
      });

      it('savePearl adds a pearl with no uses and queues it', async () => {
        const saved = await repository.savePearl({
          id: fixtures.uuid(),
          diagnosis: 'Asthma',
          points: ['Silent chest', '', '', '', ''],
        });
        expect(saved).toMatchObject({ timesUsed: 0, deleted: false });
        expect((await repository.listMyPearls()).map((p) => p.id)).toContain(
          saved.id,
        );
        await expectWaiting(repository, 1);
      });

      it('editing a pearl keeps its use count', async () => {
        const saved = await repository.savePearl({
          id: pneumonia.id,
          diagnosis: 'Pneumonia',
          points: ['CURB-65', 'x', '', '', ''],
        });
        expect(saved.timesUsed).toBe(2);
        expect(saved.points[1]).toBe('x');
      });

      it('deletePearl hides the pearl and queues it', async () => {
        await repository.deletePearl(pneumonia.id);
        expect(
          (await repository.listMyPearls()).map((p) => p.id),
        ).not.toContain(pneumonia.id);
        expect(
          await repository.findPearlForAnswer('pneumonia'),
        ).toBeUndefined();
        await expectWaiting(repository, 1);
      });

      it('markPearlUsed adds one use and queues it', async () => {
        await repository.markPearlUsed(pneumonia.id);
        const list = await repository.listMyPearls();
        expect(list.find((p) => p.id === pneumonia.id)?.timesUsed).toBe(3);
        await expectWaiting(repository, 1);
      });

      describe('matching a pearl to the learner’s answer', () => {
        it.each([
          ['pneumonia', 'Pneumonia'],
          ['  PNEUMONIA ', 'Pneumonia'],
          ['community acquired pneumonia', 'Community acquired pneumonia'],
          ['pneu', 'Pneumonia'],
          ['comm', 'Community acquired pneumonia'],
        ])('%j finds %j', async (answer, diagnosis) => {
          expect((await repository.findPearlForAnswer(answer))?.diagnosis).toBe(
            diagnosis,
          );
        });

        it.each(['a', 'pne', '', 'bronchopneumonia'])(
          '%j finds nothing',
          async (answer) => {
            expect(await repository.findPearlForAnswer(answer)).toBeUndefined();
          },
        );
      });
    });

    describe('sync state', () => {
      it('tells a subscriber the count now and after each save, until it unsubscribes', async () => {
        const counts: number[] = [];
        const unsubscribe = repository.subscribeWaitingCount((count) =>
          counts.push(count),
        );
        await vi.waitFor(() => expect(counts).toContain(0));

        await repository.saveStudent(fixtures.makeStudentInput());
        await vi.waitFor(() => expect(counts.at(-1)).toBe(1));

        unsubscribe();
        const seen = counts.length;
        await repository.saveStudent(fixtures.makeStudentInput());
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(counts).toHaveLength(seen);
      });

      it('has nothing needing attention at first', async () => {
        expect(await repository.listNeedsAttention()).toEqual([]);
      });
    });
  });
}
