import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../src/db/client.ts';
import { buildTestApp, useTestApp } from './helpers/app.ts';
import { resetDb, useTestDatabase } from './helpers/db.ts';

const db = useTestDatabase();

describe('GET /api/health', () => {
  const app = useTestApp(db);
  beforeEach(() => resetDb(db));

  it('answers ok after a database ping', async () => {
    const response = await app().inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it('answers 503 database_unavailable when the database is down', async () => {
    const unreachable = createDatabase({
      url: 'postgres://omp:omp@127.0.0.1:1/omp',
      maxConnections: 1,
    });
    const broken = await buildTestApp(unreachable.db);
    try {
      const response = await broken.inject({
        method: 'GET',
        url: '/api/health',
      });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ code: 'database_unavailable' });
    } finally {
      await broken.close();
      await unreachable.pool.end();
    }
  });
});

describe('serving the built app', () => {
  const appDistDir = fileURLToPath(
    new URL('./fixtures/app-dist', import.meta.url),
  );
  const app = useTestApp(db, () => ({ appDistDir }));
  afterEach(() => undefined);

  it('answers an unknown /api path with a JSON 404, even for a page navigation', async () => {
    const response = await app().inject({
      method: 'GET',
      url: '/api/nope',
      headers: { accept: 'text/html' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.json()).toEqual({
      code: 'not_found',
      message: 'No route for GET /api/nope',
    });
  });

  it('answers a deep link such as /history with index.html', async () => {
    const response = await app().inject({
      method: 'GET',
      url: '/history',
      headers: { accept: 'text/html' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/html/);
    expect(response.body).toContain('<div id="root"></div>');
  });

  it('answers a missing file with a JSON 404, not index.html', async () => {
    const response = await app().inject({
      method: 'GET',
      url: '/assets/missing.js',
      headers: { accept: '*/*' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: 'not_found' });
  });
});
