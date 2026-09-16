import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, testConfig, useTestApp } from '../helpers/app.ts';
import { resetDb, useTestDatabase } from '../helpers/db.ts';

const db = useTestDatabase();
const app = useTestApp(db);

beforeEach(() => resetDb(db));

describe('security headers', () => {
  it('include a content security policy with worker-src and manifest-src', async () => {
    const response = await app().inject({ method: 'GET', url: '/api/health' });
    const csp = String(response.headers['content-security-policy']);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("worker-src 'self'");
    expect(csp).toContain("manifest-src 'self'");
    expect(csp).not.toContain('upgrade-insecure-requests');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('upgrade insecure requests in production', async () => {
    const production = await buildTestApp(db, {
      config: testConfig({ NODE_ENV: 'production' }),
    });
    try {
      const response = await production.inject({
        method: 'GET',
        url: '/api/health',
      });
      const csp = String(response.headers['content-security-policy']);
      expect(csp).toContain('upgrade-insecure-requests');
      expect(csp).toContain("worker-src 'self'");
      expect(response.headers['strict-transport-security']).toBeDefined();
    } finally {
      await production.close();
    }
  });
});
