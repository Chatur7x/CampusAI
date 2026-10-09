# Runbook

One page. Operational procedures for CampusAI. For *how the product works*, see
`docs/ADMIN_GUIDE.md`, `docs/FACULTY_GUIDE.md`, `docs/STUDENT_FAQ.md`,
`docs/COMPANY_GUIDE.md`. For *what the endpoints are*, see `docs/API.md`.

Everything here was read from the repository. Steps marked **⚠ VERIFY** need a
human with credentials before you trust them.

---

## 0. Services at a glance

| Service | Runs on | Health check | Logs |
| --- | --- | --- | --- |
| Frontend (Vite SPA) | Vercel | `GET /` | Vercel dashboard |
| Express backend | Railway (`backend`) | `GET /api/health` | Railway dashboard, `railway logs` |
| AI server (FastAPI) | Railway (`ai-server`) | `GET /health` | Railway dashboard |
| Supabase | Supabase Cloud | Dashboard | Supabase dashboard |
| Edge functions | Supabase Edge | invoke directly | Supabase → Edge Functions → Logs |

Deploy pipelines: `.github/workflows/deploy.yml` (everything, on push to
`main`), `frontend.yml`, `aiserver.yml`, `backend.yml`, `ci.yml`.

---

## 1. Deploy

### 1.1 Normal deploy — push to `main`

`deploy.yml` runs on a push to `main` and does, in order:

1. **frontend** — `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm run build`,
   uploads `dist/`.
2. **ai-server** — install deps, `ruff check`, `py_compile`, then a stubbed
   import to confirm `main.app` loads.
3. **backend** — `npm ci`, `npx prisma generate`, `npx tsc --noEmit`.
4. **deploy-vercel** — production deploy of `dist/`.
5. **deploy-ai-server** — Railway, service `ai-server`, directory `ai-server`.
6. **deploy-backend** — Railway, service `backend`, directory `server--backend`.
7. **deploy-edge-functions** — `supabase link` then
   `supabase functions deploy --no-verify-jwt`.

Required GitHub secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`,
`RAILWAY_TOKEN`, `RAILWAY_PROJECT_ID`, `SUPABASE_ACCESS_TOKEN`,
`SUPABASE_PROJECT_REF`.

> **⚠ The workflow is lenient by design and you should know where.** Lint,
> type-check and the Prisma generate are all `|| echo "…"` — they cannot fail
> the pipeline. So a push to `main` can ship a frontend that does not type-check.
> Run `npm test`, `npx tsc -b` and `npx eslint .` locally before pushing.
>
> `deploy.yml` also runs `supabase functions deploy --no-verify-jwt` **without**
> the probes. Use the script below instead for any security-relevant function
> change.

### 1.2 Deploy edge functions deliberately

```bash
export SUPABASE_ACCESS_TOKEN=sbp_…
export SUPABASE_PROJECT_REF=akgjpqvpcugbmdenpxny   # or your project

# Phase-A functions only (attendance, notices, timetable)
./scripts/deploy-edge-functions.sh

# Every function in the repo
./scripts/deploy-edge-functions.sh --all

# Deploy, then run the auth probes against what is live
./scripts/deploy-edge-functions.sh --all --verify
```

`scripts/deploy-edge-functions.sh` deploys a fixed list. Adding a function to
that list is a deliberate edit — do not widen it casually. It resolves the CLI
from a global install, then `npx --no-install`, then `npx -y`, and links the
project if needed.

`--verify` runs, against `{SUPABASE_URL}/functions/v1/`:

1. `attendance` with no token → expect `401`
2. `attendance` with a tampered token → expect `401`
3. `attendance` with a **student** token marking another student → expect `403`/`401`
   (set `STUDENT_JWT`)
4. `attendance` with a **faculty** token from a different class → expect `403`/`404`
   (set `FACULTY_JWT`)
5. `notices` and `timetable` with a tampered token → expect `401`

Probes 3 and 4 are skipped unless you export those JWTs. **Run all five before
shipping an attendance change.**

To test the probe logic without deploying:

```bash
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_ANON_KEY=eyJ…
./scripts/probe-edge-functions.sh
```

`scripts/probe-edge-functions.sh` `eval`s the real `verify()` out of the deploy
script, so it tests the shipped probes rather than a copy.

### 1.3 Manual deploys

```bash
# Frontend
npm ci && npm run build          # then push; deploy.yml handles Vercel
vercel --prod                    # or deploy by hand with the CLI

# AI server
cd ai-server && railway up

# Express backend
cd server--backend && railway up

# Local full stack
docker compose up -d --build
docker compose up -d --build --profile postgres   # + local Postgres (needs pgvector)
docker compose logs -f ai-server
docker compose down -v
```

### 1.4 Database migrations

Migrations in `supabase/migrations/` are numbered `001`–`013` plus
`ai_adaptive_schema.sql` and `v4_biometric_optimization.sql`. They are written to
be idempotent (`IF EXISTS` / `IF NOT EXISTS`, `DROP POLICY IF EXISTS`), and
several are annotated as live-verified.

```bash
supabase link --project-ref <ref>
supabase db push                       # if you have them under migrations/
psql "$DATABASE_URL" -f supabase/migrations/012_security_hardening.sql
```

**Take a backup first** (§3). Several migrations `DROP POLICY` — re-running an
older one after a newer one can silently remove a control.

Migrations `001`–`005` assume snake_case; the live schema is Prisma camelCase
and `004_fix_camelcase_schema.sql` exists purely to fix that. If you are
provisioning a **fresh** database, prefer generating it from
`server--backend/prisma/schema.prisma` and then applying only the migrations
that add features rather than reshaping columns.

`v4_biometric_optimization.sql` requires the **pgvector** extension. On Supabase
Cloud it must be enabled in the dashboard first.

---

## 2. Rollback

### 2.1 Frontend (Vercel)

Vercel keeps every deployment. Fastest path: **Promote** the previous
deployment to production in the dashboard. No rebuild needed.

```bash
vercel ls                                   # list deployments
vercel rollback <deployment-url-or-scope>   # CLI rollback
```

### 2.2 AI server / Express backend (Railway)

Railway redeploys from git. Roll back by redeploying the previous commit:

```bash
cd ai-server        # or server--backend
git log --oneline -10
git checkout <last-good-sha>
railway up
```

Then confirm:

```bash
curl -sf https://<ai-host>/health
curl -sf https://<backend-host>/api/health
```

### 2.3 Edge functions

There is no per-function rollback in the CLI. Redeploy the previous version of
the file:

```bash
git checkout <last-good-sha> -- supabase/functions/
./scripts/deploy-edge-functions.sh --all --verify
```

### 2.4 Database

**There is no down-migration in this repository.** Rolling back the database
means restoring from backup (§3). This is the single most important operational
fact on this page.

Before any migration that touches RLS or drops a policy, capture the current
policy set so you can put it back:

```sql
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Save that output. Restoring a dropped policy by hand under time pressure is
error-prone.

### 2.5 Rolling back a bad face-enrolment change

If a change to the face pipeline causes mass false negatives, the fastest
mitigation is configuration, not a code rollback:

```bash
FACE_SIMILARITY_THRESHOLD   # AI server, default 0.55
FACE_CONFIDENCE_THRESHOLD   # Express, default 0.6
CAMPUS_RADIUS_M             # AI server geofence, default 500
CONF_WEIGHT_*               # confidence component weights
```

Lower the threshold to accept more matches, widen the radius, or set
`LIVENESS_CHALLENGE_ENABLED=false` to drop the challenge while you investigate.

> **⚠ Do not touch `BLOCKCHAIN_SALT`.** Attendance hashes are
> `sha256(payload + salt)`. Changing the salt invalidates every stored hash and
> `/api/blockchain/status` will report `TAMPERED` for the whole history. If the
> salt has leaked, the correct response is to accept the invalidation, document
> it, and re-chain — not to quietly rotate.

---

## 3. Backup and restore

### 3.1 What backups exist

1. **Application-level JSON export** — the `backup` edge function dumps 13
   tables to the private `db-backups` storage bucket (50 MB limit;
   `application/json|gzip|text/csv`). Every row is logged in the `backups`
   table, with `retention_days` default **30**.
2. **Platform backups** — Supabase's own managed backups and point-in-time
   recovery. These are the ones you will actually restore from.

The edge function's table list:

```
profiles  students  faculty  departments  courses  classes  subjects
attendance  timetable_entries  leave_requests  notices  notifications
audit_logs
```

> **⚠ `students` is included and `students.face_data` holds a face embedding.**
> Application backups therefore contain biometric templates. Store them with the
> same controls as production, and treat their 30-day expiry as a real
> deletion schedule — see `docs/DATA_RETENTION.md`.

> **⚠ What is NOT in that list:** `face_embeddings`, `face_verification_logs`,
> `geo_verifications`, `login_history`, `security_events`, `security_alerts`,
> `token_blacklist`, `trusted_devices`, `sessions`, `password_resets`,
> `mfa_backup_codes`, `api_request_log`, `blockchain_hashes`, `grades`,
> `organizations`. The edge function is **not** a complete backup. Rely on
> platform backups and point-in-time recovery.

### 3.2 Trigger a backup

```bash
# Admin token required
curl -X POST "$SUPABASE_URL/functions/v1/backup" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"manual"}'
```

Or call it from the Supabase dashboard with an admin JWT.

### 3.3 Scheduled backups

`supabase/functions/backup/index.ts` documents a `pg_cron` schedule. Enable it in
Supabase → Database → Extensions → `pg_cron`:

```sql
SELECT cron.schedule('nightly-backup', '0 2 * * *', $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/backup',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
    body := '{"type":"automatic"}'::jsonb)
$$);
```

> **⚠ VERIFY** before relying on this. Using the **service-role key** in a cron
> body means the call is not made as an admin. The function requires
> `profiles.role IN ('SUPER_ADMIN','ADMIN')`, and a service-role JWT does not
> carry that profile role — so this schedule will most likely return `403`.
> Confirm the behaviour against your project, and if it fails, schedule it as an
> admin user or trigger it from an external scheduler.

`backup_summary` is a view over the `backups` table:
`total_backups, successful, failed, last_successful_backup, total_size_bytes,
total_size_mb`.

Prune old completed backups with `SELECT cleanup_old_backups();` — it honours
each row's `retention_days` (default 30).

### 3.4 Verify a backup actually completed

```sql
SELECT filename, size, status, created_at, completed_at, metadata
FROM backups
ORDER BY created_at DESC
LIMIT 10;

SELECT * FROM backup_summary;
```

Alert if `last_successful_backup` is more than 26 hours old.

### 3.5 Restore

**Prefer platform point-in-time recovery.** In the Supabase dashboard:
Database → Backups / Restore → pick a point → confirm. This is a full-database
restore and it is the only complete option, because the edge-function export
omits several tables.

From a local dump:

```bash
# 1. Take a snapshot of what you are about to overwrite
pg_dump "$DATABASE_URL" --format=custom --file=before_restore_$(date +%F).dump

# 2. Restore
pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" backup.dump

# 3. Re-apply RLS (a restore can leave policies in an unexpected state)
psql "$DATABASE_URL" -f supabase/migrations/012_security_hardening.sql

# 4. Verify
psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_policies WHERE schemaname='public';"
```

> **⚠** `--clean` drops objects before recreating them. That is destructive and
> irreversible without the pre-restore dump. Get explicit sign-off, and confirm
> the pre-restore dump exists and is non-trivial in size **before** you run it.

Restoring the `db-backups` bucket export instead (JSON, partial — see the table
list in §3.1):

```bash
curl -o restore.json "$SUPABASE_URL/storage/v1/object/download/db-backups/<filename>" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"

# Then load with your own tooling; there is no importer in this repository.
```

### 3.6 Restore drill

Quarterly. Restore into a scratch project, not production, and check:

- [ ] `profiles`, `students`, `faculty` counts match the pre-restore snapshot
- [ ] `pg_policies` count matches
- [ ] a student can read their own attendance
- [ ] a student **cannot** read another student's
- [ ] `face_embeddings` is not readable by `authenticated`
- [ ] the AI server `/health` returns `ok` against the restored project

---

## 4. Rotate a secret

### 4.1 Inventory

| Secret | Where it lives | Used by |
| --- | --- | --- |
| `JWT_SECRET` | Express | Signs access tokens |
| `JWT_REFRESH_SECRET` | Express | Signs refresh tokens |
| `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` | Vercel env, `.env` | Client. Safe to expose; RLS is the control |
| `SUPABASE_SERVICE_ROLE_KEY` | AI server, edge functions | **Bypasses RLS.** Never in the browser |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI / GitHub secrets | `supabase functions deploy` |
| `BLOCKCHAIN_SALT` | Express | Attendance hash chain. **Do not rotate** — §2.5 |
| SMTP / SendGrid / Resend keys | Express, edge functions | Outbound mail |
| `VERCEL_TOKEN`, `RAILWAY_TOKEN` | GitHub secrets | Deploys |

### 4.2 Rotate `SUPABASE_SERVICE_ROLE_KEY`

1. Supabase dashboard → Project Settings → API → **Rotate / reveal** the new key.
2. Update every consumer **in this order**: AI server (Railway env), then edge
   functions (`supabase secrets set`), then anything else.
3. Redeploy the AI server.
4. Verify:

```bash
curl -sf https://<ai-host>/health
# then exercise one real verify through the UI
```

The old key stays valid briefly. **Do not delete it until every consumer is
confirmed on the new one** — a mismatch means `face_register`, `/verify` and all
analytics silently fail while login keeps working, which is a confusing
failure mode.

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<new> --project-ref <ref>
```

### 4.3 Rotate `JWT_SECRET` / `JWT_REFRESH_SECRET`

Rotating `JWT_SECRET` invalidates every Express access token, so every user is
logged out. Rotating `JWT_REFRESH_SECRET` does the same for refresh tokens.
There is no dual-key grace period.

```bash
cd server--backend
# set the new value in Railway, then:
railway up
```

Expect a logout spike. Announce it. Afterwards:

```sql
-- Optional: clear the now-dead sessions
DELETE FROM sessions;
```

### 4.4 Rotate `SUPABASE_ACCESS_TOKEN`

Personal access tokens: Supabase dashboard → Account → Access Tokens. Update
`SUPABASE_ACCESS_TOKEN` in GitHub secrets **and** in your shell. Revoke the old
one only after a deploy succeeds with the new one.

### 4.5 Rotate mail provider keys

Update in Railway / edge-function secrets, redeploy, then send one password
reset end to end. Password reset is the mail path most likely to be silently
broken — a failed send still returns `200 "If the email exists…"`.

### 4.6 Rotate `JWT_SECRET` after a suspected compromise

1. Rotate `JWT_SECRET` and `JWT_REFRESH_SECRET` (§4.3).
2. Rotate `SUPABASE_SERVICE_ROLE_KEY` (§4.2).
3. Purge sessions and blacklist rows:

```sql
DELETE FROM sessions;
DELETE FROM token_blacklist;
```

4. Force password resets for affected accounts, or set
   `profiles.is_active = false` and let admins re-provision.
5. Review `security_events` and `login_history` for the window of exposure.
6. Check `audit_logs` for unexpected writes.

---

## 5. Respond to an incident

### 5.1 Triage (first 15 minutes)

1. **Scope it.** Which service: frontend, Express, AI server, Supabase?
   `GET /api/health` and `GET /health` first.
2. **Check the logs.** Railway dashboards; Supabase → Edge Functions → Logs;
   `railway logs`.
3. **Read the security tables.** These are the fastest signal:

```sql
-- Unresolved, newest first
SELECT event_type, severity, description, ip_address, created_at
FROM security_events
WHERE resolved = false
ORDER BY created_at DESC LIMIT 50;

-- Alerts raised by the auto-response path
SELECT type, severity, description, created_at
FROM security_alerts
WHERE resolved = false
ORDER BY created_at DESC LIMIT 50;

-- Failed logins in the last hour
SELECT ip_address, status, failure_reason, count(*), max(created_at)
FROM login_history
WHERE created_at > now() - interval '1 hour'
GROUP BY 1, 2, 3 ORDER BY 4 DESC;

-- Accounts the auto-response deactivated (CRITICAL events)
SELECT email, role, is_active, lockout_until
FROM profiles WHERE is_active = false;
```

4. **Classify.**

| Class | Examples | Response |
| --- | --- | --- |
| **P1 availability** | AI server down, DB unreachable | Fail over or roll back (§2). No data at risk. |
| **P2 integrity** | Attendance records wrong or missing; blockchain `TAMPERED` | Stop writes if needed; restore; reconcile from `audit_logs` and `blockchain_hashes` |
| **P3 confidentiality** | Data exposure, unauthorised access | Contain **immediately** (§5.2). Do not debug first. |
| **P4 fraud / cheating** | Proxy attendance, impossible travel | Preserve evidence **before** acting — see §5.3 |

### 5.2 Confirmed or suspected data exposure

1. **Contain.** Deactivate the account or rotate the leaked secret. For a
   service-role leak, rotate (§4.2) — that is the fastest containment step and
   it is safe to do first.
2. **Preserve.** Snapshot before you clean up:

```sql
COPY (SELECT * FROM login_history)      TO '/tmp/login_history.csv'      CSV HEADER;
COPY (SELECT * FROM security_events)    TO '/tmp/security_events.csv'    CSV HEADER;
COPY (SELECT * FROM audit_logs)         TO '/tmp/audit_logs.csv'         CSV HEADER;
COPY (SELECT * FROM api_request_log)    TO '/tmp/api_request_log.csv'    CSV HEADER;
COPY (SELECT * FROM security_alerts)    TO '/tmp/security_alerts.csv'    CSV HEADER;
```

3. **Determine scope.** Who accessed what, via `api_request_log` and
   `audit_logs`. Note `api_request_log` retains only **30 days** — beyond that,
   scope may be unrecoverable.
4. **Notify.** If personal data was involved, the clock starts. See
   `docs/PRIVACY_POLICY.md` §9 and get legal input; if **biometric** data was
   involved the notification expectations are stricter under GDPR Art. 33/34 and
   India's DPDP Act 2023.
5. **Do not delete evidence.** Retention guidance in `docs/DATA_RETENTION.md`
   explains why audit trails must survive an incident — an incident is exactly
   when a naive retention job does the most damage.

### 5.3 Attendance fraud or proxying

The system records the evidence for you. **Capture it before cleaning up** —
retention windows are short.

```sql
-- AI decision audit for one student (last 20 by default)
curl -s "$AI_HOST/api/analytics/audit/student/$STUDENT_ID?limit=100" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" | jq .

-- Geo trail
psql "$DATABASE_URL" -c \
  "SELECT latitude, longitude, is_within_campus, spoof_detected, spoof_reason, created_at
   FROM geo_verifications WHERE user_id = '$STUDENT_ID'
   ORDER BY created_at DESC LIMIT 200;"

-- Face verification attempts (similarity scores only — no images, no embeddings)
psql "$DATABASE_URL" -c \
  "SELECT similarity_score, device_id, timestamp
   FROM face_verification_logs WHERE student_id = '$STUDENT_ID'
   ORDER BY timestamp DESC LIMIT 200;"
```

Relevant flags: `PROXY_LOCATION_DETECTION`, `IMPOSSIBLE_TRAVEL`,
`SHARED_DEVICE_DETECTED`, `SESSION_CODE_MISMATCH`, `HIGH_DEVICE_RISK`.

> **⚠ VERIFY** — `models/audit_logger.py` holds recent decisions **in process
> memory** and only mirrors them to `${AUDIT_LOG_DIR}/audit_<date>.jsonl`. After
> a restart, `/api/analytics/audit/*` returns nothing. If you are relying on
> that endpoint for an investigation, read the JSONL files from the AI server's
> `audit_logs` directory (a Docker volume in compose) **before** redeploying.

Then: notify the faculty member, decide the academic consequence per your
policy, and record the outcome. Do not delete the underlying records to "clean
up" — that defeats the tamper-evidence design and is itself a compliance
problem.

### 5.4 AI server will not start

```bash
# 1. Locally
cd ai-server
python -m py_compile main.py
python -c "from main import app; print(len(app.routes), 'routes')"

# 2. Required env — the server warns and exits without these
#    SUPABASE_URL, SUPABASE_SERVICE_KEY
grep -E 'SUPABASE_URL|SUPABASE_SERVICE_KEY' ai-server/.env

# 3. InsightFace pre-load is non-fatal; it logs a warning and continues
# 4. Docker
docker compose logs -f ai-server
docker compose up -d --build ai-server
```

Health check inside the image uses `urllib` against `/health` with a 40 s start
period. If `/health` is slow to become healthy, that is the model pre-load.

### 5.5 Face verification failing for everyone

Ordered checks:

1. `GET /health` on the AI server.
2. `FACE_SIMILARITY_THRESHOLD` / `FACE_CONFIDENCE_THRESHOLD` — did a deploy
   change them?
3. `SUPABASE_ANON_KEY` on the AI server — `_auth_user()` needs it to call
   `/auth/v1/user`. A wrong key gives `401 "Invalid or expired token"` for
   everyone. **This is the most common cause.**
4. `CAMPUS_LAT` / `CAMPUS_LON` / `CAMPUS_RADIUS_M` — a wrong campus centre makes
   `OUTSIDE_CAMPUS` fire for everyone.
5. Rate limit — 10/min/user on `/api/face/*` and `/api/attendance/*`. A class
   of 60 arriving together will hit it. `Retry-After` is returned.
6. `GET /api/face/verify` needs an **active, unexpired** session for the class.
   If faculty are not starting sessions, nothing verifies.
7. Confirm `students.face_registered = true` for the affected cohort.

### 5.6 Attendance writes failing in bulk

```bash
# Edge function down or rejecting
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$SUPABASE_URL/functions/v1/attendance" \
  -H "apikey: $ANON" -H 'Content-Type: application/json' -d '{}'
# 401 = auth layer, 403 = role, 5xx = handler
```

Then check for the `status` validation trap: only
`PRESENT|ABSENT|LATE|ON_LEAVE|EXCUSED` are accepted. `FLAGGED` — which the
faculty UI offers — is rejected with `400`. See `docs/FACULTY_GUIDE.md` §3.5.

Note the deliberate design in `attendanceService.mark`: if the edge function is
unavailable the frontend **fails** rather than falling back to a direct table
write. That is intentional — a direct write would skip the role and
class-ownership checks. A burst of "Could not mark attendance — the service is
unavailable" means the edge function is down, and manually marking is the
correct interim answer.

### 5.7 Announcements

Tell users: what broke, what data is affected, what they should do, when it will
be fixed. If personal data was involved, the privacy policy's notification
commitments apply. Do not speculate about cause in the first message.

---

## 6. Routine maintenance

### Daily
```bash
curl -sf https://<ai-host>/health
curl -sf https://<backend-host>/api/health
psql "$DATABASE_URL" -c "SELECT * FROM backup_summary;"
psql "$DATABASE_URL" -c "SELECT count(*) FROM security_events WHERE resolved = false;"
```

### Weekly
- `SELECT count(*) FROM token_blacklist;` — should stay small.
- `SELECT count(*) FROM api_request_log;` — grows fast; the 30-day prune is not
  scheduled automatically.
- Review unresolved `security_alerts`.
- Confirm `last_successful_backup` < 26 h old.
- Run `./scripts/probe-edge-functions.sh` — it should pass without deploying.

### Scheduled jobs that exist vs. that you must create

**Implemented**, callable on demand:

| What | Where |
| --- | --- |
| Prune expired token blacklist rows | `POST /api/security/cleanup-tokens` (admin) or `security-monitor` `cleanup` |
| Prune `api_request_log` > 30 days | `security-monitor` `cleanup` |
| Prune `login_history` > 90 days | `security-monitor` `cleanup` |
| Prune completed backups past `retention_days` | `SELECT cleanup_old_backups();` |
| Brute-force / impossible-travel scan | `security-monitor` `scan` |

**Not implemented — you must schedule these:**

- Anything that deletes `face_embeddings`, `face_verification_logs`,
  `geo_verifications` or `sessions`. See `docs/DATA_RETENTION.md`.
- Notification fan-out (`notifications` edge function has no auth check — see
  `docs/API.md` §7 before exposing it).
- Model retraining (`POST /api/analytics/train` is manual).

> **⚠** `security-monitor`'s `cleanup` currently has **no caller
> authentication**. Do not wire it to a public cron URL until that is fixed.

### Monthly
- Rotate `SUPABASE_SERVICE_ROLE_KEY` and the mail provider key (§4).
- Review admin accounts and `profiles.is_active = false`.
- Review `audit_logs` for unexpected entity types.
- Restore drill (§3.6).

---

## 7. Useful commands

```bash
# Health
curl -sf https://<ai-host>/health && echo ok
curl -sf https://<backend-host>/api/health && echo ok

# Row counts
psql "$DATABASE_URL" -c "
SELECT 'students', count(*) FROM students
UNION ALL SELECT 'attendance', count(*) FROM attendance
UNION ALL SELECT 'face_embeddings', count(*) FROM face_embeddings
UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs;"

# Current RLS surface — capture before any migration
psql "$DATABASE_URL" -c "
SELECT tablename, policyname, cmd, roles::text
FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname;"

# Confirm biometrics are not exposed to authenticated clients
psql "$DATABASE_URL" -c "
SELECT policyname, cmd, roles::text, qual
FROM pg_policies WHERE tablename='face_embeddings';"

# Attendance-chain integrity
curl -s https://<backend-host>/api/blockchain/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# Tests and gates — run these before every push to main
npm test                    # backend + integration + ai
npx tsc -b
npx eslint .
cd server--backend && npx tsc --noEmit
```