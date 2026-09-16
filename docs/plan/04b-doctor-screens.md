# Phase 4B: Doctor screens

**Read first:** `docs/build-plan.md` (doctor app), `docs/plan/README.md`, `docs/plan/02-contracts.md` (constants, schemas, `TimerState`, `SessionDraft`, repository interface), `docs/plan/00-allowed-apis.md` (sections React, Vite and React Router; Vitest and React Testing Library; Playwright), and these components in `prototype/src/App.jsx`: `ds`, `IconCircle`, `ChipLabel`, `TimerRing`, `TabBar`, `StudentSelect`, `SessionSetup`, `TimerScr`, `LogScr`, `HistoryScr`, `StatsScr`, `StudentHistScr`, `MoreScr`, `PearlLib`, `AboutScr`.
**Depends on:** phase 2 (memory repository) and phase 3 (router, layout, UI parts, login, repository context).
**Runs:** parallel with the other phase 4 lanes. With two lanes, pair it with 4A.
**Owns:** `app/src/doctor/`.
**Size:** 8–10 days.

## What to implement

### 1. Timer rules: `app/src/doctor/timer/timer.ts`

Pure functions over `TimerState`, each taking the current time `now` in milliseconds as an argument. No React and no timers inside.

| Function | Does |
|---|---|
| `startTimer(now)` | New state, running, on Step 1 |
| `pause(state, now)` / `resume(state, now)` | Stop or restart active time; paused time adds to `pausedMs` |
| `goToStep(state, step, now)` | Close the current step's interval and open the new step's |
| `finish(state, now)` | Close the last interval and set `finishedAtMs` |
| `readTimer(state, now)` | `{ activeMs, remainingMs, overtimeMs, pausedMs, stepMs, isOvertime, isPaused }`; `remainingMs` goes below zero in extra time |
| `toSessionTiming(state, logSavedAtMs)` | `{ teachingSeconds, overtimeSeconds, pausedSeconds, logSeconds, stepSeconds }`, rounded to whole seconds with halves rounded up; `overtimeSeconds = max(0, teachingSeconds - 60)` |
| `shouldPromptResume(draft, now)` | True when the draft was last saved more than 15 minutes ago |

Rules:

- Time always comes from subtracting timestamps, never from counting ticks, so a phone that locks or throttles the page still gets the right time.
- Time keeps running while the app is closed: reopening a draft counts the gap as active time, unless the timer was paused.
- Reaching zero changes only the display. Nothing moves to the next step and nothing closes.

### 2. Timer display: `app/src/doctor/timer/TimerRing.tsx`

Copy the prototype's `TimerRing` and change it:

- The ring covers the whole 60-second session.
- It counts down as `0:42`, then shows extra time as `+0:15` in amber, with the ring full.
- It shows "PAUSED" while paused. Tapping it pauses or resumes.
- It re-renders every 250 ms, but reads its value from `readTimer`.
- Screen reader label: "Time left 0:42", or "Extra time 0:15".

### 3. Screens

Copy each layout from the prototype, and replace sample data with repository calls.

| Screen | Route | From prototype | What changes |
|---|---|---|---|
| Student list | `/` | `StudentSelect` | Search by name or PMDC number; Add student; tap a student to set up a session; Edit link; sync badge in the header from 4C's `useSyncStatus` (a stub until 4C merges) |
| Add or correct student | `/students/new`, `/students/:id/edit` | new | Name, PMDC number (optional), level chips, and year chips shown only for medical students. Warns when the name matches an existing student ("Is this Ahmed Khan, PMDC 12345-P?"). Saves with `saveStudent`. |
| Session setup | `/session/setup` | `SessionSetup` | Department preset from the doctor's profile; case type chips; Start creates the draft, starts the timer and opens Step 1 |
| Session steps | `/session` | `TimerScr` | The whole-session timer. Step 1: prompts and the learner's answer. Step 2: Quick/Deep switch and prompts. Step 3: templates, the pearl banner from `findPearlForAnswer`, Save as teaching pearl. Step 4: starters and tag chips. Step 5: starters and action plan. Every step: one `RatingStars` control. Back and Next move freely; Finish on Step 5. The draft is saved on every change (debounced 300 ms) and every 5 seconds. |
| Quick log | `/session/log` | `LogScr` | Diagnosis; learner gave the diagnosis, Yes or No; usefulness 1–6; teaching time and extra time shown. Save and Skip both call `completeSession`; Skip leaves the log fields empty. The confirmation appears only after the repository finishes. |
| Resume prompt | On app start | new | With a draft, resume straight away; when `shouldPromptResume` is true, ask "Resume the session with [student] from [time]?" with Resume and Discard |
| History | `/history`, `/history/:id` | `HistoryScr` | The doctor's own sessions by date; the detail shows each step's rating with its label, the times and the text entered |
| Stats | `/stats` | `StatsScr` | From the doctor's own sessions: sessions this week and in total, average teaching time and extra time, average rating per step, sessions per weekday |
| Student progress | `/progress`, `/progress/:studentId` | `StudentHistScr` | Only students this doctor has taught, and only this doctor's sessions: ratings per step over time |
| More | `/more` | `MoreScr` | Teaching pearls, About, install guide (4C's component), items needing attention, app version, Log out |
| Pearl library | `/pearls` | `PearlLib` | The doctor's own pearls: search, edit, delete |
| About | `/about` | `AboutScr` | The five steps from the constants, the rating scale, study credits |

Tab bar, copied from `TabBar`: Students, History, Stats, Progress, More.

### 4. Getting data

Screens get the repository from the `RepositoryProvider` context made in phase 3; until 4C merges, it is the memory repository. A small `useRepositoryQuery` hook reloads lists after saves. No screen imports Dexie or calls `fetch`.

## Tests to write

**Unit tests** for `timer.ts`, with `now` passed in:

- At start, 60,000 ms remain; after 42 seconds, 18,000.
- At exactly 60 seconds: 0 remaining, not in extra time. At 61 seconds: 1,000 ms of extra time, still on the same step, not finished.
- Pausing for 20 seconds and resuming: active time leaves out those 20 seconds, and `pausedMs` is 20,000.
- 10 s on Step 1, 30 s on Step 2, then 5 s back on Step 1: Step 1 has 15,000 ms and Step 2 has 30,000.
- Saved at 30 seconds and reopened at 45 seconds while running: 45 seconds active.
- Saved while paused and reopened 10 minutes later: active time unchanged.
- `toSessionTiming`: 90 seconds teaching gives 30 of extra time; 25 seconds from Finish to Save gives `logSeconds` 25; 59.5 seconds rounds to 60.
- `shouldPromptResume`: false at 15 minutes minus 1 ms, true at 15 minutes plus 1 ms.

**Component tests** (React Testing Library and user-event, memory repository):

- Student form: the name is required; the year chips are hidden for a house officer; a matching name shows the warning; saving adds the student to the list.
- Rating: tapping the third star shows "Competent" and marks it pressed; tapping it again clears the rating.
- Pearl banner: with a "Pneumonia" pearl saved, the answer "community acquired pneumonia" shows the banner; Use fills all five fields; Save as teaching pearl calls `savePearl`.
- Quick log: Save calls `completeSession` with the timings from `toSessionTiming`; Skip saves without log fields.
- Resume prompt: a draft saved 20 minutes ago asks first; Discard calls `discardDraft`.
- Progress: with sessions from two doctors in the memory repository, only the logged-in doctor's appear.

**End-to-end tests** (Playwright, `phone-chromium` and `phone-webkit`, app built with `VITE_REPOSITORY=memory` until phase 5):

- **E2E-B1 Full session:** pick a student, set up, rate each step, fill the quick log, and find the session in History with its ratings and times.
- **E2E-B2 Extra time:** call `page.clock.install()` before opening the page, start a session, fast-forward 75 seconds, and see `+0:15` while still on the same step. Finish, and the quick log shows 15 seconds of extra time.
- **E2E-B3 Layout** at 320, 360, 390, 412 and 430 px: selecting Case Type, Year and Step 4 chips doesn't change any chip's width; no starter text box's right edge passes its row's right edge.
- **E2E-B4 Accessibility:** axe finds no serious or critical problems on the student list, a session step and the quick log.

## Verification checklist

- [ ] All tests pass, with 100% line coverage in `app/src/doctor/timer/timer.ts`.
- [ ] `grep -rn "setInterval\|setTimeout" app/src/doctor/timer/timer.ts` finds nothing.
- [ ] `grep -rln "dexie\|indexedDB\|fetch(" app/src/doctor` finds nothing.
- [ ] Screenshots of each screen at 390 px on both phone projects are attached to the pull request, next to the prototype's.

## Anti-pattern guards

- Counting timer ticks instead of subtracting timestamps.
- Moving to the next step, or closing the session, when the countdown reaches zero.
- A star beside each prompt: there is exactly one rating per step.
- Screens calling `fetch` or Dexie directly.
- Showing another doctor's sessions or ratings anywhere in the doctor app.
- Showing "saved" before the repository confirms the save.

## Done when

The checklist is complete, and the screens run on the memory repository with nothing to change when 4C's repository replaces it.
