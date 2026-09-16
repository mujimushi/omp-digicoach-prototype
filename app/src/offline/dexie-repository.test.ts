import { createFixtures } from '@omp/shared/fixtures';
import { describe, expect, it } from 'vitest';
import { describeRepositoryContract } from '../data/repository.contract.ts';
import { freshPhoneDb } from '../test/phone-db.ts';
import { createDexieRepository } from './dexie-repository.ts';

describeRepositoryContract('Dexie repository', async (seed) => {
  const db = freshPhoneDb();
  await db.students.bulkPut(seed.students);
  await db.sessions.bulkPut(seed.sessions);
  await db.pearls.bulkPut(seed.pearls);
  return createDexieRepository(db);
});

describe('Dexie repository: storage details', () => {
  const fixtures = createFixtures(1234);

  it('keeps nothing when a save fails halfway through its transaction', async () => {
    const db = freshPhoneDb();
    const opId = fixtures.uuid();
    // The second save reuses the first opId, so adding its outbox item breaks the unique index.
    const repository = createDexieRepository(db, { newId: () => opId });
    await repository.saveStudent(fixtures.makeStudentInput());

    const second = fixtures.makeStudentInput();
    await expect(repository.saveStudent(second)).rejects.toThrow();

    expect(await db.students.get(second.id)).toBeUndefined();
    expect(await db.outbox.count()).toBe(1);
  });

  it('completeSession stores the session, queues it and deletes the draft in one transaction', async () => {
    const db = freshPhoneDb();
    const opId = fixtures.uuid();
    const repository = createDexieRepository(db, { newId: () => opId });
    await repository.saveStudent(fixtures.makeStudentInput());
    const draftSession = fixtures.makeSession();
    await db.drafts.put({
      key: 'current',
      draft: {
        id: draftSession.id,
        studentId: draftSession.studentId,
        department: 'medicine',
        caseType: 'long_case',
        learnerLevel: 'resident',
        learnerYear: null,
        timer: {
          startedAtMs: 1,
          runningSinceMs: 1,
          activeMs: 0,
          pausedMs: 0,
          pausedSinceMs: null,
          stepActiveMs: [0, 0, 0, 0, 0],
          currentStep: 1,
          finishedAtMs: null,
        },
        stage: 'steps',
        ratings: [null, null, null, null, null],
        step1: { learnerAnswer: '' },
        step2: { mode: 'quick' },
        step3: { points: ['', '', '', '', ''] },
        step4: { starters: ['', '', ''], tags: [] },
        step5: { starters: ['', '', ''], actionPlan: '' },
        log: { diagnosis: '', learnerGaveDiagnosis: null, usefulness: null },
        savedAtMs: 1,
      },
    });

    // The outbox add fails (same opId), so the session and the draft deletion roll back too.
    await expect(repository.completeSession(draftSession)).rejects.toThrow();
    expect(await db.sessions.count()).toBe(0);
    expect(await db.drafts.get('current')).toBeDefined();
  });

  it('finds a student through an alias ID', async () => {
    const db = freshPhoneDb();
    const student = fixtures.makeStudent();
    const aliasId = fixtures.uuid();
    await db.students.put(student);
    await db.studentAliases.put({ aliasId, studentId: student.id });
    const repository = createDexieRepository(db);
    expect(await repository.getStudent(aliasId)).toEqual(student);
  });

  it('writes a summary the doctor recognises on each outbox item', async () => {
    const db = freshPhoneDb();
    const repository = createDexieRepository(db);
    await repository.saveStudent(
      fixtures.makeStudentInput({ name: 'Hamza Iqbal' }),
    );
    const [item] = await db.outbox.toArray();
    expect(item?.summary).toBe('Student Hamza Iqbal');
  });
});
