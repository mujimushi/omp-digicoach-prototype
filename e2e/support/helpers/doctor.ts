import { isRatedStep } from '@omp/shared';
import { expect, type Page } from '@playwright/test';

/** From the student list, opens session setup for a student and starts a session. */
export async function startSession(
  page: Page,
  studentName: string,
  caseType = 'Long Case',
): Promise<void> {
  await page.getByRole('button', { name: `Teach ${studentName}` }).click();
  await expect(
    page.getByRole('heading', { name: 'Session setup' }),
  ).toBeVisible();
  await page.getByRole('button', { name: caseType, exact: true }).click();
  await page.getByRole('button', { name: /Start teaching session/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Step 1 of 5' }),
  ).toBeVisible();
}

/** Taps the star for a rating on the current step. */
export async function rateStep(
  page: Page,
  stars: 1 | 2 | 3 | 4 | 5,
): Promise<void> {
  const labels = [
    'Needs improvement',
    'Basic',
    'Competent',
    'Proficient',
    'Excellent',
  ];
  const name = `${stars} ${stars === 1 ? 'star' : 'stars'}, ${labels[stars - 1]}`;
  await page.getByRole('button', { name }).click();
}

export async function nextStep(page: Page, to: number): Promise<void> {
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(
    page.getByRole('heading', { name: `Step ${to} of 5` }),
  ).toBeVisible();
}

/** The sync badge in the student list's header. */
export function syncBadge(page: Page) {
  return page.getByTestId('sync-badge');
}

/** Waits until the service worker is active, so the app can open without signal. */
export async function waitForServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
}

/** Adds a student through the form and returns to the list. */
export async function addStudent(
  page: Page,
  name: string,
  level = 'Resident',
): Promise<void> {
  await page.getByRole('button', { name: 'Add student' }).click();
  await expect(
    page.getByRole('heading', { name: 'Add student' }),
  ).toBeVisible();
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: level, exact: true }).click();
  await page.getByRole('button', { name: 'Add student' }).click();
  await expect(
    page.getByRole('button', { name: `Teach ${name}` }),
  ).toBeVisible();
}

/** Runs a session through all five steps and saves the quick log with a diagnosis. */
export async function runQuickSession(
  page: Page,
  studentName: string,
  diagnosis: string,
): Promise<void> {
  await startSession(page, studentName);
  for (const step of [2, 3, 4, 5]) await nextStep(page, step);
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByLabel('Diagnosis').fill(diagnosis);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Session saved' }),
  ).toBeVisible();
}

/** The step of the session draft saved on the phone, read from IndexedDB, or null without one. */
export async function savedDraftStep(page: Page): Promise<number | null> {
  return page.evaluate(
    () =>
      new Promise<number | null>((resolve, reject) => {
        const open = indexedDB.open('omp');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('drafts')) {
            db.close();
            resolve(null);
            return;
          }
          const request = db
            .transaction('drafts')
            .objectStore('drafts')
            .get('current');
          request.onsuccess = () => {
            db.close();
            const record = request.result as
              | { draft?: { timer?: { currentStep?: number } } }
              | undefined;
            resolve(record?.draft?.timer?.currentStep ?? null);
          };
          request.onerror = () => reject(request.error);
        };
      }),
  );
}

/** The number of items waiting in the phone's outbox, read from IndexedDB. */
export async function outboxCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('omp');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('outbox')) {
            db.close();
            resolve(0);
            return;
          }
          const request = db
            .transaction('outbox')
            .objectStore('outbox')
            .count();
          request.onsuccess = () => {
            db.close();
            resolve(request.result);
          };
          request.onerror = () => reject(request.error);
        };
      }),
  );
}

/**
 * Goes through all five steps from Step 1, rating each rated step with the given stars, then taps
 * Finish. Values for steps that have no rating are ignored.
 */
export async function rateAllAndFinish(
  page: Page,
  ratings: readonly (1 | 2 | 3 | 4 | 5)[],
): Promise<void> {
  for (const [index, stars] of ratings.entries()) {
    if (isRatedStep(index + 1)) await rateStep(page, stars);
    if (index < 4) await nextStep(page, index + 2);
  }
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByRole('heading', { name: 'Quick log' })).toBeVisible();
}

/**
 * From the student list, waits until nothing is waiting to send. Call it after the phone has stored
 * the change: it reads the outbox itself, because the badge can still show the earlier state.
 */
export async function expectAllSent(
  page: Page,
  timeout = 15_000,
): Promise<void> {
  await expect.poll(() => outboxCount(page), { timeout }).toBe(0);
  await expect(syncBadge(page)).toHaveText('All sent', { timeout });
}
