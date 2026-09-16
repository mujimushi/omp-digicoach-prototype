import {
  DoctorActivityRow,
  DoctorCreated,
  DoctorDetail,
  type DoctorInput,
  type DoctorUpdate,
  OverviewStats,
  PublicUser,
  SessionDetail,
  type SessionFilters,
  SessionPage,
  Student,
  StudentDetail,
  StudentSummaryRow,
  type StudentsQuery,
  type StudentUpdate,
  TemporaryPasswordResponse,
} from '@omp/shared';
import { z } from 'zod';
import { apiGet, apiGetBlob, apiSend } from '../api/client.ts';

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/** The dashboard's calls. Every number comes from the server; the browser never works one out. */
export const adminApi = {
  overview: () => apiGet('/api/admin/overview', OverviewStats),
  doctors: () => apiGet('/api/admin/doctors', z.array(DoctorActivityRow)),
  doctor: (id: string) => apiGet(`/api/admin/doctors/${id}`, DoctorDetail),
  createDoctor: (input: DoctorInput) =>
    apiSend('POST', '/api/admin/doctors', input, DoctorCreated),
  updateDoctor: (id: string, update: DoctorUpdate) =>
    apiSend('PATCH', `/api/admin/doctors/${id}`, update, PublicUser),
  resetPassword: (id: string) =>
    apiSend(
      'POST',
      `/api/admin/doctors/${id}/reset-password`,
      {},
      TemporaryPasswordResponse,
    ),
  students: (params: StudentsQuery) =>
    apiGet(`/api/admin/students${query(params)}`, z.array(StudentSummaryRow)),
  student: (id: string) => apiGet(`/api/admin/students/${id}`, StudentDetail),
  updateStudent: (id: string, update: StudentUpdate) =>
    apiSend('PATCH', `/api/admin/students/${id}`, update, Student),
  sessions: (filters: SessionFilters) =>
    apiGet(`/api/admin/sessions${query(filters)}`, SessionPage),
  session: (id: string) => apiGet(`/api/admin/sessions/${id}`, SessionDetail),
  deleteSession: (id: string) =>
    apiSend('DELETE', `/api/admin/sessions/${id}`, {}),
  exportCsv: (from?: string, to?: string) =>
    apiGetBlob(`/api/admin/export/sessions.csv${query({ from, to })}`),
};

export const adminKeys = {
  overview: ['admin', 'overview'] as const,
  doctors: ['admin', 'doctors'] as const,
  doctor: (id: string) => ['admin', 'doctors', id] as const,
  students: (params: StudentsQuery) => ['admin', 'students', params] as const,
  student: (id: string) => ['admin', 'students', id] as const,
  sessions: (filters: SessionFilters) =>
    ['admin', 'sessions', filters] as const,
  session: (id: string) => ['admin', 'sessions', id] as const,
};
