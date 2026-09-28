# Phase 7: Deploy

> **Changed on 2026-09-28:** production runs on a DigitalOcean droplet, not App Platform. See `docs/runbooks/droplet.md`. The App Platform steps below are kept for reference.

**Read first:** `docs/plan/00-allowed-apis.md` (section DigitalOcean App Platform and Managed PostgreSQL), `docs/runbooks/` (from phase 4E), `.do/app.yaml`.
**Depends on:** phase 6 passed, and the DigitalOcean account.
**Runs:** in order.
**Size:** 2–3 days.

## Decision needed before starting

**Region.** Bangalore (BLR1) is the nearest DigitalOcean region to Pakistan. Frankfurt (FRA1) is further away but keeps data in the EU. Check whether the ethics approval says where study data may be stored, then choose. Both the database and the app go in the same region.

## What to do

### 1. Account and access

- Create the DigitalOcean account and a project named "OMP DigiCoach". Set up billing so Prof. Muneeza pays, and add a second owner so there is never a single point of access.
- Connect GitHub and allow access to `sadiash/omp-digicoach` only.
- Install `doctl` and log in; now run `doctl apps spec validate .do/app.yaml` if phase 4E couldn't.

### 2. Database

- Create a Managed PostgreSQL cluster in the chosen region: the smallest production size (1 GB), and the same major version used in CI (or update CI to match).
- Put its name into `cluster_name` in `.do/app.yaml`.

### 3. App

- Create the app with `doctl apps create --spec .do/app.yaml --wait`.
- Add the app as a trusted source on the database: `doctl databases firewalls append <cluster-id> --rule app:<app-id>`.
- Watch the first deploy: the `migrate` job runs first, then the web service passes its `/api/health` check.

### 4. Prove the deploy behaves as the plan assumes

Do these before any real user or data exists:

- [ ] **Failing migration:** deploy a scratch commit whose migration fails on purpose. Confirm that the deploy stops and the previous version keeps serving. Then revert. The docs don't state this behaviour, so the plan depends on this test.
- [ ] **Rollback:** redeploy the previous deployment from the App Platform screen, then deploy `main` again.
- [ ] **TLS to the database:** the server's startup log shows a verified TLS connection using `DATABASE_CA_CERT`.
- [ ] **Cookie and headers over HTTPS:** the login response sets `__Host-omp_session` with `Secure`, `HttpOnly` and `SameSite=Strict`, and the page has the content security policy with `worker-src` and `manifest-src`.
- [ ] **Install from production:** the app installs on the iPhone and the Android phone from the `ondigitalocean.app` address.

### 5. Accounts

- Run `create-admin` for Prof. Muneeza from the App Platform console, following `docs/runbooks/create-admin.md`. Give her the temporary password in person or by phone, never by email or chat.
- Create a `smoke-test` doctor for the smoke test. Switch it off afterwards.

### 6. Smoke test: `scripts/smoke-production.ts`

Run a short Playwright script against production:

- The health check passes and the login page loads.
- The `smoke-test` doctor logs in, adds a clearly named test student, and records one session.
- The admin sees that session.
- Remove the test session and test student with `npm run remove-test-records -w server -- --session <id> --student <id>` from the App Platform console. The command refuses to remove a student who has sessions from any other doctor, and writes `audit_log`.

### 7. Backup restore drill

Follow `docs/runbooks/restore-backup.md` on the first day's backup:

- Fork the cluster from the backup.
- Connect a local server read-only and compare row counts.
- Delete the fork.
- Record how long it took.

### 8. Monitoring

- App Platform alerts to Sadia's email: deploy failed, instance restarts, CPU or memory above 80%.
- Database alerts: CPU and disk above 80%.
- A DigitalOcean uptime check on `/api/health`.

### 9. Release tag

Tag the deployed commit `release-YYYYMMDD` and push the tag to `origin`. The nightly migration check uses the latest release tag.

## Checklist

- [ ] Region chosen, with the reason recorded.
- [ ] App and database running; the migrate job ran; health check passing.
- [ ] Every box in section 4 is ticked.
- [ ] Prof. Muneeza has logged in and changed her password.
- [ ] Smoke test passed and its test data is cleaned up.
- [ ] Restore drill done and timed.
- [ ] Alerts and the uptime check fire on a test.
- [ ] `release-*` tag pushed.
- [ ] The first week's bill is within the estimate: about $27 a month for a 1 GB app instance and a 1 GB database.

## Anti-pattern guards

- Running migrations from the service's `run_command`.
- Using App Platform's development database for production.
- Putting secrets into `.do/app.yaml` or into the repository.
- Sending passwords by email or chat.
- Skipping the failing-migration test because "it's probably fine".

## Done when

The checklist is complete. Phase 8, the pilot, can begin.
