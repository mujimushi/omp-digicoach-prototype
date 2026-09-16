import { Outlet, type RouteObject } from 'react-router';
import { AuthProvider } from './auth/AuthProvider.tsx';
import { ChangePasswordScreen } from './auth/ChangePasswordScreen.tsx';
import { RequireDoctorArea, RequireLogin } from './auth/guards.tsx';
import { LoginScreen } from './auth/LoginScreen.tsx';
import { DoctorLayout } from './layout/DoctorLayout.tsx';
import { NotFound, PlaceholderPage } from './layout/PlaceholderPage.tsx';
import { ToastProvider } from './ui/Toast.tsx';

function AppRoot() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Outlet />
      </ToastProvider>
    </AuthProvider>
  );
}

const placeholder = (name: string) => () => <PlaceholderPage name={name} />;

/** The doctor app's pages. Lane 4B replaces each placeholder. */
export const doctorRoutes: RouteObject[] = [
  { index: true, Component: placeholder('Students') },
  { path: 'students/new', Component: placeholder('Add student') },
  { path: 'students/:id/edit', Component: placeholder('Correct student') },
  { path: 'session/setup', Component: placeholder('Session setup') },
  { path: 'session', Component: placeholder('Session') },
  { path: 'session/log', Component: placeholder('Quick log') },
  { path: 'history', Component: placeholder('History') },
  { path: 'history/:id', Component: placeholder('Session details') },
  { path: 'stats', Component: placeholder('Stats') },
  { path: 'progress', Component: placeholder('Student progress') },
  { path: 'progress/:studentId', Component: placeholder('Student progress') },
  { path: 'more', Component: placeholder('More') },
  { path: 'pearls', Component: placeholder('Teaching pearls') },
  { path: 'about', Component: placeholder('About') },
];

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
