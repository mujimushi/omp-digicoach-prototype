import type { PublicUser } from '@omp/shared';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, Outlet } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../auth/AuthProvider.tsx';
import { RepositoryProvider } from '../data/RepositoryProvider.tsx';
import type { Repository } from '../data/repository.ts';
import { doctorRoutes } from '../doctor/routes.tsx';
import { ResumeGate } from '../doctor/session/ResumeGate.tsx';
import { PracticeBanner } from '../tour/PracticeBanner.tsx';
import { TourProvider, type TourStore } from '../tour/TourProvider.tsx';
import { useTour } from '../tour/useTour.ts';
import { ToastProvider } from '../ui/Toast.tsx';

/** The given repository, or the tour's practice one while it runs, as the doctor layout does. */
function TourRepository({
  repository,
  children,
}: {
  repository: Repository;
  children: ReactNode;
}) {
  const { practiceRepository } = useTour();
  return (
    <RepositoryProvider repository={practiceRepository ?? repository}>
      {children}
    </RepositoryProvider>
  );
}

/**
 * Renders the doctor app at `path` with a given user and repository, without a server. With `tour`,
 * the app tour runs too, remembering through the given store.
 */
export function renderDoctorApp({
  path,
  repository,
  user,
  tour,
}: {
  path: string;
  repository: Repository;
  user: PublicUser;
  tour?: TourStore;
}) {
  const auth: AuthContextValue = {
    state: { status: 'authenticated', user },
    user,
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    refresh: vi.fn(),
    expireLogin: vi.fn(),
  };
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <AuthContext.Provider value={auth}>
            <ToastProvider>
              {tour ? (
                <TourProvider store={tour}>
                  <TourRepository repository={repository}>
                    <ResumeGate>
                      <PracticeBanner />
                      <Outlet />
                    </ResumeGate>
                  </TourRepository>
                </TourProvider>
              ) : (
                <RepositoryProvider repository={repository}>
                  <ResumeGate>
                    <Outlet />
                  </ResumeGate>
                </RepositoryProvider>
              )}
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
