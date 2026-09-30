// Takes every screenshot for the admin and doctor manuals from the local app.
// Needs `npm run dev` and a freshly seeded database (`npm run db:seed`).
//   node docs/manuals/capture.mjs [admin|doctor|all]
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:5180';
const PASSWORD = 'ward round teaching practice';
const which = process.argv[2] ?? 'all';
const dirFor = (part) => {
  const dir = fileURLToPath(new URL(`./shots/${part}/`, import.meta.url));
  mkdirSync(dir, { recursive: true });
  return dir;
};

const browser = await chromium.launch();

function shooter(page, dir) {
  return {
    /** The visible screen. */
    async screen(name, wait = 700, clip) {
      await page.waitForTimeout(wait);
      await page.screenshot({
        path: `${dir}${name}.png`,
        ...(clip ? { clip } : {}),
      });
      console.log('shot', name);
    },
    /** One element, such as a dialog or a panel. */
    async element(name, locator, wait = 500) {
      await page.waitForTimeout(wait);
      await locator.screenshot({ path: `${dir}${name}.png` });
      console.log('shot', name);
    },
    /** Scrolls a heading to the top of the screen, then takes the screen. */
    async at(name, heading, wait = 900) {
      try {
        await this.atOrThrow(name, heading, wait);
      } catch (error) {
        console.log('MISSED', name, String(error).split(/\n/)[0]);
      }
    },
    async atOrThrow(name, heading, wait) {
      await heading
        .first()
        .evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await page.evaluate(() => {
        // Leave a little room above the heading.
        for (const el of [
          document.scrollingElement,
          ...document.querySelectorAll('main, [style*="overflow"]'),
        ])
          if (el && el.scrollTop > 0)
            el.scrollTop = Math.max(0, el.scrollTop - 24);
      });
      await page.waitForTimeout(wait);
      await page.screenshot({ path: `${dir}${name}.png` });
      console.log('shot', name);
    },
  };
}

async function logIn(page, username, password) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log In' }).click();
}

// ---------------------------------------------------------------- admin
let newDoctorPassword = null;

if (which === 'admin' || which === 'all') {
  const dir = dirFor('admin');
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
    locale: 'en-GB',
    timezoneId: 'Asia/Karachi',
  });
  const page = await context.newPage();
  const s = shooter(page, dir);
  const dialog = () => page.getByRole('alertdialog');

  await page.goto(`${BASE}/login`);
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('••••••••');
  await s.screen('a01-login');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.getByRole('heading', { name: 'Overview' }).waitFor();
  await s.screen('a02-overview', 2500);
  await s.at(
    'a03-overview-ratings',
    page.getByRole('heading', { name: 'Average rating per step this month' }),
    1500,
  );

  await page.getByRole('link', { name: 'Doctors' }).first().click();
  await page.getByRole('heading', { name: 'Doctors' }).waitFor();
  await s.screen('a04-doctors', 1200);

  await page
    .getByRole('button', { name: 'Add doctor' })
    .or(page.getByRole('link', { name: 'Add doctor' }))
    .first()
    .click();
  await page.getByLabel('Name', { exact: true }).waitFor();
  await page.getByLabel('Name', { exact: true }).fill('Dr. Sara Malik');
  await page.getByLabel('Username').fill('dr.sara');
  await page.getByLabel('Department').selectOption('medicine');
  await page.getByLabel('Designation').selectOption('registrar');
  await s.screen('a05-add-doctor');
  await page.getByRole('radio', { name: 'Admin: uses this dashboard' }).check();
  await s.screen('a06-add-admin');
  await page.getByRole('radio', { name: 'Doctor: uses the phone app' }).check();
  await page.getByLabel('Department').selectOption('medicine');
  await page.getByLabel('Designation').selectOption('registrar');
  await page.getByRole('button', { name: 'Add doctor' }).click();
  await page.getByTestId('temporary-password').waitFor();
  newDoctorPassword = (
    await page.getByTestId('temporary-password').textContent()
  )?.trim();
  await s.screen('a07-password-once', 700, {
    x: 0,
    y: 0,
    width: 1000,
    height: 433,
  });
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('heading', { name: 'Doctors' }).waitFor();

  await page.getByRole('link', { name: 'Dr. Bilal Hussain' }).click();
  await page.getByRole('heading', { name: 'Dr. Bilal Hussain' }).waitFor();
  await s.screen('a08-doctor-detail', 1500);
  await s.at(
    'a09-doctor-students',
    page.getByRole('heading', { name: 'Students taught' }),
  );
  await s.at(
    'a10-doctor-sessions',
    page.getByRole('heading', { name: 'Sessions', exact: true }),
  );
  const doctorId = page.url().split('/').pop();

  await page.goto(`${BASE}/admin/doctors/${doctorId}/edit`);
  await page.getByLabel('Username').waitFor();
  await s.screen('a11-edit-doctor');
  await page.getByRole('button', { name: 'Reset password' }).click();
  await s.element('a12-reset-confirm', dialog());
  await dialog().getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Switch off' }).click();
  await s.element('a13-switch-off-confirm', dialog());
  await dialog().getByRole('button', { name: 'Cancel' }).click();

  await page.goto(`${BASE}/admin/reports/doctors/${doctorId}`);
  await s.screen('a14-doctor-report', 2000);

  await page.goto(`${BASE}/admin/students`);
  await page.getByRole('heading', { name: 'Students' }).waitFor();
  await s.screen('a15-students', 1200);
  await page
    .getByRole('table')
    .getByRole('link', { name: 'Asad Butt' })
    .click();
  await page.getByRole('heading', { name: 'Asad Butt' }).waitFor();
  await s.screen('a16-student-detail', 1500);
  await s.at(
    'a17-student-chart',
    page.getByRole('heading', { name: 'Ratings per step over time' }),
    2000,
  );
  await s.at(
    'a18-student-history',
    page.getByRole('heading', { name: 'Change history' }),
  );
  const studentId = page.url().split('/').pop();

  await page.goto(`${BASE}/admin/reports/students/${studentId}`);
  await s.screen('a19-student-report', 2500);

  await page.goto(`${BASE}/admin/sessions`);
  await page.getByRole('heading', { name: 'Sessions' }).waitFor();
  await s.screen('a20-sessions', 1200);
  await page.getByRole('table').getByRole('link').first().click();
  await page.getByRole('button', { name: 'Delete session' }).waitFor();
  await s.screen('a21-session-detail', 1200);
  await s.at(
    'a22-session-steps',
    page.getByText('Step 1', { exact: false }).first(),
  );
  await page.getByRole('button', { name: 'Delete session' }).click();
  await s.element('a23-delete-confirm', dialog());
  await dialog().getByRole('button', { name: 'Cancel' }).click();

  await page.goto(`${BASE}/admin/export`);
  await page.getByRole('heading', { name: 'Export' }).waitFor();
  await s.screen('a24-export', 700, { x: 0, y: 0, width: 1267, height: 427 });

  await context.close();
}

// ---------------------------------------------------------------- doctor
if (which === 'doctor' || which === 'all') {
  const dir = dirFor('doctor');
  const phone = {
    ...devices['iPhone 14'],
    locale: 'en-GB',
    timezoneId: 'Asia/Karachi',
  };

  // A new doctor: first login, the new password, the tour and its practice session.
  if (newDoctorPassword) {
    const context = await browser.newContext(phone);
    const page = await context.newPage();
    const s = shooter(page, dir);
    await page.goto(`${BASE}/login`);
    await page.getByLabel('Username').fill('dr.sara');
    await page.getByLabel('Password').fill(newDoctorPassword);
    await s.screen('d01-login');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.getByRole('heading', { name: 'Choose your password' }).waitFor();
    await page.getByLabel('Temporary password').fill(newDoctorPassword);
    await page
      .getByLabel('New password', { exact: true })
      .fill('my ward round');
    await page.getByLabel('New password again').fill('my ward round');
    await s.screen('d02-new-password');
    await page.getByRole('button', { name: 'Save new password' }).click();

    const cards = page.getByRole('dialog');
    await cards.waitFor();
    await s.screen('d03-tour-welcome');
    for (const name of [
      'd04-tour-steps',
      'd05-tour-offline',
      'd06-tour-practice',
    ]) {
      await cards.getByRole('button', { name: 'Next' }).click();
      await s.screen(name);
    }
    await cards.getByRole('button', { name: 'Start practice' }).click();
    await page.getByText('Tap the learner to begin.').waitFor();
    await s.screen('d07-practice-list');
    await page.getByRole('button', { name: 'Teach Practice Learner' }).click();
    await page.getByText('Choose the case type.').waitFor();
    await s.screen('d08-practice-setup');
    await page.getByRole('button', { name: 'Long Case' }).click();
    await page.getByRole('button', { name: /Start teaching session/ }).click();
    await page
      .getByText('One minute for all five steps. Tap to pause.')
      .waitFor();
    await s.screen('d09-practice-timer');
    await page.getByRole('button', { name: 'Got it' }).click();
    await page.getByRole('button', { name: 'Got it' }).click();
    for (let i = 0; i < 4; i += 1)
      await page.getByRole('button', { name: 'Next step' }).click();
    await page.getByRole('button', { name: 'Finish' }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('dialog', { name: 'You’re ready' }).waitFor();
    await s.screen('d10-practice-ready');
    await page.getByRole('button', { name: 'Start teaching' }).click();
    await context.close();
  }

  // A doctor with sessions: every screen.
  const context = await browser.newContext(phone);
  const page = await context.newPage();
  const s = shooter(page, dir);
  await logIn(page, 'dr.bilal', PASSWORD);
  await page.getByText('Choose the learner to teach').waitFor();
  await s.screen('d11-students', 1500);

  await page.getByRole('button', { name: 'Add student' }).click();
  await page.getByRole('heading', { name: 'Add student' }).waitFor();
  await page.getByLabel('Name', { exact: true }).fill('Zainab Akhtar');
  await page
    .getByRole('button', { name: 'Medical Student', exact: true })
    .click();
  await page.getByRole('button', { name: '3rd Year', exact: true }).click();
  await s.screen('d12-add-student');
  await page.goBack();
  await page.getByText('Choose the learner to teach').waitFor();
  await page.getByRole('link', { name: 'Edit Ahmed Siddiqui' }).click();
  await s.screen('d13-edit-student');
  await page.goto(`${BASE}/`);
  await page.getByText('Choose the learner to teach').waitFor();

  // A full session.
  await page.getByRole('button', { name: 'Teach Ahmed Siddiqui' }).click();
  await page.getByRole('heading', { name: 'Session setup' }).waitFor();
  await page.getByRole('button', { name: 'Short Case', exact: true }).click();
  await s.screen('d14-setup');
  const started = Date.now();
  await page.getByRole('button', { name: /Start teaching session/ }).click();
  await page.getByRole('heading', { name: 'Step 1 of 5' }).waitFor();
  await page
    .getByLabel('Learner’s answer')
    .fill('Community acquired pneumonia');
  await s.screen('d15-step1');
  const rate = (name) => page.getByRole('button', { name }).click();
  await rate('4 stars, Proficient');
  await s.at('d16-rating', page.getByText('Rate the learner on this step'));
  await page.getByRole('button', { name: /Time left|Extra time/ }).click();
  await s.screen('d17-paused');
  await page
    .getByRole('button', { name: /Time left|Extra time|Paused/ })
    .first()
    .click();

  await page.getByRole('button', { name: 'Next step' }).click();
  await page.getByRole('heading', { name: 'Step 2 of 5' }).waitFor();
  await rate('3 stars, Competent');
  await s.screen('d18-step2');
  await page.getByRole('button', { name: 'Next step' }).click();
  await page.getByRole('heading', { name: 'Step 3 of 5' }).waitFor();
  await page
    .getByLabel('One important thing to remember is')
    .fill('CURB-65 guides admission');
  await page.getByLabel('In patients with').fill('hypoxia');
  await s.screen('d19-step3');
  await s.at(
    'd20-step3-pearl',
    page.getByRole('button', { name: 'Save as teaching pearl' }),
  );
  await rate('4 stars, Proficient');
  await page.getByRole('button', { name: 'Next step' }).click();
  await page.getByRole('heading', { name: 'Step 4 of 5' }).waitFor();
  await page
    .getByRole('button', { name: 'Good history', exact: true })
    .click()
    .catch(() => {});
  await rate('5 stars, Excellent');
  await s.screen('d21-step4');
  await page.getByRole('button', { name: 'Next step' }).click();
  await page.getByRole('heading', { name: 'Step 5 of 5' }).waitFor();
  await page.getByLabel('Action plan').fill('Read the BTS pneumonia guideline');
  await rate('3 stars, Competent');
  // Past the minute, so the timer shows extra time.
  const left = 66_000 - (Date.now() - started);
  if (left > 0) await page.waitForTimeout(left);
  await s.screen('d22-step5-extra-time');
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByRole('heading', { name: 'Quick log' }).waitFor();
  await page.getByLabel('Diagnosis').fill('Community acquired pneumonia');
  await page.getByRole('button', { name: 'Yes', exact: true }).click();
  await page.getByRole('button', { name: 'Usefulness 5' }).click();
  await s.screen('d23-quick-log');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Session saved').waitFor();
  await s.screen('d24-saved', 300);

  // A session left open.
  await page.getByRole('button', { name: 'Teach Asad Butt' }).click();
  await page.getByRole('button', { name: 'Long Case', exact: true }).click();
  await page.getByRole('button', { name: /Start teaching session/ }).click();
  await page.getByRole('heading', { name: 'Step 1 of 5' }).waitFor();
  await page.getByRole('button', { name: 'Leave session' }).click();
  await page.getByText('Session in progress').waitFor();
  await s.screen('d25-in-progress', 5000);
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await s.element('d26-discard-confirm', page.getByRole('alertdialog'));
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Discard' })
    .click();

  // Tabs.
  await page.getByRole('link', { name: 'History' }).click();
  await s.screen('d27-history', 1200);
  await page
    .getByRole('main')
    .getByRole('link')
    .first()
    .click()
    .catch(async () => {
      await page.locator('a[href^="/history/"]').first().click();
    });
  await s.screen('d28-history-detail', 1200);
  await page.getByRole('link', { name: 'Stats' }).click();
  await s.screen('d29-stats', 1500);
  await page.getByRole('link', { name: 'Progress' }).click();
  await s.screen('d30-progress', 1200);
  await page.locator('a[href^="/progress/"]').first().click();
  await s.screen('d31-student-progress', 1200);
  await page.getByRole('link', { name: 'More' }).click();
  await s.screen('d32-more', 1200);
  await page.getByRole('link', { name: /Teaching pearls/ }).click();
  await s.screen('d33-pearls', 1000);
  await page.getByRole('link', { name: 'More' }).click();
  await page.getByRole('link', { name: /About OMP/ }).click();
  await s.screen('d34-about', 1000);

  // Without signal.
  await page.goto(`${BASE}/`);
  await page.getByText('Choose the learner to teach').waitFor();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Teach Asad Butt' }).click();
  await page.getByRole('button', { name: 'Long Case', exact: true }).click();
  await page.getByRole('button', { name: /Start teaching session/ }).click();
  await page.getByRole('heading', { name: 'Step 1 of 5' }).waitFor();
  for (let i = 0; i < 4; i += 1)
    await page.getByRole('button', { name: 'Next step' }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByText('Choose the learner to teach').waitFor();
  const header = { x: 0, y: 0, width: 390, height: 150 };
  await page.waitForTimeout(5500);
  await page.screenshot({ path: `${dir}d35-badge-waiting.png`, clip: header });
  console.log('shot', 'd35-badge-waiting');
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page
    .getByTestId('sync-badge')
    .getByText('All sent')
    .waitFor({ timeout: 30000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}d36-badge-sent.png`, clip: header });
  console.log('shot', 'd36-badge-sent');

  await context.close();
}

await browser.close();
