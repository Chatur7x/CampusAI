#!/usr/bin/env bash
# =============================================================
# Deploy the Supabase edge functions changed in Phase A.
#
# Phase A hardened attendance, notices and timetable. Those edits are in the
# repo but NOT live — the deployed functions are still the pre-Phase-A versions,
# so the ownership checks, the PUT allowlists and the class-ownership gate are
# not in effect until this runs.
#
# Requires:
#   - the Supabase CLI   (npm i -g supabase, or npx supabase)
#   - an access token    (supabase login, or export SUPABASE_ACCESS_TOKEN=...)
#   - linked project     (supabase link --project-ref <ref>)
#
# Usage:
#   ./scripts/deploy-edge-functions.sh              # the three Phase A functions
#   ./scripts/deploy-edge-functions.sh --all        # every function in the repo
#   ./scripts/deploy-edge-functions.sh --verify     # deploy, then probe
#
# To verify by hand instead of with --verify, see docs/PHASE_A_QA_CHECKLIST.md.
# =============================================================
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-akgjpqvpcugbmdenpxny}"

# The three functions modified during Phase A. Adding a function here is the
# point of this script — do not silently widen it.
PHASE_A_FUNCTIONS=(
  attendance   # staffOwnsStudent() gate, ALLOWED_STATUSES, PUT handler
  notices      # PUTTABLE_COLUMNS allowlist, getRole/getFacultyId scoping, error hygiene
  timetable    # WRITABLE_COLUMNS allowlist (was mass assignment), getRole/getFacultyId scoping
)

ALL_FUNCTIONS=(
  analytics
  attendance
  backup
  bulk-operations
  notices
  notifications
  security-monitor
  timetable
  verify-face
)

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
dim()   { printf '\033[2m%s\033[0m\n' "$*"; }

log() { printf '\n%s\n' "$*"; }

# Resolve the CLI once: a global install if present, otherwise npx. Override
# with SUPABASE_CMD if neither works.
resolve_cli() {
  if command -v supabase >/dev/null 2>&1; then
    SUPABASE_CMD=(supabase)
  elif command -v npx >/dev/null 2>&1 && npx --no-install supabase --version >/dev/null 2>&1; then
    SUPABASE_CMD=(npx --no-install supabase)
  elif command -v npx >/dev/null 2>&1; then
    SUPABASE_CMD=(npx -y supabase)
  else
    return 1
  fi
  return 0
}

sb() { "${SUPABASE_CMD[@]}" "$@"; }

# ── preflight ──────────────────────────────────────────────────
preflight() {
  if ! resolve_cli; then
    red "Supabase CLI not found."
    dim  "  npm i -g supabase     (preferred)"
    dim  "  or: npm i supabase    (uses npx)"
    exit 1
  fi

  # A token in the environment is enough; otherwise fall back to whatever
  # `supabase login` stored.
  if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]] && ! sb projects list >/dev/null 2>&1; then
    red "Not authenticated with Supabase."
    dim  "  supabase login"
    dim  "  or: export SUPABASE_ACCESS_TOKEN=sbp_…"
    exit 1
  fi

  dim "supabase: $(sb --version 2>/dev/null)"
  dim "project:  $PROJECT_REF"
}

link_project() {
  if sb status >/dev/null 2>&1; then
    dim "already linked"
    return
  fi
  log "Linking to $PROJECT_REF …"
  sb link --project-ref "$PROJECT_REF"
}

# ── deploy ─────────────────────────────────────────────────────
deploy() {
  local -a targets=("$@")
  local -a failed=()

  for fn in "${targets[@]}"; do
    if [[ ! -d "supabase/functions/$fn" ]]; then
      red "skip  $fn — no such directory"
      continue
    fi
    log "Deploying $fn …"
    if sb functions deploy "$fn" --project-ref "$PROJECT_REF"; then
      green "  ok  $fn"
    else
      red  "  FAIL  $fn"
      failed+=("$fn")
    fi
  done

  if [[ ${#failed[@]} -gt 0 ]]; then
    red "Deploy failed for: ${failed[*]}"
    exit 1
  fi
  green "All ${#targets[@]} function(s) deployed."
}

# ── verify ─────────────────────────────────────────────────────
# Negative probes run without credentials: a tampered token must be refused
# before the handler runs. Positive probes need a real session and are skipped
# when the credentials are absent.
verify() {
  local url="${SUPABASE_URL:-https://$PROJECT_REF.supabase.co}"
  local anon="${SUPABASE_ANON_KEY:-}"

  log "Probing $url/functions/v1/ …"

  if [[ -z "$anon" ]]; then
    red "SUPABASE_ANON_KEY not set — cannot probe."
    dim "Run: export SUPABASE_ANON_KEY=eyJ…"
    return 0
  fi

  local fail=0

  # 1. No token at all -> 401
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
    "$url/functions/v1/attendance" \
    -H "apikey: $anon" -H 'Content-Type: application/json' \
    -d '{"studentId":"x","status":"PRESENT"}')
  [[ "$code" == "401" ]] && green "  ok  attendance: no token -> 401" \
                         || { red "  FAIL  attendance: no token -> $code (want 401)"; fail=1; }

  # 2. Tampered token -> 401
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
    "$url/functions/v1/attendance" \
    -H "apikey: $anon" -H 'Authorization: Bearer not.a.real.token' \
    -H 'Content-Type: application/json' \
    -d '{"studentId":"x","status":"PRESENT"}')
  [[ "$code" == "401" ]] && green "  ok  attendance: tampered token -> 401" \
                         || { red "  FAIL  attendance: tampered token -> $code (want 401)"; fail=1; }

  # 3. Student token must not be able to mark -> 403
  if [[ -n "${STUDENT_JWT:-}" ]]; then
    code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
      "$url/functions/v1/attendance" \
      -H "apikey: $anon" -H "Authorization: Bearer $STUDENT_JWT" \
      -H 'Content-Type: application/json' \
      -d '{"studentId":"some-other-student","status":"PRESENT"}')
    [[ "$code" == "403" || "$code" == "401" ]] \
      && green "  ok  attendance: student token -> $code (refused)" \
      || { red "  FAIL  attendance: student token -> $code (want 403)"; fail=1; }
  else
    dim "  skip  student probe (set STUDENT_JWT)"
  fi

  # 4. Faculty token from another class must not be able to mark -> 403
  if [[ -n "${FACULTY_JWT:-}" ]]; then
    code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
      "$url/functions/v1/attendance" \
      -H "apikey: $anon" -H "Authorization: Bearer $FACULTY_JWT" \
      -H 'Content-Type: application/json' \
      -d '{"studentId":"a-student-in-a-different-class","status":"PRESENT"}')
    [[ "$code" == "403" || "$code" == "404" ]] \
      && green "  ok  attendance: foreign faculty -> $code (refused)" \
      || { red "  FAIL  attendance: foreign faculty -> $code (want 403)"; fail=1; }
  else
    dim "  skip  faculty probe (set FACULTY_JWT)"
  fi

  # 5. notices and timetable must also reject an anonymous caller
  for fn in notices timetable; do
    code=$(curl -s -o /dev/null -w '%{http_code}' -X GET \
      "$url/functions/v1/$fn" \
      -H "apikey: $anon" -H 'Authorization: Bearer not.a.real.token')
    [[ "$code" == "401" ]] && green "  ok  $fn: tampered token -> 401" \
                           || { red "  FAIL  $fn: tampered token -> $code (want 401)"; fail=1; }
  done

  [[ $fail -eq 0 ]] && green "All probes passed." || red "One or more probes failed."
  return $fail
}

# ── main ───────────────────────────────────────────────────────
main() {
  cd "$(dirname "$0")/.."

  local -a targets=("${PHASE_A_FUNCTIONS[@]}")
  local do_verify=0

  for arg in "$@"; do
    case "$arg" in
      --all)    targets=("${ALL_FUNCTIONS[@]}") ;;
      --verify) do_verify=1 ;;
      -h|--help) sed -n '2,26p' "$0"; exit 0 ;;
      *)        red "Unknown argument: $arg"; exit 1 ;;
    esac
  done

  log "Phase A edge-function deploy"
  dim "${targets[*]}"

  preflight
  link_project
  deploy "${targets[@]}"

  if [[ $do_verify -eq 1 ]]; then
    log "Verifying"
    verify
  else
    dim "Skipping verification. Re-run with --verify, or follow docs/PHASE_A_QA_CHECKLIST.md."
  fi

  green "Done."
}

main "$@"
