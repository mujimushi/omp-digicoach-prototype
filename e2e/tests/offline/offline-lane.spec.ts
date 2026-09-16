import { expect, test } from '../../support/fixtures.ts';
import {
  syncBadge,
  waitForServiceWorker,
} from '../../support/helpers/doctor.ts';

test.skip(({ isMobile }) => !isMobile, 'The doctor app runs on phones');

test('E2E-C4 no cached API answers: offline, pulls fail and the badge says offline', async ({
  doctorPage: page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Service worker offline runs in phone Chromium',
  );
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Teach Ahmed Khan' }),
  ).toBeVisible();
  await waitForServiceWorker(page);

  await page.context().setOffline(true);
  await page.reload();
  await expect(syncBadge(page)).toContainText('Offline');

  const answers = await page.evaluate(async () => {
    const attempt = async (url: string) => {
      try {
        const response = await fetch(url);
        return `answered ${response.status}`;
      } catch {
        return 'failed';
      }
    };
    return [await attempt('/api/sync/pull?cursor='), await attempt('/api/me')];
  });
  expect(answers).toEqual(['failed', 'failed']);

  // The list shows only what the phone stored, not an old API answer.
  await expect(
    page.getByRole('button', { name: 'Teach Ahmed Khan' }),
  ).toBeVisible();
});
