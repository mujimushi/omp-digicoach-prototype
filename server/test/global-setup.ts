import { recreateDatabase } from '../src/db/databases.ts';
import { runMigrations } from '../src/db/migrate.ts';
import { TEST_DATABASE_URL } from './helpers/database-url.ts';

/** Runs every migration on a fresh test database, once per test run. */
export default async function setup() {
  await recreateDatabase(TEST_DATABASE_URL);
  await runMigrations({ url: TEST_DATABASE_URL });
}
