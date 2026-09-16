/** The address Playwright opens, and where the test server listens. */
export const BASE_URL = 'http://localhost:3000';

const baseDatabaseUrl =
  process.env.DATABASE_URL ?? 'postgres://omp:omp@localhost:5434/omp';

function withDatabaseName(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

/** End-to-end tests use their own database, reset by `npm run db:reset-test`. */
export const E2E_DATABASE_URL = withDatabaseName(baseDatabaseUrl, 'omp_e2e');

/** The environment the test server and command-line tools run with. */
export const TEST_SERVER_ENV = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: E2E_DATABASE_URL,
  // Every test logs in from the same address; the real limit is tested in server tests.
  LOGIN_RATE_LIMIT_MAX: '100000',
  // Playwright itself reads @omp/shared's source; the server runs its build.
  NODE_OPTIONS: '',
};

/** Where the setup project saves each known user's login. */
export const STORAGE_STATE = {
  admin: 'playwright/.auth/admin.json',
  doctor: 'playwright/.auth/doctor.json',
  secondDoctor: 'playwright/.auth/second-doctor.json',
} as const;
