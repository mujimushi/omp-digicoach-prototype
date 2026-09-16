import {
  KNOWN_PASSWORD,
  KNOWN_USERS,
  type KnownUserKey,
} from '@omp/shared/fixtures';
import {
  type Browser,
  type BrowserContext,
  test as base,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { STORAGE_STATE } from './env.ts';
import { resetDatabase } from './helpers/db.ts';

let lastReset: string | undefined;

const CONTEXT_OPTIONS = [
  'viewport',
  'userAgent',
  'deviceScaleFactor',
  'isMobile',
  'hasTouch',
  'locale',
  'timezoneId',
  'baseURL',
  'serviceWorkers',
] as const;

/** The project's device settings, for extra browser contexts in a test. */
export function deviceOptions(testInfo: TestInfo): Record<string, unknown> {
  const use = testInfo.project.use as Record<string, unknown>;
  return Object.fromEntries(
    CONTEXT_OPTIONS.filter((key) => use[key] !== undefined).map((key) => [
      key,
      use[key],
    ]),
  );
}

/** A new browser context with the project's device settings, logged in as a known user. */
export async function contextFor(
  browser: Browser,
  testInfo: TestInfo,
  who: KnownUserKey,
  extra: Record<string, unknown> = {},
): Promise<BrowserContext> {
  const context = await browser.newContext({
    ...deviceOptions(testInfo),
    ...extra,
    storageState: STORAGE_STATE[who],
  });
  // If the saved login has gone, for example after a password reset in an earlier test, log in again.
  const me = await context.request.get('/api/me');
  if (me.status() !== 200) {
    const login = await context.request.post('/api/auth/login', {
      headers: { 'x-omp-client': 'app' },
      data: { username: KNOWN_USERS[who].username, password: KNOWN_PASSWORD },
    });
    if (!login.ok())
      throw new Error(`Could not log in ${who}: ${login.status()}`);
  }
  return context;
}

type Fixtures = {
  resetDatabasePerFile: void;
  adminPage: Page;
  doctorPage: Page;
  secondDoctorPage: Page;
};

function pageFor(who: KnownUserKey) {
  return async (
    { browser }: { browser: Browser },
    use: (page: Page) => Promise<void>,
    testInfo: TestInfo,
  ) => {
    const context = await contextFor(browser, testInfo, who);
    const page = await context.newPage();
    await use(page);
    await context.close();
  };
}

export const test = base.extend<Fixtures>({
  // Before the first test of each file in each project, the database goes back to the known data.
  // Always through the command line, never an HTTP route.
  resetDatabasePerFile: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright needs the destructuring pattern
    async ({}, use, testInfo) => {
      const key = `${testInfo.project.name}:${testInfo.file}`;
      if (lastReset !== key) {
        resetDatabase();
        lastReset = key;
      }
      await use();
    },
    { auto: true },
  ],
  adminPage: pageFor('admin'),
  doctorPage: pageFor('doctor'),
  secondDoctorPage: pageFor('secondDoctor'),
});

export { expect } from '@playwright/test';
