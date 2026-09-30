import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { mockData } from '../mocks/data.ts';
import { handlers } from '../mocks/handlers.ts';
import { renderAdmin } from '../test/admin-app.tsx';
import { generateReadablePassword } from './doctors/temporary-password.ts';

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const admin = mockData.admin;

describe('doctor form', () => {
  it('requires the name, and checks the username rules before sending', async () => {
    const user = userEvent.setup();
    let posted = 0;
    server.use(
      http.post('*/api/admin/doctors', () => {
        posted += 1;
        return HttpResponse.json(
          { code: 'validation_failed', message: 'no' },
          { status: 400 },
        );
      }),
    );
    renderAdmin('/admin/doctors/new', admin);

    await user.click(await screen.findByRole('button', { name: 'Add doctor' }));
    expect(
      await screen.findByText('Use at least 2 characters'),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText('Name'), 'Dr. Zara Shah');
    await user.type(screen.getByLabelText('Username'), 'Dr Zara');
    await user.click(screen.getByRole('button', { name: 'Add doctor' }));
    expect(
      await screen.findByText(
        'Use 3–30 lower-case letters, digits, dots or underscores',
      ),
    ).toBeInTheDocument();
    expect(posted).toBe(0);
  });

  it('makes each account a doctor or an admin, never both', async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post('*/api/admin/doctors', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          doctor: { ...mockData.admin, username: 'admin.two' },
          temporaryPassword: 'abcd-efgh-jkmn-pqrs',
        });
      }),
    );
    renderAdmin('/admin/doctors/new', admin);

    const doctorRole = await screen.findByRole('radio', {
      name: 'Doctor: uses the phone app',
    });
    const adminRole = screen.getByRole('radio', {
      name: 'Admin: uses this dashboard',
    });
    expect(doctorRole).toBeChecked();
    expect(screen.getByLabelText('Department')).toBeInTheDocument();

    await user.click(adminRole);
    expect(adminRole).toBeChecked();
    expect(doctorRole).not.toBeChecked();
    // An admin doesn't teach, so has no department or designation.
    expect(screen.queryByLabelText('Department')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Designation')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Name'), 'Admin Two');
    await user.type(screen.getByLabelText('Username'), 'admin.two');
    await user.click(screen.getByRole('button', { name: 'Add doctor' }));
    await screen.findByTestId('temporary-password');
    expect(body).toMatchObject({
      isDoctor: false,
      isAdmin: true,
      department: null,
      designation: null,
    });
  });

  it('shows the generated password once after saving, then never again', async () => {
    const user = userEvent.setup();
    const { router } = renderAdmin('/admin/doctors/new', admin);

    await user.type(await screen.findByLabelText('Name'), 'Dr. Zara Shah');
    await user.type(screen.getByLabelText('Username'), 'dr.zara');
    await user.selectOptions(screen.getByLabelText('Department'), 'pediatrics');
    await user.selectOptions(screen.getByLabelText('Designation'), 'registrar');
    await user.click(screen.getByRole('button', { name: 'Generate password' }));
    const generated = (
      screen.getByLabelText('Temporary password (optional)') as HTMLInputElement
    ).value;
    expect(generated).toMatch(/^[a-z]{3,6}\d{4}$/);

    await user.click(screen.getByRole('button', { name: 'Add doctor' }));
    expect(await screen.findByTestId('temporary-password')).toHaveTextContent(
      generated,
    );

    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/admin/doctors'),
    );
    expect(screen.queryByText(generated)).not.toBeInTheDocument();
  });

  it('asks before resetting a password, then shows the new one once', async () => {
    const user = userEvent.setup();
    let resets = 0;
    server.use(
      http.post('*/api/admin/doctors/:id/reset-password', () => {
        resets += 1;
        return HttpResponse.json({ temporaryPassword: 'abcd-efgh-jkmn-pqrs' });
      }),
    );
    renderAdmin(`/admin/doctors/${mockData.doctor.id}/edit`, admin);

    await user.click(
      await screen.findByRole('button', { name: 'Reset password' }),
    );
    const dialog = await screen.findByRole('alertdialog', {
      name: `Reset the password for ${mockData.doctor.username}?`,
    });
    expect(resets).toBe(0);

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(resets).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Reset password',
      }),
    );
    expect(await screen.findByTestId('temporary-password')).toHaveTextContent(
      'abcd-efgh-jkmn-pqrs',
    );
    expect(resets).toBe(1);
  });

  it('asks before switching a doctor off', async () => {
    const user = userEvent.setup();
    let patches: unknown[] = [];
    server.use(
      http.patch('*/api/admin/doctors/:id', async ({ request }) => {
        patches = [...patches, await request.json()];
        return HttpResponse.json({ ...mockData.doctor, active: false });
      }),
    );
    renderAdmin(`/admin/doctors/${mockData.doctor.id}/edit`, admin);
    await user.click(await screen.findByRole('button', { name: 'Switch off' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Switch off',
      }),
    );
    await waitFor(() => expect(patches).toEqual([{ active: false }]));
  });
});

describe('tables and charts', () => {
  it('lists doctors from the server', async () => {
    renderAdmin('/admin/doctors', admin);
    const table = await screen.findByRole('table', { name: 'Doctors' });
    for (const doctor of [
      mockData.admin,
      mockData.doctor,
      mockData.secondDoctor,
    ]) {
      expect(within(table).getByText(doctor.username)).toBeInTheDocument();
    }
  });

  it('sorts a table by a column header', async () => {
    const user = userEvent.setup();
    renderAdmin('/admin/doctors', admin);
    const table = await screen.findByRole('table', { name: 'Doctors' });
    await user.click(within(table).getByRole('button', { name: 'Username' }));
    const usernames = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[1]?.textContent);
    expect(usernames).toEqual([...usernames].sort());
  });

  it('lists students and sessions from the server', async () => {
    renderAdmin('/admin/students', admin);
    const students = await screen.findByRole('table', { name: 'Students' });
    expect(within(students).getAllByRole('row')).toHaveLength(
      mockData.students.length + 1,
    );
    // Each doctor keeps their own list, so the table says who added each student.
    expect(
      within(students).getByRole('columnheader', { name: /Added by/ }),
    ).toBeInTheDocument();
    expect(
      within(students).getAllByRole('cell', { name: mockData.doctor.name }),
    ).toHaveLength(mockData.students.length);
  });

  it('draws the overview chart at a fixed size', async () => {
    const { container } = renderAdminAndReturn('/admin');
    expect(
      await screen.findByRole('heading', { name: 'Overview' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(container().querySelector('.recharts-surface')).not.toBeNull(),
    );
    expect(
      container().querySelector('.recharts-surface')?.getAttribute('width'),
    ).toBe('600');
    expect(screen.getByText('Active doctors')).toBeInTheDocument();
  });

  it('shows a session with each step’s rating and label, and asks before deleting', async () => {
    const user = userEvent.setup();
    const entry = mockData.sessions[0];
    if (!entry) throw new Error('no mock session');
    renderAdmin(`/admin/sessions/${entry.session.id}`, admin);
    expect(
      await screen.findByRole('region', { name: /Step 1: Get a Commitment/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete session' }));
    expect(
      await screen.findByRole('alertdialog', { name: 'Delete this session?' }),
    ).toBeInTheDocument();
  });
});

describe('generateReadablePassword', () => {
  it('makes one lower-case word and four digits, such as river4827', () => {
    for (let i = 0; i < 100; i += 1) {
      expect(generateReadablePassword()).toMatch(/^[a-z]{3,6}\d{4}$/);
    }
    // The digits keep their leading zeros.
    expect(generateReadablePassword((n) => (n === 10_000 ? 42 : 1))).toBe(
      'river0042',
    );
  });
});

function renderAdminAndReturn(path: string) {
  renderAdmin(path, admin);
  return { container: () => document.body };
}
