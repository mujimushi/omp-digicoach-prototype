import { fileURLToPath } from 'node:url';
import type { Level, Year } from '@omp/shared';
import {
  createFixtures,
  KNOWN_PASSWORD,
  pick,
  randomInt,
} from '@omp/shared/fixtures';
import { hashPassword } from '../services/auth/passwords.ts';
import { createDatabase, type Db } from './client.ts';
import {
  insertPearlRecord,
  insertSessionRecord,
  insertStudentRecord,
} from './records.ts';
import { users } from './schema.ts';
import { truncateAll } from './truncate.ts';

export const SEED_COUNTS = { doctors: 12, students: 60, sessions: 400 };
export const SEED_WEEKS = 10;
/** Every seeded account uses this password and has already changed it. */
export const SEED_PASSWORD = KNOWN_PASSWORD;
export const SEED_LOGINS = { admin: 'dr.ayesha', doctor: 'dr.bilal' };

const DAY_MS = 24 * 60 * 60 * 1000;
/** Pakistan is UTC+5 all year. 08:00 there is 03:00 UTC. */
const WARD_START_UTC_HOUR = 3;

/**
 * Empties the database and loads 12 doctors (one also admin), 60 students and 400 sessions spread
 * over the 10 weeks before `now`. The same seed builds the same records relative to `now`.
 */
export async function seedDatabase(
  db: Db,
  now: Date = new Date(),
): Promise<typeof SEED_COUNTS> {
  const fixtures = createFixtures(2026);
  const passwordHash = await hashPassword(SEED_PASSWORD);

  await db.transaction(async (tx) => {
    await truncateAll(tx);

    const doctors = Array.from({ length: SEED_COUNTS.doctors }, (_, i) => {
      if (i === 0) {
        return fixtures.makeDoctor({
          name: 'Dr. Ayesha Siddiqui',
          username: SEED_LOGINS.admin,
          department: 'medicine',
          designation: 'professor',
          isAdmin: true,
        });
      }
      if (i === 1) {
        return fixtures.makeDoctor({
          name: 'Dr. Bilal Hussain',
          username: SEED_LOGINS.doctor,
          department: 'medicine',
          designation: 'consultant',
        });
      }
      return fixtures.makeDoctor();
    });

    const createdAt = new Date(now.getTime() - (SEED_WEEKS * 7 + 5) * DAY_MS);
    await tx.insert(users).values(
      doctors.map((doctor, i) => ({
        ...doctor,
        passwordHash,
        createdAt,
        updatedAt: createdAt,
        lastLoginAt: new Date(
          now.getTime() - randomInt(fixtures.rng, 0, 9) * DAY_MS,
        ),
        // Two doctors haven't changed their temporary password or seen the app tour yet.
        mustChangePassword: i >= SEED_COUNTS.doctors - 2,
        tourCompletedAt: i >= SEED_COUNTS.doctors - 2 ? null : createdAt,
      })),
    );

    const students = Array.from({ length: SEED_COUNTS.students }, () =>
      fixtures.makeStudent(),
    );
    for (const student of students) {
      const creator = pick(fixtures.rng, doctors);
      await insertStudentRecord(tx, student, creator.id, createdAt);
    }

    for (let i = 0; i < SEED_COUNTS.sessions; i += 1) {
      // The first doctors teach more often, so the activity table has a spread.
      const doctor =
        doctors[Math.floor(fixtures.rng() ** 1.6 * doctors.length)] ??
        doctors[0];
      const student = pick(fixtures.rng, students);
      if (!doctor) throw new Error('No doctors seeded');

      const daysBack = randomInt(fixtures.rng, 0, SEED_WEEKS * 7 - 1);
      const day = new Date(now.getTime() - daysBack * DAY_MS);
      day.setUTCHours(
        WARD_START_UTC_HOUR,
        randomInt(fixtures.rng, 0, 8 * 60),
        0,
        0,
      );
      if (day > now) day.setTime(day.getTime() - DAY_MS);

      const session = fixtures.makeSession({
        studentId: student.id,
        learnerLevel: student.level as Level,
        learnerYear: student.year as Year | null,
        department: doctor.department ?? 'medicine',
        startedAt: day.toISOString(),
      });
      const receivedAt = new Date(day.getTime() + 10 * 60 * 1000);
      await insertSessionRecord(tx, session, doctor.id, receivedAt);
    }

    for (const doctor of doctors) {
      const count = randomInt(fixtures.rng, 2, 5);
      for (let i = 0; i < count; i += 1) {
        await insertPearlRecord(tx, fixtures.makePearl(), doctor.id);
      }
    }
  });

  return SEED_COUNTS;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.env.NODE_ENV === 'production') {
    console.error('db:seed refuses to run with NODE_ENV=production.');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      'DATABASE_URL is missing. Copy server/.env.example to server/.env.',
    );
    process.exit(1);
  }
  const { db, pool } = createDatabase({ url });
  try {
    const counts = await seedDatabase(db);
    console.log(
      `Seeded ${counts.doctors} doctors, ${counts.students} students and ${counts.sessions} sessions.`,
    );
    console.log(
      `Log in as ${SEED_LOGINS.admin} (doctor and admin) or ${SEED_LOGINS.doctor} (doctor) with the password "${SEED_PASSWORD}".`,
    );
  } finally {
    await pool.end();
  }
}
