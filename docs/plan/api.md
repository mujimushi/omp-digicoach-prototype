# API routes

Phase 2 fixes this list. Request and response names refer to Zod schemas in `shared/src/schemas/`. Every route is under `/api`, returns JSON unless stated, and reports errors as `ApiError { code, message }`.

Every call that changes data must send `Content-Type: application/json` and the header `X-OMP-Client: app`. The server rejects changes without that header (see `00-allowed-apis.md`, CSRF).

## Who can call what?

| Caller | Meaning |
|---|---|
| Anyone | No login needed |
| Logged in | Any active user, even one who must still change their password |
| Doctor | Logged in, `isDoctor`, password already changed |
| Admin | Logged in, `isAdmin`, password already changed |

A logged-in user who must change their password gets `403 password_change_required` from every Doctor and Admin route. A switched-off user gets `401 not_logged_in` everywhere, and their login cookies are deleted.

## Login and account

| Method | Path | Caller | Request | Response | Errors |
|---|---|---|---|---|---|
| POST | `/api/auth/login` | Anyone | `LoginRequest` | `PublicUser`, sets the login cookie | 401 `invalid_credentials`, 429 `too_many_attempts` |
| POST | `/api/auth/logout` | Logged in | none | 204, clears the cookie | none |
| GET | `/api/me` | Logged in | none | `PublicUser` | 401 `not_logged_in` |
| POST | `/api/me/password` | Logged in | `ChangePasswordRequest` | 204; issues a new cookie and ends the user's other logins | 400 `weak_password`, 401 `wrong_current_password` |
| GET | `/api/health` | Anyone | none | `{ ok: true }` after a database ping | 503 `database_unavailable` |

`invalid_credentials` covers a wrong username, a wrong password and a switched-off account alike, so the message reveals nothing.

## Doctor app

The doctor app reads from storage on the phone. It talks to the server only through these two routes.

| Method | Path | Caller | Request | Response | Errors |
|---|---|---|---|---|---|
| POST | `/api/sync/push` | Doctor | `PushRequest` (1–50 items, in order) | `PushResponse` (one result per item, same order) | 400 `validation_failed` when the batch itself is malformed: not an array, more than 50 items, or an item without `opId` and `type` |
| GET | `/api/sync/pull?cursor=` | Doctor | none | `PullResponse` | 400 `bad_cursor` |

### Push items

The server handles items in order, each in its own transaction, so one refused item doesn't undo the others. Each item's payload is checked on its own: a bad payload refuses only that item. An `opId` seen before returns the result stored in `processed_ops`, marked `duplicate`, without applying the item again.

| `type` | Payload | Server behaviour |
|---|---|---|
| `student.upsert` | `StudentInput` with an ID made on the phone | New ID: insert. Known ID: update, record the change in `audit_log`; no change at all returns `duplicate`. A new student whose PMDC number another student already has: store the new ID as an alias of that student and return `mappedStudentId`. Changing a student's PMDC number to one another student has: `rejected` with `pmdc_taken`. |
| `session.create` | `TeachingSession` with its five steps | Insert the session and steps in one transaction. `doctor_id` comes from the login, never from the payload. Known ID with the same content: `duplicate`. Student not found: `rejected` with `unknown_student` (the phone retries later). |
| `pearl.upsert` | `Pearl` | Insert or update, only if the pearl belongs to the caller. |
| `pearl.delete` | `{ id }` | Mark deleted, only if the pearl belongs to the caller. |
| `pearl.use` | `{ id }` | Add one to `times_used`, only if the pearl belongs to the caller. |

### Result codes

| `status` | `code` | Phone does |
|---|---|---|
| `applied` | none | Remove the item from the outbox |
| `duplicate` | none | Remove the item from the outbox |
| `rejected` | `unknown_student` | Keep the item and retry on the next sync |
| `rejected` | `validation_failed`, `forbidden`, `pmdc_taken` | Move the item to a "needs attention" list the doctor can see |

A whole request failing (network error, 5xx) leaves every item in the outbox. A 401 pauses syncing until the doctor logs in again.

### Pull

`PullResponse` holds everything changed since `cursor`: all students, student aliases, and the caller's own sessions (with steps) and pearls, including deleted pearls so the phone can remove them. The server reads `change_counter.value` first and returns rows with `change_seq` above the cursor and up to that value; that value becomes the new cursor. Because writes commit in counter order (see `02-contracts.md`), no change is skipped. An empty cursor returns everything. The cursor is an opaque string to the phone.

## Dashboard

| Method | Path | Caller | Request | Response | Errors |
|---|---|---|---|---|---|
| GET | `/api/admin/overview` | Admin | none | `OverviewStats` | none |
| GET | `/api/admin/doctors` | Admin | none | `DoctorActivityRow[]` | none |
| POST | `/api/admin/doctors` | Admin | `DoctorInput` | `{ doctor: PublicUser, temporaryPassword }` | 409 `username_taken` |
| GET | `/api/admin/doctors/:id` | Admin | none | `DoctorDetail` | 404 `not_found` |
| PATCH | `/api/admin/doctors/:id` | Admin | `DoctorUpdate` | `PublicUser` | 404, 409 `username_taken`, 409 `cannot_change_own_admin` |
| POST | `/api/admin/doctors/:id/reset-password` | Admin | none | `{ temporaryPassword }`; ends that user's logins | 404 |
| GET | `/api/admin/students?query=&sort=` | Admin | none | `StudentSummaryRow[]` | none |
| GET | `/api/admin/students/:id` | Admin | none | `StudentDetail` (profile, sessions, ratings per step over time, change history) | 404 |
| PATCH | `/api/admin/students/:id` | Admin | `StudentUpdate` | `Student` | 404, 409 `pmdc_taken` |
| GET | `/api/admin/sessions?from=&to=&doctorId=&studentId=&caseType=&page=` | Admin | none | `{ rows: SessionListRow[], total }` | 400 `validation_failed` |
| GET | `/api/admin/sessions/:id` | Admin | none | `SessionDetail` | 404 |
| DELETE | `/api/admin/sessions/:id` | Admin | none | 204; recorded in `audit_log` | 404 |
| GET | `/api/admin/export/sessions.csv?from=&to=` | Admin | none | `text/csv`, UTF-8 with byte-order mark, columns in `CSV_COLUMNS` | 400 |

Admins never delete doctors or students; they switch doctors off and correct student records.

## CSV columns

One row per session, in this order: `session_id`, `date`, `start_time`, `doctor_username`, `doctor_name`, `doctor_department`, `doctor_designation`, `student_id`, `student_name`, `pmdc_number`, `learner_level`, `learner_year`, `department`, `case_type`, `teaching_seconds`, `overtime_seconds`, `paused_seconds`, `log_seconds`, `step1_rating` to `step5_rating`, `step1_seconds` to `step5_seconds`, `step2_mode`, `step4_tags`, `diagnosis`, `learner_gave_diagnosis`, `usefulness`, `pearl_used`, `app_version`.

Dates and times are in Pakistan time (Asia/Karachi). Lists inside a cell are joined with `; `.
