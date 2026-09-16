import { expect, test } from '../../support/fixtures.ts';
import { countRows } from '../../support/helpers/db.ts';
import {
  expectAllSent,
  runQuickSession,
} from '../../support/helpers/doctor.ts';

// Intercepting requests needs the service worker out of the way.
test.use({ serviceWorkers: 'block' });

test('E2E-07 (E2E-C2) resend: the first push reaches the server but its answer never arrives; the phone resends; one session exists', async ({
  doctorPage: page,
  browserName,
  isMobile,
}) => {
  test.skip(browserName !== 'chromium' || !isMobile, 'Runs in phone Chromium');
  const diagnosis = `Resend check ${Date.now() % 100000}`;

  let intercepted = 0;
  await page.route(
    '**/api/sync/push',
    async (route) => {
      intercepted += 1;
      await route.fetch();
      await route.abort();
    },
    { times: 1 },
  );

  await page.goto('/');
  await runQuickSession(page, 'Sara Ahmed', diagnosis);

  await expect.poll(() => intercepted, { timeout: 10_000 }).toBe(1);
  await expect
    .poll(() => countRows('teaching_sessions', 'diagnosis = $1', [diagnosis]))
    .toBe(1);
  // The phone didn't hear back, so it still waits, then resends after 5 seconds.
  await expectAllSent(page, 20_000);
  expect(
    await countRows('teaching_sessions', 'diagnosis = $1', [diagnosis]),
  ).toBe(1);
  expect(
    await countRows(
      'session_steps',
      'session_id = (select id from teaching_sessions where diagnosis = $1)',
      [diagnosis],
    ),
  ).toBe(5);
});
