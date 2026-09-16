import { withDatabaseName } from '../../src/db/client.ts';

/** Local Docker Compose database unless CI sets DATABASE_URL. */
export const BASE_DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://omp:omp@localhost:5434/omp';

/** The database server tests share. Recreated once per run by the global setup. */
export const TEST_DATABASE_URL = withDatabaseName(
  BASE_DATABASE_URL,
  'omp_test',
);
