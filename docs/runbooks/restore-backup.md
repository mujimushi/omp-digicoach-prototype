# Restore a backup

DigitalOcean backs up the database every day and keeps backups for 7 days, with restore to any point in that window. A restore always creates a **new** cluster, called a fork; the production database is never overwritten.

## How do I check a backup restores?

Do this before launch (phase 7), and before a release that changes the database.

1. Find the production cluster's ID: `doctl databases list`.
2. Fork it: `doctl databases fork omp-restore-check --restore-from-cluster-id <cluster id>`.
   Add `--restore-from-timestamp <UTC time>` to restore to a point in time. Note the time you start.
3. Wait until `doctl databases get <fork id>` shows `online`.
4. Allow your own address: `doctl databases firewalls append <fork id> --rule ip_addr:<your IP>`.
5. Get the fork's connection details: `doctl databases connection <fork id>`, and download its CA certificate from the cluster's page.

## How do I look at the fork without changing it?

Point a local server or `psql` at the fork with every transaction read-only. Add this to the connection URL:

```
?options=-c%20default_transaction_read_only%3Don
```

Compare row counts with production:

```sql
select 'users' as t, count(*) from users
union all select 'students', count(*) from students
union all select 'teaching_sessions', count(*) from teaching_sessions
union all select 'session_steps', count(*) from session_steps
union all select 'pearls', count(*) from pearls;
```

The fork should match production at the restore time. Sessions sent after that time are missing, as expected.

## How do I clean up?

1. Delete the fork: `doctl databases delete <fork id>`. It costs money while it runs.
2. Write down how long steps 2 to 6 took, in the pilot notes.
