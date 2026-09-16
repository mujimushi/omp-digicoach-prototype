import type { PublicUser } from '@omp/shared';
import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { vi } from 'vitest';
import { AdminRoutes, createAdminQueryClient } from '../admin/admin.tsx';
import { ChartSizeContext } from '../admin/components.tsx';
import { AuthContext, type AuthContextValue } from '../auth/AuthProvider.tsx';

/** Renders a dashboard page against whatever MSW answers, with charts at a fixed size. */
export function renderAdmin(path: string, user: PublicUser) {
  const auth: AuthContextValue = {
    state: { status: 'authenticated', user },
    user,
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    refresh: vi.fn(),
    expireLogin: vi.fn(),
  };
  const queryClient = createAdminQueryClient();
  const router = createMemoryRouter(
    [
      {
        path: '/admin/*',
        element: (
          <AuthContext.Provider value={auth}>
            <QueryClientProvider client={queryClient}>
              <ChartSizeContext.Provider value={{ width: 600, height: 240 }}>
                <AdminRoutes />
              </ChartSizeContext.Provider>
            </QueryClientProvider>
          </AuthContext.Provider>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return { router };
}
