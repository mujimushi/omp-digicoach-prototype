# Phase 3: Login and app shell

**Read first:** `docs/build-plan.md`, `docs/plan/README.md`, `docs/plan/api.md` (Login and account), `docs/plan/02-contracts.md`, `docs/plan/00-allowed-apis.md` (sections Fastify 5; Zod type provider; Drizzle ORM with PostgreSQL; Server integration tests with PostgreSQL; Passwords and login; React, Vite and React Router; Vitest and React Testing Library; Playwright), and in `prototype/src/App.jsx`: `ds`, `IconCircle`, `ChipLabel`, `TabBar`, `Login`, `Toast`.
**Depends on:** phase 2 (`contracts-v1`).
**Runs:** in order, as a gate, in two tracks side by side: **3S server** and **3W web app**. The tracks meet at the end for one login test.
**Size:** 5–6 days.

## What is this phase for?

Every lane needs a working login, the server's login checks, the app's routes and layout, and the shared UI parts. Built once here, the four lanes don't each build their own.

## Track 3S: server

**Owns:** `server/src/{app.ts,config.ts,db/client.ts,plugins/,routes/auth/,routes/me/,services/auth/,cli/}`, `server/test/auth/`, `server/test/helpers/`.

1. **App factory.** `buildApp()` registers, in this order: config, database client, `@fastify/helmet` (with `worker-src 'self'` and `manifest-src 'self'` added), `@fastify/cookie`, `@fastify/rate-limit` with `global: false`, the Zod type provider, an error handler that returns `ApiError`, the `/api` plugin with its JSON not-found handler, and static file serving with the page fallback outside `/api`.
2. **Change-request guard.** An `onRequest` hook under `/api` rejects any POST, PATCH or DELETE without `X-OMP-Client: app` and `Content-Type: application/json`, or with an `Origin` from another site, answering 403 `forbidden`.
3. **Login sessions** (`services/auth/sessions.ts`): create a 32-byte token, store its SHA-256 with an expiry (doctor: 30 days from last use, at most 90; admin: 30 minutes from last use, at most 8 hours), find a session by cookie and refresh `last_seen_at`, delete one, and delete all of a user's sessions.
4. **Passwords** (`services/auth/passwords.ts`): `hashPassword` and `verifyPassword` with `@node-rs/argon2` and the settings in `00-allowed-apis.md`; `checkPasswordRules(password, username)` covering length 15–128, the common-password list (stored as `server/src/services/auth/common-passwords.txt`), the app name and the username; `generateTemporaryPassword()`.
5. **Failed-login tracking** (`services/auth/attempts.ts`): the `login_attempts` rules in `00-allowed-apis.md`: after 5 failures, a delay starting at 1 second, doubling up to 15 minutes; cleared by a successful login or an admin reset.
6. **Login checks** (`plugins/auth.ts`): decorate `request.user` with `decorateRequest('user')` and set it in an `onRequest` hook from the cookie. Export the hooks `requireLogin`, `requireDoctor` and `requireAdmin`. The last two also return 403 `password_change_required` while the user must change their password. A switched-off user's cookie gives 401 and deletes their sessions.
7. **Routes:** `POST /api/auth/login` (per-IP rate limit, dummy-hash timing for unknown usernames, one message for every failure), `POST /api/auth/logout`, `GET /api/me`, `POST /api/me/password`, and `GET /api/health` with a database ping.
8. **Cookie settings** in `config.ts`: `__Host-omp_session` with `Secure` in production; `omp_session` without `Secure` otherwise. Startup fails in production if the insecure form is set.
9. **Command-line tools:** `npm run create-admin -w server -- --name "..." --username ...` prints a temporary password once. `npm run db:reset-test` from phase 2.
10. **Test helpers** (`server/test/helpers/`): `buildTestApp()`, `resetDb()`, `createUser({ isDoctor, isAdmin, mustChangePassword, active })`, and `loginAs(user)`, which returns cookies for `inject`.

## Track 3W: web app

**Owns:** `app/src/{main.tsx,router.tsx,layout/,ui/,auth/,api/,data/RepositoryProvider.tsx,offline/useSyncStatus.ts}`, `app/src/styles/`.

1. **Design tokens** (`app/src/styles/tokens.ts`): copy `ds` from the prototype.
2. **UI parts** (`app/src/ui/`), each with a component test: `Button`, `Card`, `IconCircle`, `ChipLabel` (copied from the prototype, including its fixed-width layers), `ChipGroup` for single and multi select, `RatingStars` (five buttons, labels from `RATING_LABELS`, tapping the chosen star again clears it, each star with an accessible name such as "3 stars, Competent"), `TextField`, `SearchSelect`, `Toast`, `TabBar` and `ConfirmDialog`.
3. **API client** (`app/src/api/client.ts`): `fetch` with `credentials: 'same-origin'`, the `X-OMP-Client` and JSON headers on every change request, responses checked against the shared schemas, and `ApiError` raised for error answers. A 401 sends the user to `/login`.
4. **Login** (`app/src/auth/`): `AuthProvider` loads `/api/me`. Screens: `LoginScreen`, copied from the prototype's `Login` without the Full Name field; `ChangePasswordScreen`, which explains the 15-character minimum and suggests a phrase of several words. Route guards send a user who must change their password to the change screen, a doctor to `/`, and an admin without the doctor flag to `/admin`.
5. **Router** (`app/src/router.tsx`): the doctor area at `/` with a placeholder page for each route listed in phase 4B, and the admin area loaded lazily from `/admin` so it builds as its own `admin` chunk. Placeholders show the page name only.
6. **Layouts:** `DoctorLayout`, phone-first with the bottom tab bar; `AdminLayout`, desktop with side navigation.
7. **Repository context** (`app/src/data/RepositoryProvider.tsx`): supplies the phase 2 memory repository for now. The choice is made in one function, `createAppRepository()`.
8. **Sync status stub** (`app/src/offline/useSyncStatus.ts`): returns `{ waiting: 0, needsAttention: 0, lastSyncAt: null, state: 'idle' }` with the final type. Lane 4C replaces the body, not the type.

## Tests to write

**Server (3S)**, Vitest with `inject` and PostgreSQL:

- Login with the right password returns `PublicUser` and a cookie with the expected flags. A wrong password, an unknown username and a switched-off account all return the same 401 body.
- A login with an unknown username still runs one password verification against the dummy hash, checked with a spy, so its timing matches a wrong password. Don't compare response times in CI: they vary too much.
- Six failures lock the username; the lock time doubles with each further failure; a successful login after the lock ends clears it; an admin reset clears it.
- The per-IP limit returns 429 after 20 tries in 15 minutes.
- `/api/me` without a cookie returns 401; with a cookie it returns the user.
- A change request without `X-OMP-Client`, with `Content-Type: text/plain`, or with a foreign `Origin` gets 403.
- Password change: a wrong current password returns 401; a 14-character password, "password1234567" and the username padded to 15 characters return `weak_password`; success issues a new cookie, invalidates the user's other sessions, and clears `must_change_password`.
- Expiry: a doctor session unused for 31 days is refused; an admin session unused for 31 minutes is refused; an admin session older than 8 hours is refused even when used recently. Move time forward by changing the stored timestamps.
- Logout deletes the session row, so the old cookie then gets 401.
- `requireDoctor` and `requireAdmin` return 403 `password_change_required` while a change is pending.
- Security headers include `content-security-policy` with `worker-src 'self'` and `manifest-src 'self'`.
- Loading production config with an insecure cookie setting throws.
- `create-admin` makes an admin who must change their password.

**Web app (3W):**

- A component test for each UI part. `RatingStars`: arrow keys move focus; tapping a star sets the rating; tapping it again clears it.
- API client: change requests carry both headers; a 401 sends the user to `/login`; an error body becomes `ApiError`.
- Guards: a user who must change their password always lands on the change screen; a doctor opening `/admin` sees the not-allowed page.

**Where the tracks meet** (Playwright, all three projects): run `create-admin`, log in with the temporary password, change it, and land on `/admin`. Log out and land on `/login`.

## Verification checklist

- [ ] `npm run check` and the meeting test pass in CI.
- [ ] `grep -rn "localStorage\|sessionStorage" app/src/auth app/src/api` finds nothing.
- [ ] `grep -rn "password" server/src --include=*.ts | grep -i "log\."` finds nothing.
- [ ] The login response's `set-cookie` header, as tested in production config, contains `__Host-`, `Secure`, `HttpOnly` and `SameSite=Strict`.
- [ ] `npm run build -w app` produces a separate `admin` chunk.

## Anti-pattern guards

- Storing the login token anywhere JavaScript can read it.
- Different error messages, or measurably different timing, for unknown users and wrong passwords.
- Password composition rules, or periodic expiry.
- `decorateRequest('user', {})` with an object value.
- Checking permissions only in the app's route guards.
- A lane adding its own login check instead of using `requireDoctor` or `requireAdmin`.

## Done when

The checklist is complete and `main` carries the tag `shell-v1`. Lanes 4A–4D can start.
