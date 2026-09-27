import {
  ApiError,
  DoctorActivityRow,
  DoctorCreated,
  DoctorDetail,
  HealthResponse,
  OverviewStats,
  PublicUser,
  PullResponse,
  PushResponse,
  SessionDetail,
  SessionPage,
  Student,
  StudentDetail,
  StudentSummaryRow,
  TemporaryPasswordResponse,
} from '@omp/shared';
import { createFixtures } from '@omp/shared/fixtures';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { mockData } from './data.ts';
import { handlers } from './handlers.ts';

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const origin = 'http://localhost:3000';
const appHeaders = {
  'content-type': 'application/json',
  'x-omp-client': 'app',
};
const fixtures = createFixtures(21);
const doctorId = mockData.doctor.id;
const studentId = mockData.students[0]?.id ?? '';
const sessionId = mockData.sessions[0]?.session.id ?? '';

function send(
  method: string,
  path: string,
  body?: unknown,
  headers = appHeaders,
) {
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  return fetch(`${origin}${path}`, init);
}

async function expectRefused(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(ApiError.safeParse(await response.json()).success).toBe(true);
}

async function expectShape(response: Response, schema: z.ZodType) {
  expect(response.status).toBe(200);
  const result = schema.safeParse(await response.json());
  expect(result.error?.issues ?? []).toEqual([]);
}

type Case = {
  name: string;
  valid: () => Promise<Response>;
  schema?: z.ZodType;
  status?: number;
  invalid?: () => Promise<Response>;
  invalidStatus?: number;
};

const cases: Case[] = [
  {
    name: 'GET /api/health',
    valid: () => send('GET', '/api/health'),
    schema: HealthResponse,
  },
  {
    name: 'POST /api/auth/login',
    valid: () =>
      send('POST', '/api/auth/login', {
        username: mockData.doctor.username,
        password: 'any password at all',
      }),
    schema: PublicUser,
    invalid: () => send('POST', '/api/auth/login', { username: 'x' }),
  },
  {
    name: 'POST /api/auth/logout',
    valid: () => send('POST', '/api/auth/logout', {}),
    status: 204,
    invalid: () =>
      send('POST', '/api/auth/logout', {}, {
        'content-type': 'application/json',
      } as typeof appHeaders),
    invalidStatus: 403,
  },
  {
    name: 'GET /api/me',
    valid: () => send('GET', '/api/me'),
    schema: PublicUser,
  },
  {
    name: 'POST /api/me/password',
    valid: () =>
      send('POST', '/api/me/password', {
        currentPassword: 'old',
        newPassword: 'a long enough pass phrase',
      }),
    status: 204,
    invalid: () =>
      send('POST', '/api/me/password', {
        currentPassword: 'old',
        newPassword: 'short',
      }),
  },
  {
    name: 'POST /api/me/tour',
    valid: () => send('POST', '/api/me/tour', {}),
    status: 204,
    invalid: () =>
      send('POST', '/api/me/tour', {}, {
        'content-type': 'application/json',
      } as typeof appHeaders),
    invalidStatus: 403,
  },
  {
    name: 'POST /api/sync/push',
    valid: () =>
      send('POST', '/api/sync/push', {
        items: [
          {
            opId: fixtures.uuid(),
            type: 'student.upsert',
            payload: fixtures.makeStudentInput(),
          },
        ],
      }),
    schema: PushResponse,
    invalid: () => send('POST', '/api/sync/push', { items: {} }),
  },
  {
    name: 'GET /api/sync/pull',
    valid: () => send('GET', '/api/sync/pull?cursor='),
    schema: PullResponse,
    invalid: () => send('GET', '/api/sync/pull?cursor=abc'),
  },
  {
    name: 'GET /api/admin/overview',
    valid: () => send('GET', '/api/admin/overview'),
    schema: OverviewStats,
  },
  {
    name: 'GET /api/admin/doctors',
    valid: () => send('GET', '/api/admin/doctors'),
    schema: z.array(DoctorActivityRow),
  },
  {
    name: 'POST /api/admin/doctors',
    valid: () =>
      send('POST', '/api/admin/doctors', {
        name: 'Dr. New Doctor',
        username: 'dr.new',
        department: 'surgery',
        designation: 'registrar',
      }),
    schema: DoctorCreated,
    invalid: () =>
      send('POST', '/api/admin/doctors', {
        name: 'Dr. New Doctor',
        username: 'Dr New',
        department: 'surgery',
        designation: 'registrar',
      }),
  },
  {
    name: 'GET /api/admin/doctors/:id',
    valid: () => send('GET', `/api/admin/doctors/${doctorId}`),
    schema: DoctorDetail,
    invalid: () => send('GET', '/api/admin/doctors/42'),
  },
  {
    name: 'PATCH /api/admin/doctors/:id',
    valid: () =>
      send('PATCH', `/api/admin/doctors/${doctorId}`, { active: false }),
    schema: PublicUser,
    invalid: () =>
      send('PATCH', `/api/admin/doctors/${doctorId}`, { active: 'no' }),
  },
  {
    name: 'POST /api/admin/doctors/:id/reset-password',
    valid: () =>
      send('POST', `/api/admin/doctors/${doctorId}/reset-password`, {}),
    schema: TemporaryPasswordResponse,
    invalid: () =>
      send(
        'POST',
        `/api/admin/doctors/${doctorId}/reset-password`,
        {},
        {
          'content-type': 'text/plain',
          'x-omp-client': 'app',
        },
      ),
    invalidStatus: 403,
  },
  {
    name: 'GET /api/admin/students',
    valid: () => send('GET', '/api/admin/students?query=&sort=name'),
    schema: z.array(StudentSummaryRow),
    invalid: () => send('GET', '/api/admin/students?sort=height'),
  },
  {
    name: 'GET /api/admin/students/:id',
    valid: () => send('GET', `/api/admin/students/${studentId}`),
    schema: StudentDetail,
    invalid: () => send('GET', '/api/admin/students/not-an-id'),
  },
  {
    name: 'PATCH /api/admin/students/:id',
    valid: () =>
      send('PATCH', `/api/admin/students/${studentId}`, { name: 'New Name' }),
    schema: Student,
    invalid: () =>
      send('PATCH', `/api/admin/students/${studentId}`, {
        level: 'resident',
        year: '1st',
      }),
  },
  {
    name: 'GET /api/admin/sessions',
    valid: () => send('GET', '/api/admin/sessions?from=&to=&page=1'),
    schema: SessionPage,
    invalid: () =>
      send('GET', '/api/admin/sessions?from=2026-09-10&to=2026-09-01'),
  },
  {
    name: 'GET /api/admin/sessions/:id',
    valid: () => send('GET', `/api/admin/sessions/${sessionId}`),
    schema: SessionDetail,
    invalid: () => send('GET', '/api/admin/sessions/nope'),
  },
  {
    name: 'DELETE /api/admin/sessions/:id',
    valid: () => send('DELETE', `/api/admin/sessions/${sessionId}`, {}),
    status: 204,
    invalid: () =>
      send('DELETE', `/api/admin/sessions/${sessionId}`, {}, {
        'content-type': 'application/json',
      } as typeof appHeaders),
    invalidStatus: 403,
  },
  {
    name: 'GET /api/admin/export/sessions.csv',
    valid: () => send('GET', '/api/admin/export/sessions.csv?from=2026-01-01'),
    status: 200,
    invalid: () => send('GET', '/api/admin/export/sessions.csv?from=January'),
  },
];

describe('mock handlers', () => {
  it('cover every route in api.md', () => {
    expect(handlers).toHaveLength(cases.length);
  });

  describe.each(cases)('$name', (testCase) => {
    it('answers a valid request with the documented shape', async () => {
      const response = await testCase.valid();
      if (testCase.schema) {
        await expectShape(response, testCase.schema);
      } else {
        expect(response.status).toBe(testCase.status);
      }
    });

    it.runIf(testCase.invalid)(
      'refuses a request that fails its schema',
      async () => {
        const response = await testCase.invalid?.();
        if (!response) throw new Error('no invalid case');
        await expectRefused(response, testCase.invalidStatus ?? 400);
      },
    );
  });

  it('sends the CSV with a byte-order mark and the column header', async () => {
    const response = await send('GET', '/api/admin/export/sessions.csv');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toContain('session_id,date,');
  });
});
