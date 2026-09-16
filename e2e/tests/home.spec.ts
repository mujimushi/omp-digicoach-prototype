import { expect, test } from '../support/fixtures.ts';

test('the home page shows the app name', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { level: 1, name: 'OMP DigiCoach' }),
  ).toBeVisible();
});
