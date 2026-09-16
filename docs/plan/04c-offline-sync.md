# Phase 4C: Offline and sync

**Read first:** `docs/build-plan.md` (offline section), `docs/plan/README.md`, `docs/plan/api.md` (Doctor app), `docs/plan/02-contracts.md` (repository interface, `SessionDraft`, `TimerState`, push items), `docs/plan/00-allowed-apis.md` (sections vite-plugin-pwa and Workbox; Dexie and fake-indexeddb; Connectivity; iPhone and Android facts; Playwright).
**Depends on:** phases 2 and 3. Uses 4A's real endpoints once they are merged; until then, phase 2's MSW handlers.
**Runs:** parallel with 4A, 4B and 4D. With two lanes, pair it with 4D after 4A is finished.
**Owns:** `app/src/offline/`, `app/src/install/`, the PWA section of `app/vite.config.ts`, generated icons in `app/public/`.
**Size:** 7–8 days.

## What to implement

### 1. Phone database: `app/src/offline/db.ts`

A typed Dexie database, following the typed-class example in `00-allowed-apis.md` (section Dexie and fake-indexeddb).

| Table | Key and indexes | Holds |
|---|---|---|
| `students` | `id`; `name`, `pmdcNumber`, `changeSeq` | The shared student list |
| `studentAliases` | `aliasId`; `studentId` | Merged duplicate IDs |
| `sessions` | `id`; `startedAt`, `studentId` | The doctor's own sessions |
| `pearls` | `id`; `diagnosis` | The doctor's own pearls |
| `outbox` | `++seq`, `&opId`; `type` | Items waiting to send, in order |
| `needsAttention` | `opId` | Items the server refused for good |
| `drafts` | `'current'` | The session in progress |
| `meta` | key | `pullCursor`, `userId`, `lastSyncAt` |

A later schema change adds `db.version(2)` with an upgrade function and keeps `version(1)` in place.

### 2. Phone storage repository: `app/src/offline/dexie-repository.ts`

Implement the phase 2 `Repository` interface on the database above.

- Every save writes the record and its outbox item in **one Dexie transaction**: `saveStudent`, `completeSession` (which also deletes the draft), `savePearl`, `deletePearl`, `markPearlUsed`.
- `listStudents(search)` resolves aliases, matches name or PMDC number ignoring case, and sorts by name.
- `findPearlForAnswer` follows the matching rule in phase 2.
- `subscribeWaitingCount` uses a live query on the outbox count.
- Export `createRepository()`, which returns this repository. Lane 4B switches to it by changing one import.

### 3. Sync engine: `app/src/offline/sync.ts`

`syncNow()` runs one sync; a second call during a run waits for the first instead of starting another.

1. **Push.** Send outbox items in `seq` order, up to 50 per request. For each result:
   - `applied` or `duplicate`: delete the item.
   - `rejected` with `unknown_student`: keep it and add one to `attempts`.
   - `rejected` with any other code: move it to `needsAttention`.
   - `mappedStudentId` present: in one transaction, replace the old student ID everywhere (students, sessions, draft, outbox payloads) and save the alias.
2. **Pull.** Call `/api/sync/pull` with the saved cursor, upsert what comes back, then save the new cursor.

When it runs: after login, on app start, on the window `online` event, when the page becomes visible, 2 seconds after any save, and every 60 seconds while visible. Do not use the Background Sync API: iPhones don't support it.

When it fails:

- **Network error or 5xx:** keep every item and wait 5 s, 15 s, 60 s, then every 5 minutes.
- **401:** stop, set the state to `login_needed`, keep all data.
- **403 `password_change_required`:** send the doctor to the change-password screen.

`navigator.onLine` only colours the status badge. The engine always tries the request and handles failure, because the browser's online flag can be wrong.

### 4. Logout and changing user

- Logout with an empty outbox clears every table.
- Logout with items waiting shows how many and asks to confirm. Confirming deletes the database.
- If a different user logs in while the previous user's items are waiting, block the login on this phone and explain why: those items can only be sent under the previous login.

### 5. Draft storage

`saveDraft` writes the current draft to `drafts`. Lane 4B calls it on every change (debounced 300 ms) and every 5 seconds while the timer runs. `loadDraft` returns it unchanged, with every `TimerState` number intact.

### 6. Installable app: `app/vite.config.ts` and `app/index.html`

Follow `00-allowed-apis.md` (section vite-plugin-pwa and Workbox):

- `registerType: 'prompt'` and `injectRegister: false`; the app registers through the React hook.
- Manifest: name "OMP DigiCoach", short name "DigiCoach", `start_url` and `scope` `/`, `display: 'standalone'`, colours from the prototype's `ds` tokens.
- Icons: copy the SVG from the prototype's `Logo` component into `app/public/logo.svg` and generate the icon set with `@vite-pwa/assets-generator` (preset `minimal-2023`).
- Workbox: `globPatterns` covering js, css, html, svg, png, ico and webmanifest files; `globIgnores` for the admin chunk; `navigateFallback: 'index.html'`; `navigateFallbackDenylist: [/^\/api\//, /^\/admin/]`; no `runtimeCaching` at all.
- The admin dashboard must build as its own chunk with a predictable name, so `globIgnores` can leave it out.
- `index.html` keeps both `apple-mobile-web-app-capable` and `mobile-web-app-capable`, plus `apple-touch-icon` and `theme-color`.

### 7. Update prompt: `app/src/offline/UpdatePrompt.tsx`

Copy the `ReloadPrompt` example referenced in `00-allowed-apis.md`, with one change: while a draft exists, `needRefresh` shows nothing. Once the draft is cleared, show "A new version is ready" with a Reload button that calls `updateServiceWorker(true)`.

After the first login in the installed app, call `navigator.storage.persist()` if the browser has it.

### 8. Install guide: `app/src/install/InstallGuide.tsx`

- Detect the installed app with the `display-mode: standalone` media query, and `navigator.standalone` on iPhones.
- iPhone in Safari: show Share → Add to Home Screen, and warn that Safari and the installed app keep separate data.
- Android Chrome: keep the `beforeinstallprompt` event and show an Install button.
- Show it after login until the app is installed. Dismissing hides it for 7 days.

### 9. Status hook: `app/src/offline/useSyncStatus.ts`

Returns `{ waiting, needsAttention, lastSyncAt, state }`, where `state` is `idle`, `syncing`, `offline` or `login_needed`. Lane 4B shows it in the header.

## Tests to write

**Unit tests** (Vitest with `fake-indexeddb/auto`; a fresh `IDBFactory` in each test):

- The phase 2 repository contract suite passes against the Dexie repository.
- Items saved as A, B, C are pushed as A, B, C.
- `applied` and `duplicate` remove items; `unknown_student` keeps the item and adds an attempt; `validation_failed` moves it to `needsAttention`.
- `mappedStudentId` replaces the old ID in students, sessions, the draft and outbox payloads.
- A network error keeps every item, and retries follow 5 s, 15 s, 60 s, 5 min (Vitest fake timers).
- Two `syncNow()` calls at once send one request.
- A 401 sets `login_needed` and leaves the outbox untouched.
- Pull saves the cursor, sends it next time, updates existing students and applies aliases.
- Logout with waiting items needs confirmation; after it, every table is empty.
- A second user logging in while the first user's items wait is blocked.
- A draft saved and loaded comes back identical.
- A save failing halfway through its transaction leaves neither the record nor the outbox item.

**Server integration** (once 4A is merged; until then against MSW): save a student and a session with no server running, start the server, run `syncNow()`, and find one student and one session with five steps. Run `syncNow()` again and still find one of each.

**Component tests:**

- `UpdatePrompt`: with `needRefresh` true and a draft present, nothing shows; after the draft is removed, the prompt shows, and Reload calls `updateServiceWorker(true)`.
- `InstallGuide`: an iPhone user agent outside the installed app sees the Add to Home Screen steps; inside the installed app it sees nothing.

**End-to-end tests** (Playwright; the service worker cases run in the phone Chromium project):

- **E2E-C1 Offline session:** load and log in online, wait for the service worker, set the context offline, reload. The app loads. Add a student and run a session: the waiting count shows 2. Go back online: within 10 seconds the count is 0, and the database holds both records.
- **E2E-C2 Resend safety:** route the first `/api/sync/push` call so it reaches the server and then aborts before the page sees the answer. The next sync resends, and the database holds one session.
- **E2E-C3 Draft survives reload** (phone Chromium and phone WebKit): reload during Step 3, and the draft comes back with its text and times.
- **E2E-C4 No cached API answers:** offline, a pull fails, the badge shows offline, and no stale data appears.

**Real phones** (results pasted into the pull request):

- iPhone: Add to Home Screen, airplane mode, open the app, record a session, close it, reopen the next day with signal, and see the session arrive.
- Android: install from the prompt, then the same steps.

## Verification checklist

- [ ] The repository contract suite passes on the Dexie repository.
- [ ] All unit and component tests pass, with at least 90% line coverage in `app/src/offline/sync.ts`.
- [ ] E2E-C1 to E2E-C4 pass.
- [ ] `grep -n "autoUpdate\|runtimeCaching\|injectRegister: null" app/vite.config.ts` finds nothing.
- [ ] `grep -rn "SyncManager\|localStorage" app/src/offline` finds nothing.
- [ ] After `npm run build -w app`, the admin chunk's file name does not appear in `app/dist/sw.js`.
- [ ] The real-phone checks are recorded in the pull request.

## Anti-pattern guards

- `registerType: 'autoUpdate'`: its own docs warn it reloads pages mid-form.
- A Workbox `runtimeCaching` rule for `/api`: it would cache private answers.
- The Background Sync API: iPhones don't have it.
- `localStorage` for the outbox or drafts: small, synchronous and without transactions.
- Deciding whether to send from `navigator.onLine`.
- Deleting an outbox item before the server confirms it.
- Clearing phone data at logout without warning while items wait.
- Relying on `navigateFallbackDenylist` alone to keep admin code off phones: it doesn't stop precaching.

## Done when

The checklist is complete, and lane 4B's screens work on the Dexie repository after changing one import.
