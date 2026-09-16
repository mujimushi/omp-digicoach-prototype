#!/usr/bin/env bash
# Searches the code for the anti-patterns listed in docs/plan/00-allowed-apis.md. Any match fails.
# Usage: scripts/check-anti-patterns.sh          searches the source
#        scripts/check-anti-patterns.sh --dist   also searches app/dist, after `npm run build`
set -uo pipefail

cd "$(dirname "$0")/.." || exit 2

failed=0

# search <what must not appear> <extended regex> <path>...
# Searches tracked and untracked files, not ignored ones such as node_modules and build output.
search() {
  local label=$1 pattern=$2
  shift 2
  local found
  found=$(git grep --untracked -nIE "$pattern" -- "$@" 2>/dev/null)
  if [ -n "$found" ]; then
    echo "FAIL  $label"
    echo "$found" | sed 's/^/      /'
    failed=1
  else
    echo "ok    $label"
  fi
}

search 'autoUpdate, runtimeCaching or injectRegister: null in the PWA config' \
  'autoUpdate|runtimeCaching|injectRegister: *null' app/vite.config.ts
search 'SyncManager, localStorage or sessionStorage in the app' \
  'SyncManager|localStorage|sessionStorage' app/src
# The sync badge may show navigator.onLine; nothing may decide whether to send from it.
search 'navigator.onLine outside the sync badge' \
  'navigator\.onLine' app/src ':!app/src/offline/useSyncStatus.ts'
search 'react-router-dom in the app' 'react-router-dom' app ':!**/package-lock.json'
search 'vitest.workspace outside the plan documents' 'vitest\.workspace' . ':!docs/**' ':!scripts/check-anti-patterns.sh'
if git ls-files --cached --others --exclude-standard | grep -q 'vitest\.workspace'; then
  echo 'FAIL  a vitest.workspace file exists'
  failed=1
else
  echo 'ok    no vitest.workspace file'
fi
search 'MSW 1 handlers (rest.get, rest.post, ctx.json, res(ctx))' \
  'rest\.(get|post|put|patch|delete)\(|ctx\.json|res\(ctx' app e2e
search 'drizzle-kit push, db.query. or defineRelations' \
  'drizzle-kit push|db\.query\.|defineRelations' server package.json '*/package.json'
search 'decorateRequest with an object value' \
  "decorateRequest\('[a-zA-Z]+', *\{" server/src
search 'Drizzle table options as an object' \
  '\((t|table)\) => \(\{' server/src/db
search 'biome check in CI' 'biome check' .github
search 'Clear-Site-Data in the server' 'Clear-Site-Data' server/src
search 'legacy DigitalOcean size slugs' 'basic-xxs|basic-xs|basic-s|professional-' .do
search 'ResponsiveContainer in component tests' 'ResponsiveContainer' '*.test.tsx'
search 'positional useQuery(key, fn)' 'useQuery\( *\[' app/src
search '"recommended": true in biome.json' '"recommended": *true' biome.json
search 'TypeScript run directly in production' \
  'run_command:.*\.ts( |$)|--experimental-strip-types' .do server/package.json

# The web service must not run migrations; only the PRE_DEPLOY job may.
service_run=$(awk '/^services:/{s=1;next} /^[a-z_]+:/{s=0} s && /run_command:/' .do/app.yaml)
if echo "$service_run" | grep -q 'migrat'; then
  echo 'FAIL  migrations in the web service run_command'
  echo "      $service_run"
  failed=1
else
  echo 'ok    no migrations in the web service run_command'
fi

if [ "${1:-}" = '--dist' ]; then
  if [ ! -d app/dist ]; then
    echo 'FAIL  app/dist is missing: run npm run build first'
    failed=1
  else
    found=$(grep -rlE 'msw|memory-repository' app/dist)
    if [ -n "$found" ]; then
      echo 'FAIL  msw or memory-repository in app/dist'
      echo "$found" | sed 's/^/      /'
      failed=1
    else
      echo 'ok    no msw or memory-repository in app/dist'
    fi
  fi
fi

if [ "$failed" -ne 0 ]; then
  echo 'Anti-pattern check failed.'
  exit 1
fi
echo 'Anti-pattern check passed.'
