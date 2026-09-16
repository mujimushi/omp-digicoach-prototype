import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Route, Routes } from 'react-router';
import { RequireAdminArea, RequireLogin } from '../auth/guards.tsx';
import { AdminLayout } from '../layout/AdminLayout.tsx';
import { NotFound } from '../layout/PlaceholderPage.tsx';
import './admin.css';
import { DoctorDetailScreen } from './doctors/DoctorDetailScreen.tsx';
import { DoctorFormScreen } from './doctors/DoctorFormScreen.tsx';
import { DoctorsScreen } from './doctors/DoctorsScreen.tsx';
import { OverviewScreen } from './overview/OverviewScreen.tsx';
import { DoctorReportScreen } from './reports/DoctorReportScreen.tsx';
import { ExportScreen } from './reports/ExportScreen.tsx';
import { StudentReportScreen } from './reports/StudentReportScreen.tsx';
import { SessionDetailScreen } from './sessions/SessionDetailScreen.tsx';
import { SessionsScreen } from './sessions/SessionsScreen.tsx';
import { StudentDetailScreen } from './students/StudentDetailScreen.tsx';
import { StudentsScreen } from './students/StudentsScreen.tsx';

export function createAdminQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { networkMode: 'online', staleTime: 10_000, retry: 1 },
    },
  });
}

/** The dashboard's pages. */
export function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<OverviewScreen />} />
      <Route path="doctors" element={<DoctorsScreen />} />
      <Route path="doctors/new" element={<DoctorFormScreen />} />
      <Route path="doctors/:id" element={<DoctorDetailScreen />} />
      <Route path="doctors/:id/edit" element={<DoctorFormScreen />} />
      <Route path="students" element={<StudentsScreen />} />
      <Route path="students/:id" element={<StudentDetailScreen />} />
      <Route path="sessions" element={<SessionsScreen />} />
      <Route path="sessions/:id" element={<SessionDetailScreen />} />
      <Route path="reports/students/:id" element={<StudentReportScreen />} />
      <Route path="reports/doctors/:id" element={<DoctorReportScreen />} />
      <Route path="export" element={<ExportScreen />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

/** The dashboard. The router loads this file lazily, so it builds as its own `admin` chunk. */
export function AdminApp() {
  const [queryClient] = useState(createAdminQueryClient);
  return (
    <RequireLogin>
      <RequireAdminArea>
        <QueryClientProvider client={queryClient}>
          <AdminLayout>
            <AdminRoutes />
          </AdminLayout>
        </QueryClientProvider>
      </RequireAdminArea>
    </RequireLogin>
  );
}
