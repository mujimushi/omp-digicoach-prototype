import { Outlet, type RouteObject } from 'react-router';
import { AuthProvider } from './auth/AuthProvider.tsx';
import { ChangePasswordScreen } from './auth/ChangePasswordScreen.tsx';
import { RequireDoctorArea, RequireLogin } from './auth/guards.tsx';
import { LoginScreen } from './auth/LoginScreen.tsx';
import { doctorRoutes } from './doctor/routes.tsx';
import { DoctorLayout } from './layout/DoctorLayout.tsx';
import { NotFound } from './layout/PlaceholderPage.tsx';
import { UpdatePrompt } from './offline/UpdatePrompt.tsx';
import { ToastProvider } from './ui/Toast.tsx';

function AppRoot() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Outlet />
        <UpdatePrompt />
      </ToastProvider>
    </AuthProvider>
  );
}

export const routes: RouteObject[] = [
  {
    Component: AppRoot,
    children: [
      { path: '/login', Component: LoginScreen },
      {
        path: '/change-password',
        element: (
          <RequireLogin>
            <ChangePasswordScreen />
          </RequireLogin>
        ),
      },
      {
        path: '/',
        element: (
          <RequireLogin>
            <RequireDoctorArea>
              <DoctorLayout />
            </RequireDoctorArea>
          </RequireLogin>
        ),
        children: doctorRoutes,
      },
      {
        // Loaded only when opened, so phones never download the dashboard.
        path: '/admin/*',
        lazy: async () => {
          const { AdminApp } = await import('./admin/admin.tsx');
          return { Component: AdminApp };
        },
      },
      { path: '*', Component: NotFound },
    ],
  },
];
