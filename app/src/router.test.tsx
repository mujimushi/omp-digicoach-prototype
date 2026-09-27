import type { PublicUser } from '@omp/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { mockData } from './mocks/data.ts';
import { routes } from './router.tsx';

// The PWA plugin's virtual module doesn't load on Windows; these tests need no update anyway.
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(async () => undefined),
  }),
}));

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function meAnswers(user: PublicUser | null) {
  server.use(
    http.get('*/api/me', () =>
      user
        ? HttpResponse.json(user)
        : HttpResponse.json(
            { code: 'not_logged_in', message: 'Please log in.' },
            { status: 401 },
          ),
    ),
  );
}

function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('route guards', () => {
  it('send a visitor who is not logged in to the login screen', async () => {
    meAnswers(null);
    const router = open('/history');
    expect(
      await screen.findByRole('button', { name: 'Log In' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(
      screen.getByRole('heading', { level: 1, name: 'OMP DigiCoach' }),
    ).toBeInTheDocument();
  });

  it.each(['/', '/history', '/admin', '/admin/doctors'])(
    'always land a user who must change their password on the change screen, from %s',
    async (path) => {
      meAnswers({
        ...mockData.doctor,
        isAdmin: true,
        mustChangePassword: true,
      });
      const router = open(path);
      // The first visit to /admin loads the dashboard's lazy module, which can outlast the default 1 s.
      expect(
        await screen.findByRole(
          'heading',
          { name: 'Choose your password' },
          { timeout: 5000 },
        ),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/change-password');
    },
  );

  it('show a doctor who opens /admin the not-allowed page', async () => {
    meAnswers(mockData.doctor);
    open('/admin');
    expect(
      await screen.findByRole('heading', {
        name: 'This page is for the admin',
      }),
    ).toBeInTheDocument();
  });

  it('send an admin who doesn’t teach from the doctor app to the dashboard', async () => {
    meAnswers(mockData.admin);
    const router = open('/');
    expect(
      await screen.findByRole('navigation', { name: 'Dashboard' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin');
  });

  it('show a doctor the student list with the tab bar', async () => {
    meAnswers(mockData.doctor);
    open('/');
    expect(
      await screen.findByText('Choose the learner to teach'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Main' }),
    ).toBeInTheDocument();
  });
});

describe('login and password change', () => {
  it('logs a doctor in and goes to the student list', async () => {
    const user = userEvent.setup();
    meAnswers(null);
    server.use(
      http.post('*/api/auth/login', () => HttpResponse.json(mockData.doctor)),
    );
    const router = open('/login');

    await user.type(await screen.findByLabelText('Username'), 'doctor.mock');
    await user.type(screen.getByLabelText('Password'), 'any password');
    await user.click(screen.getByRole('button', { name: 'Log In' }));

    expect(
      await screen.findByText('Choose the learner to teach'),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('shows one message for a failed login', async () => {
    const user = userEvent.setup();
    meAnswers(null);
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(
          {
            code: 'invalid_credentials',
            message: 'Wrong username or password',
          },
          { status: 401 },
        ),
      ),
    );
    open('/login');
    await user.type(await screen.findByLabelText('Username'), 'nobody');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Log In' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Wrong username or password.',
    );
  });

  it('shows the switched-off message from the server', async () => {
    server.use(
      http.get('*/api/me', () =>
        HttpResponse.json(
          {
            code: 'not_logged_in',
            message: 'This account has been switched off. Ask the admin.',
          },
          { status: 401 },
        ),
      ),
    );
    open('/');
    expect(await screen.findByText(/switched off/)).toBeInTheDocument();
  });

  it('explains the 6-character minimum and refuses a short password before sending', async () => {
    const user = userEvent.setup();
    meAnswers({ ...mockData.doctor, mustChangePassword: true });
    open('/change-password');
    expect(
      await screen.findByText(
        /at least 6 characters\. A phrase of several words/i,
      ),
    ).toBeInTheDocument();

    await user.type(
      screen.getByLabelText('Temporary password'),
      'k7mq-3xrp-9dwt-2hvf',
    );
    await user.type(screen.getByLabelText('New password'), 'short');
    expect(screen.getByText('Use at least 6 characters.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save new password' }),
    ).toBeDisabled();
  });

  it('changes the password and goes home', async () => {
    const user = userEvent.setup();
    let changed = false;
    server.use(
      http.get('*/api/me', () =>
        HttpResponse.json({ ...mockData.doctor, mustChangePassword: !changed }),
      ),
      http.post('*/api/me/password', () => {
        changed = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const router = open('/change-password');
    await user.type(
      await screen.findByLabelText('Temporary password'),
      'k7mq-3xrp-9dwt-2hvf',
    );
    await user.type(
      screen.getByLabelText('New password'),
      'a quiet river at dawn',
    );
    await user.type(
      screen.getByLabelText('New password again'),
      'a quiet river at dawn',
    );
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    expect(
      await screen.findByText('Choose the learner to teach'),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });
});
