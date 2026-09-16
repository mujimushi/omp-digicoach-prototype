import { KNOWN_PASSWORD, KNOWN_USERS } from '@omp/shared/fixtures';
import { test as setup } from '@playwright/test';
import { STORAGE_STATE } from './env.ts';
import { resetDatabase } from './helpers/db.ts';

setup.describe.configure({ mode: 'serial' });

setup('reset the database', () => {
  resetDatabase();
});

for (const key of ['admin', 'doctor', 'secondDoctor'] as const) {
  setup(`log in the known ${key}`, async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      headers: { 'x-omp-client': 'app' },
      data: { username: KNOWN_USERS[key].username, password: KNOWN_PASSWORD },
    });
    if (!response.ok()) {
      throw new Error(
        `Login for ${key} failed: ${response.status()} ${await response.text()}`,
      );
    }
    await request.storageState({ path: STORAGE_STATE[key] });
  });
}
