# Deploy

## What does a push to `main` do?

DigitalOcean App Platform builds the app from `sadiash/omp-digicoach` with `npm ci && npm run build`. Then the `migrate` job runs `npm run db:migrate -w server` once, against the production database. Only after it succeeds does the new `web` service start and take traffic, once `/api/health` answers.

Nothing merges into `main` unless CI is green on the pull request.

## What does the migrate job do?

It applies every new file in `server/drizzle/` in order and records each in the database. Files that already ran are skipped, so running it twice changes nothing.

**A migration must never break the version already running.** Add columns as nullable or with a default; drop old columns only in a later release. The nightly migration check tests this against the latest `release-*` tag.

Before a release that changes the database, also run the migration on a copy of production restored from the latest backup. See `restore-backup.md`.

## Where do I watch it?

- App Platform → the app → **Activity**: each deployment, its build log and the migrate job's log.
- App Platform → **Runtime Logs** → `web`: the server's log after start.
- From a terminal: `doctl apps list-deployments <app-id>` and `doctl apps logs <app-id> migrate --type run`.

If the build or the migrate job fails, the deploy stops and the previous version keeps serving. Phase 7 proves this with a deliberately failing migration before launch.

## What do I check afterwards?

1. `https://<app address>/api/health` answers `{"ok":true}`.
2. The login page loads.
3. Log in as the `smoke-test` doctor, add a clearly named test student, and record one short session.
4. Log in to the dashboard as the admin and find that session.
5. Remove the test records from the App Platform console:
   `npm run remove-test-records -w server -- --session <session id> --student <student id>`.
   It refuses to remove a student whom any other session refers to, and writes `audit_log`.
6. Switch the `smoke-test` doctor off again.
