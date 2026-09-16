import {
  ApiError,
  ChangePasswordRequest,
  CSV_COLUMNS,
  DoctorInput,
  DoctorUpdate,
  type ErrorCode,
  ExportQuery,
  LoginRequest,
  PullQuery,
  PushEnvelope,
  PushItem,
  type PushResult,
  SessionFilters,
  StudentsQuery,
  StudentUpdate,
} from '@omp/shared';
import { HttpResponse, http } from 'msw';
import { z } from 'zod';
import { mockData } from './data.ts';

// Mock answers for every route in docs/plan/api.md. Each handler checks the request against the
// shared schemas, as the real server does, and answers with fixed records. Tests only.

const IdParam = z.uuid();

function error(status: number, code: ErrorCode, message: string) {
  return HttpResponse.json(ApiError.parse({ code, message }), { status });
}

/** The change-request guard: the client header and a JSON body type. */
function guardChange(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  if (
    request.headers.get('x-omp-client') !== 'app' ||
    !contentType.startsWith('application/json')
  ) {
    return error(403, 'forbidden', 'Change requests need the app headers');
  }
  return undefined;
}

async function readBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { response: Response }> {
  const refused = guardChange(request);
  if (refused) return { response: refused };
  const json = await request.json().catch(() => undefined);
  const result = schema.safeParse(json);
  if (!result.success) {
    return {
      response: error(
        400,
        'validation_failed',
        result.error.issues[0]?.message ?? 'Invalid request',
      ),
    };
  }
  return { data: result.data };
}

function readQuery<T extends z.ZodType>(
  request: Request,
  schema: T,
): { data: z.infer<T> } | { response: Response } {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const result = schema.safeParse(params);
  if (!result.success) {
    return {
      response: error(400, 'validation_failed', 'Invalid query'),
    };
  }
  return { data: result.data };
}

function readId(params: Record<string, unknown>) {
  return IdParam.safeParse(params.id);
}

export const handlers = [
  http.get('*/api/health', () => HttpResponse.json({ ok: true })),

  http.post('*/api/auth/login', async ({ request }) => {
    const body = await readBody(request, LoginRequest);
    if ('response' in body) return body.response;
    if (body.data.username === mockData.admin.username) {
      return HttpResponse.json(mockData.admin);
    }
    if (body.data.username === mockData.doctor.username) {
      return HttpResponse.json(mockData.doctor);
    }
    return error(401, 'invalid_credentials', 'Wrong username or password');
  }),

  http.post('*/api/auth/logout', ({ request }) => {
    return guardChange(request) ?? new HttpResponse(null, { status: 204 });
  }),

  http.get('*/api/me', () => HttpResponse.json(mockData.doctor)),

  http.post('*/api/me/password', async ({ request }) => {
    const body = await readBody(request, ChangePasswordRequest);
    if ('response' in body) return body.response;
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('*/api/sync/push', async ({ request }) => {
    const body = await readBody(request, PushEnvelope);
    if ('response' in body) return body.response;
    const results: PushResult[] = body.data.items.map((item) =>
      PushItem.safeParse(item).success
        ? { opId: item.opId, status: 'applied' }
        : { opId: item.opId, status: 'rejected', code: 'validation_failed' },
    );
    return HttpResponse.json({ results });
  }),

  http.get('*/api/sync/pull', ({ request }) => {
    const query = readQuery(request, PullQuery);
    if ('response' in query) return query.response;
    const cursor = query.data.cursor ?? '';
    if (cursor !== '' && !/^\d+$/.test(cursor)) {
      return error(400, 'bad_cursor', 'Unknown cursor');
    }
    const first = cursor === '' || cursor === '0';
    return HttpResponse.json({
      cursor: '10',
      students: first ? mockData.students : [],
      studentAliases: [],
      sessions: first
        ? mockData.sessions
            .filter((e) => e.doctorId === mockData.doctor.id)
            .map((e) => e.session)
        : [],
      pearls: first ? mockData.pearls : [],
    });
  }),

  http.get('*/api/admin/overview', () =>
    HttpResponse.json(mockData.overview()),
  ),

  http.get('*/api/admin/doctors', () => HttpResponse.json(mockData.doctors())),

  http.post('*/api/admin/doctors', async ({ request }) => {
    const body = await readBody(request, DoctorInput);
    if ('response' in body) return body.response;
    if (body.data.username === mockData.doctor.username) {
      return error(409, 'username_taken', 'That username is taken');
    }
    return HttpResponse.json({
      doctor: {
        ...mockData.doctor,
        id: crypto.randomUUID(),
        name: body.data.name,
        username: body.data.username,
        department: body.data.department,
        designation: body.data.designation,
        isDoctor: body.data.isDoctor,
        isAdmin: body.data.isAdmin,
        mustChangePassword: true,
      },
      temporaryPassword:
        body.data.temporaryPassword ?? mockData.temporaryPassword,
    });
  }),

  http.get('*/api/admin/doctors/:id', ({ params }) => {
    const id = readId(params);
    if (!id.success) return error(400, 'validation_failed', 'Invalid ID');
    const detail = mockData.doctorDetail(id.data);
    return detail
      ? HttpResponse.json(detail)
      : error(404, 'not_found', 'No such doctor');
  }),

  http.patch('*/api/admin/doctors/:id', async ({ request, params }) => {
    const id = readId(params);
    if (!id.success) return error(400, 'validation_failed', 'Invalid ID');
    const body = await readBody(request, DoctorUpdate);
    if ('response' in body) return body.response;
    const detail = mockData.doctorDetail(id.data);
    if (!detail) return error(404, 'not_found', 'No such doctor');
    const { activity } = detail;
    return HttpResponse.json({
      id: activity.id,
      name: body.data.name ?? activity.name,
      username: body.data.username ?? activity.username,
      department:
        body.data.department === undefined
          ? activity.department
          : body.data.department,
      designation:
        body.data.designation === undefined
          ? activity.designation
          : body.data.designation,
      isDoctor: body.data.isDoctor ?? activity.isDoctor,
      isAdmin: body.data.isAdmin ?? activity.isAdmin,
      active: body.data.active ?? activity.active,
      mustChangePassword: activity.mustChangePassword,
    });
  }),

  http.post('*/api/admin/doctors/:id/reset-password', ({ request, params }) => {
    const refused = guardChange(request);
    if (refused) return refused;
    const id = readId(params);
    if (!id.success) return error(400, 'validation_failed', 'Invalid ID');
    if (!mockData.doctorDetail(id.data)) {
      return error(404, 'not_found', 'No such doctor');
    }
    return HttpResponse.json({
      temporaryPassword: mockData.temporaryPassword,
    });
  }),

  http.get('*/api/admin/students', ({ request }) => {
    const query = readQuery(request, StudentsQuery);
    if ('response' in query) return query.response;
    const text = (query.data.query ?? '').toLowerCase();
    return HttpResponse.json(
      mockData
        .studentRows()
        .filter(
          (row) =>
            row.name.toLowerCase().includes(text) ||
            (row.pmdcNumber ?? '').toLowerCase().includes(text),
        ),
    );
  }),

  http.get('*/api/admin/students/:id', ({ params }) => {
    const id = readId(params);
    if (!id.success) return error(400, 'validation_failed', 'Invalid ID');
    const detail = mockData.studentDetail(id.data);
    return detail
      ? HttpResponse.json(detail)
      : error(404, 'not_found', 'No such student');
  }),

  http.patch('*/api/admin/students/:id', async ({ request, params }) => {
    const id = readId(params);
    if (!id.success) return error(400, 'validation_failed', 'Invalid ID');
    const body = await readBody(request, StudentUpdate);
    if ('response' in body) return body.response;
    const detail = mockData.studentDetail(id.data);
    if (!detail) return error(404, 'not_found', 'No such student');
    return HttpResponse.json({ ...detail.student, ...body.data });
  }),

  http.get('*/api/admin/sessions', ({ request }) => {
    const query = readQuery(request, SessionFilters);
    if ('response' in query) return query.response;
    const rows = mockData
      .sessionRows()
      .filter(
        (row) =>
          (query.data.doctorId === undefined ||
            row.doctorId === query.data.doctorId) &&
          (query.data.studentId === undefined ||
            row.studentId === query.data.studentId) &&
          (query.data.caseType === undefined ||
            row.caseType === query.data.caseType),
      );
    return HttpResponse.json({ rows, total: rows.length });
  }),

  http.get('*/api/admin/sessions/:id', ({ params }) => {
    const id = readId(params);
    if (!id.success) return error(400, 'validation_failed', 'Invalid ID');
    const detail = mockData.sessionDetail(id.data);
    return detail
      ? HttpResponse.json(detail)
      : error(404, 'not_found', 'No such session');
  }),

  http.delete('*/api/admin/sessions/:id', ({ request, params }) => {
    const refused = guardChange(request);
    if (refused) return refused;
    const id = readId(params);
    if (!id.success) return error(400, 'validation_failed', 'Invalid ID');
    if (!mockData.sessionDetail(id.data)) {
      return error(404, 'not_found', 'No such session');
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('*/api/admin/export/sessions.csv', ({ request }) => {
    const query = readQuery(request, ExportQuery);
    if ('response' in query) return query.response;
    const rows = mockData.sessionRows().map((row) => row.id);
    const csv = `﻿${[CSV_COLUMNS.join(','), ...rows].join('\r\n')}\r\n`;
    return new HttpResponse(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="omp-sessions-mock.csv"',
      },
    });
  }),
];
