import type {
  Pearl,
  PullResponse,
  SessionStep,
  Student,
  TeachingSession,
} from '@omp/shared';
import { and, asc, eq, gt, inArray, lte } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { readChangeCounter } from '../../db/change-seq.ts';
import type { Db } from '../../db/client.ts';
import {
  pearls,
  sessionSteps,
  studentAliases,
  students,
  teachingSessions,
} from '../../db/schema.ts';
import { visibleToDoctor } from '../students/upsert.ts';

const CURSOR_PATTERN = /^(0|[1-9][0-9]{0,14})$/;

/** An empty cursor means 0. Anything else must be a number the server made. */
export function decodeCursor(cursor: string | undefined): number | null {
  if (cursor === undefined || cursor === '') return 0;
  return CURSOR_PATTERN.test(cursor) ? Number(cursor) : null;
}

export function encodeCursor(value: number): string {
  return String(value);
}

type StudentRow = typeof students.$inferSelect;
type SessionRow = typeof teachingSessions.$inferSelect;
type StepRow = typeof sessionSteps.$inferSelect;
type PearlRow = typeof pearls.$inferSelect;

export function toStudent(row: StudentRow): Student {
  return {
    id: row.id,
    name: row.name,
    pmdcNumber: row.pmdcNumber,
    level: row.level,
    year: row.year,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toTeachingSession(
  row: SessionRow,
  steps: StepRow[],
): TeachingSession {
  return {
    id: row.id,
    studentId: row.studentId,
    department: row.department as TeachingSession['department'],
    caseType: row.caseType,
    learnerLevel: row.learnerLevel,
    learnerYear: row.learnerYear,
    startedAt: row.startedAt.toISOString(),
    teachingSeconds: row.teachingSeconds,
    overtimeSeconds: row.overtimeSeconds,
    pausedSeconds: row.pausedSeconds,
    logSeconds: row.logSeconds,
    diagnosis: row.diagnosis,
    learnerGaveDiagnosis: row.learnerGaveDiagnosis,
    usefulness: row.usefulness as TeachingSession['usefulness'],
    appVersion: row.appVersion,
    steps: [...steps]
      .sort((a, b) => a.step - b.step)
      .map(
        (step) =>
          ({
            step: step.step,
            seconds: step.seconds,
            rating: step.rating,
            content: step.content,
          }) as SessionStep,
      ),
  };
}

export function toPearl(row: PearlRow): Pearl {
  return {
    id: row.id,
    diagnosis: row.diagnosis,
    points: row.points as Pearl['points'],
    timesUsed: row.timesUsed,
    updatedAt: row.updatedAt.toISOString(),
    deleted: row.deletedAt !== null,
  };
}

/**
 * Everything changed after the cursor: the caller's students (added or taught) and their aliases,
 * the caller's sessions with their
 * steps and the caller's pearls, deleted ones included. Reads the counter first and returns rows up
 * to it; writes commit in counter order, so nothing that commits late is skipped.
 */
export async function pullChanges(
  db: Db,
  userId: string,
  cursor: number,
): Promise<PullResponse> {
  const upTo = await readChangeCounter(db);
  const inRange = (column: AnyPgColumn) =>
    and(gt(column, cursor), lte(column, upTo));

  const [studentRows, aliasRows, sessionRows, pearlRows] = await Promise.all([
    db
      .select()
      .from(students)
      .where(and(inRange(students.changeSeq), visibleToDoctor(userId)))
      .orderBy(asc(students.changeSeq)),
    db
      .select({
        aliasId: studentAliases.aliasId,
        studentId: studentAliases.studentId,
        createdAt: studentAliases.createdAt,
        changeSeq: studentAliases.changeSeq,
      })
      .from(studentAliases)
      .innerJoin(students, eq(students.id, studentAliases.studentId))
      .where(and(inRange(studentAliases.changeSeq), visibleToDoctor(userId)))
      .orderBy(asc(studentAliases.changeSeq)),
    db
      .select()
      .from(teachingSessions)
      .where(
        and(
          eq(teachingSessions.doctorId, userId),
          inRange(teachingSessions.changeSeq),
        ),
      )
      .orderBy(asc(teachingSessions.changeSeq)),
    db
      .select()
      .from(pearls)
      .where(and(eq(pearls.doctorId, userId), inRange(pearls.changeSeq)))
      .orderBy(asc(pearls.changeSeq)),
  ]);

  const stepRows =
    sessionRows.length === 0
      ? []
      : await db
          .select()
          .from(sessionSteps)
          .where(
            inArray(
              sessionSteps.sessionId,
              sessionRows.map((row) => row.id),
            ),
          );
  const stepsBySession = new Map<string, StepRow[]>();
  for (const step of stepRows) {
    const list = stepsBySession.get(step.sessionId) ?? [];
    list.push(step);
    stepsBySession.set(step.sessionId, list);
  }

  return {
    cursor: encodeCursor(upTo),
    students: studentRows.map(toStudent),
    studentAliases: aliasRows.map((row) => ({
      aliasId: row.aliasId,
      studentId: row.studentId,
    })),
    sessions: sessionRows.map((row) =>
      toTeachingSession(row, stepsBySession.get(row.id) ?? []),
    ),
    pearls: pearlRows.map(toPearl),
  };
}
