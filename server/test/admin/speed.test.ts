import { createFixtures } from '@omp/shared/fixtures';
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  sessionSteps,
  students,
  teachingSessions,
  users,
} from '../../src/db/schema.ts';
import { hashPassword } from '../../src/services/auth/passwords.ts';
import { loginAs, useTestApp } from '../helpers/app.ts';
import { resetDb, useTestDatabase } from '../helpers/db.ts';

const db = useTestDatabase();
const app = useTestApp(db);

/** Ten times the seed data: 120 doctors, 600 students and 4,000 sessions over 10 weeks. */
export async function loadTenTimesSeed(): Promise<{
  adminId: string;
  doctorId: string;
  studentId: string;
  sessionId: string;
}> {
  const fixtures = createFixtures(1010);
  const passwordHash = await hashPassword('ten times the seed data');
  const doctors = Array.from({ length: 120 }, (_, i) => ({
    ...fixtures.makeDoctor(),
    tourCompletedAt: null,
    passwordHash,
    isAdmin: i === 0,
  }));
  await db.insert(users).values(doctors);
  const studentRows = Array.from({ length: 600 }, (_, i) => ({
    ...fixtures.makeStudentInput(),
    createdBy: doctors[0]?.id ?? '',
    updatedBy: doctors[0]?.id ?? '',
    changeSeq: i + 1,
  }));
  for (let i = 0; i < studentRows.length; i += 300)
    await db.insert(students).values(studentRows.slice(i, i + 300));

  const now = Date.now();
  const sessionRows = [];
  const stepRows = [];
  for (let i = 0; i < 4000; i += 1) {
    const student = studentRows[i % 600];
    const session = fixtures.makeSession({
      studentId: student?.id ?? '',
      learnerLevel: student?.level ?? 'resident',
      learnerYear: student?.year ?? null,
      startedAt: new Date(
        now - (i % 70) * 86_400_000 - (i % 480) * 60_000,
      ).toISOString(),
    });
    sessionRows.push({
      ...session,
      startedAt: new Date(session.startedAt),
      doctorId: doctors[i % 12]?.id ?? '',
      changeSeq: 601 + i,
    });
    for (const step of session.steps)
      stepRows.push({ ...step, sessionId: session.id });
  }
  for (let i = 0; i < sessionRows.length; i += 1000)
    await db.insert(teachingSessions).values(sessionRows.slice(i, i + 1000));
  for (let i = 0; i < stepRows.length; i += 4000)
    await db.insert(sessionSteps).values(stepRows.slice(i, i + 4000));
  await db.execute(sql`update change_counter set value = 5000 where id = 1`);
  await db.execute(sql`analyze`);
  return {
    adminId: doctors[0]?.id ?? '',
    doctorId: doctors[1]?.id ?? '',
    studentId: studentRows[5]?.id ?? '',
    sessionId: sessionRows[10]?.id ?? '',
  };
}

describe('report speed with ten times the seed data', () => {
  let ids: Awaited<ReturnType<typeof loadTenTimesSeed>>;

  beforeAll(async () => {
    await resetDb(db);
    ids = await loadTenTimesSeed();
  }, 60_000);

  it('answers every report route within 500 ms', async () => {
    const cookies = await loginAs(app(), { id: ids.adminId, isDoctor: true });
    const urls = [
      '/api/admin/overview',
      '/api/admin/doctors',
      `/api/admin/doctors/${ids.doctorId}`,
      '/api/admin/students',
      '/api/admin/students?query=a&sort=sessions',
      `/api/admin/students/${ids.studentId}`,
      '/api/admin/sessions',
      '/api/admin/sessions?from=2026-01-01&page=3',
      `/api/admin/sessions/${ids.sessionId}`,
      '/api/admin/export/sessions.csv',
    ];
    const timings: Record<string, number> = {};
    for (const url of urls) {
      await app().inject({ method: 'GET', url, cookies });
      const started = performance.now();
      const response = await app().inject({ method: 'GET', url, cookies });
      timings[url] = Math.round(performance.now() - started);
      expect(response.statusCode, url).toBe(200);
    }
    console.log('report timings (ms)', timings);
    for (const [url, ms] of Object.entries(timings))
      expect(ms, url).toBeLessThan(500);
  }, 60_000);
});
