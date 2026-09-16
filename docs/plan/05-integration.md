# Phase 5: Integration and hardening

**Read first:** `docs/build-plan.md`, `docs/plan/README.md` (risks and guards), `docs/plan/api.md`, `docs/plan/02-contracts.md`, the "Done when" section of every phase 4 file, and `docs/plan/00-allowed-apis.md` (sections Playwright; vite-plugin-pwa and Workbox; Passwords and login).
**Depends on:** 4A, 4B, 4C, 4D and 4E, all merged.
**Runs:** in order, by one integrator (Sadia with one agent session).
**Size:** 5–7 days.

## What is this phase for?

It joins the lanes, removes every mock, and proves the whole system against the risks listed in `README.md`, on emulated phones and on real ones.

## What to do

### 1. Remove the mocks

- `createAppRepository()` returns the Dexie repository in every build. The memory repository is used only in unit and component tests.
- MSW runs only inside tests.
- Every end-to-end test runs against the real server, built in production mode, with the test database.

### 2. Run the joined end-to-end suite

Write these in `e2e/tests/integration/`. "Both phones" means the `phone-chromium` and `phone-webkit` projects.

| ID | Scenario | Projects |
|---|---|---|
| E2E-01 | The admin adds a doctor; the doctor logs in with the temporary password, must change it, and reaches the student list | Desktop and both phones |
| E2E-02 | A doctor adds a student, rates each step, fills the quick log; the session appears in their History and, for the admin, with the same ratings and times | Both phones and desktop |
| E2E-03 | With Playwright's clock, 60 seconds pass and the display turns to extra time; at 90 seconds it shows `+0:30`; nothing moves on by itself; Finish records 90 seconds teaching and 30 extra | Both phones |
| E2E-04 | Pausing for 20 seconds doesn't reduce the time left, and the dashboard shows 20 seconds paused | Both phones |
| E2E-05 | A reload during Step 3 brings back the text and times; an old draft asks Resume or Discard | Both phones |
| E2E-06 | Offline: the app loads from the service worker; a student and a session are saved; back online, the waiting count reaches 0 and the admin sees each record once | Phone Chromium |
| E2E-07 | Resend: the first push reaches the server but its answer never arrives; the phone resends; one session exists | Phone Chromium |
| E2E-08 | A second doctor sees neither the first doctor's sessions nor their pearls nor their ratings, in the app or through direct API calls | Both phones |
| E2E-09 | A doctor opening `/admin` is blocked, and admin API calls return 403 | Phone Chromium |
| E2E-10 | The admin switches a doctor off; the doctor's next sync gets 401; the app says the account is switched off and keeps the waiting data | Phone Chromium and desktop |
| E2E-11 | The admin resets a password; the doctor's old login stops working; the temporary password works and must be changed | Desktop and phone Chromium |
| E2E-12 | A pearl saved for "Pneumonia" appears for the answer "community acquired pneumonia", fills the fields when used, and adds one to its use count; another doctor never sees it | Both phones |
| E2E-13 | Two doctors, offline, add a student with the same PMDC number and record a session each; after sync there is one student with both sessions | Two phone Chromium contexts |
| E2E-14 | Layout at 320, 360, 390, 412 and 430 px: chips don't move when selected, and text boxes aren't cut off | Both phones |
| E2E-15 | The student report in print mode shows every section; the CSV download parses with the right columns, rows and ratings | Desktop |
| E2E-16 | axe finds no serious or critical problems on login, the student list, a session step, the quick log, the overview, doctors and student detail | All |
| E2E-17 | Logout with waiting data warns first; confirming clears the phone's data | Phone Chromium |

The update prompt is proved by its component test (phase 4C) and by the real-phone check below.

### 3. Harden

- Run the permission tests for every route, and read the list once more against `api.md`.
- Check the login cookie's flags and the security headers on a production-mode build served over HTTPS locally.
- Run `npm audit --omit=dev`, and fix or record every high finding.
- Capture the server logs from a full end-to-end run and search them for passwords, tokens, cookie values and student names from the fixtures. None may appear.

### 4. Speed

- The bundle budget passes: the doctor entry is under 250 KB gzipped.
- On a mid-range Android phone over a normal mobile connection, the installed app opens in under 3 seconds, and a session's steps respond to taps without visible delay.
- With 10 times the seed data, dashboard pages load within 1 second.

### 5. Real phones

Use one iPhone with the current iOS and one mid-range Android phone. Paste results into the pull request.

| Check | iPhone | Android |
|---|---|---|
| Install from the browser to the home screen | Share, then Add to Home Screen | Install prompt |
| Open in airplane mode | App loads | App loads |
| Offline session, then reopen with signal the next day | Arrives on the dashboard | Arrives on the dashboard |
| Phone locked for 2 minutes during a session | Time is correct on unlock | Same |
| New version deployed during a session | No reload until the quick log is saved | Same |
| Installed app used on day 1 and day 9, with no use between | Data still there on day 9 | Same |
| Smallest screen available (iPhone SE size) | Nothing cut off | n/a |

Start the day 1 / day 9 check at the beginning of this phase so it finishes before phase 6.

### 6. Bug bash

Spend one hour with one other person. Each plays a doctor and then the admin, trying to break things. Log every finding as an issue labelled `before-launch` or `later`.

## Verification checklist

- [ ] E2E-01 to E2E-17 pass on their projects in CI.
- [ ] The nightly run is green two nights in a row.
- [ ] The log search finds no secrets or student names.
- [ ] Every speed target is met.
- [ ] The real-phone table is complete, with every cell passing.
- [ ] Every `before-launch` issue from the bug bash is fixed.

## Anti-pattern guards

- Skipping a flaky test. Fix it, or quarantine it with an issue and a deadline within this phase.
- Treating emulated offline in Chromium as enough: the real-phone checks are required.
- Changing a contract here without a contract pull request and a rerun of every suite.
- Leaving any mock in the app build.

## Done when

The checklist is complete, and `main` carries the tag `rc-1`.
