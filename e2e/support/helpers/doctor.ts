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
