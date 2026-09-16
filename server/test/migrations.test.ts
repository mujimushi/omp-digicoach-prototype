import { createFixtures } from '@omp/shared/fixtures';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nextChangeSeq } from '../src/db/change-seq.ts';
import { createDatabase, withDatabaseName } from '../src/db/client.ts';
import { recreateDatabase } from '../src/db/databases.ts';
import { runMigrations } from '../src/db/migrate.ts';
import {
  auditLog,
  changeCounter,
  loginAttempts,
  loginSessions,
  pearls,
  processedOps,
  sessionSteps,
  studentAliases,
  students,
  teachingSessions,
  users,
} from '../src/db/schema.ts';
import { BASE_DATABASE_URL } from './helpers/database-url.ts';

const url = withDatabaseName(BASE_DATABASE_URL, 'omp_migrations_test');
const fixtures = createFixtures(11);

/** Postgres error codes. */
const CHECK_VIOLATION = '23514';
const UNIQUE_VIOLATION = '23505';

describe('migrations on an empty database', () => {
  let database: ReturnType<typeof createDatabase>;

  beforeAll(async () => {
    await recreateDatabase(url);
    await runMigrations({ url });
    database = createDatabase({ url, maxConnections: 2 });
  });

  afterAll(async () => {
    await database.pool.end();
  });

  const doctor = fixtures.makeDoctor();
  const student = fixtures.makeStudent({
    level: 'medical_student',
    year: '2nd',
    pmdcNumber: '55555-P',
  });
  const session = fixtures.makeSession({
    studentId: student.id,
    learnerLevel: 'medical_student',
    learnerYear: '2nd',
  });

  async function expectPgError(run: () => Promise<unknown>, code: string) {
    const error = await run().then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(error).toBeDefined();
    const pgCode =
      (error as { code?: string; cause?: { code?: string } }).cause?.code ??
      (error as { code?: string }).code;
    expect(pgCode).toBe(code);
  }

  it('creates the change counter row at 0', async () => {
    const rows = await database.db.select().from(changeCounter);
    expect(rows).toEqual([{ id: 1, value: 0 }]);
  });

  it('accepts one row in every table', async () => {
    const { db } = database;
    await db.insert(users).values({ ...doctor, passwordHash: 'hash' });
    await db.insert(loginSessions).values({
      id: 'sha256-of-token',
      userId: doctor.id,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await db.insert(loginAttempts).values({ usernameLower: 'someone' });

    await db.transaction(async (tx) => {
      await tx.insert(students).values({
        ...student,
        createdBy: doctor.id,
        updatedBy: doctor.id,
        createdAt: new Date(student.createdAt),
        updatedAt: new Date(student.updatedAt),
        changeSeq: await nextChangeSeq(tx),
      });
      await tx.insert(studentAliases).values({
        aliasId: fixtures.uuid(),
        studentId: student.id,
        changeSeq: await nextChangeSeq(tx),
      });
      await tx.insert(teachingSessions).values({
        ...session,
        startedAt: new Date(session.startedAt),
        doctorId: doctor.id,
        changeSeq: await nextChangeSeq(tx),
      });
      await tx
        .insert(sessionSteps)
        .values(
          session.steps.map((step) => ({ ...step, sessionId: session.id })),
        );
      const pearl = fixtures.makePearl();
      await tx.insert(pearls).values({
        id: pearl.id,
        doctorId: doctor.id,
        diagnosis: pearl.diagnosis,
        points: [...pearl.points],
        changeSeq: await nextChangeSeq(tx),
      });
    });

    await db.insert(auditLog).values({
      actorId: doctor.id,
      action: 'student.update',
      entityType: 'student',
      entityId: student.id,
      before: { name: 'A' },
      after: { name: 'B' },
    });
    await db.insert(processedOps).values({
      opId: fixtures.uuid(),
      userId: doctor.id,
      type: 'student.upsert',
      result: { status: 'applied' },
    });

    const counts = await db.execute<{ table: string; count: string }>(sql`
      select 'users' as table, count(*) from users
      union all select 'login_sessions', count(*) from login_sessions
      union all select 'login_attempts', count(*) from login_attempts
      union all select 'students', count(*) from students
      union all select 'student_aliases', count(*) from student_aliases
      union all select 'teaching_sessions', count(*) from teaching_sessions
      union all select 'session_steps', count(*) from session_steps
      union all select 'pearls', count(*) from pearls
      union all select 'audit_log', count(*) from audit_log
      union all select 'processed_ops', count(*) from processed_ops
    `);
    expect(
      Object.fromEntries(counts.rows.map((r) => [r.table, Number(r.count)])),
    ).toEqual({
      users: 1,
      login_sessions: 1,
      login_attempts: 1,
      students: 1,
      student_aliases: 1,
      teaching_sessions: 1,
      session_steps: 5,
      pearls: 1,
      audit_log: 1,
      processed_ops: 1,
    });
    const [counter] = await db.select().from(changeCounter);
    expect(counter?.value).toBe(4);
  });

  it('refuses a rating of 6', async () => {
    await expectPgError(
      () =>
        database.db
          .update(sessionSteps)
          .set({ rating: 6 })
          .where(sql`${sessionSteps.step} = 1`),
      CHECK_VIOLATION,
    );
  });

  it('refuses a step numbered 6', async () => {
    await expectPgError(
      () =>
        database.db
          .update(sessionSteps)
          .set({ step: 6 })
          .where(sql`${sessionSteps.step} = 5`),
      CHECK_VIOLATION,
    );
  });

  it('refuses usefulness 0', async () => {
    await expectPgError(
      () => database.db.update(teachingSessions).set({ usefulness: 0 }),
      CHECK_VIOLATION,
    );
  });

  it('refuses negative teaching seconds', async () => {
    await expectPgError(
      () => database.db.update(teachingSessions).set({ teachingSeconds: -1 }),
      CHECK_VIOLATION,
    );
  });

  it('refuses a repeated PMDC number, but allows many students without one', async () => {
    const insertStudent = (pmdcNumber: string | null) =>
      database.db.transaction(async (tx) => {
        await tx.insert(students).values({
          id: fixtures.uuid(),
          name: 'Another Student',
          pmdcNumber,
          level: 'resident',
          year: null,
          createdBy: doctor.id,
          updatedBy: doctor.id,
          changeSeq: await nextChangeSeq(tx),
        });
      });

    await expectPgError(() => insertStudent('55555-P'), UNIQUE_VIOLATION);
    await insertStudent(null);
    await insertStudent(null);
  });

  it('refuses a year for a resident', async () => {
    await expectPgError(
      () =>
        database.db
          .update(students)
          .set({ level: 'resident', year: '3rd' })
          .where(sql`${students.id} = ${student.id}`),
      CHECK_VIOLATION,
    );
  });

  it('refuses a year for a resident on a session', async () => {
    await expectPgError(
      () =>
        database.db
          .update(teachingSessions)
          .set({ learnerLevel: 'resident', learnerYear: 'final' }),
      CHECK_VIOLATION,
    );
  });

  it('refuses a repeated username in different letter case', async () => {
    await expectPgError(
      () =>
        database.db.insert(users).values({
          ...fixtures.makeDoctor(),
          username: doctor.username.toUpperCase(),
          passwordHash: 'hash',
        }),
      UNIQUE_VIOLATION,
    );
  });

  it('refuses a second change counter row', async () => {
    await expectPgError(
      () => database.db.insert(changeCounter).values({ id: 2, value: 0 }),
      CHECK_VIOLATION,
    );
  });

  it('deletes a session’s steps with the session', async () => {
    await database.db.delete(teachingSessions);
    const steps = await database.db.select().from(sessionSteps);
    expect(steps).toEqual([]);
  });
});
