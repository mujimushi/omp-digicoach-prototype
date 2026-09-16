import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { count, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createDatabase, type Db } from '../db/client.ts';
import {
  auditLog,
  studentAliases,
  students,
  teachingSessions,
} from '../db/schema.ts';
import { deleteSession } from '../services/reports/sessions.ts';
import { toStudent } from '../services/sync/pull.ts';

export type RemovalReport = {
  removedSessions: string[];
  missingSessions: string[];
  removedStudents: string[];
  keptStudents: { id: string; reason: string }[];
};

/**
 * Removes the smoke test's and launch practice's records: the listed sessions first, then each
 * listed student only if no session from any doctor still refers to them. Writes audit_log for
 * everything removed. Not an API route, so the dashboard can't delete students.
 */
export async function removeTestRecords(
  db: Db,
  ids: { sessions: string[]; students: string[] },
  now: Date = new Date(),
): Promise<RemovalReport> {
  const Uuids = z.array(z.uuid());
  const sessionIds = Uuids.parse(ids.sessions);
  const studentIds = Uuids.parse(ids.students);
  const report: RemovalReport = {
    removedSessions: [],
    missingSessions: [],
    removedStudents: [],
    keptStudents: [],
  };

  for (const id of sessionIds) {
    if (await deleteSession(db, null, id, now)) report.removedSessions.push(id);
    else report.missingSessions.push(id);
  }

  for (const id of studentIds) {
    await db.transaction(async (tx) => {
      const [student] = await tx
        .select()
        .from(students)
        .where(eq(students.id, id))
        .for('update');
      if (!student) {
        report.keptStudents.push({ id, reason: 'no such student' });
        return;
      }
      const [refs] = await tx
        .select({ n: count() })
        .from(teachingSessions)
        .where(eq(teachingSessions.studentId, id));
      if ((refs?.n ?? 0) > 0) {
        report.keptStudents.push({
          id,
          reason: `${refs?.n} sessions still refer to this student`,
        });
        return;
      }
      await tx.delete(studentAliases).where(eq(studentAliases.studentId, id));
      await tx.delete(students).where(eq(students.id, id));
      await tx.insert(auditLog).values({
        actorId: null,
        action: 'student.remove_test_record',
        entityType: 'student',
        entityId: id,
        before: toStudent(student),
        after: null,
        createdAt: now,
      });
      report.removedStudents.push(id);
    });
  }
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      session: { type: 'string', multiple: true, default: [] },
      student: { type: 'string', multiple: true, default: [] },
    },
  });
  const url = process.env.DATABASE_URL;
  if (!url || (values.session.length === 0 && values.student.length === 0)) {
    console.error(
      'Usage: npm run remove-test-records -w server -- --session <id> [--session <id>] --student <id>',
    );
    process.exit(1);
  }
  const { db, pool } = createDatabase({
    url,
    caCert: process.env.DATABASE_CA_CERT,
  });
  try {
    const report = await removeTestRecords(db, {
      sessions: values.session,
      students: values.student,
    });
    console.log(JSON.stringify(report, null, 2));
    if (report.keptStudents.length > 0 || report.missingSessions.length > 0)
      process.exitCode = 2;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
