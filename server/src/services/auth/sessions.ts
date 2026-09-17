import { createHash, randomBytes } from 'node:crypto';
import { and, eq, ne } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client.ts';
import { loginSessions, users } from '../../db/schema.ts';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

type SessionRule = {
  /** The login ends when unused this long. */
  idleMs: number;
  /** The login ends this long after it began, however often it is used. Null: no limit. */
  maxMs: number | null;
};

/**
 * How long a login lasts. A doctor's phone stays logged in while the app is used at least once
 * every 400 days, the longest a browser keeps a cookie; each use moves the end forward. An admin
 * without the doctor role follows OWASP's short rules.
 */
export const SESSION_RULES = {
  doctor: { idleMs: 400 * DAY_MS, maxMs: null },
  admin: { idleMs: 30 * MINUTE_MS, maxMs: 8 * HOUR_MS },
} as const satisfies Record<string, SessionRule>;

/**
 * The dashboard needs a password typed this recently, for any account. A doctor who is also admin
 * stays logged in on the phone, but logs in again to open the dashboard after 8 hours.
 */
export const DASHBOARD_LOGIN_MAX_MS = 8 * HOUR_MS;

/** An account that is both doctor and admin follows the doctor's rules; see DASHBOARD_LOGIN_MAX_MS. */
export function sessionRulesFor(user: { isDoctor: boolean }): SessionRule {
  return user.isDoctor ? SESSION_RULES.doctor : SESSION_RULES.admin;
}

function lifetimeMs(rules: SessionRule): number {
  return rules.maxMs ?? rules.idleMs;
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
  user: Pick<UserRow, 'id' | 'isDoctor'>,
  now: Date,
): Promise<{ token: string; id: string; maxAgeSeconds: number }> {
  const token = newSessionToken();
  const id = hashSessionToken(token);
  const lifetime = lifetimeMs(sessionRulesFor(user));
  await db.insert(loginSessions).values({
    id,
    userId: user.id,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + lifetime),
  });
  return { token, id, maxAgeSeconds: Math.floor(lifetime / 1000) };
}

export type FoundSession = {
  id: string;
  user: UserRow;
  /** When the password was typed for this login. */
  createdAt: Date;
  /** Set when a login without an end date moved forward: send the cookie again with this age. */
  renewedMaxAgeSeconds: number | null;
};

/** A login the admin ended by switching the user off. It never works again. */
export type EndedSession = { endedReason: string };

/**
 * Finds the login for a cookie token and refreshes its last use, moving the end of a doctor's login
 * forward. Returns null when there is no such login or it has expired; an expired login is deleted.
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
    (rules.maxMs !== null &&
      nowMs >= row.session.createdAt.getTime() + rules.maxMs) ||
    nowMs >= row.session.lastSeenAt.getTime() + rules.idleMs;
  if (expired) {
    await db.delete(loginSessions).where(eq(loginSessions.id, id));
    return null;
  }

  let renewedMaxAgeSeconds: number | null = null;
  if (nowMs - row.session.lastSeenAt.getTime() >= LAST_SEEN_WRITE_MS) {
    const renew = rules.maxMs === null;
    await db
      .update(loginSessions)
      .set(
        renew
          ? { lastSeenAt: now, expiresAt: new Date(nowMs + rules.idleMs) }
          : { lastSeenAt: now },
      )
      .where(eq(loginSessions.id, id));
    if (renew) renewedMaxAgeSeconds = Math.floor(rules.idleMs / 1000);
  }
  return {
    id,
    user: row.user,
    createdAt: row.session.createdAt,
    renewedMaxAgeSeconds,
  };
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
