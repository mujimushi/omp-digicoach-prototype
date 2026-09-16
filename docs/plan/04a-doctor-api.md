# Phase 4A: Doctor API

**Read first:** `docs/build-plan.md`, `docs/plan/README.md`, `docs/plan/api.md` (Doctor app), `docs/plan/02-contracts.md` (sync schemas, tables, change order, exactly-once items), `docs/plan/00-allowed-apis.md` (sections Fastify 5; Zod type provider; Drizzle ORM with PostgreSQL; Server integration tests with PostgreSQL).
**Depends on:** phase 3 (`buildApp()`, login checks, database test harness).
**Runs:** parallel with the other phase 4 lanes. With two lanes, pair it with 4B.
**Owns:** `server/src/routes/sync/`, `server/src/services/{students,sessions,pearls,sync}/`, `server/test/sync/`.
**Size:** 5–6 days.

## What to implement

### 1. Route plugin: `server/src/routes/sync/index.ts`

Register it under `/api/sync` with the Zod type provider. Both routes use the `requireDoctor` hook from phase 3. The route schema checks only the batch envelope (1–50 items, each with `opId` and `type`); the service checks each payload.

### 2. `POST /api/sync/push`

Handle items strictly in order, each in its own `db.transaction`. For each item:

1. If `processed_ops` already has the `opId`, return its stored result with `status: 'duplicate'`.
2. Check the payload against its Zod schema. If it fails, return `rejected` with `validation_failed`, and record that result.
3. Apply the item as below, then insert into `processed_ops` in the same transaction.

**`student.upsert`** (`services/students`):

- Clean the input: trim the name and collapse spaces; trim the PMDC number, upper-case it, and turn an empty value into null.
- If the ID is an alias, work on the real student.
- New ID whose PMDC number another student has: insert an alias row and return `applied` with `mappedStudentId`.
- New ID otherwise: insert with `created_by` and `updated_by` set to the caller and a new `change_seq`.
- Known ID with no field changed: return `duplicate` and write nothing.
- Known ID being given a PMDC number another student has: return `rejected` with `pmdc_taken`.
- Known ID otherwise: update the fields, `updated_by`, `updated_at` and `change_seq`, and write `audit_log` with the values before and after.

**`session.create`** (`services/sessions`):

- `doctor_id` is always the caller. The payload schema has no doctor field.
- Resolve an alias student ID. If the student doesn't exist, return `rejected` with `unknown_student`.
- Insert the session with `onConflictDoNothing({ target: id })`. The docs note that `.returning()` gives no row when a conflict happened, so when it returns nothing, load the existing session: another doctor's session returns `rejected` with `forbidden`; the caller's own returns `duplicate`.
- Insert its five steps in the same transaction, and take a new `change_seq`.

**`pearl.upsert`, `pearl.delete`, `pearl.use`** (`services/pearls`):

- New pearl: insert with `doctor_id` set to the caller.
- Existing pearl owned by someone else: `rejected` with `forbidden`.
- Update: change the fields. Delete: set `deleted_at`. Use: add one to `times_used`. Each takes a new `change_seq`.

**Taking a `change_seq`:** one helper, `nextChangeSeq(tx)`, runs `UPDATE change_counter SET value = value + 1 RETURNING value` inside the item's transaction. No other code writes `change_seq`.

Return one result per item, in the order received.

### 3. `GET /api/sync/pull`

1. Decode the cursor. An empty cursor means 0; anything that isn't a valid encoded number returns 400 `bad_cursor`.
2. Read `change_counter.value` as `upTo`.
3. Return, for `cursor < change_seq <= upTo`: all students, all aliases, the caller's sessions with their steps, and the caller's pearls, including deleted ones.
4. Return `upTo`, encoded, as the new cursor.

### 4. Logging

Log `opId`, `type` and result status for each push item. Never log payloads: they hold student names.

## Tests to write

Vitest with `app.inject()` against real PostgreSQL, using the per-worker test databases from phase 3.

**Who may call:**

- No login: 401 on both routes.
- A doctor who must still change their password: 403 `password_change_required`.
- An admin without the doctor flag: 403.
- The cookie of a user who has since been switched off: 401.

**Push, students:**

- A new student is applied, with `created_by` set to the caller and a `change_seq` set.
- The same `opId` sent again returns `duplicate` with an identical result, and there is still one row.
- A second doctor correcting the name returns `applied`, and `audit_log` holds the old and new name with that doctor as actor.
- An upsert with a new `opId` but no changes returns `duplicate` and writes no audit entry.
- A new student with an existing PMDC number returns `mappedStudentId`; a session using the new ID is stored against the existing student.
- Giving a student another student's PMDC number returns `pmdc_taken`.

**Push, sessions:**

- A session for an unknown student returns `unknown_student`. A later batch with the student first and the session second applies both.
- A session with four steps, a rating of 6 or wrong extra time is rejected with `validation_failed`, while the other items in the batch are applied.
- The same session sent again with a new `opId` returns `duplicate`, and there are still five step rows.
- A session ID already used by another doctor returns `forbidden`.
- A `doctorId` field added to the payload fails validation, because the schema is strict.
- A batch of 51 items returns 400.

**Push, pearls:**

- A doctor can't update, delete or use another doctor's pearl.
- `pearl.use` sent twice with the same `opId` adds one, not two.

**Pull:**

- An empty cursor returns every student, the caller's sessions with steps and the caller's pearls. Another doctor's sessions and pearls are absent.
- A pull with the returned cursor after new writes returns only the new rows. Deleted pearls come back marked deleted.
- `cursor=abc` returns 400 `bad_cursor`.
- **Late commit:** transaction T1 takes a `change_seq` and doesn't commit yet. A pull runs and returns cursor C, without T1's row. T1 commits. The next pull from C returns T1's row.

**Speed** (on CI PostgreSQL): a push of 50 sessions finishes within 2 seconds; a first pull with 500 students and 2,000 sessions within 1 second.

**Logs:** capture log output during a push of fixture students and check that no fixture name appears.

## Verification checklist

- [ ] `npm run test:server` passes, with at least 90% line coverage in `server/src/services/sync/` and `server/src/services/students/`.
- [ ] `grep -rn "doctorId" shared/src/schemas/sync.ts` finds nothing.
- [ ] `grep -rn "change_seq\|changeSeq" server/src --include=*.ts | grep -v "nextChangeSeq\|schema.ts\|select\|where\|orderBy"` finds no other writer of `change_seq`.
- [ ] `grep -rn "db\.query\.\|defineRelations" server/src` finds nothing.
- [ ] `api.md` is unchanged by this lane, or its contract pull request merged first.

## Anti-pattern guards

- Taking the doctor's ID from the phone.
- One transaction for the whole batch, so one bad item undoes the rest; or handling items out of order.
- Reading changes by clock time or a plain sequence instead of the change counter.
- Treating an empty `.returning()` after `onConflictDoNothing` as an insert.
- APIs only in the Drizzle 1.0 release candidate (`defineRelations`, relations v2), or the old object-style table config.
- Logging request bodies.

## Done when

The checklist is complete, and lane 4C's sync engine passes its server integration test against these routes.
