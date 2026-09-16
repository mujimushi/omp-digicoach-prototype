# Build progress

Branch `build-v1`, one pull request into `main` at the end. Each phase's last commit carries its tag.

## Resume here

**Next: phase 4D, Admin dashboard** (`docs/plan/04d-admin-dashboard.md`), then the rest of 4E, 5 and 6. Phases 2, 3, 4A, 4B and 4C are done; 4E's end-to-end support is done. The optional stop after phase 2 was skipped: Sadia asked for no review stops.

Where things are, for the next session:

- **Change numbers:** `nextChangeSeq(tx)` in `server/src/db/change-seq.ts`; call `lockChangeCounter(tx)` first in a writing transaction. Insert helpers for seeding and tests are in `server/src/db/records.ts`.
- **Sync:** `server/src/services/sync/push.ts` and `pull.ts`; student updates with audit go through `updateStudentRecord()` in `server/src/services/students/upsert.ts`, which the admin's correction should reuse. `toStudent`, `toTeachingSession` and `toPearl` in `pull.ts` turn rows into shared shapes.
- **Login checks:** `requireLogin`, `requireDoctor` and `requireAdmin` in `server/src/plugins/auth.ts`. `request.user` is the full user row, so convert it with `toPublicUser()` before sending. Register new route plugins inside the `/api` plugin in `server/src/app.ts`.
- **Errors:** `sendError(reply, status, code, message)` in `server/src/plugins/errors.ts`. The error handler turns Zod failures into 400 `validation_failed`.
- **Server test helpers** (`server/test/helpers/`): `useTestDatabase()`, `resetDb(db)`, `useTestApp(db, () => options)`, `createUser(db, overrides)`, `loginAs(app, user)`, `APP_HEADERS`. Test files run one at a time on `omp_test`.
- **App:** `useRepository()` from `app/src/data/RepositoryProvider.tsx`, whose `createAppRepository()` returns the Dexie repository (`app/src/offline/`); the memory repository is used only in tests. Screens load through `useRepositoryQuery()` (`app/src/doctor/useRepositoryQuery.ts`), which reloads when the provider's `notifyChanged()` runs; the sync engine should call it after a pull. Doctor screens are in `app/src/doctor/`, their routes in `app/src/doctor/routes.tsx`. Component tests render screens with `renderDoctorApp()` from `app/src/test/doctor-app.tsx`. `useUser()` and `useAuth()` from `app/src/auth/AuthProvider.tsx`. UI parts are in `app/src/ui/`; text colours that pass WCAG AA are `ds.txMuted`, `ds.priText`, `ds.goldText`, `ds.tealText`, `ds.greenText`, `ds.redText`.
- **Offline:** `getPhoneDb()` in `app/src/offline/db.ts`; the sync engine in `sync.ts` runs inside `SyncProvider` in the doctor layout; `phone-auth.ts` keeps the last user and blocks a second user while items wait. `server/test/integration/phone-sync.test.ts` runs the engine against the real routes and has its own tsconfig with the DOM library.
- **End-to-end:** `npm run start:test` builds, resets `omp_e2e` and starts the server in test mode. `e2e/support/fixtures.ts` gives `doctorPage`, `secondDoctorPage` and `adminPage` and resets the database before each file; `e2e/support/helpers/` holds `db.ts`, `axe.ts`, `layout.ts` and `doctor.ts`. Run with `npm run test:e2e`, which sets `NODE_OPTIONS=--conditions=development` so Playwright reads `@omp/shared` source.
- **This Mac:** start every shell command with `eval "$(fnm env)" && fnm use 22`. PostgreSQL on 5434 (`npm run db:up`), server on 3000, Vite on 5180. Run `npx biome check --write .` before committing.
- **Git:** commits authored by Sadia with no Co-Authored-By line; push only `build-v1` and tags to `origin`.

| Phase | Status | Tag |
|---|---|---|
| 1 Foundations | Done (merged earlier) | `foundations-v1` |
| 2 Contracts | Done | `contracts-v1` |
| 3 Login and app shell | Done | `shell-v1` |
| 4A Doctor API | Done | `phase-4a-v1` |
| 4B Doctor screens | Done | `phase-4b-v1` |
| 4C Offline and sync | Done | `phase-4c-v1` |
| 4D Admin dashboard | Not started | |
| 4E Quality and deploy prep | In progress: end-to-end support done | |
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

- CI run on `shell-v1`: https://github.com/sadiash/omp-digicoach/actions/runs/35152066983 (green, including the meeting test on all three Playwright projects).

## Phase 4A: Doctor API

### Checklist

- [x] `npm run test:server` passes: 130 tests. Line coverage is 100% in `server/src/services/sync/` (push, pull, results) and `server/src/services/students/`.
- [x] `grep -rn "doctorId" shared/src/schemas/sync.ts` finds nothing.
- [x] The `change_seq` writer search finds no writer other than `nextChangeSeq`.
- [x] `grep -rn "db\.query\.\|defineRelations" server/src` finds nothing.
- [x] `api.md` is unchanged since `foundations-v1`.
- Lane 4C's sync engine against these routes: checked in phase 4C.

Speed on the local database: a push of 50 sessions and a first pull of 500 students and 2,000 sessions both pass their limits (2 s and 1 s) in the tests.

### Anti-pattern checks

- Doctor ID from the phone: no. `session.create` uses the login; a `doctorId` field fails the strict schema (tested).
- One transaction for the whole batch, or items out of order: no. Each item has its own transaction, in order (tested).
- Changes read by clock time or a plain sequence: no. Pull reads `change_counter` first (late-commit test).
- An empty `.returning()` after `onConflictDoNothing` treated as an insert: no. It loads the existing session and answers `duplicate` or `forbidden`.
- Drizzle 1.0 release-candidate APIs or object-style table options: none.
- Logging request bodies: no. The log test checks that no student name or PMDC number appears.

### Choices the plan didn't make

- **Every item transaction locks the change counter first** (`lockChangeCounter`), before touching other rows, so two pushes can't deadlock on each other's rows.
- **A push item that collides with the same item from another request** (unique violation or deadlock) is retried once in a new transaction, which then finds the stored result.
- **An opId recorded by another user** is refused with `forbidden` and its stored result isn't shown.
- **`pearl.delete` and `pearl.use` of an unknown pearl answer `duplicate`**: there is nothing to change.
- **`pearl.upsert` doesn't undelete a deleted pearl**; it changes only the diagnosis and points.
- **`pearl.use` doesn't change `updated_at`**, so the pearl's time reflects its last edit.
- **A student update through an alias ID** answers with `mappedStudentId` set to the real student, so a phone that missed the first mapping still learns it.
- **The cursor is the counter value as a decimal string**; anything else, including leading zeros, is `bad_cursor`.
- **Sessions the admin deletes stay on the doctor's phone**: pull has no way to send a deletion, and the plan adds none.

- CI run on `phase-4a-v1`: https://github.com/sadiash/omp-digicoach/actions/runs/35152803133 (green).

## Phase 4B: Doctor screens

### Checklist

- [x] All tests pass: 287 unit and component tests; Playwright E2E-B1 to E2E-B4 pass on phone Chromium and phone WebKit. `app/src/doctor/timer/timer.ts` has 100% line, branch and function coverage.
- [x] `grep -rn "setInterval\|setTimeout" app/src/doctor/timer/timer.ts` finds nothing. The 250 ms refresh lives in `useNow.ts` and only redraws.
- [x] `grep -rln "dexie\|indexedDB\|fetch(" app/src/doctor` finds nothing.
- [ ] Screenshots of each screen at 390 px on both phone projects, next to the prototype's. `e2e/tests/doctor/screenshots.spec.ts` attaches 15 screenshots per phone project to the Playwright report, which CI uploads. **Needs a person** to put them beside the prototype's in the pull request.

### Anti-pattern checks

- Counting ticks: no. Every reading subtracts timestamps passed in as `now`.
- Moving on or closing at zero: no. E2E-B2 checks the step is unchanged at `+0:15`.
- A star beside each prompt: no. One `RatingStars` per step (component test counts one group).
- Screens calling `fetch` or Dexie: none (search above).
- Another doctor's sessions or ratings: the memory repository filters by doctor; the progress component test checks it.
- "Saved" before the repository confirms: the toast appears after `completeSession` resolves; a component test checks that a failed save shows no confirmation.

### Choices the plan didn't make

- **Tab bar hidden** on `/session`, `/session/setup` and `/session/log`, as in the prototype.
- **Leaving a session** keeps the draft; the student list then shows "Session in progress" with Resume and Discard. Starting another session while a draft exists asks first.
- **The resume prompt** ignores Escape, so a stray key never discards a session. Its question uses the time the session started.
- **Timer display** counts down in whole seconds rounded up, so `0:00` means the minute is spent; extra time rounds down. The ring turns coral in extra time; the text uses a darker amber that passes contrast checks. The compact ring appears on screens under 760 px tall.
- **Stored times are capped at six hours**, so a session left open for days still saves.
- **Step 1's Back button is disabled** instead of the prototype's Skip, which did the same as Next.
- **Saving a pearl needs the learner's answer from Step 1 and at least one point.** The prototype saved "General" when the answer was empty.
- **Case type has no default**; Start waits until one is chosen. The department starts from the doctor's profile.
- **Year is optional** for medical students.
- **Usefulness and "learner gave the diagnosis" can be cleared** by tapping the chosen answer again.
- **History groups by the phone's calendar day.** Stats count "this week" from Monday in the phone's time zone, and show sessions per weekday over all sessions.
- **Student progress** is a table of ratings per step per session, not a chart, to keep the doctor app small and readable by screen readers.
- **Draft saving**: 300 ms after each change, every 5 seconds, and when the page is hidden.
- **App version** comes from `app/package.json`, now 1.0.0, through Vite's `define`.
- **E2E-B1 to B4 run on the default build**: the memory repository is the default until 4C, so no `VITE_REPOSITORY=memory` switch was added. The memory repository holds the known students from `@omp/shared/fixtures` for these tests; 4C removes it from the app build.

- CI run on `phase-4b-v1`: https://github.com/sadiash/omp-digicoach/actions/runs/35154411711 (green).

## Phase 4C: Offline and sync

### Checklist

- [x] The repository contract suite passes on the Dexie repository (`app/src/offline/dexie-repository.test.ts`, on fake-indexeddb with a fresh `IDBFactory` per test).
- [x] All unit and component tests pass: 348 unit and component tests. Line coverage of `app/src/offline/sync.ts` is 95.9%.
- [x] E2E-C1 to E2E-C4 pass on phone Chromium; E2E-C3 also on phone WebKit.
- [x] `grep -n "autoUpdate\|runtimeCaching\|injectRegister: null" app/vite.config.ts` finds nothing.
- [x] `grep -rn "SyncManager\|localStorage" app/src/offline` finds nothing.
- [x] After `npm run build -w app`, no `admin-*.js` name appears in `app/dist/sw.js`.
- [ ] Real-phone checks: iPhone Add to Home Screen, airplane mode, record, reopen next day with signal; Android install and the same steps. **Needs a person.**
- Server integration: `server/test/integration/phone-sync.test.ts` saves a student and a session while the server is down, syncs against the real routes, and finds one student, one session and five steps after two syncs.

### Anti-pattern checks

- `registerType: 'autoUpdate'`: no, `prompt`.
- Workbox runtime caching for `/api`: none; E2E-C4 checks that offline API requests fail rather than answer.
- Background Sync API: not used; the engine runs at start, on `online`, on visibility, 2 s after a save and every 60 s.
- `localStorage` for the outbox or drafts: no; the install guide's dismissal is stored in Dexie too.
- Deciding to send from `navigator.onLine`: no; it only colours the badge.
- Deleting an outbox item before the server confirms it: no; unit tests cover applied, duplicate, kept and refused items.
- Clearing phone data at logout without warning while items wait: no; the More screen asks first (component test).
- Relying on `navigateFallbackDenylist` alone to keep admin code off phones: no; `globIgnores` excludes `admin-*.js` (checked in `sw.js`).

### Choices the plan didn't make

- **The precache ignores `manifest.webmanifest`**, because the plugin adds it too and Workbox otherwise refuses to install. Recorded in `00-allowed-apis.md`.
- **Icons are generated at build time** through `pwaAssets` and `app/pwa-assets.config.ts`, so no generated PNGs are committed.
- **The app opens offline with the last user on the phone**, stored in Dexie's `meta` table (`user`, `userId`). The first login still needs a connection.
- **A sync that gets 401** shows a banner with the server's message (for a switched-off account: "This account has been switched off. Ask the admin.") and a Log in button, instead of leaving the screen, so a session in progress isn't interrupted. Nothing on the phone is deleted.
- **A second user is blocked** twice: before contacting the server when the typed username differs from the phone's last user and items wait, and after login by ID, which also ends the new login on the server. With nothing waiting, the phone is emptied for the new user.
- **Logout deletes the Dexie database** in every case, after asking when items wait. An admin who logs out on a desktop also clears that browser's phone database, which holds nothing of theirs.
- **Pulls don't overwrite a student or pearl** that still has an item waiting in the outbox; the next pull after it sends brings the server's version.
- **A cursor the server refuses** (`bad_cursor`) starts a full pull from an empty cursor.
- **Pulled aliases also remap a local student** whose ID matches, for a phone that never heard the push answer.
- **Retries** follow 5 s, 15 s, 60 s and then 5 minutes after a network error, a 5xx or an unexpected error.
- **The update prompt** assumes a draft exists until IndexedDB answers, so it never interrupts a session while loading.
- **The install guide** shows on the student list (dismissible for 7 days) and on the More screen (always, until installed). It shows nothing on desktops.
- **`navigator.storage.persist()`** runs when the doctor layout opens in the installed app.
- **Every phone database write that stores a record also queues it** in the same Dexie transaction; a failing outbox write rolls the record back (tested with a repeated opId).

## Phase 4E: Quality and deploy prep (in progress)

Done so far: `e2e/support/` with `auth.setup.ts` (saves the admin's and two doctors' logins), `fixtures.ts` (`adminPage`, `doctorPage`, `secondDoctorPage`, database reset before each file through the command line), and `helpers/` (`layout.ts` with `expectChipsStable` and `expectTextBoxesNotClipped`, `axe.ts` with `expectNoSeriousA11yIssues`, `db.ts` with read-only queries). Playwright runs one worker, because test files reset the shared database.

## Versions

Every package added so far matches the major in `00-allowed-apis.md`: drizzle-orm 0.45.2, drizzle-kit 0.31.10, pg 8.23.0, @types/pg 8.23.1, @node-rs/argon2 2.2.1, msw 2.15.0, zod 4.6.5, @fastify/cookie 11.1.2, @fastify/rate-limit 11.2.0, @fastify/helmet 13.1.1, fastify-type-provider-zod 7.0.0, @testing-library/user-event 14.6.7.

@vitest/coverage-v8 5.0.1, @axe-core/playwright 4.13.0, dexie 4.4.6, dexie-react-hooks 4.4.0, fake-indexeddb 6.2.5, vite-plugin-pwa 1.3.0, @vite-pwa/assets-generator 2.0.0.

`lucide-react` 1.46.0 wasn't listed. Phase 3 read its documentation and added it to `00-allowed-apis.md`.

## Needs a person

- Sadia's review of the contracts (phase 2).
- Sadia's decision on login length for an account that is both doctor and admin (phase 3).
- Putting the doctor screen screenshots beside the prototype's in the pull request (phase 4B).
- Real-phone checks on an iPhone and an Android phone: install, airplane mode, a session recorded offline and sent the next day (phase 4C).
