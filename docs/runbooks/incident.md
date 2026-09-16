# Incidents

## Who do I call?

| Who | For | How |
|---|---|---|
| Sadia | The app, the server, deploys and data | Phone number filled in at launch (phase 7) |
| Prof. Muneeza Rizwan | Doctors' accounts, the study, the DigitalOcean bill | Phone number filled in at launch (phase 7) |
| DigitalOcean support | The platform or the database being down | Cloud control panel → Support |

## Where are the logs?

- App Platform → the app → **Runtime Logs** → `web`: every request, with no passwords, cookies or request bodies.
- App Platform → **Activity**: builds, deploys and the migrate job.
- From a terminal: `doctl apps logs <app-id> web --type run --follow`.
- The database's own metrics: DigitalOcean → Databases → the cluster → **Insights**.
- Who changed what: the `audit_log` table, and each student's change history in the dashboard.

## How do I stop one person using the app?

Dashboard → **Doctors** → their name → **Edit** → **Switch off**. Their logins stop at their next request, on every device; their sessions stay. If only their password may be known to someone else, reset it instead.

## How do I stop the whole app?

1. First, switch off the affected accounts from the dashboard, which takes effect immediately.
2. To take the app offline, use App Platform's maintenance mode for the app. **Confirm this control in phase 7**, before launch, and note the exact steps here.

Phones keep their saved sessions while the app is offline and send them once it returns.

## What if data looks wrong or lost?

Don't change or delete anything in production. Restore a copy from backup, following `restore-backup.md`, and compare there. Every correction to a student and every deleted session is in `audit_log` with who did it and the values before and after.
