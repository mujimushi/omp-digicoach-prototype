// Migration safety check: a migration must never break the version already running.
//
// 1. Check out the latest release-* tag (or --base <ref>) into a temporary folder, migrate a fresh
//    database with it and seed it.
// 2. Run this branch's migrations on that database.
// 3. Check the migrations succeed, row counts are unchanged, and the previous release's server still
//    answers /api/health and one push and pull.
//
//   node scripts/check-migrations.ts [--base <git ref>] [--keep]
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import pg from 'pg';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const baseUrl =
  process.env.DATABASE_URL ?? 'postgres://omp:omp@localhost:5434/omp';
const PORT = 3190;

/** The row counts the check compares before and after migrating. */
const TABLES = [
  'users',
  'students',
  'student_aliases',
  'teaching_sessions',
  'session_steps',
  'pearls',
  'audit_log',
];

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

function run(
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv },
) {
  console.log(`$ ${command} ${args.join(' ')}   (in ${options.cwd})`);
  execFileSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: 'inherit',
  });
}

export function latestReleaseTag(): string | null {
  const tags = execFileSync(
    'git',
    ['tag', '--list', 'release-*', '--sort=-creatordate'],
    { cwd: repoRoot, encoding: 'utf8' },
  )
    .split('\n')
    .filter(Boolean);
  return tags[0] ?? null;
}

async function withClient<T>(
  url: string,
  work: (client: pg.Client) => Promise<T>,
): Promise<T> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

async function counts(url: string): Promise<Record<string, number>> {
  return withClient(url, async (client) => {
    const result: Record<string, number> = {};
    for (const table of TABLES) {
      const { rows } = await client.query<{ count: string }>(
        `select count(*) from ${table}`,
      );
      result[table] = Number(rows[0]?.count ?? 0);
    }
    return result;
  });
}

async function waitForHealth(url: string, timeoutMs = 30_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`The previous release's server didn't answer ${url}`);
}

/** Logs in as a seeded doctor on the previous release's server and pushes and pulls one session. */
async function pushAndPull(origin: string): Promise<void> {
  const headers = { 'content-type': 'application/json', 'x-omp-client': 'app' };
  const login = await fetch(`${origin}/api/auth/login`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      username: 'dr.bilal',
      password: 'ward round teaching practice',
    }),
  });
  if (!login.ok)
    throw new Error(
      `Login on the previous release failed: ${login.status} ${await login.text()}`,
    );
  const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

  const studentId = randomUUID();
  const sessionId = randomUUID();
  const steps = [1, 2, 3, 4, 5].map((step) => ({
    step,
    seconds: 12,
    rating: 3,
    content:
      step === 1
        ? { learnerAnswer: 'Migration check' }
        : step === 2
          ? { mode: 'quick' }
          : step === 3
            ? { points: ['', '', '', '', ''] }
            : step === 4
              ? { starters: ['', '', ''], tags: [] }
              : { starters: ['', '', ''], actionPlan: '' },
  }));
  const items = [
    {
      opId: randomUUID(),
      type: 'student.upsert',
      payload: {
        id: studentId,
        name: 'Migration Check',
        pmdcNumber: null,
        level: 'resident',
        year: null,
      },
    },
    {
      opId: randomUUID(),
      type: 'session.create',
      payload: {
        id: sessionId,
        studentId,
        department: 'medicine',
        caseType: 'long_case',
        learnerLevel: 'resident',
        learnerYear: null,
        startedAt: new Date().toISOString(),
        teachingSeconds: 60,
        overtimeSeconds: 0,
        pausedSeconds: 0,
        logSeconds: 5,
        diagnosis: 'Migration check',
        learnerGaveDiagnosis: true,
        usefulness: 4,
        appVersion: 'migration-check',
        steps,
      },
    },
  ];
  const push = await fetch(`${origin}/api/sync/push`, {
    method: 'POST',
    headers: { ...headers, cookie },
    body: JSON.stringify({ items }),
  });
  const pushBody = (await push.json()) as { results?: { status: string }[] };
  if (!push.ok || pushBody.results?.some((r) => r.status === 'rejected')) {
    throw new Error(
      `Push on the previous release failed: ${push.status} ${JSON.stringify(pushBody)}`,
    );
  }
  const pull = await fetch(`${origin}/api/sync/pull?cursor=`, {
    headers: { cookie },
  });
  const pullBody = (await pull.json()) as { sessions?: { id: string }[] };
  if (!pull.ok || !pullBody.sessions?.some((s) => s.id === sessionId)) {
    throw new Error(`Pull on the previous release failed: ${pull.status}`);
  }
}

export async function checkMigrations(
  base: string,
  keep = false,
): Promise<void> {
  const folder = mkdtempSync(join(tmpdir(), 'omp-release-'));
  const dbName = 'omp_migration_check_test';
  const dbUrl = withDatabase(baseUrl, dbName);
  const env = { DATABASE_URL: dbUrl, NODE_ENV: 'test', PORT: String(PORT) };
  let server: ChildProcess | undefined;

  try {
    run('git', ['worktree', 'add', '--detach', folder, base], {
      cwd: repoRoot,
    });
    run('npm', ['ci', '--no-audit', '--no-fund'], { cwd: folder });
    run('npm', ['run', 'build', '-w', 'shared'], { cwd: folder });
    run('npm', ['run', 'build', '-w', 'server'], { cwd: folder });

    await withClient(withDatabase(baseUrl, 'postgres'), async (client) => {
      await client.query(`drop database if exists ${dbName} with (force)`);
      await client.query(`create database ${dbName}`);
    });

    run('npm', ['run', 'db:migrate', '-w', 'server'], { cwd: folder, env });
    run('npm', ['run', 'db:seed', '-w', 'server'], { cwd: folder, env });
    const before = await counts(dbUrl);

    run('npm', ['run', 'db:migrate', '-w', 'server'], { cwd: repoRoot, env });
    const after = await counts(dbUrl);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      throw new Error(
        `Row counts changed during migration:\n before ${JSON.stringify(before)}\n after  ${JSON.stringify(after)}`,
      );
    }

    server = spawn('node', ['dist/server.js'], {
      cwd: join(folder, 'server'),
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });
    await waitForHealth(`http://127.0.0.1:${PORT}/api/health`);
    await pushAndPull(`http://127.0.0.1:${PORT}`);
    console.log(
      `Migration check passed: ${base} still works on this branch's migrations. Rows: ${JSON.stringify(after)}`,
    );
  } finally {
    server?.kill('SIGTERM');
    if (!keep) {
      execFileSync('git', ['worktree', 'remove', '--force', folder], {
        cwd: repoRoot,
      });
      rmSync(folder, { recursive: true, force: true });
      await withClient(withDatabase(baseUrl, 'postgres'), (client) =>
        client.query(`drop database if exists ${dbName} with (force)`),
      ).catch(() => undefined);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      base: { type: 'string' },
      keep: { type: 'boolean', default: false },
    },
  });
  const base = values.base ?? latestReleaseTag();
  if (!base) {
    console.log(
      'No release-* tag yet: nothing is deployed, so there is no running version to protect. Skipping.',
    );
    process.exit(0);
  }
  checkMigrations(base, values.keep).catch((error: unknown) => {
    console.error(
      `✗ Migration check failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
}
