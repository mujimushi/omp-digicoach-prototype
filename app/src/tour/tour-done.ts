import { apiSend } from '../api/client.ts';

/**
 * Whether the tour opens for a user whose server record says `tourCompletedAt`. The server's record
 * is the only one: on an iPhone, Safari and the home-screen app keep separate storage, so a flag on
 * the phone would differ between them.
 */
export function shouldOpenTour(
  tourCompletedAt: string | null | undefined,
): boolean {
  // `undefined` is a user cached by an older version of the app: don't guess.
  return tourCompletedAt === null;
}

/** Tells the server the tour is done. Throws when it can't be reached. */
export async function markTourDone(): Promise<void> {
  await apiSend('POST', '/api/me/tour', {}, undefined, {
    redirectOnUnauthorized: false,
  });
}
