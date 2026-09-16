import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase, type DatabaseSettings } from './client.ts';

/** `server/drizzle`, from both `src/db` and `dist/db`. */
export const MIGRATIONS_FOLDER = fileURLToPath(
  new URL('../../drizzle', import.meta.url),
);

export async function runMigrations(settings: DatabaseSettings): Promise<void> {
  const { db, pool } = createDatabase({ ...settings, maxConnections: 1 });
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      'DATABASE_URL is missing. Copy server/.env.example to server/.env.',
    );
    process.exit(1);
  }
  try {
    await runMigrations({ url, caCert: process.env.DATABASE_CA_CERT });
    console.log('Migrations applied.');
  } catch (error) {
    console.error(
      'Migration failed:',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}
