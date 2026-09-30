import { createFixtures } from '@omp/shared/fixtures';
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { nextChangeSeq } from '../../src/db/change-seq.ts';
import { students } from '../../src/db/schema.ts';
import {
  createUser,
  loginAs,
  type TestUser,
  useTestApp,
} from '../helpers/app.ts';
import { resetDb, useTestDatabase } from '../helpers/db.ts';
import { pull, push, type RawItem } from '../helpers/sync.ts';

const db = useTestDatabase();
const app = useTestApp(db);
const fixtures = createFixtures(5050);

let doctor: TestUser;
let other: TestUser;
let cookies: Record<string, string>;
let otherCookies: Record<string, string>;

beforeEach(async () => {
  await resetDb(db);
  doctor = await createUser(db);
  other = await createUser(db);
  cookies = await loginAs(app(), doctor);
  otherCookies = await loginAs(app(), other);
});

const item = (type: string, payload: object): RawItem => ({
  opId: fixtures.uuid(),
  type,
  payload,
});
const newStudent = () =>
  fixtures.makeStudentInput({ level: 'resident', year: null });
const sessionFor = (studentId: string) =>
  fixtures.makeSession({
    studentId,
    learnerLevel: 'resident',
    learnerYear: null,
  });

describe('GET /api/sync/pull', () => {
  it('with an empty cursor, returns only the caller’s students, sessions and pearls', async () => {
    const s1 = newStudent();
    const s2 = newStudent();
    const mine = sessionFor(s1.id);
    const theirs = sessionFor(s2.id);
    const myPearl = fixtures.makePearl({ diagnosis: 'Mine' });
    const theirPearl = fixtures.makePearl({ diagnosis: 'Theirs' });

    await push(app(), cookies, [
      item('student.upsert', s1),
      item('session.create', mine),
      item('pearl.upsert', myPearl),
    ]);
    await push(app(), otherCookies, [
      item('student.upsert', s2),
      item('session.create', theirs),
      item('pearl.upsert', theirPearl),
    ]);

    const { response, body } = await pull(app(), cookies);

    expect(response.statusCode).toBe(200);
    expect(body.students.map((s) => s.id)).toEqual([s1.id]);
    expect(response.body).not.toContain(s2.id);
    expect(body.sessions).toEqual([mine]);
    expect(body.sessions[0]?.steps).toHaveLength(5);
    expect(body.pearls.map((p) => p.diagnosis)).toEqual(['Mine']);
    expect(response.body).not.toContain(theirs.id);
    expect(response.body).not.toContain('Theirs');
  });

  it('after new writes, the returned cursor gives only the new rows; deleted pearls come back marked', async () => {
    const s1 = newStudent();
    const pearl = fixtures.makePearl();
    await push(app(), cookies, [
      item('student.upsert', s1),
      item('pearl.upsert', pearl),
    ]);
    const first = await pull(app(), cookies);

    const s2 = newStudent();
    await push(app(), cookies, [
      item('student.upsert', s2),
      item('pearl.delete', { id: pearl.id }),
    ]);
    const second = await pull(app(), cookies, first.body.cursor);

    expect(second.body.students.map((s) => s.id)).toEqual([s2.id]);
    expect(second.body.pearls).toMatchObject([{ id: pearl.id, deleted: true }]);
    expect(Number(second.body.cursor)).toBeGreaterThan(
      Number(first.body.cursor),
    );

    const third = await pull(app(), cookies, second.body.cursor);
    expect(third.body).toEqual({
      cursor: second.body.cursor,
      students: [],
      studentAliases: [],
      sessions: [],
      pearls: [],
    });
  });

  it('returns the caller’s student aliases, and not another doctor’s', async () => {
    const first = fixtures.makeStudentInput({
      pmdcNumber: '44444-P',
      level: 'resident',
      year: null,
    });
    const copy = { ...newStudent(), pmdcNumber: '44444-P' };
    await push(app(), cookies, [item('student.upsert', first)]);
    await push(app(), cookies, [item('student.upsert', copy)]);

    const { body } = await pull(app(), cookies);
    expect(body.studentAliases).toEqual([
      { aliasId: copy.id, studentId: first.id },
    ]);
    const theirs = await pull(app(), otherCookies);
    expect(theirs.body.studentAliases).toEqual([]);
    expect(theirs.body.students).toEqual([]);
  });

  it('still returns a student another doctor added, once the caller has taught them', async () => {
    // Before 30 September 2026 the list was shared, so doctors taught students others had added.
    const theirs = newStudent();
    await push(app(), otherCookies, [item('student.upsert', theirs)]);
    const before = await pull(app(), cookies);
    expect(before.body.students).toEqual([]);

    await push(app(), cookies, [item('session.create', sessionFor(theirs.id))]);
    const after = await pull(app(), cookies);
    expect(after.body.students.map((s) => s.id)).toEqual([theirs.id]);
  });

  it.each(['abc', '-1', '1.5', '01', '99999999999999999'])(
    'refuses cursor=%s with 400 bad_cursor',
    async (cursor) => {
      const { response } = await pull(app(), cookies, cursor);
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'bad_cursor' });
    },
  );

  it('never skips a change that commits late', async () => {
    const early = newStudent();
    await push(app(), cookies, [item('student.upsert', early)]);

    const late = newStudent();
    let commit!: () => void;
    const holding = new Promise<void>((resolve) => {
      commit = resolve;
    });
    let taken!: () => void;
    const seqTaken = new Promise<void>((resolve) => {
      taken = resolve;
    });

    // T1 takes a change number and doesn't commit yet.
    const t1 = db.transaction(async (tx) => {
      await tx.insert(students).values({
        ...late,
        createdBy: doctor.id,
        updatedBy: doctor.id,
        changeSeq: await nextChangeSeq(tx),
      });
      taken();
      await holding;
    });
    await seqTaken;

    // A pull while T1 is open returns cursor C, without T1's row.
    const during = await pull(app(), cookies);
    expect(during.body.students.map((s) => s.id)).toEqual([early.id]);

    commit();
    await t1;

    // The next pull from C returns T1's row.
    const after = await pull(app(), cookies, during.body.cursor);
    expect(after.body.students.map((s) => s.id)).toEqual([late.id]);
  });
});

describe('speed', () => {
  it('pushes 50 sessions within 2 seconds', async () => {
    const student = newStudent();
    await push(app(), cookies, [item('student.upsert', student)]);
    const items = Array.from({ length: 50 }, () =>
      item('session.create', sessionFor(student.id)),
    );

    const started = performance.now();
    const { body } = await push(app(), cookies, items);
    const elapsed = performance.now() - started;

    expect(body.results.every((r) => r.status === 'applied')).toBe(true);
    expect(elapsed).toBeLessThan(2000);
  });

  it('answers a first pull of 500 students and 2,000 sessions within 1 second', async () => {
    const studentRows = Array.from({ length: 500 }, (_, i) => ({
      ...newStudent(),
      pmdcNumber: null,
      createdBy: doctor.id,
      updatedBy: doctor.id,
      changeSeq: i + 1,
    }));
    await db.insert(students).values(studentRows);

    const sessionRows = [];
    const stepRows = [];
    for (let i = 0; i < 2000; i += 1) {
      const session = sessionFor(studentRows[i % 500]?.id ?? '');
      sessionRows.push({
        ...session,
        startedAt: new Date(session.startedAt),
        doctorId: doctor.id,
        changeSeq: 501 + i,
      });
      for (const step of session.steps)
        stepRows.push({ ...step, sessionId: session.id });
    }
    const { teachingSessions, sessionSteps } = await import(
      '../../src/db/schema.ts'
    );
    for (let i = 0; i < sessionRows.length; i += 500) {
      await db.insert(teachingSessions).values(sessionRows.slice(i, i + 500));
    }
    for (let i = 0; i < stepRows.length; i += 2000) {
      await db.insert(sessionSteps).values(stepRows.slice(i, i + 2000));
    }
    await db.execute(sql`update change_counter set value = 2500 where id = 1`);

    // Warm the database's plan cache once, as a real server would be.
    await pull(app(), cookies, '2500');

    const started = performance.now();
    const { body } = await pull(app(), cookies);
    const elapsed = performance.now() - started;

    expect(body.students).toHaveLength(500);
    expect(body.sessions).toHaveLength(2000);
    expect(elapsed).toBeLessThan(1000);
  });
});
