import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';

describe('GET /api/health', () => {
  const app = buildApp({ logger: false });

  beforeAll(() => app.ready());
  afterAll(() => app.close());

  it('answers ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });
});

describe('serving the built app', () => {
  const appDistDir = fileURLToPath(
    new URL('./fixtures/app-dist', import.meta.url),
  );
  const app = buildApp({ logger: false, appDistDir });

  beforeAll(() => app.ready());
  afterAll(() => app.close());

  it('answers an unknown /api path with a JSON 404, even for a page navigation', async () => {
    const response = await app.inject({
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
    const response = await app.inject({
      method: 'GET',
      url: '/history',
      headers: { accept: 'text/html' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/html/);
    expect(response.body).toContain('<div id="root"></div>');
  });

  it('answers a missing file with a JSON 404, not index.html', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/assets/missing.js',
      headers: { accept: '*/*' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: 'not_found' });
  });
});
