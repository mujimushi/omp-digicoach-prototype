# Phase 6: Verification gate

**Read first:** `docs/plan/00-allowed-apis.md` (all, especially Anti-patterns), `docs/plan/README.md` (When is a task done?), `docs/plan/api.md`.
**Depends on:** phase 5 (`rc-1`).
**Runs:** in order. Nothing is deployed until this phase passes.
**Size:** 2 days.

## What is this phase for?

It checks the finished code against the documentation it was meant to follow, runs every automated check one last time, and gets the client's approval before anything reaches production.

## What to do

### 1. Anti-pattern script: `scripts/check-anti-patterns.sh`

Turn the anti-pattern table in `00-allowed-apis.md` into searches that fail the script when they find anything, and add the script to CI. At minimum:

| Search (in the folder shown) | Must find |
|---|---|
| `autoUpdate`, `runtimeCaching`, `injectRegister: null` in `app/vite.config.ts` | Nothing |
| `SyncManager`, `localStorage`, `sessionStorage` in `app/src` | Nothing |
| `react-router-dom` in `app`, and `vitest.workspace` anywhere | Nothing |
| `rest.get`, `rest.post`, `ctx.json` in `app` and `e2e` | Nothing |
| `drizzle-kit push`, `db.query.`, `defineRelations` in `server` and `package.json` scripts | Nothing |
| `decorateRequest\('[a-z]+', *\{` in `server/src` | Nothing |
| `biome check` in `.github/` | Nothing |
| `Clear-Site-Data` in `server/src` | Nothing |
| `basic-xxs`, `professional-` in `.do/` | Nothing |
| `ResponsiveContainer` in `*.test.tsx` | Nothing |
| `msw`, `memory-repository` in `app/dist` after a build | Nothing |

### 2. Review against the documentation

For each section of `00-allowed-apis.md`, open the code that uses it and tick it off in the pull request:

- [ ] Fastify: app factory, hooks, not-found handlers, cookie, rate limit, helmet
- [ ] Zod type provider on every route
- [ ] Drizzle: array table options, partial unique index, lower-case username index, migrations through `migrate()` with `migrationsFolder`, SSL through the `ssl` option
- [ ] Passwords and login: Argon2id settings, 15-character minimum, common-password list, cookie flags, session lengths, change-request guard, failed-login delays
- [ ] vite-plugin-pwa: prompt updates, admin chunk excluded, no API caching
- [ ] Dexie: transactions around every save, versioned schema
- [ ] Playwright: device names, clock installed before navigation, no cached browsers in CI
- [ ] DigitalOcean spec: current slugs, `PRE_DEPLOY` migration job, no secrets in the file

### 3. Final automated run

- [ ] CI is green on `main` for `rc-1`, including all end-to-end shards.
- [ ] The nightly run is green three nights in a row.
- [ ] Coverage meets each phase's target: timer 100%; sync, students and reports services at least 85–90%.
- [ ] The migration safety check passes.
- [ ] `npm audit --omit=dev` shows no unresolved high or critical findings.

### 4. Data check

Seed a known dataset, run it through the whole pipeline, and compare:

- [ ] Sessions recorded on phones, then synced, match database rows one for one.
- [ ] Dashboard averages equal the same averages computed directly in SQL.
- [ ] CSV rows equal the database rows, column by column, for 20 sampled sessions.

### 5. Client approval

Walk Prof. Muneeza through the app by screen share or on your laptop: one full doctor session on a phone, then each admin task (add a doctor, reset a password, switch a doctor off, find a student, print a report, download the CSV). Record her approval, and any changes she asks for, in an issue.

- [ ] Approval recorded. Any change she asks for is either done and retested, or agreed as "after launch".

## Done when

Every box above is ticked, `rc-1` (or a later `rc-n` after fixes) is approved, and phase 7 can start once the DigitalOcean account exists.
