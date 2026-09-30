// Pilot re-test of 30 September 2026: the checklist for branch pilot-feedback-2026-09-30.
//
// Runs against the local test server only (npm run start:test, database omp_e2e), never production.
// Every check is recorded and the run carries on after a failure; the results table is written to
// this test's output folder as pilot-retest-results.md and attached to the report.
//
// Environment:
//   PILOT_NEW_PASSWORD         the password the new preceptors choose at first login (required)
//   PILOT_OLD_FORMAT_PASSWORD  a temporary password in the previous format, such as abcd-efgh-jkmn-pqrs (required)
//   PREVIOUS_BASE_URL          the previous version on another port, for check 9.2 (optional); it
//                              must have the known test data from `db:reset-test`
//
// Phones: WebKit cannot start on the machine this was written on (a missing system library), so
// "iPhone Safari" and "iPhone Chrome" run in Chromium with the iPhone 13 profile: screen size, touch
// and user agent, not Apple's engine.
import { mkdirSync, writeFileSync } from 'node:fs';
import { CSV_COLUMNS } from '@omp/shared';
import { KNOWN_PASSWORD, KNOWN_USERS } from '@omp/shared/fixtures';
import {
  type Browser,
  type BrowserContext,
  devices,
  type Page,
} from '@playwright/test';
import { BASE_URL } from '../support/env.ts';
import { contextFor, expect, test } from '../support/fixtures.ts';
import { parseCsv } from '../support/helpers/csv.ts';
import { addStudent, expectAllSent } from '../support/helpers/doctor.ts';
import { addDoctorByApi, uniqueUsername } from '../support/helpers/people.ts';

// ------------------------------------------------------------------ settings

/** The CSV header of the previous version (commit 42ae506, shared/src/schemas/admin.ts). */
const PREVIOUS_CSV_HEADER = [
  'session_id',
  'date',
  'start_time',
  'doctor_username',
  'doctor_name',
  'doctor_department',
  'doctor_designation',
  'student_id',
  'student_name',
  'pmdc_number',
  'learner_level',
  'learner_year',
  'department',
  'case_type',
  'teaching_seconds',
  'overtime_seconds',
  'paused_seconds',
  'log_seconds',
  'step1_rating',
  'step2_rating',
  'step3_rating',
  'step4_rating',
  'step5_rating',
  'step1_seconds',
  'step2_seconds',
  'step3_seconds',
  'step4_seconds',
  'step5_seconds',
  'step2_mode',
  'step4_tags',
  'diagnosis',
  'learner_gave_diagnosis',
  'usefulness',
  'pearl_used',
  'app_version',
];
/** In the previous version, every one of the five steps had a rating control. */
const PREVIOUSLY_RATED_STEPS = [1, 2, 3, 4, 5];

const { defaultBrowserType: _iphoneEngine, ...IPHONE } = devices['iPhone 13'];
const { defaultBrowserType: _androidEngine, ...ANDROID } = devices['Pixel 7'];
const IPHONE_CHROME_UA = (IPHONE.userAgent ?? '').replace(
  'Mobile/',
  'CriOS/129.0.6668.46 Mobile/',
);

/** Makes the page believe it was opened from the home-screen icon. */
const STANDALONE_SCRIPT = () => {
  Object.defineProperty(Navigator.prototype, 'standalone', {
    get: () => true,
    configurable: true,
  });
  const original = window.matchMedia.bind(window);
  window.matchMedia = (query: string) =>
    query.includes('display-mode: standalone')
      ? ({
          matches: true,
          media: query,
          onchange: null,
          addListener() {},
          removeListener() {},
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent: () => false,
        } as unknown as MediaQueryList)
      : original(query);
};

// ------------------------------------------------------------------ results

type Result = 'Pass' | 'Fail' | 'Needs a real phone' | 'Not tested';
const results: {
  id: string;
  title: string;
  result: Result;
  evidence: string;
}[] = [];

function firstLine(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  // Strip colour codes from Playwright's messages.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: removing terminal colour codes
  const clean = text.replace(/\u001b\[[0-9;]*m/g, '');
  const lines = clean
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.slice(0, 3).join(' | ').slice(0, 300);
}

/** Runs one check, records Pass or Fail with its evidence, and never stops the run. */
async function check(
  id: string,
  title: string,
  run: () => Promise<string | undefined>,
): Promise<boolean> {
  try {
    const evidence = await run();
    results.push({
      id,
      title,
      result: 'Pass',
      evidence: evidence || 'as expected',
    });
    return true;
  } catch (error) {
    results.push({ id, title, result: 'Fail', evidence: firstLine(error) });
    return false;
  }
}

function record(id: string, title: string, result: Result, evidence: string) {
  results.push({ id, title, result, evidence });
}

// ------------------------------------------------------------------ app steps

async function phone(
  browser: Browser,
  kind: 'iphone-safari' | 'iphone-chrome' | 'android' | 'home-screen',
): Promise<BrowserContext> {
  const base = {
    baseURL: BASE_URL,
    locale: 'en-GB',
    timezoneId: 'Asia/Karachi',
  };
  if (kind === 'android') return browser.newContext({ ...ANDROID, ...base });
  const context = await browser.newContext({
    ...IPHONE,
    ...base,
    ...(kind === 'iphone-chrome' ? { userAgent: IPHONE_CHROME_UA } : {}),
  });
  if (kind === 'home-screen') await context.addInitScript(STANDALONE_SCRIPT);
  return context;
}

/** Types into a labelled field key by key, as a person would. */
async function typeInto(page: Page, label: string, text: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.keyboard.type(text);
}

async function logIn(page: Page, username: string, password: string) {
  await page.goto('/login');
  await typeInto(page, 'Username', username);
  await typeInto(page, 'Password', password);
  await page.getByRole('button', { name: 'Log In' }).click();
}

async function firstLogin(
  page: Page,
  username: string,
  temporary: string,
  chosen: string,
) {
  await logIn(page, username, temporary);
  await expect(
    page.getByRole('heading', { name: 'Choose your password' }),
  ).toBeVisible();
  await typeInto(page, 'Temporary password', temporary);
  await typeInto(page, 'New password', chosen);
  await typeInto(page, 'New password again', chosen);
  await page.getByRole('button', { name: 'Save new password' }).click();
}

const welcome = (page: Page) =>
  page.getByRole('dialog', { name: 'Welcome to OMP DigiCoach' });
const home = (page: Page) => page.getByText('Choose the learner to teach');

/** Nothing on screen asks to add the app to the home screen. */
async function expectNoInstallPrompt(page: Page) {
  await expect(
    page.getByText(/Add to Home Screen|Install DigiCoach|Install app/i),
  ).toHaveCount(0);
}

async function logOut(page: Page) {
  await page.goto('/more');
  await page.getByRole('button', { name: 'Log out' }).click();
  const confirm = page.getByRole('button', { name: 'Log out and delete them' });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await expect(page.getByLabel('Username')).toBeVisible();
}

type SessionNotes = {
  step3: string;
  step5: string;
  quickLog: string;
  stepTexts: string[];
  errors: string[];
};

/** One full session: setup, the five steps with the Next button, and the quick log. */
async function runSession(
  page: Page,
  student: string,
  diagnosis: string,
  checks: {
    step3?: () => Promise<void>;
    step5?: () => Promise<void>;
    quickLog?: () => Promise<void>;
    ratedSteps?: () => Promise<void>;
  } = {},
): Promise<SessionNotes> {
  const errors: string[] = [];
  const onConsole = (m: { type(): string; text(): string }) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  };
  const onError = (e: Error) => errors.push(`page error: ${e.message}`);
  page.on('console', onConsole);
  page.on('pageerror', onError);
  const notes: SessionNotes = {
    step3: '',
    step5: '',
    quickLog: '',
    stepTexts: [],
    errors,
  };

  await page.getByRole('button', { name: `Teach ${student}` }).click();
  await page.getByRole('button', { name: 'Long Case', exact: true }).click();
  await page.getByRole('button', { name: /Start teaching session/ }).click();
  const stars = (n: number) =>
    page.getByRole('button', {
      name: `${n} ${n === 1 ? 'star' : 'stars'}, ${['Needs improvement', 'Basic', 'Competent', 'Proficient', 'Excellent'][n - 1]}`,
    });
  for (let step = 1; step <= 5; step += 1) {
    await expect(
      page.getByRole('heading', { name: `Step ${step} of 5` }),
    ).toBeVisible();
    notes.stepTexts.push(await page.locator('body').innerText());
    if (step === 1) await page.getByLabel('Learner’s answer').fill('Pneumonia');
    if (step === 3) {
      await page
        .getByLabel('One important thing to remember is')
        .fill('Oxygen saturation first');
      notes.step3 = await page.locator('body').innerText();
      await checks.step3?.();
    }
    if (step === 5) {
      await page.getByLabel('Action plan').fill('Read the pneumonia guideline');
      notes.step5 = await page.locator('body').innerText();
      await checks.step5?.();
    }
    const ratingGroup = page.getByRole('group', { name: `Rate Step ${step}` });
    if (await ratingGroup.count()) await stars(step === 4 ? 5 : 4).click();
    if (step < 5) await page.getByRole('button', { name: 'Next step' }).click();
  }
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByRole('heading', { name: 'Quick log' })).toBeVisible();
  notes.quickLog = await page.locator('body').innerText();
  await checks.quickLog?.();
  await page.getByLabel('Diagnosis').fill(diagnosis);
  await page.getByRole('button', { name: 'Yes', exact: true }).click();
  await page.getByRole('button', { name: 'Usefulness 5' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Session saved' }),
  ).toBeVisible();
  await expectAllSent(page);
  page.off('console', onConsole);
  page.off('pageerror', onError);
  return notes;
}

/** Visible text on the doctor app's screens, for the "red flag" search. */
async function screenTexts(page: Page): Promise<Record<string, string>> {
  const texts: Record<string, string> = {};
  for (const [name, path] of [
    ['Students', '/'],
    ['History', '/history'],
    ['Stats', '/stats'],
    ['Progress', '/progress'],
    ['More', '/more'],
    ['Teaching pearls', '/pearls'],
    ['About', '/about'],
  ] as const) {
    await page.goto(path);
    await page.waitForTimeout(500);
    texts[name] = await page.locator('body').innerText();
  }
  await page.goto('/history');
  await page.locator('a[href^="/history/"]').first().click();
  await page.waitForTimeout(500);
  texts['History, one session'] = await page.locator('body').innerText();
  await page.goto('/progress');
  await page.locator('a[href^="/progress/"]').first().click();
  await page.waitForTimeout(500);
  texts['Progress, one student'] = await page.locator('body').innerText();
  return texts;
}

// ------------------------------------------------------------------ the checklist

test('pilot re-test checklist, 30 September 2026', async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'Runs once, in Chromium; it makes its own phone contexts',
  );
  const newPassword = process.env.PILOT_NEW_PASSWORD;
  const oldFormatPassword = process.env.PILOT_OLD_FORMAT_PASSWORD;
  test.skip(
    !newPassword || !oldFormatPassword,
    'Set PILOT_NEW_PASSWORD and PILOT_OLD_FORMAT_PASSWORD',
  );
  if (!newPassword || !oldFormatPassword) return;
  test.setTimeout(15 * 60_000);
  const shots = testInfo.outputPath('shots');
  mkdirSync(shots, { recursive: true });
  const shot = (page: Page, name: string) =>
    page.screenshot({ path: `${shots}/${name}.png` });
  const stamp = String(Date.now() % 100000);

  // Test data, through the app: the PI is the known admin that `db:reset-test` creates.
  const pi = await contextFor(browser, testInfo, 'admin', {
    viewport: { width: 1280, height: 900 },
    isMobile: false,
    hasTouch: false,
  });
  const piPage = await pi.newPage();
  const aName = uniqueUsername('dr.retest.a', testInfo);
  const bName = uniqueUsername('dr.retest.b', testInfo);
  const oldName = uniqueUsername('dr.retest.old', testInfo);
  const a = await addDoctorByApi(pi.request, 'Dr. Retest A', aName);
  const b = await addDoctorByApi(pi.request, 'Dr. Retest B', bName);
  const oldAccount = await pi.request.post('/api/admin/doctors', {
    headers: { 'x-omp-client': 'app' },
    data: {
      name: 'Dr. Retest Old Format',
      username: oldName,
      department: 'medicine',
      designation: 'registrar',
      temporaryPassword: oldFormatPassword,
    },
  });
  expect(oldAccount.status(), await oldAccount.text()).toBe(200);
  const student1 = `Retest Student One ${stamp}`;
  const student2 = `Retest Student Two ${stamp}`;
  const diagnoses = {
    a1: `Retest A with S1 ${stamp}`,
    b2: `Retest B with S2 ${stamp}`,
    b1: `Retest B with S1 ${stamp}`,
  };

  // ---------------------------------------------------------------- 2. install notices
  {
    const context = await phone(browser, 'iphone-safari');
    const page = await context.newPage();
    await check(
      '2.1',
      'iPhone Safari: notice on splash and login, above the fields, bold and 18px or more',
      async () => {
        // Hold /api/me back, so the splash screen stays up long enough to read.
        await page.route('**/api/me', async (route) => {
          await new Promise((r) => setTimeout(r, 1500));
          await route.continue();
        });
        await page.goto('/');
        const splashNotice = page.getByRole('region', {
          name: 'Install the app',
        });
        await expect(splashNotice).toContainText('Open this app in Safari');
        await shot(page, '2.1-splash-iphone-safari');
        await page.unroute('**/api/me');
        await page.goto('/login');
        const notice = page.getByRole('region', { name: 'Install the app' });
        await expect(notice).toContainText(
          'Open this app in Safari, not Chrome. Then use Safari’s Share menu and choose Add to Home Screen.',
        );
        await shot(page, '2.1-login-iphone-safari');
        const noticeBox = await notice.boundingBox();
        const fieldBox = await page.getByLabel('Username').boundingBox();
        expect(
          noticeBox && fieldBox && noticeBox.y + noticeBox.height <= fieldBox.y,
        ).toBe(true);
        const style = await notice
          .locator('p')
          .first()
          .evaluate((el) => {
            const s = getComputedStyle(el);
            return {
              weight: Number(s.fontWeight),
              size: Number.parseFloat(s.fontSize),
            };
          });
        expect(style.weight, 'font weight').toBeGreaterThanOrEqual(600);
        expect(style.size, 'font size in px').toBeGreaterThanOrEqual(18);
        return `weight ${style.weight}, size ${style.size}px`;
      },
    );
    await context.close();
  }
  {
    const context = await phone(browser, 'iphone-chrome');
    const page = await context.newPage();
    await check(
      '2.2',
      'iPhone Chrome: a stronger warning to switch to Safari',
      async () => {
        await page.goto('/login');
        const alert = page.getByRole('alert', { name: 'Install the app' });
        await expect(alert).toContainText('You are not in Safari.');
        await shot(page, '2.2-login-iphone-chrome');
        return 'red "You are not in Safari." warning shown';
      },
    );
    await context.close();
  }
  record(
    '2.3',
    'Opening the link from WhatsApp',
    'Needs a real phone',
    'In-app browsers can only be detected by user agent here; unit tests cover WhatsApp and Instagram user agents',
  );
  {
    const context = await phone(browser, 'home-screen');
    const page = await context.newPage();
    await check('2.4', 'Home-screen icon: no install notice', async () => {
      await page.goto('/login');
      await expect(page.getByLabel('Username')).toBeVisible();
      await expect(
        page.getByRole('region', { name: 'Install the app' }),
      ).toHaveCount(0);
      await expect(
        page.getByRole('alert', { name: 'Install the app' }),
      ).toHaveCount(0);
      await shot(page, '2.4-login-home-screen');
    });
    await context.close();
  }
  {
    const context = await phone(browser, 'android');
    const page = await context.newPage();
    await check(
      '2.5',
      'Android Chrome: Chrome steps, no "Safari"',
      async () => {
        await page.goto('/login');
        const notice = page.getByRole('region', { name: 'Install the app' });
        await expect(notice).toContainText(
          'Open the Chrome menu and choose Add to Home screen or Install app.',
        );
        await expect(notice).not.toContainText('Safari');
        await shot(page, '2.5-login-android');
      },
    );
    await context.close();
  }

  // ---------------------------------------------------------------- 3.1 account creation
  await check(
    '3.1',
    'Temporary passwords match ^[a-z]+[0-9]{4}$; usernames are the admin’s choice',
    async () => {
      // The 1,000-password run is the unit test shared/src/rules/pilot-retest-2026-09-30.test.ts.
      for (const password of [a.password, b.password])
        expect(password).toMatch(/^[a-z]+[0-9]{4}$/);
      const form = await piPage.goto('/admin/doctors/new');
      expect(form?.ok()).toBe(true);
      // Decided after the re-test: the app generates no IDs, the admin types every username.
      await expect(piPage.getByLabel('Username')).toHaveValue('');
      return `passwords pass (${a.password}, ${b.password}); the admin types each username, as decided`;
    },
  );

  // ---------------------------------------------------------------- 1 and 3.2: Preceptor A, iPhone Safari
  const aPhone = await phone(browser, 'iphone-safari');
  const aPage = await aPhone.newPage();
  await check(
    '3.2',
    'Login fields: autocapitalize none, autocorrect off, spellcheck false; typed login works first time',
    async () => {
      await aPage.goto('/login');
      for (const label of ['Username', 'Password']) {
        const field = aPage.getByLabel(label, { exact: true });
        await expect(field).toHaveAttribute('autocapitalize', 'none');
        await expect(field).toHaveAttribute('autocorrect', 'off');
        await expect(field).toHaveAttribute('spellcheck', 'false');
      }
      await firstLogin(aPage, aName, a.password, newPassword);
      await shot(aPage, '3.2-after-first-login');
      // The trial session opens once the app has checked the user with the server. The home
      // screen sits behind the welcome dialog, so both can match: take the first.
      await expect(welcome(aPage).or(home(aPage)).first()).toBeVisible();
      return 'attributes set on both fields; first typed login succeeded';
    },
  );
  await check(
    '1.1',
    'iPhone Safari, first login of A: trial session opens; no install pop-up',
    async () => {
      await expect(welcome(aPage)).toBeVisible();
      await shot(aPage, '1.1-first-login-iphone-safari');
      await expectNoInstallPrompt(aPage);
      await welcome(aPage).getByRole('button', { name: 'Skip' }).click();
      await expect(home(aPage)).toBeVisible();
      await expectNoInstallPrompt(aPage);
    },
  );

  // A adds Student 1 and teaches them; steps 3 and 5, the quick log and the rated steps are checked on the way.
  let aSession: SessionNotes | null = null;
  await check('4.1a', 'Preceptor A runs a session with Student 1', async () => {
    await addStudent(aPage, student1);
    aSession = await runSession(aPage, student1, diagnoses.a1, {
      step3: async () => {
        await check(
          '5.1',
          'Step 3: no rating; teaching points present; Next works without a rating',
          async () => {
            await expect(
              aPage.getByRole('group', { name: /Rate Step/ }),
            ).toHaveCount(0);
            await expect(
              aPage.getByLabel('One important thing to remember is'),
            ).toBeVisible();
            await shot(aPage, '5.1-step-3');
          },
        );
        await check('8.1', '"Warning sign" where "red flag" was', async () => {
          await expect(
            aPage.getByLabel('Warning sign', { exact: true }),
          ).toBeVisible();
          return 'Step 3 shows the blank "• Warning sign:"; the app never had the sentence "A red flag you must never miss is", so it is not "A warning sign you must never miss is" either';
        });
      },
      step5: async () => {
        await check(
          '5.2',
          'Step 5: no rating; comments present; finishes without a rating',
          async () => {
            await expect(
              aPage.getByRole('group', { name: /Rate Step/ }),
            ).toHaveCount(0);
            await expect(aPage.getByLabel('Action plan')).toBeVisible();
            await expect(
              aPage.getByRole('button', { name: 'Finish' }),
            ).toBeEnabled();
            await shot(aPage, '5.2-step-5');
          },
        );
      },
      quickLog: async () => {
        await check(
          '7.1',
          'Quick log names the student; 1 to 6 scale unchanged',
          async () => {
            await expect(
              aPage.getByText(
                'Ask the student: How useful was this session for you? (1 to 6)',
              ),
            ).toBeVisible();
            for (let n = 1; n <= 6; n += 1)
              await expect(
                aPage.getByRole('button', { name: `Usefulness ${n}` }),
              ).toBeVisible();
            await expect(
              aPage.getByRole('button', { name: 'Usefulness 7' }),
            ).toHaveCount(0);
            await shot(aPage, '7.1-quick-log');
          },
        );
      },
    });
  });
  await check(
    '5.3',
    'Steps that had ratings before still do (previous version: all five)',
    async () => {
      // Previous version: StepRating on every step. This version keeps steps 1, 2 and 4.
      const notes = aSession as SessionNotes | null;
      if (!notes) throw new Error('the session did not run');
      const stillRated = [1, 2, 4];
      const history = await aPhone.newPage();
      await history.goto('/history');
      await history
        .getByRole('link', { name: new RegExp(diagnoses.a1) })
        .click();
      for (const step of stillRated)
        await expect(history.getByTestId(`step-${step}`)).toContainText(
          step === 4 ? 'Excellent' : 'Proficient',
        );
      for (const step of PREVIOUSLY_RATED_STEPS.filter(
        (s) => !stillRated.includes(s),
      ))
        await expect(history.getByTestId(`step-${step}`)).not.toContainText(
          /Proficient|Excellent|Not rated/,
        );
      await shot(history, '5.3-history-session');
      await history.close();
      return 'steps 1, 2 and 4 rated and shown in History; steps 3 and 5 show no rating';
    },
  );
  await check(
    '9.1',
    'A complete session saves with no errors on the page or in the console',
    async () => {
      const notes = aSession as SessionNotes | null;
      if (!notes) throw new Error('the session did not run');
      expect(notes.errors).toEqual([]);
      return 'saved and sent; no console errors or page errors';
    },
  );

  await check(
    '1.2',
    'A logs out and in again: Home, no trial session',
    async () => {
      await logOut(aPage);
      await logIn(aPage, aName, newPassword);
      await expect(home(aPage)).toBeVisible();
      await aPage.waitForTimeout(1500);
      await expect(welcome(aPage)).toHaveCount(0);
      await shot(aPage, '1.2-second-login');
    },
  );
  await check('9.3', 'Log out, then log in again', async () => {
    await logOut(aPage);
    await logIn(aPage, aName, newPassword);
    await expect(home(aPage)).toBeVisible();
  });
  {
    const context = await phone(browser, 'iphone-safari');
    const page = await context.newPage();
    await check(
      '3.3',
      'Login with spaces before and after the ID',
      async () => {
        await logIn(page, `  ${aName}  `, newPassword);
        await expect(home(page)).toBeVisible();
      },
    );
    await context.close();
  }
  const aHome = await phone(browser, 'home-screen');
  const aHomePage = await aHome.newPage();
  await check(
    '1.3',
    'Home-screen icon, A logs in: Home, no trial session again',
    async () => {
      await logIn(aHomePage, aName, newPassword);
      await expect(home(aHomePage)).toBeVisible();
      await aHomePage.waitForTimeout(1500);
      await expect(welcome(aHomePage)).toHaveCount(0);
      await expectNoInstallPrompt(aHomePage);
      await shot(aHomePage, '1.3-home-screen-login');
    },
  );

  // ---------------------------------------------------------------- 1.4 and 1.5: Preceptor B, Android
  const bPhone = await phone(browser, 'android');
  const bPage = await bPhone.newPage();
  await check(
    '1.4',
    'Android, first login of B: trial session; install event prevented; no banner',
    async () => {
      await firstLogin(bPage, bName, b.password, newPassword);
      await expect(welcome(bPage)).toBeVisible();
      const prevented = await bPage.evaluate(() => {
        const event = new Event('beforeinstallprompt', { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      });
      expect(prevented, 'beforeinstallprompt was prevented').toBe(true);
      await expectNoInstallPrompt(bPage);
      await shot(bPage, '1.4-first-login-android');
      await welcome(bPage).getByRole('button', { name: 'Skip' }).click();
      await expect(home(bPage)).toBeVisible();
      return 'trial session shown; the event was prevented';
    },
  );
  await check('4.1b', 'Preceptor B runs a session with Student 2', async () => {
    await addStudent(bPage, student2);
    await runSession(bPage, student2, diagnoses.b2);
  });
  await check('1.5', 'B logs out and in again: Home', async () => {
    await logOut(bPage);
    await logIn(bPage, bName, newPassword);
    await expect(home(bPage)).toBeVisible();
    await bPage.waitForTimeout(1500);
    await expect(welcome(bPage)).toHaveCount(0);
  });

  // ---------------------------------------------------------------- 4. own students and sessions
  async function ownScreens(
    page: Page,
    own: string,
    other: string,
    ownDx: string,
    otherDx: string,
  ) {
    const problems: string[] = [];
    await page.goto('/');
    await expect(home(page)).toBeVisible();
    await page.waitForTimeout(1000);
    if (!(await page.getByRole('button', { name: `Teach ${own}` }).isVisible()))
      problems.push(`Students tab lacks ${own}`);
    if (await page.getByRole('button', { name: `Teach ${other}` }).isVisible())
      problems.push(
        `Students tab shows the other preceptor's student "${other}" (and every other student)`,
      );
    await page.goto('/history');
    await page.waitForTimeout(800);
    const history = await page.locator('body').innerText();
    if (!history.includes(ownDx))
      problems.push('History lacks the own session');
    if (history.includes(otherDx))
      problems.push("History shows the other preceptor's session");
    await page.goto('/progress');
    await page.waitForTimeout(800);
    const progress = await page.locator('body').innerText();
    if (!progress.includes(own)) problems.push(`Progress lacks ${own}`);
    if (progress.includes(other)) problems.push(`Progress shows ${other}`);
    await page.goto('/stats');
    await page.waitForTimeout(800);
    const stats = await page.locator('body').innerText();
    if (!/\b1\s*\n\s*Sessions/.test(stats))
      problems.push('Stats does not count exactly 1 session');
    await shot(page, `4-stats-${own.includes('One') ? 'A' : 'B'}`);
    if (problems.length) throw new Error(problems.join('; '));
    return 'History, Progress and Stats show only the own session and student';
  }
  await check('4.2', 'As A: only Student 1 and A’s own session', () =>
    ownScreens(aHomePage, student1, student2, diagnoses.a1, diagnoses.b2),
  );
  await check('4.3', 'As B: only Student 2 and B’s own session', () =>
    ownScreens(bPage, student2, student1, diagnoses.b2, diagnoses.a1),
  );
  await check(
    '4.4',
    'B teaches Student 1; A sees only A’s session with Student 1',
    async () => {
      // Each doctor keeps their own list, so B adds their own record for the same student.
      await bPage.goto('/');
      await expect(
        bPage.getByRole('button', { name: `Teach ${student1}` }),
      ).toHaveCount(0);
      await addStudent(bPage, student1);
      await runSession(bPage, student1, diagnoses.b1);
      await aHomePage.goto('/');
      await aHomePage.reload();
      await aHomePage.waitForTimeout(2500);
      await aHomePage.goto('/progress');
      await aHomePage.getByRole('link', { name: new RegExp(student1) }).click();
      // Wait for the page's sessions to load before reading it.
      await expect(aHomePage.getByText(diagnoses.a1)).toBeVisible();
      const text = await aHomePage.locator('body').innerText();
      await shot(aHomePage, '4.4-a-student-1-progress');
      expect(text).toContain(diagnoses.a1);
      expect(text).not.toContain(diagnoses.b1);
      return 'Progress for Student 1 lists only A’s session';
    },
  );
  await check('4.5', 'A’s student list for a new session', async () => {
    await aHomePage.goto('/');
    await expect(
      aHomePage.getByRole('button', { name: `Teach ${student1}` }),
    ).toHaveCount(1);
    await expect(
      aHomePage.getByRole('button', { name: `Teach ${student2}` }),
    ).toHaveCount(0);
    await expect(
      aHomePage.getByRole('button', { name: 'Teach Ahmed Khan' }),
    ).toHaveCount(0);
    return 'Each doctor has their own list: A sees only Student 1, the one student A added';
  });
  await check('4.6', 'PI dashboard shows all three sessions', async () => {
    await piPage.goto('/admin/sessions');
    for (const dx of Object.values(diagnoses))
      await expect(
        piPage.getByRole('row', { name: new RegExp(dx) }),
      ).toBeVisible();
    await shot(piPage, '4.6-pi-sessions');
  });
  await check(
    '4.7',
    'A’s login cannot get B’s sessions through the API',
    async () => {
      const admin = await aHome.request.get('/api/admin/sessions');
      expect(admin.status(), 'admin session list').toBe(403);
      const other = await aHome.request.get('/api/admin/doctors');
      expect(other.status(), 'admin doctor list').toBe(403);
      const pull = await aHome.request.get('/api/sync/pull?cursor=');
      expect(pull.status()).toBe(200);
      const body = (await pull.json()) as {
        sessions: { diagnosis: string | null }[];
      };
      const diagnosesSeen = body.sessions.map((s) => s.diagnosis);
      expect(diagnosesSeen).toContain(diagnoses.a1);
      expect(diagnosesSeen).not.toContain(diagnoses.b1);
      expect(diagnosesSeen).not.toContain(diagnoses.b2);
      return `admin routes 403; pull returns ${body.sessions.length} session(s), none of B’s. The browser never reads the database directly.`;
    },
  );

  // ---------------------------------------------------------------- 5.4, 5.5, 7.2, 7.3
  await check(
    '5.4',
    'Progress and Stats load with no blank, zero or NaN from steps 3 and 5',
    async () => {
      await aHomePage.goto('/progress');
      await aHomePage.getByRole('link', { name: new RegExp(student1) }).click();
      await expect(
        aHomePage.getByText('Ratings per step over time'),
      ).toBeVisible();
      const progress = await aHomePage.locator('body').innerText();
      expect(progress).not.toMatch(/NaN/);
      for (const col of ['S1', 'S2', 'S4']) expect(progress).toContain(col);
      for (const col of ['S3', 'S5'])
        expect(progress).not.toMatch(new RegExp(`\\b${col}\\b`));
      await aHomePage.goto('/stats');
      const stats = await aHomePage.locator('body').innerText();
      expect(stats).not.toMatch(/NaN/);
      expect(stats).not.toContain('Teach General Rule');
      expect(stats).not.toContain('Correct & Improve');
      await piPage.goto('/admin');
      const overview = await piPage.locator('body').innerText();
      expect(overview).not.toMatch(/NaN/);
      expect(overview).not.toMatch(
        /3\. Teach General Rule|5\. Correct & Improve/,
      );
      await shot(aHomePage, '5.4-stats');
      return 'steps 3 and 5 are absent from Progress, Stats and the dashboard overview; no NaN';
    },
  );
  let csvRows: string[][] = [];
  await check(
    '5.5',
    'CSV header unchanged; new session’s step 3 and 5 ratings empty',
    async () => {
      const response = await pi.request.get('/api/admin/export/sessions.csv');
      expect(response.ok()).toBe(true);
      csvRows = parseCsv((await response.text()).replace(/^﻿/, ''));
      const [header, ...rows] = csvRows;
      expect(header).toEqual(PREVIOUS_CSV_HEADER);
      expect(header).toEqual([...CSV_COLUMNS]);
      const row = rows.find(
        (r) => r[header?.indexOf('diagnosis') ?? -1] === diagnoses.a1,
      );
      expect(row, 'A’s session in the CSV').toBeDefined();
      const col = (name: string) => row?.[header?.indexOf(name) ?? -1];
      expect(col('step3_rating')).toBe('');
      expect(col('step5_rating')).toBe('');
      expect(col('step1_rating')).toBe('4');
      return `header identical to the previous version (${header?.length} columns); step3_rating and step5_rating empty`;
    },
  );
  await check(
    '7.2',
    'History and Stats use the same wording for the question',
    async () => {
      await aHomePage.goto('/history');
      await aHomePage
        .getByRole('link', { name: new RegExp(diagnoses.a1) })
        .click();
      await expect(aHomePage.getByText('Useful for the student')).toBeVisible();
      await expect(aHomePage.getByText('5 of 6')).toBeVisible();
      await aHomePage.goto('/stats');
      const stats = await aHomePage.locator('body').innerText();
      expect(stats.toLowerCase()).not.toContain('useful');
      return 'The question itself appears only on the quick log. History shows the answer as "Useful for the student: 5 of 6"; Stats shows no usefulness.';
    },
  );
  await check(
    '7.3',
    'CSV usefulness column keeps its name and holds the 1 to 6 value',
    async () => {
      const [header, ...rows] = csvRows;
      expect(header).toContain('usefulness');
      const row = rows.find(
        (r) => r[header?.indexOf('diagnosis') ?? -1] === diagnoses.a1,
      );
      expect(row?.[header?.indexOf('usefulness') ?? -1]).toBe('5');
      return 'usefulness = 5';
    },
  );

  // ---------------------------------------------------------------- 8.2 red flags anywhere
  await check('8.2', 'No visible "red flag(s)" on any screen', async () => {
    const notes = aSession as SessionNotes | null;
    const texts: Record<string, string> = await screenTexts(aHomePage);
    if (notes) {
      notes.stepTexts.forEach((t, i) => {
        texts[`Session step ${i + 1}`] = t;
      });
      texts['Quick log'] = notes.quickLog;
    }
    await aHomePage.goto('/pearls');
    const login = await phone(browser, 'iphone-safari');
    const loginPage = await login.newPage();
    await loginPage.goto('/login');
    texts.Login = await loginPage.locator('body').innerText();
    await login.close();
    await piPage.goto('/admin/sessions');
    await piPage
      .getByRole('row', { name: new RegExp(diagnoses.a1) })
      .getByRole('link')
      .first()
      .click();
    await expect(
      piPage.getByRole('button', { name: 'Delete session' }),
    ).toBeVisible();
    texts['Dashboard, session page'] = await piPage.locator('body').innerText();
    const hits = Object.entries(texts)
      .filter(([, t]) => /red flags?/i.test(t))
      .map(([name]) => name);
    expect(hits, `screens with "red flag": ${hits.join(', ')}`).toEqual([]);
    return `${Object.keys(texts).length} screens searched`;
  });

  // ---------------------------------------------------------------- 3.4 previous-format account
  {
    const context = await phone(browser, 'iphone-safari');
    const page = await context.newPage();
    await check(
      '3.4',
      'An account with a previous-format temporary password still logs in',
      async () => {
        await logIn(page, oldName, oldFormatPassword);
        await expect(
          page.getByRole('heading', { name: 'Choose your password' }),
        ).toBeVisible();
        return 'accepted; the app asks for a new password, as for any temporary password';
      },
    );
    await context.close();
  }

  // ---------------------------------------------------------------- 9.2 previous version side by side
  const previous = process.env.PREVIOUS_BASE_URL;
  if (!previous) {
    record(
      '9.2',
      'Side by side with the previous version',
      'Not tested',
      'PREVIOUS_BASE_URL not set',
    );
  } else {
    await check(
      '9.2',
      'Screenshots of every tab in both versions',
      async () => {
        const screens = [
          '/',
          '/history',
          '/stats',
          '/progress',
          '/more',
          '/about',
        ];
        for (const [label, url] of [
          ['current', BASE_URL],
          ['previous', previous],
        ] as const) {
          const context = await browser.newContext({ ...IPHONE, baseURL: url });
          const page = await context.newPage();
          await logIn(page, KNOWN_USERS.doctor.username, KNOWN_PASSWORD);
          await expect(home(page)).toBeVisible();
          await page.waitForTimeout(1500);
          for (const path of screens) {
            await page.goto(path);
            await page.waitForTimeout(1200);
            await page.screenshot({
              path: `${shots}/9.2-${label}${path === '/' ? '-students' : path.replace('/', '-')}.png`,
              fullPage: true,
            });
          }
          await context.close();
        }
        return `${screens.length} screens in each version, saved as 9.2-current-* and 9.2-previous-*; compare by eye`;
      },
    );
  }

  // ---------------------------------------------------------------- the table
  const order = (id: string) =>
    id
      .split(/[.a-z]/)
      .filter(Boolean)
      .map(Number);
  results.sort((x, y) => {
    const [xa = 0, xb = 0] = order(x.id);
    const [ya = 0, yb = 0] = order(y.id);
    return xa - ya || xb - yb || x.id.localeCompare(y.id);
  });
  const table = [
    '| Check | Result | Evidence |',
    '|---|---|---|',
    ...results.map(
      (r) =>
        `| ${r.id} ${r.title} | ${r.result} | ${r.evidence.replace(/\|/g, '/')} |`,
    ),
  ].join('\n');
  writeFileSync(testInfo.outputPath('pilot-retest-results.md'), `${table}\n`);
  writeFileSync(
    testInfo.outputPath('pilot-retest-results.json'),
    JSON.stringify(results, null, 2),
  );
  await testInfo.attach('pilot-retest-results.md', {
    body: table,
    contentType: 'text/markdown',
  });
  console.log(`\n${table}\n`);

  await pi.close();
  await aPhone.close();
  await aHome.close();
  await bPhone.close();

  const failed = results.filter((r) => r.result === 'Fail').map((r) => r.id);
  expect(failed, 'failed checks').toEqual([]);
});
