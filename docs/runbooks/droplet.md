# The production server (droplet)

Since 2026-09-28 the app runs on one DigitalOcean droplet instead of App Platform. This replaces `deploy.md`, `rollback.md` and `restore-backup.md` where they describe App Platform; `.do/app.yaml` is no longer used.

| | |
|---|---|
| Address | https://ompdigicoach.com (`www.` redirects there) |
| Droplet | `ubuntu-s-1vcpu-1gb-nyc1`, 159.223.183.20, Ubuntu 24.04, 1 GB memory, 2 GB swap |
| Domain | Registered at Hostinger. DNS: `A @ → 159.223.183.20`, `CNAME www → ompdigicoach.com` |
| Code | `/srv/omp-digicoach/app`, a clone of `main`, owned by the `omp` user |
| Settings | `/etc/omp-digicoach/env`: database address and password, readable by root and `omp` only |
| Setup | `deploy/droplet/setup.sh`, run once as root; safe to run again |

## What runs on it?

| Part | What it does |
|---|---|
| Caddy | Answers on ports 80 and 443, gets and renews the HTTPS certificate, passes requests to the app |
| `omp-digicoach` service | The Node server on port 3000, serving the API and the built app. Restarts itself if it stops. |
| PostgreSQL 16 | The database `omp`, reachable only from the droplet itself |
| `omp-backup.timer` | Dumps the database at 02:00 Pakistan time into `/var/backups/omp-digicoach`, keeping 14 nights |
| ufw | Only SSH, HTTP and HTTPS are open |
| unattended-upgrades | Installs Ubuntu security updates daily |

## How do I log in to it?

`ssh root@159.223.183.20` with a key listed in `/root/.ssh/authorized_keys`, or DigitalOcean → the droplet → **Access** → **Launch Droplet Console**.

## How do I deploy?

After changes are pushed to `main` and CI is green:

```
omp-deploy
```

It fetches `main`, installs, builds, backs up the database, runs the migrations, restarts the app and checks `/api/health`. It prints the previous commit for rolling back. Building takes several minutes on this droplet.

## How do I roll back?

```
omp-deploy <previous commit>
```

This redeploys older code. It doesn't undo migrations, which are written so the previous version keeps working with them (see `deploy.md`). To undo data changes as well, restore the backup taken before the deploy (below).

## How do I run a server command?

```
omp create-admin --name "Prof. Muneeza Rizwan" --username muneeza
omp remove-test-records --session <id> --student <id>
```

`omp` runs the command as the app user with the production settings.

## Where are the logs?

```
journalctl -u omp-digicoach -n 100      # the app
journalctl -u caddy -n 50               # HTTPS and the certificate
journalctl -u omp-backup -n 20          # last backups
systemctl list-timers omp-backup.timer  # next backup
```

## How do I restore a backup?

Backups are in `/var/backups/omp-digicoach`: `…-nightly.dump` every night, and `…-before-<commit>.dump` before each deploy.

```
systemctl stop omp-digicoach
sudo -u postgres pg_restore --clean --if-exists --dbname omp /var/backups/omp-digicoach/<file>.dump
systemctl start omp-digicoach
```

**The backups live on the droplet itself.** If the droplet is lost, so are they. Turn on DigitalOcean's droplet backups (the droplet → **Backups**) so a copy of the whole server exists elsewhere, and copy a dump off the server now and then:

```
scp root@159.223.183.20:/var/backups/omp-digicoach/<file>.dump .
```
