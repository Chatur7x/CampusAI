#!/usr/bin/env bash
# Runs only the verify() probes from the deploy script against the currently
# deployed functions, so the probe logic itself can be tested without deploying.
set -uo pipefail
cd "$(dirname "$0")/.."

PROJECT_REF="${SUPABASE_PROJECT_REF:-akgjpqvpcugbmdenpxny}"

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
dim()   { printf '\033[2m%s\033[0m\n' "$*"; }
log() { printf '\n%s\n' "$*"; }

# Pull verify() and its colour helpers out of the deploy script verbatim, so
# this exercises the real code rather than a copy.
eval "$(awk '/^(red|green|dim|log)\(\)/,/^}/' scripts/deploy-edge-functions.sh)"
eval "$(awk '/^verify\(\) \{/,/^\}/' scripts/deploy-edge-functions.sh)"

verify
exit $?
