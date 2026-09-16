import { createFixtures } from '@omp/shared/fixtures';
import { describe, expect, it } from 'vitest';
import { createMemoryRepository } from './memory-repository.ts';
import { describeRepositoryContract } from './repository.contract.ts';

describeRepositoryContract('memory repository', async (seed) =>
  createMemoryRepository({
    doctorId: seed.doctorId,
    students: seed.students,
    sessions: seed.sessions.map((session) => ({
      doctorId: seed.doctorId,
      session,
    })),
    pearls: seed.pearls.map((pearl) => ({ doctorId: seed.doctorId, pearl })),
  }),
);

describe('memory repository: other doctors', () => {
  const fixtures = createFixtures(8);
  const me = fixtures.uuid();
  const other = fixtures.uuid();
  const student = fixtures.makeStudent();
  const mine = fixtures.makeSession({ studentId: student.id });
  const theirs = fixtures.makeSession({ studentId: student.id });
  const theirPearl = fixtures.makePearl({ diagnosis: 'Pneumonia' });

  const repository = createMemoryRepository({
    doctorId: me,
    students: [student],
    sessions: [
      { doctorId: me, session: mine },
      { doctorId: other, session: theirs },
    ],
    pearls: [{ doctorId: other, pearl: theirPearl }],
  });

  it('shows only the logged-in doctor’s sessions', async () => {
    expect((await repository.listMySessions()).map((s) => s.id)).toEqual([
      mine.id,
    ]);
    expect(await repository.getMySession(theirs.id)).toBeUndefined();
  });

  it('shows none of another doctor’s pearls', async () => {
    expect(await repository.listMyPearls()).toEqual([]);
    expect(await repository.findPearlForAnswer('pneumonia')).toBeUndefined();
  });

  it('refuses to edit another doctor’s pearl', async () => {
    await expect(
      repository.savePearl({
        id: theirPearl.id,
        diagnosis: 'Mine now',
        points: ['', '', '', '', ''],
      }),
    ).rejects.toThrow();
  });

  it('queues each save as a push item with its own opId', async () => {
    await repository.saveStudent(fixtures.makeStudentInput());
    await repository.saveStudent(fixtures.makeStudentInput());
    expect(repository.outbox.map((item) => item.type)).toEqual([
      'student.upsert',
      'student.upsert',
    ]);
    expect(new Set(repository.outbox.map((item) => item.opId)).size).toBe(2);
  });
});
