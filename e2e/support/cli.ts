import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TEST_SERVER_ENV } from './env.ts';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

/** Runs `npm run <script> -w server -- ...args` against the end-to-end database. */
export function runServerCommand(script: string, args: string[] = []): string {
  return execFileSync(
    'npm',
    ['run', '--silent', script, '-w', 'server', '--', ...args],
    {
      cwd: repoRoot,
      env: { ...process.env, ...TEST_SERVER_ENV },
      encoding: 'utf8',
    },
  );
}

/** Makes an admin with `create-admin` and returns the temporary password it prints once. */
export function createAdminWithCli(name: string, username: string): string {
  const output = runServerCommand('create-admin', [
    '--name',
    name,
    '--username',
    username,
  ]);
  const match = output.match(/Temporary password \(shown once\): (\S+)/);
  if (!match?.[1])
    throw new Error(`create-admin printed no password:\n${output}`);
  return match[1];
}
