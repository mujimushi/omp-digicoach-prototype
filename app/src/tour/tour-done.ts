import { apiSend } from '../api/client.ts';
import { getPhoneDb, type PhoneDb } from '../offline/db.ts';

function tellServer(): Promise<void> {
  return apiSend('POST', '/api/me/tour', {}, undefined, {
    redirectOnUnauthorized: false,
  }).catch(() => undefined);
}

/**
 * Remembers that the doctor finished or skipped the tour: on the phone first, so it never shows
 * again here, then on the server, so it doesn't show after logging in on another phone.
 */
export async function markTourDone(db: PhoneDb = getPhoneDb()): Promise<void> {
  await db
    .setMeta('tourDoneAt', new Date().toISOString())
    .catch(() => undefined);
  await tellServer();
}

/**
 * Whether the tour should open for a user whose server record says `tourCompletedAt`. When the
 * phone already knows it was seen, the server is told again, in case it missed it offline.
 */
export async function shouldOpenTour(
  tourCompletedAt: string | null | undefined,
  db: PhoneDb = getPhoneDb(),
): Promise<boolean> {
  // `undefined` is a user cached by an older version of the app: don't guess.
  if (tourCompletedAt !== null) return false;
  const doneHere = await db.getMeta('tourDoneAt').catch(() => undefined);
  if (doneHere) {
    void tellServer();
    return false;
  }
  return true;
}
