import { createHash, randomBytes } from 'node:crypto';
import { and, eq, ne } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client.ts';
import { loginSessions, users } from '../../db/schema.ts';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** How long a login lasts: from last use, and at most from when it began (OWASP Session Management). */
export const SESSION_RULES = {
  doctor: { idleMs: 30 * DAY_MS, maxMs: 90 * DAY_MS },
  admin: { idleMs: 30 * MINUTE_MS, maxMs: 8 * HOUR_MS },
} as const;

/** An account that is both doctor and admin follows the admin's shorter rules. */
export function sessionRulesFor(user: { isAdmin: boolean }) {
  return user.isAdmin ? SESSION_RULES.admin : SESSION_RULES.doctor;
}

/** `last_seen_at` is written at most this often, to save a write on every request. */
const LAST_SEEN_WRITE_MS = MINUTE_MS;

export type UserRow = typeof users.$inferSelect;

/** 32 random bytes, base64url-encoded. Only its SHA-256 is stored. */
export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createLoginSession(
  db: DbOrTx,
  user: Pick<UserRow, 'id' | 'isAdmin'>,
  now: Date,
): Promise<{ token: string; id: string; maxAgeSeconds: number }> {
  const token = newSessionToken();
  const id = hashSessionToken(token);
  const rules = sessionRulesFor(user);
  await db.insert(loginSessions).values({
    id,
    userId: user.id,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + rules.maxMs),
  });
  return { token, id, maxAgeSeconds: Math.floor(rules.maxMs / 1000) };
}

export type FoundSession = {
  id: string;
  user: UserRow;
};

/** A login the admin ended by switching the user off. It never works again. */
export type EndedSession = { endedReason: string };

/**
 * Finds the login for a cookie token and refreshes its last use. Returns null when there is no
 * such login or it has expired; an expired login is deleted.
 */
export async function findLoginSession(
  db: DbOrTx,
  token: string,
  now: Date,
): Promise<FoundSession | EndedSession | null> {
  const id = hashSessionToken(token);
  const [row] = await db
    .select({ session: loginSessions, user: users })
    .from(loginSessions)
    .innerJoin(users, eq(users.id, loginSessions.userId))
    .where(eq(loginSessions.id, id))
    .limit(1);
  if (!row) return null;

  if (row.session.endedReason) {
    await db.delete(loginSessions).where(eq(loginSessions.id, id));
    return { endedReason: row.session.endedReason };
  }

  const rules = sessionRulesFor(row.user);
  const nowMs = now.getTime();
  const expired =
    nowMs >= row.session.expiresAt.getTime() ||
    nowMs >= row.session.createdAt.getTime() + rules.maxMs ||
    nowMs >= row.session.lastSeenAt.getTime() + rules.idleMs;
  if (expired) {
    await db.delete(loginSessions).where(eq(loginSessions.id, id));
    return null;
  }

  if (nowMs - row.session.lastSeenAt.getTime() >= LAST_SEEN_WRITE_MS) {
    await db
      .update(loginSessions)
      .set({ lastSeenAt: now })
      .where(eq(loginSessions.id, id));
  }
  return { id, user: row.user };
}

export async function deleteLoginSession(
  db: DbOrTx,
  id: string,
): Promise<void> {
  await db.delete(loginSessions).where(eq(loginSessions.id, id));
}

/** Ends every login of a user, optionally keeping one. */
export async function deleteUserSessions(
  db: DbOrTx,
  userId: string,
  exceptId?: string,
): Promise<void> {
  await db
    .delete(loginSessions)
    .where(
      exceptId === undefined
        ? eq(loginSessions.userId, userId)
        : and(eq(loginSessions.userId, userId), ne(loginSessions.id, exceptId)),
    );
}

/** Ends every login of a user who has been switched off, keeping the rows so each phone learns why. */
export async function endUserSessions(
  db: DbOrTx,
  userId: string,
  reason: 'switched_off',
): Promise<void> {
  await db
    .update(loginSessions)
    .set({ endedReason: reason })
    .where(eq(loginSessions.userId, userId));
}
