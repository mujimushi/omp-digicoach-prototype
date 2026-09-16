import {
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { contextFor, deviceOptions } from '../fixtures.ts';

const DESKTOP = {
  viewport: { width: 1280, height: 900 },
  isMobile: false,
  hasTouch: false,
};

/** The admin at a desktop-sized window, in whatever browser the project runs. */
export async function adminAtDesk(
  browser: Browser,
  testInfo: TestInfo,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await contextFor(browser, testInfo, 'admin', DESKTOP);
  return { context, page: await context.newPage() };
}

/** A phone with nobody logged in, using the project's device, or a Pixel 7 on the desktop project. */
export async function emptyPhone(
  browser: Browser,
  testInfo: TestInfo,
): Promise<{ context: BrowserContext; page: Page }> {
  const options = testInfo.project.use.isMobile
    ? deviceOptions(testInfo)
    : {
        ...deviceOptions(testInfo),
        viewport: { width: 412, height: 915 },
        isMobile: true,
        hasTouch: true,
      };
  const context = await browser.newContext(options);
  return { context, page: await context.newPage() };
}

/** Adds a doctor through the admin API and returns the temporary password. */
export async function addDoctorByApi(
  admin: APIRequestContext,
  name: string,
  username: string,
): Promise<{ id: string; password: string }> {
  const response = await admin.post('/api/admin/doctors', {
    headers: { 'x-omp-client': 'app' },
    data: { name, username, department: 'medicine', designation: 'registrar' },
  });
  expect(response.status(), await response.text()).toBe(200);
  const body = (await response.json()) as {
    doctor: { id: string };
    temporaryPassword: string;
  };
  return { id: body.doctor.id, password: body.temporaryPassword };
}

export function uniqueUsername(prefix: string, testInfo: TestInfo): string {
  const project = testInfo.project.name.replace(/(\w)\w*-?/g, '$1');
  return `${prefix}.${project}.${Date.now() % 1_000_000}`;
}
