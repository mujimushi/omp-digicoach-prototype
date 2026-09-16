import type { StepContent, TeachingSession } from '@omp/shared';
import { eq } from 'drizzle-orm';
import { nextChangeSeq } from '../../db/change-seq.ts';
import type { Tx } from '../../db/client.ts';
import { sessionSteps, students, teachingSessions } from '../../db/schema.ts';
import { resolveStudentId } from '../students/upsert.ts';
import {
  applied,
  duplicate,
  type ItemOutcome,
  rejected,
} from '../sync/results.ts';

/** `session.create` from a phone. The doctor is always the caller: the payload has no doctor field. */
export async function createSession(
  tx: Tx,
  userId: string,
  session: TeachingSession,
  now: Date,
): Promise<ItemOutcome> {
  const studentId = await resolveStudentId(tx, session.studentId);
  const [student] = await tx
    .select({ id: students.id })
    .from(students)
    .where(eq(students.id, studentId));
  if (!student) return rejected('unknown_student');

  const inserted = await tx
    .insert(teachingSessions)
    .values({
      id: session.id,
      doctorId: userId,
      studentId,
      department: session.department,
      caseType: session.caseType,
      learnerLevel: session.learnerLevel,
      learnerYear: session.learnerYear,
      startedAt: new Date(session.startedAt),
      teachingSeconds: session.teachingSeconds,
      overtimeSeconds: session.overtimeSeconds,
      pausedSeconds: session.pausedSeconds,
      logSeconds: session.logSeconds,
      diagnosis: session.diagnosis,
      learnerGaveDiagnosis: session.learnerGaveDiagnosis,
      usefulness: session.usefulness,
      appVersion: session.appVersion,
      receivedAt: now,
      changeSeq: await nextChangeSeq(tx),
    })
    .onConflictDoNothing({ target: teachingSessions.id })
    .returning({ id: teachingSessions.id });

  // No row back means the ID already exists: this is not an insert.
  if (inserted.length === 0) {
    const [existing] = await tx
      .select({ doctorId: teachingSessions.doctorId })
      .from(teachingSessions)
      .where(eq(teachingSessions.id, session.id));
    return existing?.doctorId === userId ? duplicate() : rejected('forbidden');
  }

  await tx.insert(sessionSteps).values(
    session.steps.map((step) => ({
      sessionId: session.id,
      step: step.step,
      seconds: step.seconds,
      rating: step.rating,
      content: step.content as StepContent,
    })),
  );
  return applied();
}
