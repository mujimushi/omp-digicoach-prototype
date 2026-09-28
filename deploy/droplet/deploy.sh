#!/usr/bin/env bash
# Deploys a commit of main to this droplet: backs up the database, builds, migrates, restarts.
# Run as root. Installed as /usr/local/bin/omp-deploy by setup.sh.
#
#   omp-deploy              the latest main from GitHub
#   omp-deploy <commit>     a given commit or tag, for example to roll back
set -euo pipefail

APP_USER=omp
APP_DIR=/srv/omp-digicoach/app
ENV_FILE=/etc/omp-digicoach/env
REF=${1:-origin/main}

say() { printf '\n== %s\n' "$*"; }
as_app() { sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR' && $1"; }

[ "$(id -u)" -eq 0 ] || { echo 'Run as root.' >&2; exit 1; }

say "Fetching $REF"
as_app 'git fetch --quiet --tags origin'
PREVIOUS=$(as_app 'git rev-parse --short HEAD')
as_app "git checkout --quiet --detach '$REF'"
CURRENT=$(as_app 'git rev-parse --short HEAD')
echo "Was $PREVIOUS, now $CURRENT."

say 'Installing and building'
as_app 'npm ci --no-audit --no-fund --loglevel=error'
as_app 'NODE_ENV=production npm run build'

say 'Backing up the database before migrating'
/usr/local/bin/omp-backup "before-$CURRENT"

say 'Migrating'
as_app "set -a && . '$ENV_FILE' && set +a && npm run db:migrate -w server"

# Keep the server scripts in step with the repository.
install -m 755 "$APP_DIR/deploy/droplet/backup.sh" /usr/local/bin/omp-backup
install -m 755 "$APP_DIR/deploy/droplet/deploy.sh" /usr/local/bin/omp-deploy
install -m 755 "$APP_DIR/deploy/droplet/omp.sh" /usr/local/bin/omp

say 'Restarting'
systemctl restart omp-digicoach
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "Deployed $CURRENT. Health check passed."
    echo "To roll back: omp-deploy $PREVIOUS"
    exit 0
  fi
  sleep 1
done
echo "The server didn't pass its health check. See: journalctl -u omp-digicoach -n 50" >&2
echo "To roll back: omp-deploy $PREVIOUS" >&2
exit 1
