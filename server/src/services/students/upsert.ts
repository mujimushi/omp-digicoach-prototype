import type { StudentInput } from '@omp/shared';
import { and, eq, ne, type SQL, sql } from 'drizzle-orm';
import { nextChangeSeq } from '../../db/change-seq.ts';
import type { Tx } from '../../db/client.ts';
import {
  auditLog,
  studentAliases,
  students,
  teachingSessions,
} from '../../db/schema.ts';
import {
  applied,
  duplicate,
  type ItemOutcome,
  rejected,
} from '../sync/results.ts';

export type StudentFields = Pick<
  StudentInput,
  'name' | 'pmdcNumber' | 'level' | 'year'
>;

/** The real student for an ID the phone made, following an alias if there is one. */
export async function resolveStudentId(tx: Tx, id: string): Promise<string> {
  const [alias] = await tx
    .select({ studentId: studentAliases.studentId })
    .from(studentAliases)
    .where(eq(studentAliases.aliasId, id));
  return alias?.studentId ?? id;
}

/** The fields that differ, before and after. Empty when nothing changed. */
export function changedFields(
  before: StudentFields,
  after: StudentFields,
): { before: Partial<StudentFields>; after: Partial<StudentFields> } {
  const keys = ['name', 'pmdcNumber', 'level', 'year'] as const;
  const changed = keys.filter((key) => before[key] !== after[key]);
  return {
    before: Object.fromEntries(changed.map((key) => [key, before[key]])),
    after: Object.fromEntries(changed.map((key) => [key, after[key]])),
  };
}

/** A student with this PMDC number in one doctor's own list. */
export async function findStudentByPmdc(
  tx: Tx,
  createdBy: string,
  pmdcNumber: string,
  exceptId?: string,
) {
  const sameList = and(
    eq(students.createdBy, createdBy),
    eq(students.pmdcNumber, pmdcNumber),
  );
  const [row] = await tx
    .select({ id: students.id })
    .from(students)
    .where(exceptId ? and(sameList, ne(students.id, exceptId)) : sameList);
  return row;
}

/**
 * The students a doctor sees: the ones they added, and any they have taught. Until 30 September
 * 2026 the list was shared, so a doctor may have taught a student another doctor added; that student
 * stays visible to both, and no stored record is changed.
 */
export function visibleToDoctor(doctorId: string): SQL {
  return sql`(${students.createdBy} = ${doctorId} or exists (
    select 1 from ${teachingSessions}
    where ${teachingSessions.studentId} = ${students.id}
      and ${teachingSessions.doctorId} = ${doctorId}))`;
}

/**
 * Updates a stored student's details and writes the change to `audit_log`. Shared by sync and the
 * admin's correction. Returns null when nothing changed, or 'pmdc_taken'.
 */
export async function updateStudentRecord(
  tx: Tx,
  actorId: string,
  studentId: string,
  current: StudentFields & { createdBy: string },
  next: StudentFields,
  action: string,
  now: Date,
): Promise<'updated' | 'unchanged' | 'pmdc_taken'> {
  const diff = changedFields(current, next);
  if (Object.keys(diff.after).length === 0) return 'unchanged';

  if (
    next.pmdcNumber !== null &&
    next.pmdcNumber !== current.pmdcNumber &&
    (await findStudentByPmdc(tx, current.createdBy, next.pmdcNumber, studentId))
  ) {
    return 'pmdc_taken';
  }

  await tx
    .update(students)
    .set({
      name: next.name,
      pmdcNumber: next.pmdcNumber,
      level: next.level,
      year: next.year,
      updatedBy: actorId,
      updatedAt: now,
      changeSeq: await nextChangeSeq(tx),
    })
    .where(eq(students.id, studentId));
  await tx.insert(auditLog).values({
    actorId,
    action,
    entityType: 'student',
    entityId: studentId,
    before: diff.before,
    after: diff.after,
    createdAt: now,
  });
  return 'updated';
}

/**
 * `student.upsert` from a phone. The input has already passed `StudentInput`, which trims the
 * name, collapses its spaces, upper-cases the PMDC number and turns an empty one into null.
 */
export async function upsertStudent(
  tx: Tx,
  userId: string,
  input: StudentInput,
  now: Date,
): Promise<ItemOutcome> {
  const targetId = await resolveStudentId(tx, input.id);
  const viaAlias = targetId !== input.id;
  const [existing] = await tx
    .select()
    .from(students)
    .where(eq(students.id, targetId))
    .for('update');

  if (!existing) {
    if (input.pmdcNumber) {
      const sameNumber = await findStudentByPmdc(tx, userId, input.pmdcNumber);
      if (sameNumber) {
        // The doctor added the same student twice: keep the first record and remember the new ID.
        // Another doctor with the same PMDC number gets a record of their own.
        await tx.insert(studentAliases).values({
          aliasId: input.id,
          studentId: sameNumber.id,
          createdAt: now,
          changeSeq: await nextChangeSeq(tx),
        });
        return applied(sameNumber.id);
      }
    }
    await tx.insert(students).values({
      id: input.id,
      name: input.name,
      pmdcNumber: input.pmdcNumber,
      level: input.level,
      year: input.year,
      createdBy: userId,
      updatedBy: userId,
      createdAt: now,
      updatedAt: now,
      changeSeq: await nextChangeSeq(tx),
    });
    return applied();
  }

  // A doctor corrects only a student they see: one they added or have taught.
  const [visible] = await tx
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.id, targetId), visibleToDoctor(userId)));
  if (!visible) return rejected('forbidden');

  const mapped = viaAlias ? targetId : undefined;
  const outcome = await updateStudentRecord(
    tx,
    userId,
    targetId,
    existing,
    input,
    'student.update',
    now,
  );
  if (outcome === 'unchanged') return duplicate(mapped);
  if (outcome === 'pmdc_taken') return rejected('pmdc_taken');
  return applied(mapped);
}
