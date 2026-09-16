import { createFixtures } from '@omp/shared/fixtures';
import { describe, expect, it } from 'vitest';
import { freshPhoneDb } from '../test/phone-db.ts';
import { createDexieRepository } from './dexie-repository.ts';
import {
  assertLoginAllowed,
  LoginBlockedError,
  rememberUser,
} from './phone-auth.ts';

const fixtures = createFixtures(3131);
const first = fixtures.makeDoctor({ name: 'Dr. First', username: 'dr.first' });
const second = fixtures.makeDoctor({
  name: 'Dr. Second',
  username: 'dr.second',
});

describe('changing user on a phone', () => {
  it('lets the same user log in again, keeping their data', async () => {
    const db = freshPhoneDb();
    await rememberUser(first, db);
    await createDexieRepository(db).saveStudent(fixtures.makeStudentInput());
    await assertLoginAllowed('DR.FIRST', db);
    await rememberUser(first, db);
    expect(await db.outbox.count()).toBe(1);
  });

  it('blocks a different user while the first user’s items wait, and explains why', async () => {
    const db = freshPhoneDb();
    await rememberUser(first, db);
    const repository = createDexieRepository(db);
    await repository.saveStudent(fixtures.makeStudentInput());
    await repository.saveStudent(fixtures.makeStudentInput());

    await expect(assertLoginAllowed('dr.second', db)).rejects.toThrow(
      LoginBlockedError,
    );
    await expect(assertLoginAllowed('dr.second', db)).rejects.toThrow(
      '2 items saved by Dr. First haven’t been sent yet. Log in as dr.first with signal to send them first.',
    );
    await expect(rememberUser(second, db)).rejects.toThrow(LoginBlockedError);
    expect(await db.outbox.count()).toBe(2);
    expect(await db.getMeta('userId')).toBe(first.id);
  });

  it('gives a different user an empty phone once nothing is waiting', async () => {
    const db = freshPhoneDb();
    await rememberUser(first, db);
    await db.students.put(fixtures.makeStudent());
    await db.sessions.put(fixtures.makeSession());
    await db.pearls.put(fixtures.makePearl());
    await db.setMeta('pullCursor', '99');

    await assertLoginAllowed('dr.second', db);
    await rememberUser(second, db);

    expect(await db.sessions.count()).toBe(0);
    expect(await db.pearls.count()).toBe(0);
    expect(await db.students.count()).toBe(0);
    expect(await db.getMeta('pullCursor')).toBeUndefined();
    expect(await db.getMeta('user')).toEqual(second);
  });

  it('clearAll empties every table', async () => {
    const db = freshPhoneDb();
    await rememberUser(first, db);
    const repository = createDexieRepository(db);
    await repository.saveStudent(fixtures.makeStudentInput());
    await repository.savePearl({
      id: fixtures.uuid(),
      diagnosis: 'Asthma',
      points: ['', '', '', '', ''],
    });
    await db.needsAttention.put({
      opId: fixtures.uuid(),
      type: 'student.upsert',
      code: 'pmdc_taken',
      summary: 'x',
      failedAt: new Date().toISOString(),
      payload: {},
    });

    await db.clearAll();

    const counts = await Promise.all(db.tables.map((table) => table.count()));
    expect(counts.every((count) => count === 0)).toBe(true);
  });
});
