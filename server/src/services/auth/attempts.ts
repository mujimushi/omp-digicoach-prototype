import { eq, sql } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client.ts';
import { loginAttempts } from '../../db/schema.ts';

/** Failures allowed before a username locks (OWASP Authentication). */
export const FREE_FAILURES = 5;
export const FIRST_LOCK_MS = 1000;
export const MAX_LOCK_MS = 15 * 60 * 1000;

/** The lock after a given number of failures: none up to 5, then 1 s doubling to 15 minutes. */
export function lockDurationMs(failures: number): number {
  if (failures <= FREE_FAILURES) return 0;
  return Math.min(
    FIRST_LOCK_MS * 2 ** (failures - FREE_FAILURES - 1),
    MAX_LOCK_MS,
  );
}

/** The time the username stays locked until, or null. Kept for any username, known or not. */
export async function lockedUntil(
  db: DbOrTx,
  usernameLower: string,
  now: Date,
): Promise<Date | null> {
  const [row] = await db
    .select({ lockedUntil: loginAttempts.lockedUntil })
    .from(loginAttempts)
    .where(eq(loginAttempts.usernameLower, usernameLower));
  return row?.lockedUntil && row.lockedUntil > now ? row.lockedUntil : null;
}

export async function recordFailure(
  db: DbOrTx,
  usernameLower: string,
  now: Date,
): Promise<{ failures: number; lockedUntil: Date | null }> {
  const [row] = await db
    .insert(loginAttempts)
    .values({ usernameLower, failures: 1, updatedAt: now })
    .onConflictDoUpdate({
      target: loginAttempts.usernameLower,
      set: {
        failures: sql`${loginAttempts.failures} + 1`,
        updatedAt: now,
      },
    })
    .returning({ failures: loginAttempts.failures });
  const failures = row?.failures ?? 1;
  const lockMs = lockDurationMs(failures);
  const until = lockMs > 0 ? new Date(now.getTime() + lockMs) : null;
  if (until) {
    await db
      .update(loginAttempts)
      .set({ lockedUntil: until })
      .where(eq(loginAttempts.usernameLower, usernameLower));
  }
  return { failures, lockedUntil: until };
}

/** Cleared by a successful login or an admin password reset. */
export async function clearFailures(
  db: DbOrTx,
  usernameLower: string,
): Promise<void> {
  await db
    .delete(loginAttempts)
    .where(eq(loginAttempts.usernameLower, usernameLower));
}
