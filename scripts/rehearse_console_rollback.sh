#!/usr/bin/env bash
# Rehearse the Console pause, rollback and forward-fix plan without executing it.
#
# The Console half of the same contract the backend script holds: exit 0 on a
# rehearsable plan, 1 on an unrehearsable one, 64 on a usage error. Rehearsal is
# read-only, so it prints the plan it would run and refuses a profile that could
# reach a live or model-bearing path.
set -euo pipefail
set +x

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if (( $# != 1 )); then
  printf 'CONSOLE_ROLLBACK_REHEARSAL_USAGE\n' >&2
  exit 64
fi

profile="$1"
if [[ ! -f "$profile" ]]; then
  printf 'CONSOLE_ROLLBACK_REHEARSAL_PROFILE_MISSING\n' >&2
  exit 64
fi

node "${repository_root}/tools/verify/rehearse-rollback.mjs" "$profile"
