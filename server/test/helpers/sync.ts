import type { PullResponse, PushResponse } from '@omp/shared';
import type { FastifyInstance } from 'fastify';
import { APP_HEADERS } from './app.ts';

export type RawItem = { opId: string; type: string; payload: unknown };

export async function push(
  app: FastifyInstance,
  cookies: Record<string, string>,
  items: RawItem[],
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/sync/push',
    headers: APP_HEADERS,
    cookies,
    payload: { items },
  });
  return { response, body: response.json() as PushResponse };
}

export async function pull(
  app: FastifyInstance,
  cookies: Record<string, string>,
  cursor = '',
) {
  const response = await app.inject({
    method: 'GET',
    url: `/api/sync/pull?cursor=${encodeURIComponent(cursor)}`,
    cookies,
  });
  return { response, body: response.json() as PullResponse };
}
