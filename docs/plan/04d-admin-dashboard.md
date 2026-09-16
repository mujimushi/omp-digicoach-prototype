# Phase 4D: Admin dashboard

**Read first:** `docs/build-plan.md` (dashboard), `docs/plan/README.md`, `docs/plan/api.md` (Dashboard, CSV columns), `docs/plan/02-contracts.md` (admin schemas, tables, seed data), `docs/plan/00-allowed-apis.md` (sections Fastify 5; Drizzle ORM with PostgreSQL; Passwords and login; React, Vite and React Router; TanStack Query (dashboard only); Recharts; Playwright).
**Depends on:** phase 3 (`requireAdmin`, the password hashing helper, the `/admin` area in the app shell).
**Runs:** parallel with the other phase 4 lanes. With two lanes, pair it with 4C. It can split into a server half and a screens half, with `api.md` as the boundary.
**Owns:** `server/src/routes/admin/`, `server/src/services/{doctors,reports}/`, `server/test/admin/`, `app/src/admin/`.
**Size:** 8–10 days.

## What to implement: server

### 1. Route plugin: `server/src/routes/admin/index.ts`

Register it under `/api/admin` and add `requireAdmin` as a hook **on the plugin**, so a new route can't be added without the check.

### 2. Doctors: `server/src/services/doctors/`

- **List:** each doctor with sessions in total and in the last 7 days, last session date, average teaching and extra time, the share of sessions with all five steps rated, and last login.
- **Create:** check `DoctorInput`; the username must be unique ignoring case. The temporary password is either typed by the admin or generated readable, and either way follows the password rules in `00-allowed-apis.md`. Hash it with the phase 3 helper, set `must_change_password`, and write `audit_log`. The response shows the password once.
- **Update:** name, department, designation, doctor and admin flags, active. An admin can't remove their own admin flag or switch themselves off (409 `cannot_change_own_admin`). Switching a user off deletes their `login_sessions`. Write `audit_log`.
- **Reset password:** set a new temporary password and `must_change_password`, delete the user's `login_sessions`, write `audit_log`, and return the password once.

### 3. Reports: `server/src/services/reports/`

- **Overview:** doctors with a session in the last 14 days, sessions this week, number of students, average teaching and extra time this month, average rating per step this month, and sessions per week for the last 12 weeks.
- **Students:** summary rows (name, PMDC number, level, year, sessions, doctors, average rating per step, last session). The detail holds the profile, every session from every doctor, ratings per step over time, and change history from `audit_log`.
- **Student correction:** the same rules as a student update through sync, including `pmdc_taken`, with `audit_log`.
- **Sessions:** a list filtered by date range, doctor, student and case type, 50 per page; the detail with every step; delete, which removes the steps too and writes `audit_log`.
- Dates are grouped and filtered in the Asia/Karachi time zone.

### 4. CSV export

- Columns exactly as `CSV_COLUMNS`, starting with a UTF-8 byte-order mark so Excel reads names correctly.
- Quote cells as RFC 4180 requires, so commas, quotes and new lines survive.
- Prefix any cell starting with `=`, `+`, `-`, `@`, a tab or a carriage return with `'`, so a spreadsheet can't run it as a formula.
- File name `omp-sessions-YYYY-MM-DD.csv`. Write `audit_log` with who exported and which filters.

### 5. Removing test records

A command-line tool, `npm run remove-test-records -w server -- --session <id> --student <id>`, for the smoke test and the launch practice sessions. It removes the listed sessions, then removes each listed student only if no other session refers to them, and writes `audit_log` for everything removed. It isn't an API route, so the dashboard can't delete students by mistake.

### 6. Query speed

Run `EXPLAIN` on the three heaviest report queries against 10 times the seed data, and add indexes where a query scans a whole large table.

## What to implement: screens

`app/src/admin/`, loaded lazily by the router so it builds as its own chunk named `admin` (lane 4C keeps that chunk off phones). A desktop layout with side navigation (Overview, Doctors, Students, Sessions, Export) and a top bar with the admin's name and Log out. Data loads through TanStack Query.

| Screen | Route | Contents |
|---|---|---|
| Overview | `/admin` | Figures, sessions per week chart, average rating per step |
| Doctors | `/admin/doctors` | Sortable table and Add doctor |
| Add or edit doctor | `/admin/doctors/new`, `/admin/doctors/:id/edit` | The simple form with Generate password. After saving, the temporary password shows once with a Copy button. Switch on or off; Reset password asks for confirmation first. |
| Doctor detail | `/admin/doctors/:id` | Activity, sessions, students taught |
| Students | `/admin/students` | Search and table |
| Student detail | `/admin/students/:id` | Editable profile, sessions, ratings per step over time, change history |
| Sessions | `/admin/sessions` | Filters, table, pages |
| Session detail | `/admin/sessions/:id` | Every step, ratings with labels, times and text; Delete asks for confirmation |
| Student report | `/admin/reports/students/:id` | Print layout: student and date range, summary, ratings over time, session list; a "Print or save as PDF" button |
| Doctor report | `/admin/reports/doctors/:id` | Print layout: activity, sessions, spread of ratings |
| Export | `/admin/export` | Date range and Download CSV |

Print styles hide navigation and buttons, use A4 margins, and keep table rows whole across pages. A doctor who opens `/admin` sees "This page is for the admin"; the server refuses the data regardless.

## Tests to write

**Server integration:**

- **Permissions for every admin route:** 401 without login, 403 for a doctor, 403 `password_change_required` for an admin who must change their password, 200 for the admin. The test collects every registered route under `/api/admin` with an `onRoute` hook and fails if one has no permission case.
- **Create doctor:** the stored hash verifies with the temporary password; `must_change_password` is set; a username differing only in letter case returns 409; an audit row exists.
- **Reset password:** the doctor's old cookie now gets 401, the new temporary password works, and a password change is required.
- **Switch off:** the doctor's cookie gets 401 and login fails; switching off one's own account returns 409.
- **Numbers:** with fixed seed data whose values are worked out by hand, the overview, the per-step student averages and the doctor activity all match.
- **Time zone:** a session at 23:30 Pakistan time on the 5th counts for the 5th.
- **CSV:** parse the response back. The header equals `CSV_COLUMNS`; the row count and step ratings match; the byte-order mark is there; a diagnosis of `=HYPERLINK("x")` comes back prefixed with `'`; text with commas and new lines survives.
- **Delete session:** its steps are gone and an audit row exists.
- **Speed:** with 10 times the seed data (4,000 sessions), every report route answers within 500 ms.

**Component tests:**

- Doctor form: required fields and username rules; the generated password shows once; Reset asks for confirmation.
- Tables show rows from MSW responses. Charts in tests use a fixed width and height, because `ResponsiveContainer` draws at zero size in jsdom.

**End-to-end tests** (`desktop-chromium` for the admin, `phone-chromium` for the doctor; real server with seed data):

- **E2E-D1:** the admin adds a doctor; the doctor logs in on a phone with the temporary password, must change it, and reaches the student list.
- **E2E-D2:** the admin switches the doctor off; the doctor's next page load goes to the login screen with a message.
- **E2E-D3:** a doctor opening `/admin` is blocked, and a direct request to an admin route returns 403.
- **E2E-D4:** a student report with `page.emulateMedia({ media: 'print' })` hides navigation and shows every section. Attach a screenshot.
- **E2E-D5:** download the CSV with `page.waitForEvent('download')`, save it, parse it, and match the row count to the seeded sessions in range.
- **E2E-D6:** axe finds no serious or critical problems on the overview, the doctors list and a student's detail.

## Verification checklist

- [ ] All tests pass, with at least 85% line coverage in `server/src/services/reports/` and `server/src/services/doctors/`.
- [ ] Adding a dummy admin route without a permission case makes the permission test fail (tried once, then removed).
- [ ] `EXPLAIN` output for the three heaviest report queries is in the pull request.
- [ ] `npm run build -w app` produces a separate `admin` chunk.
- [ ] A printed student report, saved as PDF, is attached to the pull request.

## Anti-pattern guards

- Checking admin rights only in the screens.
- Showing a temporary password after its first display, or storing or logging it anywhere unhashed.
- Letting an admin switch off or un-admin their own account.
- Building the CSV by joining strings without quoting, leaving out the byte-order mark, or exporting formula-like cells unprefixed.
- Working out report numbers in the browser from raw sessions.
- `ResponsiveContainer` inside component tests.

## Done when

The checklist is complete, and every admin task works against seed data: add a doctor, reset a password, switch a doctor off, find a student, print a report, download the CSV.
