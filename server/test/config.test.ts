import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config.ts';

const validEnv = {
  DATABASE_URL: 'postgres://omp:omp@localhost:5434/omp',
  PORT: '3000',
  NODE_ENV: 'development',
  SESSION_COOKIE_NAME: 'omp_session',
};

describe('loadConfig', () => {
  it('reads valid settings', () => {
    expect(loadConfig(validEnv)).toEqual({ ...validEnv, PORT: 3000 });
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
});
