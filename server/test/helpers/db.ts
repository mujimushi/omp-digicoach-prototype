import { afterAll } from 'vitest';
import { createDatabase, type Db } from '../../src/db/client.ts';
import { truncateAll } from '../../src/db/truncate.ts';
import { TEST_DATABASE_URL } from './database-url.ts';

/** Opens a pool on the test database for one test file. Call at the top of the file. */
export function useTestDatabase(): Db {
  const { db, pool } = createDatabase({
    url: TEST_DATABASE_URL,
    maxConnections: 5,
  });
  afterAll(() => pool.end());
  return db;
}

/** Empties every table and resets the change counter. Call in `beforeEach`. */
export function resetDb(db: Db): Promise<void> {
  return truncateAll(db);
}
