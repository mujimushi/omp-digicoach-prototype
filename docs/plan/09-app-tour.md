# Phase 9: App tour

**Read first:** `docs/plan/README.md`, `docs/plan/api.md`, `docs/plan/04b-doctor-screens.md` (screens and routes), `docs/plan/04c-offline-sync.md` (phone storage), `app/src/data/repository.ts`, `app/src/layout/DoctorLayout.tsx`.
**Depends on:** phases 2–6.
**Owns:** `app/src/tour/`, and small hooks into the doctor screens (`data-tour` attributes).
**Contract change:** `PublicUser.tourCompletedAt`, the `users.tour_completed_at` column and `POST /api/me/tour`.
**Size:** 3–4 days.

## Why

The client wants new doctors to learn the app before their first real session. Doctors learn a timed flow best by doing it once, so the tour ends in a practice session.

## Decisions

- Doctor app only. The dashboard gets no tour.
- English only. Text stays short: one line per card or hint, no paragraphs.
- The tour can always be skipped, and can be replayed from More.
- Nothing from practice is saved, queued or sent. Practice runs on its own in-memory repository.
- The server remembers that a doctor finished or skipped the tour, because logging out deletes the phone's data.

## What to implement

### 1. Contract

| Where | Change |
|---|---|
| `shared/src/schemas/user.ts` | `PublicUser.tourCompletedAt`: ISO time or null |
| `server/src/db/schema.ts` | `users.tour_completed_at timestamptz` null. Migration made with `npm run db:generate`. |
| `server/src/routes/me/index.ts` | `POST /api/me/tour`: sets `tour_completed_at` if it is null, answers 204. Repeating it changes nothing. |
| `api.md` | The new route |
| Seed and test reset | Known and seeded users have finished the tour, except the two seeded doctors who must still change their password |

### 2. When the tour opens

- After login, on the doctor app, when `user.tourCompletedAt` is null and this phone hasn't recorded it as done.
- Not while a real session is open (`/session…`).
- From More → "App tour", any time.
- An `undefined` value (a user cached on the phone by an older version) never opens it.

Finishing, skipping or leaving practice marks the tour done: the phone stores `tourDoneAt` in Dexie's `meta` table, then calls `POST /api/me/tour`. If there is no signal, the next start with a login retries the call.

### 3. Welcome cards

A modal with four short cards, dots, Next, and Skip on every card.

1. **Welcome to OMP DigiCoach**: The app guides each step and keeps time.
2. **Five steps, one minute**: the five step names from `STEPS`.
3. **Works without signal**: Sessions save on your phone and send later.
4. **Try a practice session**: Nothing you enter is saved. Buttons: Start practice, Skip.

### 4. Practice session

- The doctor app switches to a practice repository with one learner, "Practice Learner". Real students, drafts and sessions stay untouched in IndexedDB.
- A strip at the top reads "Practice · nothing is saved" with an Exit button.
- Hints point at the real controls, one at a time. Each hint belongs to a `data-tour` target; the tour shows the first unfinished hint whose target is on screen. Tapping the target finishes the hint; hints that only explain have "Got it".

| # | Target | Hint | Done by |
|---|---|---|---|
| 1 | `practice-student` | Tap the learner to begin. | Tap |
| 2 | `case-type` | Choose the case type. | Tap |
| 3 | `start` | Start the one-minute timer. | Tap |
| 4 | `timer` | One minute for all five steps. Tap to pause. | Got it |
| 5 | `rating` | Rate the learner on this step. | Got it |
| 6 | `next` | Go through the five steps. | Tap |
| 7 | `finish` | Finish when you’re done. | Tap |
| 8 | `log-save` | Add a note if you like, then save. | Tap |

- Saving or skipping the quick log ends practice with a card: **You’re ready**, "Replay this tour from More." and a Start teaching button.
- The quick log's "Session saved" message doesn't show in practice.

### 5. Accessibility and layout

- Cards are a labelled modal dialog; focus moves into it and back.
- Hints are a `role="status"` region, so screen readers announce them. The highlight doesn't block taps.
- Hints fit at 320 px and never cover their target.

## Tests to write

**Server:** `POST /api/me/tour` sets the time once, repeats keep the first time, needs a login; `/api/me` returns the field.

**Unit and component:**

- The practice repository saves nothing to IndexedDB and reports zero waiting items.
- A new doctor sees the welcome cards; one with `tourCompletedAt` set doesn't; `undefined` doesn't.
- Skip marks the tour done and calls the route once.
- The practice run shows hint 1 on the student list, and "You’re ready" after the quick log.
- More → App tour opens the cards again.

**End-to-end** (phone Chromium and WebKit): a new doctor logs in, runs the practice session to the end, and afterwards the phone's outbox is empty and the server has no session for that doctor. Logging in again shows no tour.

## Anti-pattern checks

- A practice write reaching Dexie or the outbox.
- A tour flag in `localStorage`.
- Text longer than one line on a card or hint.
