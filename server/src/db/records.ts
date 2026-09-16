import type {
  Pearl,
  StepContent,
  Student,
  StudentInput,
  TeachingSession,
} from '@omp/shared';
import { nextChangeSeq } from './change-seq.ts';
import type { Tx } from './client.ts';
import { pearls, sessionSteps, students, teachingSessions } from './schema.ts';

/** Inserts a student with a new change number. Used by seeding and tests. */
export async function insertStudentRecord(
  tx: Tx,
  student: StudentInput | Student,
  actorId: string,
  at: Date = new Date(),
): Promise<void> {
  await tx.insert(students).values({
    id: student.id,
    name: student.name,
    pmdcNumber: student.pmdcNumber,
    level: student.level,
    year: student.year,
    createdBy: actorId,
    updatedBy: actorId,
    createdAt: at,
    updatedAt: at,
    changeSeq: await nextChangeSeq(tx),
  });
}

/** Inserts a session and its five steps with a new change number. */
export async function insertSessionRecord(
  tx: Tx,
  session: TeachingSession,
  doctorId: string,
  receivedAt: Date = new Date(),
): Promise<void> {
  await tx.insert(teachingSessions).values({
    ...sessionColumns(session),
    doctorId,
    receivedAt,
    changeSeq: await nextChangeSeq(tx),
  });
  await tx.insert(sessionSteps).values(stepRows(session));
}

export function sessionColumns(session: TeachingSession) {
  return {
    id: session.id,
    studentId: session.studentId,
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
  };
}

export function stepRows(session: TeachingSession) {
  return session.steps.map((step) => ({
    sessionId: session.id,
    step: step.step,
    seconds: step.seconds,
    rating: step.rating,
    content: step.content as StepContent,
  }));
}

/** Inserts a pearl with a new change number. */
export async function insertPearlRecord(
  tx: Tx,
  pearl: Pearl,
  doctorId: string,
): Promise<void> {
  const at = new Date(pearl.updatedAt);
  await tx.insert(pearls).values({
    id: pearl.id,
    doctorId,
    diagnosis: pearl.diagnosis,
    points: [...pearl.points],
    timesUsed: pearl.timesUsed,
    deletedAt: pearl.deleted ? at : null,
    createdAt: at,
    updatedAt: at,
    changeSeq: await nextChangeSeq(tx),
  });
}
