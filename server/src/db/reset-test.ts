import { fileURLToPath } from 'node:url';
import {
  createFixtures,
  KNOWN_PASSWORD,
  KNOWN_SESSION_COUNTS,
  KNOWN_STUDENTS,
  KNOWN_USERS,
} from '@omp/shared/fixtures';
import { inArray } from 'drizzle-orm';
import { hashPassword } from '../services/auth/passwords.ts';
import { createDatabase, type Db } from './client.ts';
import { ensureDatabase } from './databases.ts';
import { runMigrations } from './migrate.ts';
import { insertSessionRecord, insertStudentRecord } from './records.ts';
import { loginSessions, users } from './schema.ts';
import { truncateAll } from './truncate.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const knownUserIds = Object.values(KNOWN_USERS).map((user) => user.id);

/**
 * Empties every table and loads the small known data set from `@omp/shared/fixtures`.
 *
 * Login sessions of the known users survive the reset, so the storage-state files that
 * Playwright's setup project saves stay valid from one test file to the next.
 */
export async function loadKnownData(
  db: Db,
  now: Date = new Date(),
): Promise<void> {
  const fixtures = createFixtures(99);
  const passwordHash = await hashPassword(KNOWN_PASSWORD);

  await db.transaction(async (tx) => {
    const keptLogins = await tx
      .select()
      .from(loginSessions)
      .where(inArray(loginSessions.userId, knownUserIds));

    await truncateAll(tx);

    await tx.insert(users).values(
      Object.values(KNOWN_USERS).map((user) => ({
        ...user,
        passwordHash,
        active: true,
        mustChangePassword: false,
        // Tests of the tour use a doctor the admin adds.
        tourCompletedAt: now,
      })),
    );

    const creator = KNOWN_USERS.doctor.id;
    const createdAt = new Date(now.getTime() - 30 * DAY_MS);
    for (const student of KNOWN_STUDENTS) {
      await insertStudentRecord(tx, student, creator, createdAt);
    }

    const plan = [
      [KNOWN_USERS.doctor, KNOWN_SESSION_COUNTS.doctor],
      [KNOWN_USERS.secondDoctor, KNOWN_SESSION_COUNTS.secondDoctor],
    ] as const;
    let n = 0;
    for (const [doctor, count] of plan) {
      for (let i = 0; i < count; i += 1) {
        const student = KNOWN_STUDENTS[n % KNOWN_STUDENTS.length];
        if (!student) throw new Error('No known students');
        n += 1;
        const startedAt = new Date(now.getTime() - (2 + n * 3) * DAY_MS);
        startedAt.setUTCHours(4, 30, 0, 0);
        const session = fixtures.makeSession({
          studentId: student.id,
          learnerLevel: student.level,
          learnerYear: student.year,
          department: doctor.department,
          startedAt: startedAt.toISOString(),
        });
        await insertSessionRecord(tx, session, doctor.id, startedAt);
      }
    }

    const liveLogins = keptLogins.filter((login) => login.expiresAt > now);
    if (liveLogins.length > 0) {
      await tx.insert(loginSessions).values(liveLogins);
    }
  });
}

export async function resetTestDatabase(databaseUrl: string): Promise<void> {
  const name = new URL(databaseUrl).pathname.slice(1);
  if (!name.endsWith('_e2e') && !name.endsWith('_test')) {
    throw new Error(
      `db:reset-test only resets a database whose name ends in _e2e or _test, not "${name}".`,
    );
  }
  await ensureDatabase(databaseUrl);
  await runMigrations({ url: databaseUrl });
  const { db, pool } = createDatabase({ url: databaseUrl, maxConnections: 1 });
  try {
    await loadKnownData(db);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.env.NODE_ENV !== 'test') {
    console.error('db:reset-test runs only with NODE_ENV=test.');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is missing.');
    process.exit(1);
  }
  await resetTestDatabase(url);
  console.log('Test database reset.');
}
