import type {
  CaseType,
  Department,
  Level,
  SessionDetail,
  SessionFilters,
  SessionListRow,
  SessionPage,
  Year,
} from '@omp/shared';
import { ADMIN_PAGE_SIZE } from '@omp/shared';
import { eq, type SQL, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import {
  auditLog,
  sessionSteps,
  students,
  teachingSessions,
  users,
} from '../../db/schema.ts';
import { toTeachingSession } from '../sync/pull.ts';
import { endOfDay, startOfDay, toIso, toNumber } from './sql.ts';

export type SessionRowRecord = Record<string, unknown>;

/** The columns of a session list row. Joined with the doctor and student. */
export const SESSION_ROW_COLUMNS = sql`
  s.id, s.started_at, s.doctor_id, u.name as doctor_name, s.student_id, st.name as student_name,
  st.pmdc_number, s.department, s.case_type, s.learner_level, s.learner_year, s.teaching_seconds,
  s.overtime_seconds, s.paused_seconds, s.diagnosis, s.usefulness,
  (select array_agg(ss.rating order by ss.step) from session_steps ss where ss.session_id = s.id) as ratings`;

export function toSessionListRow(row: SessionRowRecord): SessionListRow {
  const ratings = (row.ratings as (number | null)[] | null) ?? [];
  return {
    id: String(row.id),
    startedAt: toIso(row.started_at) ?? '',
    doctorId: String(row.doctor_id),
    doctorName: String(row.doctor_name),
    studentId: String(row.student_id),
    studentName: String(row.student_name),
    pmdcNumber: (row.pmdc_number as string | null) ?? null,
    department: row.department as Department,
    caseType: row.case_type as CaseType,
    learnerLevel: row.learner_level as Level,
    learnerYear: (row.learner_year as Year | null) ?? null,
    teachingSeconds: toNumber(row.teaching_seconds),
    overtimeSeconds: toNumber(row.overtime_seconds),
    pausedSeconds: toNumber(row.paused_seconds),
    diagnosis: (row.diagnosis as string | null) ?? null,
    usefulness: (row.usefulness as SessionListRow['usefulness']) ?? null,
    ratings: [0, 1, 2, 3, 4].map(
      (i) => ratings[i] ?? null,
    ) as SessionListRow['ratings'],
  };
}

export function sessionConditions(filters: Omit<SessionFilters, 'page'>): SQL {
  const conditions: SQL[] = [sql`true`];
  if (filters.from)
    conditions.push(sql`s.started_at >= ${startOfDay(filters.from)}`);
  if (filters.to) conditions.push(sql`s.started_at < ${endOfDay(filters.to)}`);
  if (filters.doctorId) conditions.push(sql`s.doctor_id = ${filters.doctorId}`);
  if (filters.studentId)
    conditions.push(sql`s.student_id = ${filters.studentId}`);
  if (filters.caseType) conditions.push(sql`s.case_type = ${filters.caseType}`);
  return sql.join(conditions, sql` and `);
}

/** Sessions matching the filters, newest first, 50 to a page. */
export async function listSessions(
  db: Db,
  filters: SessionFilters,
): Promise<SessionPage> {
  const where = sessionConditions(filters);
  const page = filters.page ?? 1;
  const [rows, total] = await Promise.all([
    db.execute(sql`
      select ${SESSION_ROW_COLUMNS}
      from teaching_sessions s
      join users u on u.id = s.doctor_id
      join students st on st.id = s.student_id
      where ${where}
      order by s.started_at desc, s.id
      limit ${ADMIN_PAGE_SIZE} offset ${(page - 1) * ADMIN_PAGE_SIZE}`),
    db.execute(
      sql`select count(*) as count from teaching_sessions s where ${where}`,
    ),
  ]);
  return {
    rows: rows.rows.map(toSessionListRow),
    total: toNumber(total.rows[0]?.count),
  };
}

export async function getSessionDetail(
  db: Db,
  id: string,
): Promise<SessionDetail | undefined> {
  const [row] = await db
    .select({ session: teachingSessions, doctor: users, student: students })
    .from(teachingSessions)
    .innerJoin(users, eq(users.id, teachingSessions.doctorId))
    .innerJoin(students, eq(students.id, teachingSessions.studentId))
    .where(eq(teachingSessions.id, id));
  if (!row) return undefined;
  const steps = await db
    .select()
    .from(sessionSteps)
    .where(eq(sessionSteps.sessionId, id));
  return {
    session: toTeachingSession(row.session, steps),
    doctor: {
      id: row.doctor.id,
      name: row.doctor.name,
      username: row.doctor.username,
    },
    student: {
      id: row.student.id,
      name: row.student.name,
      pmdcNumber: row.student.pmdcNumber,
    },
    receivedAt: row.session.receivedAt.toISOString(),
  };
}

/** Deletes a session and its steps, and records what was deleted. */
export async function deleteSession(
  db: Db,
  actorId: string | null,
  id: string,
  now: Date,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(teachingSessions)
      .where(eq(teachingSessions.id, id))
      .for('update');
    if (!existing) return false;
    const steps = await tx
      .select()
      .from(sessionSteps)
      .where(eq(sessionSteps.sessionId, id));
    await tx.delete(teachingSessions).where(eq(teachingSessions.id, id));
    await tx.insert(auditLog).values({
      actorId,
      action: 'session.delete',
      entityType: 'session',
      entityId: id,
      before: {
        ...toTeachingSession(existing, steps),
        doctorId: existing.doctorId,
      },
      after: null,
      createdAt: now,
    });
    return true;
  });
}
