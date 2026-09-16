import { expect, test } from '@playwright/test';

test('the home page shows the app name', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { level: 1, name: 'OMP DigiCoach' }),
  ).toBeVisible();
});
