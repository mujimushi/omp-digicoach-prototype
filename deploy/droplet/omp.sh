#!/usr/bin/env bash
# Runs a server command against production, with its settings. Installed as /usr/local/bin/omp.
#
#   omp create-admin --name "Prof. Muneeza Rizwan" --username muneeza
#   omp remove-test-records --session <id> --student <id>
set -euo pipefail

[ $# -ge 1 ] || { echo 'Usage: omp <server script> [arguments]' >&2; exit 1; }
script=$1
shift
quoted=''
[ $# -eq 0 ] || quoted=$(printf ' %q' "$@")
sudo -u omp -H bash -c "cd /srv/omp-digicoach/app && set -a && . /etc/omp-digicoach/env && set +a && npm run --silent $script -w server --$quoted"
