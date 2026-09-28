# Roll back

> **Changed on 2026-09-28:** production runs on a DigitalOcean droplet, not App Platform. See `docs/runbooks/droplet.md`. The App Platform steps below are kept for reference.

## How do I go back to the previous version?

1. App Platform → the app → **Activity**.
2. Find the last deployment that worked and choose **Rollback**.
3. Watch it start, then check `/api/health` and the login page.

From a terminal: `doctl apps create-deployment <app-id>` redeploys the current spec; a rollback to an earlier deployment is done in the App Platform screen.

When the fault is fixed, merge the fix into `main`; the push deploys it.

## Why is rolling back safe?

Rollback changes the code, not the database. Migrations only ever expand the database (new tables, nullable columns, columns with defaults), so the previous version still reads and writes it. Columns are dropped only in a later release, after no running version uses them.

**Never write a migration that undoes another.** If a migration itself is wrong, fix it forward with a new migration.

## What about phones?

Phones keep working through a rollback. Anything saved while the server was being replaced waits on the phone and sends on the next sync. An installed app offers its update once no session is in progress.
