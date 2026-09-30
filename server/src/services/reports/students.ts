import {
  type AuditEntry,
  isRatedStep,
  type Student,
  type StudentDetail,
  StudentInput,
  type StudentSummaryRow,
  type StudentsQuery,
  type StudentUpdate,
} from '@omp/shared';
import { eq, type SQL, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { students } from '../../db/schema.ts';
import { updateStudentRecord } from '../students/upsert.ts';
import { toStudent } from '../sync/pull.ts';
import { SESSION_ROW_COLUMNS, toSessionListRow } from './sessions.ts';
import { likePattern, toAverage, toIso, toNumber } from './sql.ts';

const SORTS: Record<NonNullable<StudentsQuery['sort']>, SQL> = {
  name: sql`lower(st.name), st.id`,
  sessions: sql`count(distinct s.id) desc, lower(st.name)`,
  last_session: sql`max(s.started_at) desc nulls last, lower(st.name)`,
  pmdc_number: sql`st.pmdc_number nulls last, lower(st.name)`,
};

function summarySql(where: SQL, order: SQL) {
  return sql`
    select st.id, st.name, st.pmdc_number, st.level, st.year,
      count(distinct s.id) as sessions,
      count(distinct s.doctor_id) as doctors,
      max(s.started_at) as last_session_at,
      avg(ss.rating) filter (where ss.step = 1) as r1,
      avg(ss.rating) filter (where ss.step = 2) as r2,
      avg(ss.rating) filter (where ss.step = 3) as r3,
      avg(ss.rating) filter (where ss.step = 4) as r4,
      avg(ss.rating) filter (where ss.step = 5) as r5
    from students st
    left join teaching_sessions s on s.student_id = st.id
    left join session_steps ss on ss.session_id = s.id
    where ${where}
    group by st.id
    order by ${order}`;
}

function toSummaryRow(row: Record<string, unknown>): StudentSummaryRow {
  return {
    id: String(row.id),
    name: String(row.name),
    pmdcNumber: (row.pmdc_number as string | null) ?? null,
    level: row.level as StudentSummaryRow['level'],
    year: (row.year as StudentSummaryRow['year']) ?? null,
    sessions: toNumber(row.sessions),
    doctors: toNumber(row.doctors),
    // Steps no longer rated keep their stored ratings, but stay out of every average.
    avgRatingPerStep: [row.r1, row.r2, row.r3, row.r4, row.r5].map(
      (value, i) => (isRatedStep(i + 1) ? toAverage(value) : null),
    ) as StudentSummaryRow['avgRatingPerStep'],
    lastSessionAt: toIso(row.last_session_at),
  };
}

export async function listStudentSummaries(
  db: Db,
  query: StudentsQuery,
): Promise<StudentSummaryRow[]> {
  const text = query.query?.trim() ?? '';
  const where =
    text === ''
      ? sql`true`
      : sql`(st.name ilike ${likePattern(text)} or st.pmdc_number ilike ${likePattern(text)})`;
  const result = await db.execute(
    summarySql(where, SORTS[query.sort ?? 'name']),
  );
  return result.rows.map(toSummaryRow);
}

export async function getStudentDetail(
  db: Db,
  id: string,
): Promise<StudentDetail | undefined> {
  const [student] = await db.select().from(students).where(eq(students.id, id));
  if (!student) return undefined;
  const [summary, sessions, changes] = await Promise.all([
    db.execute(summarySql(sql`st.id = ${id}`, sql`st.id`)),
    db.execute(sql`
      select ${SESSION_ROW_COLUMNS}
      from teaching_sessions s
      join users u on u.id = s.doctor_id
      join students st on st.id = s.student_id
      where s.student_id = ${id}
      order by s.started_at desc, s.id`),
    db.execute(sql`
      select a.id, a.action, u.name as actor_name, a.created_at, a.before, a.after
      from audit_log a left join users u on u.id = a.actor_id
      where a.entity_type = 'student' and a.entity_id = ${id}
      order by a.created_at desc, a.id desc`),
  ]);
  const rows = sessions.rows.map(toSessionListRow);
  return {
    student: toStudent(student),
    summary: toSummaryRow(summary.rows[0] ?? {}),
    sessions: rows,
    ratingsOverTime: [...rows].reverse().map((row) => ({
      sessionId: row.id,
      startedAt: row.startedAt,
      ratings: row.ratings,
    })),
    changes: changes.rows.map(
      (c): AuditEntry => ({
        id: toNumber(c.id),
        action: String(c.action),
        actorName: (c.actor_name as string | null) ?? null,
        createdAt: toIso(c.created_at) ?? '',
        before: c.before ?? null,
        after: c.after ?? null,
      }),
    ),
  };
}

export type CorrectionResult =
  | { status: 'updated'; student: Student }
  | { status: 'not_found' }
  | { status: 'pmdc_taken' }
  | { status: 'invalid'; message: string };

/** The admin's correction: the same rules as a correction through sync, recorded in audit_log. */
export async function correctStudent(
  db: Db,
  actorId: string,
  id: string,
  update: StudentUpdate,
  now: Date,
): Promise<CorrectionResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(students)
      .where(eq(students.id, id))
      .for('update');
    if (!existing) return { status: 'not_found' };
    const level = update.level ?? existing.level;
    const merged = StudentInput.safeParse({
      id,
      name: update.name ?? existing.name,
      pmdcNumber:
        update.pmdcNumber === undefined
          ? existing.pmdcNumber
          : update.pmdcNumber,
      level,
      year:
        update.year === undefined
          ? level === 'medical_student'
            ? existing.year
            : null
          : update.year,
    });
    if (!merged.success) {
      return {
        status: 'invalid',
        message: merged.error.issues[0]?.message ?? 'The details are not valid',
      };
    }
    const outcome = await updateStudentRecord(
      tx,
      actorId,
      id,
      existing,
      merged.data,
      'student.update_by_admin',
      now,
    );
    if (outcome === 'pmdc_taken') return { status: 'pmdc_taken' };
    const [row] = await tx.select().from(students).where(eq(students.id, id));
    return { status: 'updated', student: toStudent(row ?? existing) };
  });
}
