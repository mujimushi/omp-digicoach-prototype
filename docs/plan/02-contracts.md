# Phase 2: Contracts

**Read first:** `docs/build-plan.md`, `docs/plan/README.md`, `docs/plan/api.md`, `docs/plan/00-allowed-apis.md` (sections Zod type provider; Drizzle ORM with PostgreSQL; MSW), and the constants at the top of `prototype/src/App.jsx` (`STEPS`, `DEPTS`, `CASES`, `YEARS`).
**Depends on:** phase 1.
**Runs:** in order, by one person: the contract owner.
**Size:** 3–4 days.

## What is this phase for?

It fixes every shape that two lanes share: constants, data rules, database tables, API routes, the phone storage interface, test data and mock responses. After it, lanes 4A–4D can work side by side without guessing.

## What to implement

### 1. Constants: `shared/src/constants.ts`

Copy the lists from the prototype's `STEPS`, `DEPTS`, `CASES` and `YEARS`, then apply the decisions:

- `SESSION_SECONDS = 60` and `RESUME_PROMPT_AFTER_MS = 15 * 60 * 1000`.
- `STEPS`: ids 1–5 with name, instruction and prompts; Step 2's quick and deep prompt lists; Step 3's five template labels; Step 4's starters and tags; Step 5's starters. Drop the prototype's `rateLabel` and per-prompt stars.
- `RATING_LABELS = ['Needs improvement', 'Basic', 'Competent', 'Proficient', 'Excellent']`, where index 0 is one star.
- `LEVELS`: `medical_student`, `house_officer`, `resident`, each with a display name.
- `YEARS`: `1st`, `2nd`, `3rd`, `4th`, `final`, used only for medical students.
- `CASE_TYPES`: `long_case`, `short_case`, `case_based_discussion`, `procedure`, `counseling`, `other`.
- `DEPARTMENTS`: the prototype list as keys, plus `other`.
- `DESIGNATIONS`: `professor`, `associate_professor`, `assistant_professor`, `consultant`, `senior_registrar`, `registrar`, `senior_resident`, `medical_officer`, `other`.
- Limits: name 2–100 characters; PMDC number 3–20 letters, digits or hyphens, stored upper-case; username 3–30 of `a-z 0-9 . _`; diagnosis up to 200; each step text box up to 500; action plan up to 1,000.

### 2. Data rules: `shared/src/schemas/`

One Zod file per subject. Each exports the schema and its inferred type. Use Zod 4 syntax from `00-allowed-apis.md`.

| File | Schemas |
|---|---|
| `user.ts` | `PublicUser` (id, name, username, department, designation, isDoctor, isAdmin, active, mustChangePassword) |
| `auth.ts` | `LoginRequest`, `ChangePasswordRequest` (password rules from `00-allowed-apis.md`, Passwords) |
| `student.ts` | `Student`, `StudentInput` (ID made on the phone), `StudentUpdate` |
| `session.ts` | `TeachingSession`, `SessionStep`, one content schema per step, `TimerState`, `SessionDraft` |
| `pearl.ts` | `Pearl` (id, diagnosis, five points, timesUsed, updatedAt, deleted) |
| `sync.ts` | `PushRequest`, `PushItem` (a union keyed on `type`), `PushResponse`, `PullResponse` |
| `admin.ts` | `DoctorInput`, `DoctorUpdate`, `OverviewStats`, `DoctorActivityRow`, `DoctorDetail`, `StudentSummaryRow`, `StudentDetail`, `SessionFilters`, `SessionListRow`, `SessionDetail`, `CSV_COLUMNS` |
| `errors.ts` | `ApiError` (code, message) and the list of error codes in `api.md` |

Rules the schemas must enforce:

- A session has exactly five steps, numbered 1 to 5.
- A rating is 1–5 or null; usefulness is 1–6 or null.
- All second counts are whole numbers from 0 to 21,600 (six hours).
- `overtimeSeconds` equals `max(0, teachingSeconds - 60)`.
- A student's `year` is null unless the level is `medical_student`.
- Step content: Step 1 `{ learnerAnswer }`; Step 2 `{ mode: 'quick' | 'deep' }`; Step 3 `{ points: [5 strings], pearlUsedId?, pearlSavedId? }`; Step 4 `{ starters: [3 strings], tags: string[] }` with tags from the constants; Step 5 `{ starters: [3 strings], actionPlan }`.

`TimerState` holds times in milliseconds, so a reload can rebuild the clock exactly: `startedAtMs`, `runningSinceMs` (null while paused), `activeMs`, `pausedMs`, `pausedSinceMs` (null while running), `stepActiveMs` (five numbers), `currentStep`, `finishedAtMs` (null until Finish).

### 3. Database tables: `server/src/db/schema.ts`

Write the tables with Drizzle, following `00-allowed-apis.md` (section Drizzle ORM with PostgreSQL). Then the contract owner generates the first migration.

| Table | Columns and rules |
|---|---|
| `users` | `id` uuid key, random default; `name` text; `username` text, unique on `lower(username)`; `password_hash` text; `department`, `designation` text; `is_doctor` boolean default true; `is_admin` boolean default false; `active` boolean default true; `must_change_password` boolean default true; `created_at`, `updated_at`, `last_login_at` timestamps with time zone |
| `login_sessions` | `id` text key (SHA-256 of the cookie token); `user_id` → users, deleted with the user; `created_at`, `last_seen_at`, `expires_at`; index on `user_id` |
| `login_attempts` | `username_lower` text key (kept for any username, whether or not the account exists); `failures` integer default 0; `locked_until` timestamp, nullable; `updated_at` |
| `students` | `id` uuid key (made on the phone); `name` text; `pmdc_number` text, unique when not null; `level` enum; `year` enum, null allowed, with a check that it is null unless `level` is `medical_student`; `created_by`, `updated_by` → users; `created_at`, `updated_at`; `change_seq` bigint, indexed |
| `student_aliases` | `alias_id` uuid key; `student_id` → students; `created_at`; `change_seq` bigint |
| `teaching_sessions` | `id` uuid key (made on the phone); `doctor_id` → users; `student_id` → students; `department` text; `case_type` enum; `learner_level` enum; `learner_year` enum, nullable; `started_at`; `teaching_seconds`, `overtime_seconds`, `paused_seconds`, `log_seconds` integers checked ≥ 0; `diagnosis` text; `learner_gave_diagnosis` boolean; `usefulness` smallint checked 1–6; `app_version` text; `received_at` default now; `change_seq` bigint; indexes on (`doctor_id`, `started_at`) and (`student_id`, `started_at`) |
| `session_steps` | `session_id` → teaching_sessions, deleted with the session; `step` smallint checked 1–5; `seconds` integer ≥ 0; `rating` smallint checked 1–5, nullable; `content` jsonb; key (`session_id`, `step`) |
| `pearls` | `id` uuid key (made on the phone); `doctor_id` → users; `diagnosis` text; `points` jsonb; `times_used` integer default 0; `deleted_at` nullable; `created_at`, `updated_at`; `change_seq` bigint; index on (`doctor_id`, `change_seq`) |
| `audit_log` | `id` bigint identity key; `actor_id` → users, nullable; `action` text; `entity_type`, `entity_id` text; `before`, `after` jsonb; `created_at`; index on (`entity_type`, `entity_id`) |
| `processed_ops` | `op_id` uuid key; `user_id` → users; `type` text; `result` jsonb (the result sent back); `created_at` |
| `change_counter` | One row: `id` smallint key fixed at 1; `value` bigint |

Enums: `learner_level`, `learner_year`, `case_type`. Departments and designations stay text, checked by Zod, so adding one needs no migration.

**Change order.** Every insert or update of a student, alias, session or pearl takes its `change_seq` by running `UPDATE change_counter SET value = value + 1 RETURNING value` inside its own transaction. That row stays locked until the transaction commits, so writes commit in counter order. A pull reads `change_counter.value` and returns rows up to that value, and so never skips a change that commits late. A plain database sequence can't promise this, because a lower number can commit after a higher one.

**Exactly-once items.** Each push item is applied and recorded in `processed_ops` in the same transaction. A repeated `opId` returns the stored result without applying the item again, so resending "pearl used" never counts twice.

### 4. API routes

`docs/plan/api.md` is the route list. Review it in this phase and change it only here.

### 5. Phone storage interface: `app/src/data/repository.ts`

The doctor screens (4B) use only this interface. The offline lane (4C) implements it. Write it with these methods:

| Group | Methods |
|---|---|
| Students | `listStudents(search?)`, `getStudent(id)`, `saveStudent(input)` |
| Session in progress | `loadDraft()`, `saveDraft(draft)`, `discardDraft()`, `completeSession(session)` |
| Own history | `listMySessions(filter?)`, `getMySession(id)` |
| Pearls | `listMyPearls()`, `findPearlForAnswer(text)`, `savePearl(pearl)`, `deletePearl(id)`, `markPearlUsed(id)` |
| Sync state | `subscribeWaitingCount(listener)`, `listNeedsAttention()` |

Saving methods put an item in the outbox as well as storing the record. `completeSession` stores the session, queues it and discards the draft in one step.

Also write `app/src/data/memory-repository.ts`: the same interface held in memory and seeded from fixtures. Lane 4B builds against it, and component tests use it.

### 6. Test data and mocks

- `shared/src/fixtures/`: `makeDoctor`, `makeStudent`, `makeSession`, `makePearl`, driven by a seeded random generator so each run produces the same records.
- `server/src/db/seed.ts` with `npm run db:seed`: 12 doctors (one also admin), 60 students and 400 sessions spread over 10 weeks, with varied ratings and extra time.
- `server/src/db/reset-test.ts` with `npm run db:reset-test`: empties every table and reseeds a small known set. It refuses to run unless `NODE_ENV=test`.
- `app/src/mocks/handlers.ts`: MSW handlers for every route in `api.md`. They check requests against the shared schemas and answer with fixtures.

## Tests to write

- **Schema tests** (`shared/src/schemas/*.test.ts`): for each rule above, one valid example and one invalid example. Include rating 0 and 6, usefulness 7, a year for a resident, a session with four steps, and wrong overtime.
- **Fixture test:** 200 generated records of each kind all pass their schemas.
- **Migration test** (`server/test/migrations.test.ts`): run every migration on an empty database, insert one row per table, then prove each check fails as it should: rating 6, usefulness 0, a repeated PMDC number, a year for a resident, a repeated username in different letter case.
- **Repository contract suite** (`app/src/data/repository.contract.ts`): one set of behaviour tests any repository must pass. For example: `saveStudent` then `listStudents` finds the student; `completeSession` removes the draft and raises the waiting count by one. Run it against the memory repository now. Lane 4C runs the same suite against the phone storage version.
- **Pearl matching rule**, part of the contract suite. Trim both texts and ignore letter case. A pearl matches when the answer contains the pearl's diagnosis as whole words, or when the diagnosis starts with the answer and the answer has at least four letters. So "pneumonia" and "community acquired pneumonia" match a "Pneumonia" pearl, "pneu" matches it, and "a" matches nothing. When several pearls match, the longest diagnosis wins.
- **Mock test:** each MSW handler rejects a request that fails its schema.

## Verification checklist

- [ ] `npm run check` passes.
- [ ] On an empty local database, `npm run db:migrate` then `npm run db:seed` finish, and the table counts are 12, 60 and 400.
- [ ] Every `/api/` path mentioned in any phase file appears in `api.md`. Check with `grep -rhoE "/api/[a-z/:.-]+" docs/plan | sort -u`.
- [ ] The repository contract suite passes against the memory repository.
- [ ] Sadia has reviewed the contracts, and `main` carries the tag `contracts-v1`.

## Anti-pattern guards

- Never use `drizzle-kit push`; create tables only through generated migrations.
- `app/` imports types from `shared/` only, never from `server/`.
- Constants live only in `shared/`. Check with `grep -rn "Needs improvement" app/src server/src`, which must find nothing.
- Students, sessions and pearls get their IDs on the phone; the server never generates them.
- No per-prompt stars: exactly one rating per step.

## Done when

The checklist is complete and `contracts-v1` is tagged. From then on, contract changes follow the rules in `README.md`.
