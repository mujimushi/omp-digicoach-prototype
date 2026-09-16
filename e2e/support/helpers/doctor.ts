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
