import { PublicUser } from '@omp/shared';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { z } from 'zod';
import { mockData } from '../mocks/data.ts';
import {
  ApiRequestError,
  apiGet,
  apiSend,
  NetworkError,
  setUnauthorizedHandler,
} from './client.ts';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('API client', () => {
  it('sends X-OMP-Client and a JSON body type on every change request', async () => {
    const seen: Record<string, string | null>[] = [];
    server.use(
      http.all('*/api/test', async ({ request }) => {
        seen.push({
          method: request.method,
          client: request.headers.get('x-omp-client'),
          type: request.headers.get('content-type'),
          body: await request.text(),
        });
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await apiSend('POST', '/api/test', { a: 1 });
    await apiSend('PATCH', '/api/test', { b: 2 });
    await apiSend('DELETE', '/api/test');

    expect(seen).toEqual([
      {
        method: 'POST',
        client: 'app',
        type: 'application/json',
        body: '{"a":1}',
      },
      {
        method: 'PATCH',
        client: 'app',
        type: 'application/json',
        body: '{"b":2}',
      },
      { method: 'DELETE', client: 'app', type: 'application/json', body: '{}' },
    ]);
  });

  it('sends no change headers on a GET, and checks the answer against its schema', async () => {
    let client: string | null = 'unset';
    server.use(
      http.get('*/api/me', ({ request }) => {
        client = request.headers.get('x-omp-client');
        return HttpResponse.json(mockData.doctor);
      }),
    );
    await expect(apiGet('/api/me', PublicUser)).resolves.toEqual(
      mockData.doctor,
    );
    expect(client).toBeNull();
  });

  it('refuses an answer that doesn’t match the schema', async () => {
    server.use(http.get('*/api/me', () => HttpResponse.json({ id: 42 })));
    await expect(apiGet('/api/me', PublicUser)).rejects.toThrow();
  });

  it('turns an error body into ApiRequestError', async () => {
    server.use(
      http.post('*/api/admin/doctors', () =>
        HttpResponse.json(
          { code: 'username_taken', message: 'That username is taken' },
          { status: 409 },
        ),
      ),
    );
    const error = await apiSend(
      'POST',
      '/api/admin/doctors',
      {},
      z.unknown(),
    ).catch((e) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      status: 409,
      code: 'username_taken',
      message: 'That username is taken',
    });
  });

  it('gives a 5xx without a body the internal_error code', async () => {
    server.use(
      http.get('*/api/me', () => new HttpResponse('oops', { status: 502 })),
    );
    await expect(apiGet('/api/me', PublicUser)).rejects.toMatchObject({
      status: 502,
      code: 'internal_error',
    });
  });

  it('sends the user to /login on a 401', async () => {
    const handler = vi.fn();
    const restore = setUnauthorizedHandler(handler);
    server.use(
      http.get('*/api/me', () =>
        HttpResponse.json(
          { code: 'not_logged_in', message: 'Please log in.' },
          { status: 401 },
        ),
      ),
    );
    try {
      await expect(apiGet('/api/me', PublicUser)).rejects.toMatchObject({
        status: 401,
      });
      expect(handler).toHaveBeenCalledTimes(1);

      await expect(
        apiGet('/api/me', PublicUser, { redirectOnUnauthorized: false }),
      ).rejects.toMatchObject({ code: 'not_logged_in' });
      expect(handler).toHaveBeenCalledTimes(1);
    } finally {
      restore();
    }
  });

  it('reports a request that never got an answer as NetworkError', async () => {
    server.use(http.get('*/api/me', () => HttpResponse.error()));
    await expect(apiGet('/api/me', PublicUser)).rejects.toBeInstanceOf(
      NetworkError,
    );
  });
});
