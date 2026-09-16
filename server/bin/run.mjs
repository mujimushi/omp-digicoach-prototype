// Runs a server command: compiled JavaScript from dist/ when NODE_ENV=production, the TypeScript
// source otherwise. Production never runs .ts files, because type stripping is only a release
// candidate in Node 22.
import { spawnSync } from 'node:child_process';

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error(
    'Usage: node bin/run.mjs <path under src without .ts> [arguments]',
  );
  process.exit(1);
}

const nodeArgs =
  process.env.NODE_ENV === 'production'
    ? [`dist/${command}.js`]
    : [
        '--env-file-if-exists=.env',
        '--conditions=development',
        `src/${command}.ts`,
      ];

const result = spawnSync(process.execPath, [...nodeArgs, ...args], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
