#!/usr/bin/env bash
# Dumps the database to /var/backups/omp-digicoach and keeps the last 14 nightly dumps.
# Installed as /usr/local/bin/omp-backup. Runs nightly from omp-backup.timer, and before every deploy.
#
#   omp-backup [label]
set -euo pipefail

DIR=/var/backups/omp-digicoach
LABEL=${1:-nightly}
FILE="$DIR/omp-$(date -u +%Y%m%d-%H%M%S)-$LABEL.dump"

sudo -u postgres pg_dump --format=custom --file="$FILE" omp
echo "Backed up to $FILE ($(du -h "$FILE" | cut -f1))."

# Keeps the newest $2 files matching $1 and deletes the rest. Fine when there are none yet.
keep_newest() {
  find "$DIR" -maxdepth 1 -name "$1" -printf '%T@ %p\n' \
    | sort -rn | tail -n +"$(($2 + 1))" | cut -d' ' -f2- | xargs -r rm --
}
keep_newest 'omp-*-nightly.dump' 14
keep_newest 'omp-*-before-*.dump' 10
