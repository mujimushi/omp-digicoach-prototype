import type { Rating, TeachingSession } from '@omp/shared';
import { createFixtures } from '@omp/shared/fixtures';
import type { Db } from '../../src/db/client.ts';
import {
  insertSessionRecord,
  insertStudentRecord,
} from '../../src/db/records.ts';
import { createUser, type TestUser } from './app.ts';

/** The clock for report tests: Thursday 17 September 2026, 13:00 in Pakistan. */
export const REPORT_NOW = new Date('2026-09-17T08:00:00.000Z');

export type SessionPlan = {
  doctor: TestUser;
  studentId: string;
  startedAt: string;
  teachingSeconds: number;
  ratings: (Rating | null)[];
  diagnosis?: string;
  level?: 'medical_student' | 'resident';
};

const sharedFixtures = createFixtures(13579);

export async function addSession(
  db: Db,
  plan: SessionPlan,
  fixtures = sharedFixtures,
): Promise<TeachingSession> {
  const level = plan.level ?? 'medical_student';
  const session = fixtures.makeSession({
    studentId: plan.studentId,
    learnerLevel: level,
    learnerYear: level === 'medical_student' ? '3rd' : null,
    startedAt: plan.startedAt,
    teachingSeconds: plan.teachingSeconds,
    overtimeSeconds: Math.max(0, plan.teachingSeconds - 60),
    ratings: plan.ratings,
    ...(plan.diagnosis === undefined ? {} : { diagnosis: plan.diagnosis }),
  });
  await db.transaction((tx) =>
    insertSessionRecord(tx, session, plan.doctor.id),
  );
  return session;
}

/**
 * A small data set whose report numbers are worked out by hand in the tests:
 * doctors A and B; students S1 (medical student) and S2 (resident); four sessions.
 */
export async function loadReportData(db: Db) {
  const fixtures = createFixtures(2468);
  const admin = await createUser(db, {
    name: 'Admin',
    username: 'admin.reports',
    isDoctor: false,
    isAdmin: true,
  });
  const doctorA = await createUser(db, { name: 'Dr. A', username: 'dr.a' });
  const doctorB = await createUser(db, { name: 'Dr. B', username: 'dr.b' });
  const s1 = fixtures.makeStudentInput({
    name: 'Student One',
    pmdcNumber: '11111-P',
    level: 'medical_student',
    year: '3rd',
  });
  const s2 = fixtures.makeStudentInput({
    name: 'Student Two',
    pmdcNumber: null,
    level: 'resident',
    year: null,
  });
  await db.transaction(async (tx) => {
    await insertStudentRecord(tx, s1, doctorA.id);
    await insertStudentRecord(tx, s2, doctorA.id);
  });

  const sessions = {
    thisWeek: await addSession(
      db,
      {
        doctor: doctorA,
        studentId: s1.id,
        startedAt: '2026-09-16T05:00:00.000Z',
        teachingSeconds: 90,
        ratings: [5, 4, 3, 2, 1],
      },
      fixtures,
    ),
    lastWeek: await addSession(
      db,
      {
        doctor: doctorA,
        studentId: s2.id,
        level: 'resident',
        startedAt: '2026-09-10T05:00:00.000Z',
        teachingSeconds: 50,
        ratings: [3, null, 3, 4, 5],
      },
      fixtures,
    ),
    earlyMonth: await addSession(
      db,
      {
        doctor: doctorB,
        studentId: s1.id,
        startedAt: '2026-09-02T05:00:00.000Z',
        teachingSeconds: 70,
        ratings: [1, 2, 3, 4, 5],
      },
      fixtures,
    ),
    lastMonth: await addSession(
      db,
      {
        doctor: doctorB,
        studentId: s1.id,
        startedAt: '2026-08-20T05:00:00.000Z',
        teachingSeconds: 60,
        ratings: [2, 2, 2, 2, 2],
      },
      fixtures,
    ),
  };
  return { admin, doctorA, doctorB, s1, s2, sessions, fixtures };
}
