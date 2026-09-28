#!/usr/bin/env bash
# Prepares a fresh Ubuntu 24.04 droplet for OMP DigiCoach. Run once, as root. Safe to run again:
# every step checks whether it is already done.
#
#   bash deploy/droplet/setup.sh
set -euo pipefail

REPO_URL=${REPO_URL:-https://github.com/mujimushi/omp-digicoach-prototype.git}
APP_USER=omp
APP_HOME=/srv/omp-digicoach
APP_DIR=$APP_HOME/app
ENV_FILE=/etc/omp-digicoach/env
DOMAIN=${DOMAIN:-ompdigicoach.com}

say() { printf '\n== %s\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo 'Run as root.' >&2; exit 1; }

say 'Swap: 2 GB, so building the app fits in 1 GB of memory'
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
sysctl -q vm.swappiness=10
echo 'vm.swappiness=10' > /etc/sysctl.d/99-omp-swappiness.conf

say 'Packages'
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -yq
apt-get install -yq ca-certificates curl gnupg git ufw unattended-upgrades debian-keyring debian-archive-keyring apt-transport-https

# Node.js 22 from NodeSource, matching .nvmrc.
if ! node --version 2>/dev/null | grep -q '^v22\.'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -yq nodejs
fi

# Caddy from its official repository. It obtains and renews the HTTPS certificate itself.
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -yq caddy
fi

# PostgreSQL 16, Ubuntu 24.04's own version and the one CI uses. It listens only on this machine.
apt-get install -yq postgresql-16

say 'Automatic security updates'
dpkg-reconfigure -f noninteractive unattended-upgrades
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

say 'Firewall: SSH, HTTP and HTTPS only'
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

say 'App user and folders'
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$APP_HOME" --shell /bin/bash "$APP_USER"
install -d -o root -g "$APP_USER" -m 750 /etc/omp-digicoach
install -d -o postgres -g postgres -m 750 /var/backups/omp-digicoach

say 'Database'
if ! sudo -u postgres psql -tAc "select 1 from pg_roles where rolname = 'omp'" | grep -q 1; then
  DB_PASSWORD=$(openssl rand -hex 24)
  sudo -u postgres psql -q -c "create role omp login password '$DB_PASSWORD'"
  sudo -u postgres psql -q -c 'create database omp owner omp'
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://omp:$DB_PASSWORD@127.0.0.1:5432/omp
APP_ORIGIN=https://$DOMAIN
EOF
  chown root:"$APP_USER" "$ENV_FILE"
  chmod 640 "$ENV_FILE"
fi

say 'Code'
if [ ! -d "$APP_DIR/.git" ]; then
  sudo -u "$APP_USER" git clone --quiet "$REPO_URL" "$APP_DIR"
fi

say 'Services, backups and web server'
SRC=$APP_DIR/deploy/droplet
install -m 644 "$SRC/omp-digicoach.service" /etc/systemd/system/omp-digicoach.service
install -m 644 "$SRC/omp-backup.service" /etc/systemd/system/omp-backup.service
install -m 644 "$SRC/omp-backup.timer" /etc/systemd/system/omp-backup.timer
install -m 755 "$SRC/backup.sh" /usr/local/bin/omp-backup
install -m 755 "$SRC/deploy.sh" /usr/local/bin/omp-deploy
install -m 755 "$SRC/omp.sh" /usr/local/bin/omp
install -m 644 "$SRC/Caddyfile" /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable --now omp-backup.timer
systemctl enable omp-digicoach.service
systemctl reload caddy || systemctl restart caddy

say 'Done. Next: omp-deploy'
