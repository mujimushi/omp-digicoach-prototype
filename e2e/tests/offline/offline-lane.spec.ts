import { expect, test } from '../../support/fixtures.ts';
import { countRows } from '../../support/helpers/db.ts';
import {
  addStudent,
  nextStep,
  runQuickSession,
  startSession,
  syncBadge,
  waitForServiceWorker,
} from '../../support/helpers/doctor.ts';

test.skip(({ isMobile }) => !isMobile, 'The doctor app runs on phones');

test('E2E-C1 offline session: the app opens offline, saves, and sends once back online', async ({
  doctorPage: page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Service worker offline runs in phone Chromium',
  );
  const name = `Offline Student ${Date.now() % 100000}`;

  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Teach Ahmed Khan' }),
  ).toBeVisible();
  await waitForServiceWorker(page);

  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByText('Choose the learner to teach')).toBeVisible();
  await expect(syncBadge(page)).toContainText('Offline');

  await addStudent(page, name);
  await runQuickSession(page, name, 'Offline diagnosis');
  await expect(syncBadge(page)).toHaveText(/2 waiting/);

  await page.context().setOffline(false);
  await expect(syncBadge(page)).toHaveText('All sent', { timeout: 10_000 });

  expect(await countRows('students', 'name = $1', [name])).toBe(1);
  expect(
    await countRows(
      'teaching_sessions',
      "diagnosis = 'Offline diagnosis' and student_id = (select id from students where name = $1)",
      [name],
    ),
  ).toBe(1);
});

test.describe('resend', () => {
  // Intercepting requests needs the service worker out of the way.
  test.use({ serviceWorkers: 'block' });

  test('E2E-C2 resend safety: the server stores a push whose answer is lost, and the resend stores nothing twice', async ({
    doctorPage: page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Runs in phone Chromium');
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
    await expect(syncBadge(page)).toHaveText('All sent', { timeout: 20_000 });
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
});

test('E2E-C3 a reload during Step 3 brings the draft back with its text and times', async ({
  doctorPage: page,
}) => {
  await page.goto('/');
  await startSession(page, 'Fatima Rizvi');
  await nextStep(page, 2);
  await nextStep(page, 3);
  await page.getByLabel('Red flag').fill('Sudden breathlessness');
  await page.waitForTimeout(1_200);
  const before = await page.getByTestId('timer-text').textContent();

  await page.reload();

  await expect(
    page.getByRole('heading', { name: 'Step 3 of 5' }),
  ).toBeVisible();
  await expect(page.getByLabel('Red flag')).toHaveValue(
    'Sudden breathlessness',
  );
  const after = await page.getByTestId('timer-text').textContent();
  // The countdown kept running across the reload instead of starting again.
  expect(after).not.toBe('1:00');
  expect(before).not.toBe('1:00');
});

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
