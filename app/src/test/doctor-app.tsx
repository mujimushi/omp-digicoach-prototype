import type { PublicUser } from '@omp/shared';
import { render } from '@testing-library/react';
import { createMemoryRouter, Outlet } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../auth/AuthProvider.tsx';
import { RepositoryProvider } from '../data/RepositoryProvider.tsx';
import type { Repository } from '../data/repository.ts';
import { doctorRoutes } from '../doctor/routes.tsx';
import { ResumeGate } from '../doctor/session/ResumeGate.tsx';
import { ToastProvider } from '../ui/Toast.tsx';

/** Renders the doctor app at `path` with a given user and repository, without a server. */
export function renderDoctorApp({
  path,
  repository,
  user,
}: {
  path: string;
  repository: Repository;
  user: PublicUser;
}) {
  const auth: AuthContextValue = {
    state: { status: 'authenticated', user },
    user,
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    refresh: vi.fn(),
  };
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <AuthContext.Provider value={auth}>
            <ToastProvider>
              <RepositoryProvider repository={repository}>
                <ResumeGate>
                  <Outlet />
                </ResumeGate>
              </RepositoryProvider>
            </ToastProvider>
          </AuthContext.Provider>
        ),
        children: doctorRoutes,
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return { router, auth };
}
