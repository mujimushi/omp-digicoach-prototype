# Build progress

Branch `build-v1`, one pull request into `main` at the end. Each phase's last commit carries its tag.

| Phase | Status | Tag |
|---|---|---|
| 1 Foundations | Done (merged earlier) | `foundations-v1` |
| 2 Contracts | Done | `contracts-v1` |
| 3 Login and app shell | Not started | |
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

## Versions

Every package added so far matches the major in `00-allowed-apis.md`: drizzle-orm 0.45.2, drizzle-kit 0.31.10, pg 8.23.0, @types/pg 8.23.1, @node-rs/argon2 2.2.1, msw 2.15.0, zod 4.6.5.

## Needs a person

- Sadia's review of the contracts (phase 2).
