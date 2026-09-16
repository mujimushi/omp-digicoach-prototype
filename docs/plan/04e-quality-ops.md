# Phase 4E: Quality and deploy prep

**Read first:** `docs/plan/README.md` (How do we test?), `docs/plan/01-foundations.md` (CI), `docs/plan/00-allowed-apis.md` (sections GitHub Actions; Playwright; DigitalOcean App Platform and Managed PostgreSQL).
**Depends on:** phases 1 and 2. The end-to-end helpers need phase 3.
**Runs:** alongside 4A–4D, in the gaps between reviews.
**Owns:** `.github/`, `.do/`, `e2e/support/`, `scripts/`, `docs/runbooks/`.
**Size:** 3–4 days.

## What to implement

### 1. CI jobs: `.github/workflows/ci.yml`

| Job | Does | Needs |
|---|---|---|
| `static` | `npm run typecheck`, `npm run lint` | none |
| `unit` | `npm run test:unit` with coverage | none |
| `server` | `npm run test:server` with the `postgres:16` service | none |
| `build` | `npm run build`, bundle budget check, uploads the build | none |
| `e2e` | Playwright in two shards (`--shard=1/2`, `2/2`), blob reports named per shard | `build` |
| `e2e-report` | Merges the blob reports into one HTML report and uploads it | `e2e` |

Cancel older runs on the same branch when a new push arrives. If the GitHub plan offers branch protection for private repositories, require `static`, `unit`, `server`, `build` and `e2e-report` on `main`. If it doesn't, the rule still holds by habit: a red pull request is never merged.

### 2. Nightly workflow: `.github/workflows/nightly.yml`

It runs on a schedule and on demand:

- The full Playwright suite on all projects.
- The migration safety check below.
- `npm audit --omit=dev --audit-level=high`, failing on any high or critical finding.

### 3. End-to-end support: `e2e/support/`

- An `npm run start:test` script builds the app, resets the `omp_e2e` database with `db:reset-test`, and starts the server in test mode.
- `auth.setup.ts` logs in the seeded admin and two seeded doctors, whose passwords are already changed, and saves three storage-state files.
- `fixtures.ts` provides `adminPage`, `doctorPage` and `secondDoctorPage`, and resets the database before each test file by running the command-line reset, never through an HTTP route.
- `helpers/layout.ts`:
  - `expectChipsStable(page, names)` records each chip's width, taps each chip, waits 350 ms for the chip animation, and checks that no width changed.
  - `expectTextBoxesNotClipped(page)` checks that every sentence-starter box's right edge is within its row.
- `helpers/axe.ts` provides `expectNoSeriousA11yIssues(page)`.
- `helpers/db.ts` holds read-only queries for checking results, such as session counts.

### 4. Migration safety check: `scripts/check-migrations.ts`

1. Check out the latest `release-*` tag into a temporary folder, migrate a fresh database and seed it.
2. Run the current branch's migrations on that database.
3. Check that the migrations succeed, row counts are unchanged, and the previous release's server still answers `/api/health` and one push and pull against the migrated database.

This enforces the **expand-then-contract rule**: a migration never breaks the version already running. Add columns as nullable or with defaults, fill them, switch the code, and drop old columns in a later release.

### 5. Bundle budget: `scripts/check-bundle.ts`

After `npm run build`:

- The doctor entry's JavaScript and CSS together stay under 250 KB gzipped.
- The admin chunk exists and the doctor entry doesn't load it.
- `app/dist` contains no `msw` or `memory-repository` code.

### 6. DigitalOcean app spec draft: `.do/app.yaml`

- **Service `web`:** GitHub repo `sadiash/omp-digicoach`, branch `main`, `deploy_on_push: true`, `source_dir: /`, `build_command: npm ci && npm run build`, `run_command: npm run start -w server`, `http_port: 8080`, `environment_slug: node-js`, `instance_size_slug: apps-s-1vcpu-1gb`, `instance_count: 1`, health check on `/api/health`.
- **Job `migrate`:** `kind: PRE_DEPLOY`, the same build command, `run_command: npm run db:migrate -w server`.
- **Database `db`:** `engine: PG`, `production: true`, `cluster_name` left as a placeholder until phase 7.
- **Environment:** `NODE_ENV=production`, `PORT=8080`, `DATABASE_URL=${db.DATABASE_URL}`, `DATABASE_CA_CERT=${db.CA_CERT}`, all at run time. No secret values in the file.

Validate it with `doctl apps spec validate --schema-only .do/app.yaml`. If that needs a DigitalOcean login, note it and validate in phase 7.

### 7. Runbooks: `docs/runbooks/`

| File | Covers |
|---|---|
| `deploy.md` | What a push to `main` does, what the migrate job does, where to watch progress, the smoke test afterwards |
| `rollback.md` | Redeploying the previous deployment in App Platform, and why the expand-then-contract rule makes that safe |
| `restore-backup.md` | Forking the database from a backup, pointing a local server at the fork read-only, checking counts, deleting the fork |
| `create-admin.md` | Running `create-admin` against production |
| `reset-password.md` | The admin screen, and the command-line fallback |
| `incident.md` | Who to call, where the logs are, how to switch the app off |

## Tests to write

- Push a deliberately failing unit test on a scratch branch once, to confirm the pull request turns red, then delete the branch.
- The layout helpers fail on a test page whose chip grows when tapped.
- The bundle budget script, run on a small fake `dist`, fails when the budget is exceeded and when `msw` appears.
- The migration safety check fails on a scratch migration that drops a column the previous release uses.

## Verification checklist

- [ ] A pull request shows the `static`, `unit`, `server`, `build`, `e2e` and `e2e-report` checks, and the merged HTML report is attached.
- [ ] The nightly workflow has run green once, started by hand.
- [ ] The budget, mock-code and migration checks have each failed on purpose once, and pass normally.
- [ ] `.do/app.yaml` validates, or its validation is recorded as waiting for phase 7.
- [ ] Sadia has reviewed the runbooks.

## Anti-pattern guards

- Caching Playwright browsers; reusing one artifact name across shards; action versions older than those in `00-allowed-apis.md`.
- Migrations in `run_command`; a development database in the app spec; legacy size slugs.
- Secrets in `.do/app.yaml` or in workflow files.
- End-to-end tests resetting the database through an HTTP route.

## Done when

The checklist is complete, and phase 5 can run every test with one command, locally and in CI.
