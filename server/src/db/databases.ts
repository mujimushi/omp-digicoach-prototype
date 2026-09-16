import { Client } from 'pg';
import { poolConfig } from './client.ts';

function maintenanceClient(databaseUrl: string): {
  client: Client;
  name: string;
} {
  const url = new URL(databaseUrl);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error(`Unexpected database name: ${name}`);
  }
  url.pathname = '/postgres';
  return { client: new Client(poolConfig({ url: url.toString() })), name };
}

/** Creates the database named in the URL if it doesn't exist yet. */
export async function ensureDatabase(databaseUrl: string): Promise<void> {
  const { client, name } = maintenanceClient(databaseUrl);
  await client.connect();
  try {
    const found = await client.query(
      'select 1 from pg_database where datname = $1',
      [name],
    );
    if (found.rowCount === 0) await client.query(`create database "${name}"`);
  } finally {
    await client.end();
  }
}

/** Drops and creates the database named in the URL. Only for test databases. */
export async function recreateDatabase(databaseUrl: string): Promise<void> {
  const { client, name } = maintenanceClient(databaseUrl);
  if (!name.endsWith('_test') && !name.endsWith('_e2e')) {
    throw new Error(`Refusing to drop ${name}: not a test database`);
  }
  await client.connect();
  try {
    await client.query(`drop database if exists "${name}" with (force)`);
    await client.query(`create database "${name}"`);
  } finally {
    await client.end();
  }
}
