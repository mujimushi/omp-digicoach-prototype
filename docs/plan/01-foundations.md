# Phase 1: Foundations

**Read first:** `docs/build-plan.md`, `docs/plan/README.md`, `docs/plan/00-allowed-apis.md` (sections Versions; npm workspaces; React, Vite and React Router; Vitest and React Testing Library; Biome; Fastify 5; Drizzle ORM with PostgreSQL; GitHub Actions).
**Depends on:** nothing.
**Runs:** first, in order, by one person.
**Size:** 2–3 days.

## What is this phase for?

It sets up the empty project so every later phase starts from the same folders, tools and checks. It contains no product features.

## What to implement

### 1. Workspaces

The root `package.json` declares npm workspaces `app`, `server`, `shared` and `e2e`, plus `"engines": { "node": "22.x" }`. Add `.nvmrc` with `22`.

Root scripts:

| Script | Runs |
|---|---|
| `dev` | Server and Vite dev server together; Vite forwards `/api` to the server |
| `build` | `shared`, then `app`, then `server` |
| `check` | `typecheck`, `lint`, `test:unit`, `test:server` |
| `typecheck` | `tsc --noEmit` in every workspace |
| `lint` | `biome ci .` |
| `format` | `biome check --write .` |
| `test:unit` | Vitest projects for `shared` and `app` |
| `test:server` | Vitest project for `server` (needs PostgreSQL) |
| `test:e2e` | Playwright in `e2e` |
| `db:up` / `db:down` | Start and stop the local PostgreSQL container |
| `db:migrate`, `db:seed`, `db:reset-test` | Database commands from `server` |

Pin exact versions from `00-allowed-apis.md` (section Versions). Commit `package-lock.json`.

### 2. Shared settings

- `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, ES2022 target, bundler-style module resolution. Each workspace extends it.
- `biome.json` from `npx @biomejs/biome init`, with the recommended rules on and formatting set to 2 spaces and single quotes. Ignore `prototype/`, `dist/`, generated migrations and Playwright reports.
- `.editorconfig` and the existing `.gitignore`, extended with `playwright-report/`, `test-results/`, `blob-report/` and `coverage/`.

### 3. The four workspaces, each with a smoke test

| Workspace | Contents after this phase | Smoke test |
|---|---|---|
| `shared` | `src/index.ts` exporting `APP_NAME` | Vitest: `APP_NAME` is "OMP DigiCoach" |
| `server` | `src/app.ts` with `buildApp()` returning a Fastify instance with `GET /api/health` answering `{ ok: true }` (no database yet); `src/server.ts` that listens on `PORT` | Vitest: `app.inject` on `/api/health` returns 200 |
| `app` | Vite React TypeScript project (`npm create vite@latest app -- --template react-ts`), React Router with one route showing "OMP DigiCoach" | Vitest with jsdom and React Testing Library: the heading renders |
| `e2e` | `playwright.config.ts` with projects `phone-chromium` (`devices['Pixel 7']`), `phone-webkit` (`devices['iPhone 14']`) and `desktop-chromium`, and a `webServer` that builds and starts the server | Playwright: the home page shows "OMP DigiCoach" in all three projects |

The server serves `app/dist` in production mode, following the `@fastify/static` single-page-app pattern in `00-allowed-apis.md`. Deep links like `/history` return `index.html`; unknown `/api` paths return a JSON 404.

### 4. Local database

`docker-compose.yml` runs PostgreSQL 16 on port 5432 with a named volume. `server/.env.example` lists `DATABASE_URL`, `PORT`, `NODE_ENV` and `SESSION_COOKIE_NAME`. Copy it to `.env`, which Git ignores. `server/src/config.ts` reads the environment through a Zod schema and stops the server with a clear message when a value is missing.

### 5. Continuous integration: `.github/workflows/ci.yml`

On every push and pull request:

1. `actions/checkout`, then `actions/setup-node` with `node-version-file: .nvmrc` and `cache: npm`.
2. `npm ci`.
3. `npm run typecheck` and `npm run lint`.
4. `npm run test:unit`.
5. `npm run test:server`, with a `postgres` service container (health check `pg_isready`, port 5432).
6. `npm run build`.
7. `npx playwright install --with-deps`, then `npm run test:e2e`.
8. Upload `playwright-report/` with `actions/upload-artifact`, even when tests fail.

Use the action major versions listed in `00-allowed-apis.md`, not the older ones in Playwright's example files.

### 6. Pull request template: `.github/pull_request_template.md`

Sections: what changed, the phase and task, the checklist copied from the phase file, test evidence, screenshots for screen changes.

## Tests to write

The four smoke tests above, plus one server test proving an unknown `/api/nope` returns a JSON 404 and `/history` returns HTML.

## Verification checklist

- [ ] On a clean clone: `npm ci`, `npm run db:up`, `npm run check` and `npm run test:e2e` all pass.
- [ ] `npm run dev` opens the app at the Vite address, and `/api/health` answers through the Vite forward.
- [ ] The CI run on GitHub is green, and the Playwright report is attached.
- [ ] `git status` is clean after a build and a test run; nothing generated is committed.

## Anti-pattern guards

- No `vitest.workspace.ts` file: use `test.projects` in the root Vitest config.
- No `react-router-dom` import: React Router 8 uses `react-router` and `react-router/dom`.
- No `biome check` in CI, because it can rewrite files: CI runs `biome ci`.
- No `app.listen()` in tests: use `app.inject()`.
- Don't cache Playwright browsers in CI.
- No product code, tables or screens in this phase.

## Done when

The checklist is complete and `main` carries the tag `foundations-v1`.
