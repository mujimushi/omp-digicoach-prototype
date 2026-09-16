import type { PublicUser } from '@omp/shared';
import { deletePhoneDb, getPhoneDb, type PhoneDb } from './db.ts';

/** A login refused on this phone, because another doctor's saves are still waiting to send. */
export class LoginBlockedError extends Error {
  override name = 'LoginBlockedError';
}

function blockedMessage(previous: PublicUser, waiting: number): string {
  const items = waiting === 1 ? '1 item' : `${waiting} items`;
  return `${items} saved by ${previous.name} haven’t been sent yet. Log in as ${previous.username} with signal to send them first.`;
}

/** The last user who logged in on this phone, so the app opens without signal. */
export function cachedUser(
  db: PhoneDb = getPhoneDb(),
): Promise<PublicUser | undefined> {
  return db.getMeta('user');
}

/** Refuses a login by another username while the previous user's items wait. */
export async function assertLoginAllowed(
  username: string,
  db: PhoneDb = getPhoneDb(),
): Promise<void> {
  const previous = await cachedUser(db);
  if (!previous || previous.username === username.trim().toLowerCase()) return;
  const waiting = await db.outbox.count();
  if (waiting > 0)
    throw new LoginBlockedError(blockedMessage(previous, waiting));
}

/**
 * Remembers who is logged in. A different user starts with an empty phone, but only when nothing
 * from the previous user is waiting; otherwise the login is refused.
 */
export async function rememberUser(
  user: PublicUser,
  db: PhoneDb = getPhoneDb(),
): Promise<void> {
  const previousId = await db.getMeta('userId');
  if (previousId !== undefined && previousId !== user.id) {
    const waiting = await db.outbox.count();
    const previous = await cachedUser(db);
    if (waiting > 0 && previous)
      throw new LoginBlockedError(blockedMessage(previous, waiting));
    await db.clearAll();
  }
  await db.setMeta('userId', user.id);
  await db.setMeta('user', user);
}

/** Everything on the phone goes: records, waiting items, the draft and the cached user. */
export async function clearPhoneData(): Promise<void> {
  await deletePhoneDb();
}

/** Asks the browser to keep this site's storage, once the app is installed. */
export async function requestPersistentStorage(): Promise<void> {
  const installed =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (installed && navigator.storage?.persist) {
    await navigator.storage.persist().catch(() => false);
  }
}
