import { sql } from 'drizzle-orm';
import type { DbOrTx } from './client.ts';

/** Every table except `change_counter`, whose single row is reset instead. */
export const DATA_TABLES = [
  'audit_log',
  'processed_ops',
  'session_steps',
  'teaching_sessions',
  'student_aliases',
  'students',
  'pearls',
  'login_attempts',
  'login_sessions',
  'users',
] as const;

/** Empties every table and resets the change counter. Never used on production data. */
export async function truncateAll(db: DbOrTx): Promise<void> {
  await db.execute(
    sql.raw(
      `truncate table ${DATA_TABLES.join(', ')} restart identity cascade`,
    ),
  );
  await db.execute(sql`update change_counter set value = 0 where id = 1`);
}
