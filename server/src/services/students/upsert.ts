import type { StudentInput } from '@omp/shared';
import { and, eq, ne } from 'drizzle-orm';
import { nextChangeSeq } from '../../db/change-seq.ts';
import type { Tx } from '../../db/client.ts';
import { auditLog, studentAliases, students } from '../../db/schema.ts';
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

export async function findStudentByPmdc(
  tx: Tx,
  pmdcNumber: string,
  exceptId?: string,
) {
  const [row] = await tx
    .select({ id: students.id })
    .from(students)
    .where(
      exceptId
        ? and(eq(students.pmdcNumber, pmdcNumber), ne(students.id, exceptId))
        : eq(students.pmdcNumber, pmdcNumber),
    );
  return row;
}

/**
 * Updates a stored student's details and writes the change to `audit_log`. Shared by sync and the
 * admin's correction. Returns null when nothing changed, or 'pmdc_taken'.
 */
export async function updateStudentRecord(
  tx: Tx,
  actorId: string,
  studentId: string,
  current: StudentFields,
  next: StudentFields,
  action: string,
  now: Date,
): Promise<'updated' | 'unchanged' | 'pmdc_taken'> {
  const diff = changedFields(current, next);
  if (Object.keys(diff.after).length === 0) return 'unchanged';

  if (
    next.pmdcNumber !== null &&
    next.pmdcNumber !== current.pmdcNumber &&
    (await findStudentByPmdc(tx, next.pmdcNumber, studentId))
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
      const sameNumber = await findStudentByPmdc(tx, input.pmdcNumber);
      if (sameNumber) {
        // Two doctors added the same student: keep the first record and remember the new ID.
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
