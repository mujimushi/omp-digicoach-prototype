import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config.ts';

const validEnv = {
  DATABASE_URL: 'postgres://omp:omp@localhost:5434/omp',
  PORT: '3000',
  NODE_ENV: 'development',
};

describe('loadConfig', () => {
  it('reads valid settings with the development cookie', () => {
    expect(loadConfig(validEnv)).toEqual({
      databaseUrl: validEnv.DATABASE_URL,
      databaseCaCert: undefined,
      port: 3000,
      nodeEnv: 'development',
      cookie: { name: 'omp_session', secure: false },
      appOrigin: undefined,
      loginRateLimitMax: 20,
      trustProxy: false,
    });
  });

  it('names every missing value', () => {
    const { DATABASE_URL: _, PORT: __, ...env } = validEnv;

    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(
      /DATABASE_URL is missing\n {2}PORT is missing/,
    );
  });

  it('rejects a database address that is not PostgreSQL', () => {
    expect(() =>
      loadConfig({ ...validEnv, DATABASE_URL: 'mysql://localhost/omp' }),
    ).toThrow(/DATABASE_URL:/);
  });

  it('uses __Host-omp_session with Secure in production and trusts the proxy', () => {
    const config = loadConfig({ ...validEnv, NODE_ENV: 'production' });
    expect(config.cookie).toEqual({ name: '__Host-omp_session', secure: true });
    expect(config.trustProxy).toBe(true);
  });

  it('throws in production when the cookie name is the insecure form', () => {
    expect(() =>
      loadConfig({
        ...validEnv,
        NODE_ENV: 'production',
        SESSION_COOKIE_NAME: 'omp_session',
      }),
    ).toThrow(/__Host-/);
  });

  it('throws in production when the login rate limit is changed', () => {
    expect(() =>
      loadConfig({
        ...validEnv,
        NODE_ENV: 'production',
        LOGIN_RATE_LIMIT_MAX: '1000',
      }),
    ).toThrow(/LOGIN_RATE_LIMIT_MAX/);
  });
});
