import { expect, test } from '../../support/fixtures.ts';

test('E2E-09 (E2E-D3) a doctor opening /admin is blocked, and admin API calls return 403', async ({
  doctorPage,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'phone-webkit',
    'Runs in phone Chromium (E2E-09) and desktop Chromium (E2E-D3)',
  );
  await doctorPage.goto('/admin');
  await expect(
    doctorPage.getByRole('heading', { name: 'This page is for the admin' }),
  ).toBeVisible();
  for (const url of [
    '/api/admin/overview',
    '/api/admin/doctors',
    '/api/admin/students',
    '/api/admin/export/sessions.csv',
  ]) {
    const response = await doctorPage.request.get(url);
    expect(response.status(), url).toBe(403);
  }
  const create = await doctorPage.request.post('/api/admin/doctors', {
    headers: { 'x-omp-client': 'app' },
    data: {
      name: 'Dr. Sneaky',
      username: 'dr.sneaky',
      department: 'medicine',
      designation: 'registrar',
    },
  });
  expect(create.status()).toBe(403);
});
