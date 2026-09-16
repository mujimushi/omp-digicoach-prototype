import { Route, Routes } from 'react-router';
import { RequireAdminArea, RequireLogin } from '../auth/guards.tsx';
import { AdminLayout } from '../layout/AdminLayout.tsx';
import { NotFound, PlaceholderPage } from '../layout/PlaceholderPage.tsx';

/** The dashboard. The router loads this file lazily, so it builds as its own `admin` chunk. */
export function AdminApp() {
  return (
    <RequireLogin>
      <RequireAdminArea>
        <AdminLayout>
          <Routes>
            <Route index element={<PlaceholderPage name="Overview" />} />
            <Route
              path="doctors"
              element={<PlaceholderPage name="Doctors" />}
            />
            <Route
              path="doctors/new"
              element={<PlaceholderPage name="Add doctor" />}
            />
            <Route
              path="doctors/:id"
              element={<PlaceholderPage name="Doctor" />}
            />
            <Route
              path="doctors/:id/edit"
              element={<PlaceholderPage name="Edit doctor" />}
            />
            <Route
              path="students"
              element={<PlaceholderPage name="Students" />}
            />
            <Route
              path="students/:id"
              element={<PlaceholderPage name="Student" />}
            />
            <Route
              path="sessions"
              element={<PlaceholderPage name="Sessions" />}
            />
            <Route
              path="sessions/:id"
              element={<PlaceholderPage name="Session" />}
            />
            <Route
              path="reports/students/:id"
              element={<PlaceholderPage name="Student report" />}
            />
            <Route
              path="reports/doctors/:id"
              element={<PlaceholderPage name="Doctor report" />}
            />
            <Route path="export" element={<PlaceholderPage name="Export" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AdminLayout>
      </RequireAdminArea>
    </RequireLogin>
  );
}
