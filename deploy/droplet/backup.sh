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

# Nightly dumps: keep 14. Dumps taken before a deploy: keep 10.
ls -1t "$DIR"/omp-*-nightly.dump 2>/dev/null | tail -n +15 | xargs -r rm --
ls -1t "$DIR"/omp-*-before-*.dump 2>/dev/null | tail -n +11 | xargs -r rm --
