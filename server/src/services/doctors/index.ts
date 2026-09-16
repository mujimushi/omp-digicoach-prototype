import type {
  DoctorActivityRow,
  DoctorDetail,
  DoctorInput,
  DoctorUpdate,
  PublicUser,
  RatingSpread,
  TaughtStudentRow,
} from '@omp/shared';
import { eq, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { auditLog, users } from '../../db/schema.ts';
import { clearFailures } from '../auth/attempts.ts';
import {
  checkPasswordRules,
  generateTemporaryPassword,
  hashPassword,
} from '../auth/passwords.ts';
import { deleteUserSessions, endUserSessions } from '../auth/sessions.ts';
import { findUserByUsername, toPublicUser } from '../auth/users.ts';
import { SESSION_ROW_COLUMNS, toSessionListRow } from '../reports/sessions.ts';
import { toAverage, toIso, toNumber } from '../reports/sql.ts';

export class DoctorError extends Error {
  readonly code:
    | 'username_taken'
    | 'cannot_change_own_admin'
    | 'weak_password'
    | 'validation_failed';
  constructor(code: DoctorError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

/** A readable temporary password that meets the password rules for this username. */
export function readableTemporaryPassword(username: string): string {
  for (;;) {
    const password = generateTemporaryPassword();
    if (checkPasswordRules(password, username) === null) return password;
  }
}

function activitySql(where: ReturnType<typeof sql>, now: Date) {
  return sql`
    select u.id, u.name, u.username, u.department, u.designation, u.is_doctor, u.is_admin, u.active,
      u.must_change_password, u.last_login_at,
      count(s.id) as sessions_total,
      count(s.id) filter (where s.started_at >= ${now.toISOString()}::timestamptz - interval '7 days') as sessions_last_7_days,
      max(s.started_at) as last_session_at,
      avg(s.teaching_seconds) as avg_teaching_seconds,
      avg(s.overtime_seconds) as avg_overtime_seconds,
      avg(case when rated.count = 5 then 1.0 else 0.0 end) filter (where s.id is not null) as all_steps_rated_share,
      count(distinct s.student_id) as students_taught
    from users u
    left join teaching_sessions s on s.doctor_id = u.id
    left join lateral (
      select count(ss.rating) as count from session_steps ss where ss.session_id = s.id
    ) rated on true
    where ${where}
    group by u.id
    order by lower(u.name), u.id`;
}

function toActivityRow(row: Record<string, unknown>): DoctorActivityRow {
  const user = toPublicUser({
    id: String(row.id),
    name: String(row.name),
    username: String(row.username),
    department: row.department as string | null,
    designation: row.designation as string | null,
    isDoctor: Boolean(row.is_doctor),
    isAdmin: Boolean(row.is_admin),
    active: Boolean(row.active),
    mustChangePassword: Boolean(row.must_change_password),
  } as never);
  return {
    ...user,
    sessionsTotal: toNumber(row.sessions_total),
    sessionsLast7Days: toNumber(row.sessions_last_7_days),
    lastSessionAt: toIso(row.last_session_at),
    avgTeachingSeconds: toAverage(row.avg_teaching_seconds),
    avgOvertimeSeconds: toAverage(row.avg_overtime_seconds),
    allStepsRatedShare: toAverage(row.all_steps_rated_share),
    studentsTaught: toNumber(row.students_taught),
    lastLoginAt: toIso(row.last_login_at),
  };
}

/** Every user, doctors and admins, with their teaching activity. */
export async function listDoctors(
  db: Db,
  now: Date,
): Promise<DoctorActivityRow[]> {
  const result = await db.execute(activitySql(sql`true`, now));
  return result.rows.map(toActivityRow);
}

export async function getDoctorDetail(
  db: Db,
  id: string,
  now: Date,
): Promise<DoctorDetail | undefined> {
  const activity = await db.execute(activitySql(sql`u.id = ${id}`, now));
  const row = activity.rows[0];
  if (!row) return undefined;

  const [sessions, taught, spread] = await Promise.all([
    db.execute(sql`
      select ${SESSION_ROW_COLUMNS}
      from teaching_sessions s
      join users u on u.id = s.doctor_id
      join students st on st.id = s.student_id
      where s.doctor_id = ${id}
      order by s.started_at desc, s.id`),
    db.execute(sql`
      select st.id, st.name, st.pmdc_number, st.level, st.year, count(s.id) as sessions,
        max(s.started_at) as last_session_at
      from teaching_sessions s join students st on st.id = s.student_id
      where s.doctor_id = ${id}
      group by st.id
      order by lower(st.name), st.id`),
    db.execute(sql`
      select ss.step, ss.rating, count(*) as count
      from session_steps ss join teaching_sessions s on s.id = ss.session_id
      where s.doctor_id = ${id}
      group by ss.step, ss.rating`),
  ]);

  const ratingSpread = [0, 1, 2, 3, 4].map(() => ({
    counts: [0, 0, 0, 0, 0] as [number, number, number, number, number],
    unrated: 0,
  })) as RatingSpread;
  for (const entry of spread.rows) {
    const step = ratingSpread[toNumber(entry.step) - 1];
    if (!step) continue;
    if (entry.rating === null) step.unrated = toNumber(entry.count);
    else step.counts[toNumber(entry.rating) - 1] = toNumber(entry.count);
  }

  return {
    activity: toActivityRow(row),
    sessions: sessions.rows.map(toSessionListRow),
    students: taught.rows.map(
      (s): TaughtStudentRow => ({
        id: String(s.id),
        name: String(s.name),
        pmdcNumber: (s.pmdc_number as string | null) ?? null,
        level: s.level as TaughtStudentRow['level'],
        year: (s.year as TaughtStudentRow['year']) ?? null,
        sessions: toNumber(s.sessions),
        lastSessionAt: toIso(s.last_session_at) ?? '',
      }),
    ),
    ratingSpread,
  };
}

/** Registers a doctor with a temporary password they must change at first login. */
export async function createDoctor(
  db: Db,
  actorId: string,
  input: DoctorInput,
  now: Date,
): Promise<{ doctor: PublicUser; temporaryPassword: string }> {
  if (await findUserByUsername(db, input.username)) {
    throw new DoctorError('username_taken', 'That username is taken');
  }
  const temporaryPassword =
    input.temporaryPassword ?? readableTemporaryPassword(input.username);
  const problem = checkPasswordRules(temporaryPassword, input.username);
  if (problem) throw new DoctorError('weak_password', problem);
  const passwordHash = await hashPassword(temporaryPassword);

  try {
    const doctor = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(users)
        .values({
          name: input.name,
          username: input.username,
          passwordHash,
          department: input.department,
          designation: input.designation,
          isDoctor: input.isDoctor,
          isAdmin: input.isAdmin,
          mustChangePassword: true,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!row) throw new Error('user not created');
      const created = toPublicUser(row);
      await tx.insert(auditLog).values({
        actorId,
        action: 'doctor.create',
        entityType: 'user',
        entityId: row.id,
        before: null,
        after: created,
        createdAt: now,
      });
      return created;
    });
    return { doctor, temporaryPassword };
  } catch (error) {
    if ((error as { cause?: { code?: string } }).cause?.code === '23505') {
      throw new DoctorError('username_taken', 'That username is taken');
    }
    throw error;
  }
}

/** Changes a user's details. An admin can't remove their own admin flag or switch themselves off. */
export async function updateDoctor(
  db: Db,
  actorId: string,
  id: string,
  update: DoctorUpdate,
  now: Date,
): Promise<PublicUser | undefined> {
  if (id === actorId && (update.isAdmin === false || update.active === false)) {
    throw new DoctorError(
      'cannot_change_own_admin',
      'You can’t remove your own admin rights or switch off your own account',
    );
  }
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(users)
      .where(eq(users.id, id))
      .for('update');
    if (!existing) return undefined;

    if (
      update.username !== undefined &&
      update.username !== existing.username.toLowerCase()
    ) {
      const other = await findUserByUsername(tx, update.username);
      if (other && other.id !== id)
        throw new DoctorError('username_taken', 'That username is taken');
    }
    const next = {
      name: update.name ?? existing.name,
      username: update.username ?? existing.username,
      department:
        update.department === undefined
          ? existing.department
          : update.department,
      designation:
        update.designation === undefined
          ? existing.designation
          : update.designation,
      isDoctor: update.isDoctor ?? existing.isDoctor,
      isAdmin: update.isAdmin ?? existing.isAdmin,
      active: update.active ?? existing.active,
    };
    if (
      next.isDoctor &&
      (next.department === null || next.designation === null)
    ) {
      throw new DoctorError(
        'validation_failed',
        'A doctor needs a department and a designation',
      );
    }

    const before = toPublicUser(existing);
    const [row] = await tx
      .update(users)
      .set({ ...next, updatedAt: now })
      .where(eq(users.id, id))
      .returning();
    if (!row) return undefined;
    const after = toPublicUser(row);

    if (existing.active && !next.active)
      await endUserSessions(tx, id, 'switched_off');

    const keys = Object.keys(next) as (keyof typeof next)[];
    const changed = keys.filter((key) => before[key] !== after[key]);
    if (changed.length > 0) {
      await tx.insert(auditLog).values({
        actorId,
        action: 'doctor.update',
        entityType: 'user',
        entityId: id,
        before: Object.fromEntries(changed.map((key) => [key, before[key]])),
        after: Object.fromEntries(changed.map((key) => [key, after[key]])),
        createdAt: now,
      });
    }
    return after;
  });
}

/** Sets a new temporary password, ends the user's logins and clears failed-login locks. */
export async function resetDoctorPassword(
  db: Db,
  actorId: string,
  id: string,
  now: Date,
): Promise<string | undefined> {
  const [existing] = await db.select().from(users).where(eq(users.id, id));
  if (!existing) return undefined;
  const temporaryPassword = readableTemporaryPassword(existing.username);
  const passwordHash = await hashPassword(temporaryPassword);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, mustChangePassword: true, updatedAt: now })
      .where(eq(users.id, id));
    await deleteUserSessions(tx, id);
    await clearFailures(tx, existing.username.toLowerCase());
    await tx.insert(auditLog).values({
      actorId,
      action: 'doctor.reset_password',
      entityType: 'user',
      entityId: id,
      before: null,
      after: { mustChangePassword: true },
      createdAt: now,
    });
  });
  return temporaryPassword;
}
