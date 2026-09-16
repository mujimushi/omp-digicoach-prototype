# Build progress

Branch `build-v1`, one pull request into `main` at the end. Each phase's last commit carries its tag.

## Resume here

**Next: phase 4A, Doctor API** (`docs/plan/04a-doctor-api.md`). Phases 2 and 3 are done and tagged. The run paused after phase 3 at Sadia's request, so a new session can continue. The optional stop after phase 2 was skipped: Sadia asked for no review stops.

Where things are, for the next session:

- **Change numbers:** `nextChangeSeq(tx)` in `server/src/db/change-seq.ts`. Insert helpers for seeding and tests are in `server/src/db/records.ts`.
- **Login checks:** `requireLogin`, `requireDoctor` and `requireAdmin` in `server/src/plugins/auth.ts`. `request.user` is the full user row, so convert it with `toPublicUser()` before sending. Register new route plugins inside the `/api` plugin in `server/src/app.ts`.
- **Errors:** `sendError(reply, status, code, message)` in `server/src/plugins/errors.ts`. The error handler turns Zod failures into 400 `validation_failed`.
- **Server test helpers** (`server/test/helpers/`): `useTestDatabase()`, `resetDb(db)`, `useTestApp(db, () => options)`, `createUser(db, overrides)`, `loginAs(app, user)`, `APP_HEADERS`. Test files run one at a time on `omp_test`.
- **App:** `useRepository()` from `app/src/data/RepositoryProvider.tsx`, whose `createAppRepository(userId)` still returns the memory repository. `useUser()` and `useAuth()` from `app/src/auth/AuthProvider.tsx`. UI parts are in `app/src/ui/`; text colours that pass WCAG AA are `ds.txMuted`, `ds.priText`, `ds.goldText`, `ds.tealText`, `ds.greenText`, `ds.redText`.
- **End-to-end:** `npm run start:test` builds, resets `omp_e2e` and starts the server in test mode. `e2e/support/env.ts` holds the test server's environment; `e2e/support/cli.ts` runs server commands against `omp_e2e`.
- **This Mac:** start every shell command with `eval "$(fnm env)" && fnm use 22`. PostgreSQL on 5434 (`npm run db:up`), server on 3000, Vite on 5180. Run `npx biome check --write .` before committing.
- **Git:** commits authored by Sadia with no Co-Authored-By line; push only `build-v1` and tags to `origin`.

| Phase | Status | Tag |
|---|---|---|
| 1 Foundations | Done (merged earlier) | `foundations-v1` |
| 2 Contracts | Done | `contracts-v1` |
| 3 Login and app shell | Done | `shell-v1` |
| 4A Doctor API | Not started | |
| 4B Doctor screens | Not started | |
| 4C Offline and sync | Not started | |
| 4D Admin dashboard | Not started | |
| 4E Quality and deploy prep | Not started | |
| 5 Integration and hardening | Not started | |
| 6 Verification gate | Not started | |

## Phase 2: Contracts

### Checklist

- [x] `npm run check` passes: 202 unit tests (4 skipped: routes with no request to refuse) and 19 server tests.
- [x] On an empty local database, `npm run db:migrate` then `npm run db:seed` finish, with 12 doctors, 60 students and 400 sessions.
- [x] Every `/api/` path in the phase files appears in `api.md`. The search also finds `/api/client.ts`, `/api/typescript.html` and `/api/nope`: a file path, a Node docs page and a test path, not routes.
- [x] The repository contract suite passes against the memory repository.
- [ ] Sadia has reviewed the contracts. **Needs a person.** `contracts-v1` is on `build-v1`, not `main`, until the pull request merges.

### Anti-pattern checks

- `grep -rn "Needs improvement" app/src server/src`: nothing.
- `app/` imports from `server/`: nothing.
- `drizzle-kit push` in scripts, code or workflows: nothing. Tables come from `drizzle-kit generate`.
- Only `users.id` has a database default; students, sessions and pearls take the phone's ID.
- No per-prompt stars: `SessionStep` has one `rating`.

### Choices the plan didn't make

- **Push body is `{ items: [...] }`**, not a bare array.
- **`users.department` and `designation` allow null**, because `create-admin` takes only a name and username. `DoctorInput` requires both when `isDoctor` is true.
- **Step 3 template labels** are the prototype's five blanks: "One important thing to remember is", "In patients with", "always check", "First-line treatment is usually", "Red flag", with short labels for pearls.
- **Step 4 tags are stored as their labels**, such as "Good history", so the CSV reads without a lookup.
- **`ErrorCode` adds `internal_error`** for unexpected server failures; `api.md` lists no code for a 500.
- **A pearl upsert ignores `timesUsed`, `updatedAt` and `deleted` from the phone.** The server sets `updated_at`; only `pearl.use` changes the count and only `pearl.delete` deletes. The payload stays `Pearl`, as `api.md` says.
- **A repeated `opId` whose stored result was `rejected`** returns that rejection again, not `duplicate`, so the phone moves it to "needs attention" instead of deleting it. `unknown_student` is never stored, so the phone can retry it.
- **`SessionDraft`** holds the timer, stage (`steps` or `log`), five ratings, the five steps' content, the quick log and `savedAtMs`. The session's start time comes from `timer.startedAtMs`.
- **`teaching_sessions` also checks the year rule** (`learner_year` only for medical students), matching `students`.
- **`change_counter`'s row** is inserted by a second, custom migration made with `drizzle-kit generate --custom`.
- **Seeded logins**: every seeded account uses the password `ward round teaching practice`. `db:seed` makes `dr.ayesha` (doctor and admin) and `dr.bilal` (doctor); two seeded doctors still must change their password. `db:reset-test` makes `admin`, `doctor.one` and `doctor.two`, and keeps those users' login sessions across resets so Playwright's saved logins stay valid.
- **`db:reset-test` refuses** unless `NODE_ENV=test` and the database name ends in `_e2e` or `_test`.
- **Server tests** use a database named `omp_test`, dropped and migrated once per run; the migration test uses `omp_migrations_test`.
- **`db:migrate` runs compiled JavaScript when `NODE_ENV=production`** and the TypeScript source otherwise, so production never runs `.ts` files.
- **MSW handlers** for routes with no body or query (`/api/health`, `/api/me`, overview, doctor list) have nothing to refuse, so their tests check only the response shape.

- CI run on `contracts-v1`: https://github.com/sadiash/omp-digicoach/actions/runs/35149971830 (green).

## Phase 3: Login and app shell

### Checklist

- [x] `npm run check` passes locally: 246 unit and component tests (4 skipped), 84 server tests. The meeting test passes locally on phone Chromium, phone WebKit and desktop Chromium. CI result is recorded with the next phase.
- [x] `grep -rn "localStorage\|sessionStorage" app/src/auth app/src/api` finds nothing.
- [x] `grep -rn "password" server/src --include=*.ts | grep -i "log\."` finds nothing.
- [x] The login response in production config sets `__Host-omp_session` with `Secure`, `HttpOnly`, `SameSite=Strict` and `Path=/` (server test `the login cookie in production`).
- [x] `npm run build -w app` produces `dist/assets/admin-<hash>.js`, separate from the doctor entry.

### Anti-pattern checks

- Login token readable by JavaScript: no. The cookie is `HttpOnly`; the app never stores the token.
- Different messages or timing for unknown users and wrong passwords: no. One 401 body; an unknown username verifies against a dummy Argon2id hash (tested with a spy).
- Composition rules or periodic expiry: none.
- `decorateRequest` with an object value: none; `decorateRequest('user')` has no value.
- Permissions only in app guards: no. Every route checks on the server.
- Lanes adding their own login checks: not applicable yet; lanes use `requireDoctor` and `requireAdmin`.

### Choices the plan didn't make

- **An account that is both doctor and admin follows the admin's login lengths** (30 minutes idle, 8 hours at most), including on the phone. The plan gives each role's length but not the combined case. **Sadia should confirm this**, because it means Prof. Muneeza logs in again on her phone after 30 minutes. Phone data waits safely meanwhile.
- **A switched-off account** gets 401 `not_logged_in` with the message "This account has been switched off. Ask the admin." The code stays as `api.md` says; the message lets the app explain.
- **A locked username gets 429 even with the right password.** Failed attempts during a lock don't add to the count. A wrong current password on the password-change screen doesn't count towards the lock.
- **Common passwords:** SecLists' 10,000 most common passwords (MIT licence), matched ignoring case, also with leading or trailing digits and symbols removed, so "password1234567" is refused. Passwords of only one or two distinct characters are refused too. "Contains the app name" means contains `digicoach`.
- **`create-admin`** makes an admin who doesn't teach. `--doctor --department <key> --designation <key>` makes an admin who also teaches. It writes `audit_log` with no actor.
- **`server/bin/run.mjs`** runs `db:migrate` and `create-admin` from `dist/` when `NODE_ENV=production` and from source otherwise.
- **`LOGIN_RATE_LIMIT_MAX`** raises the per-IP login limit for end-to-end tests. The server refuses to start in production with it set.
- **Production trusts the proxy** (`trustProxy`), so the per-IP login limit sees each phone's address behind DigitalOcean's load balancer. Phase 7 should confirm the address it sees.
- **`upgrade-insecure-requests` is left out of the CSP outside production**, because Safari then fails to load http://localhost.
- **`last_seen_at`** is written at most once a minute.
- **Logout** answers 204 even without a login.
- **Every change request sends a JSON body**, `{}` when there is nothing to send, because Fastify refuses an empty body labelled JSON.
- **Colours:** the prototype's light text and white-on-pastel chips fail WCAG AA contrast, which axe reports as serious. `ds` keeps the prototype colours for icons and borders and adds darker shades for text and chip fills.
- **Inputs use 16 px text**, not the prototype's 14 px, so iPhones don't zoom when a field is tapped.
- **`SearchSelect`** is a search box above a list of buttons, not an ARIA combobox; Biome's accessibility rules refuse the combobox roles on list elements. Chip groups and the star control use `fieldset` and a hidden `legend`.
- **Login screen:** "Forgot your password? Ask the admin to reset it." replaces the prototype's "Forgot password?" and "Sign Up" links, which have no purpose here.
- **`buildApp()` takes `extraApiRoutes`**, used only by server tests to reach `requireDoctor` and `requireAdmin` before lanes 4A and 4D add real routes.
- **The dashboard** loads through one lazy route, `/admin/*`, whose module `app/src/admin/admin.tsx` holds nested `<Routes>`. React Router's `lazy` can't add child routes, and the file name gives the chunk its `admin-` name.

## Versions

Every package added so far matches the major in `00-allowed-apis.md`: drizzle-orm 0.45.2, drizzle-kit 0.31.10, pg 8.23.0, @types/pg 8.23.1, @node-rs/argon2 2.2.1, msw 2.15.0, zod 4.6.5, @fastify/cookie 11.1.2, @fastify/rate-limit 11.2.0, @fastify/helmet 13.1.1, fastify-type-provider-zod 7.0.0, @testing-library/user-event 14.6.7.

`lucide-react` 1.46.0 wasn't listed. Phase 3 read its documentation and added it to `00-allowed-apis.md`.

## Needs a person

- Sadia's review of the contracts (phase 2).
- Sadia's decision on login length for an account that is both doctor and admin (phase 3).
