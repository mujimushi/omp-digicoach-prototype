import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { E2E_DATABASE_URL, TEST_SERVER_ENV } from '../env.ts';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

/** Empties the end-to-end database and reloads the known data, through the command line. */
export function resetDatabase(): void {
  execFileSync('npm', ['run', '--silent', 'db:reset-test', '-w', 'server'], {
    cwd: repoRoot,
    env: { ...process.env, ...TEST_SERVER_ENV },
    stdio: 'pipe',
  });
}

/** Runs a read-only query against the end-to-end database, to check results. */
export async function queryRows<T extends Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const client = new Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    await client.query('begin read only');
    const result = await client.query<T>(text, values);
    await client.query('rollback');
    return result.rows;
  } finally {
    await client.end();
  }
}

export async function countRows(
  table:
    | 'students'
    | 'teaching_sessions'
    | 'session_steps'
    | 'pearls'
    | 'student_aliases',
  where = 'true',
  values: unknown[] = [],
): Promise<number> {
  const [row] = await queryRows<{ count: string }>(
    `select count(*) from ${table} where ${where}`,
    values,
  );
  return Number(row?.count ?? 0);
}
