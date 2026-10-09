# PRODUCTION_READINESS

**Repository:** CampusAI (`akgjpqvpcugbmdenpxny`)
**Prepared:** 2026-10-09
**Scope of this pass:** Phases A–F as specified in the master prompt

---

## Verdict

**NOT production-ready.**

The engineering quality of the code is materially better than it started:
the security work is real and tested, and this pass found and fixed a critical
unauthenticated-write vulnerability, two live HTTP 500s, four silent-logic bugs in
the ML layer, and a schema-drift bug that had been breaking every analytics page.

**But the platform cannot onboard a single new user right now**, because
self-service signup returns HTTP 500 on every attempt, the root cause is proven,
and the fix cannot be applied from here — it needs the Supabase table owner or a
Management API token. Two further blockers (below) each independently fail the
stated definition of done.

Saying "ready" here would require ignoring those three facts.

---

## 1. Gate status

| Gate | Result | Evidence |
|---|---|---|
| **A** — tests promoted, deploy script, QA checklist, white-box audit | **PASS** | `tests/` tracked with ai/backend/integration; `scripts/deploy-edge-functions.sh`; `docs/PHASE_A_QA_CHECKLIST.md` (26 Part A + 81 Part B) |
| **B** — CI green, coverage ≥80% critical paths, load test p95 | **PARTIAL** | CI added and green; **coverage % never measured** (tooling absent); load test **PASS** at 1000 users/75.6 rps |
| **C** — `docker compose up`, staging deployed, migrations clean, no secret in history | **PARTIAL** | Compose valid and image context fixed; **nothing built or deployed**; secret-scan of history **never run** |
| **D** — Sentry, Grafana, alerts, backup restore, AI-down fallback | **NOT DONE** | Agents were rate-limited mid-phase; partial artifacts discarded as incomplete |
| **E** — axe-core 0 critical, deletion endpoint, audit log, docs, fresh-user task | **FAIL** | Docs done; **no axe audit, no consent capture, no deletion endpoint, no audit-on-view** |
| **F** — autoscaling, CDN, canary, status page, dress rehearsal | **NOT DONE** | Agents were rate-limited mid-phase; nothing produced |

### Gates that genuinely pass

- **A: PASS.** Everything required exists.
- **Test suite: PASS.** `104 backend + 42 integration (10 skipped) + 241 AI (19 skipped, 1 xfail) = 387 passing, 0 failing.`
- **Lint / typecheck / build:** `eslint` 0 errors (301 pre-existing warnings), `tsc -b` 0, backend `tsc --noEmit` 0, `vite build` 0, `py_compile` clean.
- **Load test: PASS.** See §4.

---

## 2. Definition of done — item by item

| Requirement | Status | Why |
|---|---|---|
| A fresh user can sign up | **FAIL** | Every signup returns HTTP 500. Root cause proven; fix needs the DB owner. See §5.1. |
| …enroll | **FAIL** | Depends on signup. |
| …and mark attendance | BLOCKED | Depends on signup. Face-verify path is code-complete but unexercised end to end. |
| An admin can view analytics | **FIXED THIS PASS** | `department_attendance_summary` and `student_attendance_overview` were **missing from the live schema**; the frontend and two edge functions were querying them and getting empty results. Recreated and verified live. |
| A company user can view a student's attendance summary | **FAIL** | `/company/attendance` queries `profile_id`/`check_in`/`check_out`, which **do not exist** on `attendance` — it 400s (`42703`). Verified live. See §5.2. |
| No known critical/high security findings | **FAIL** | Two critical ones were open until this pass and are now **fixed in code but not deployed**. See §3. |
| Monitoring, backups, rollback proven | **NOT DONE** | Phase D not completed. |
| Documentation sufficient to run from the runbook | **PASS** | `docs/RUNBOOK.md` plus four role guides, API reference, architecture, migration guide. |

---

## 3. Security work done in this pass

### 3.1 Critical: two edge functions had no authentication at all (fixed)

`security-monitor` and `notifications` read no `Authorization` header, called no
`getUser`, and checked no role. Requests went straight to the action switch. Both
use the service-role client (RLS off) and the documented deploy path passes
`--no-verify-jwt` (no platform gate). There was **no authorization boundary
whatsoever**.

While open, an anonymous internet caller could:

| Function | Action | Effect |
|---|---|---|
| security-monitor | `lockout-check` | **Unlock every locked account and reset failed-attempt counters** — defeated the brute-force lockout platform-wide |
| security-monitor | `cleanup` | **Delete** `token_blacklist`, `api_request_log`, `login_history` — destroyed security evidence |
| security-monitor | `scan` / `stats` | Read all login and geo history; write forged security events |
| notifications | `system_announcement` | Inject arbitrary notifications to any role/department (phishing vector) |
| notifications | `custom` | Arbitrary notification to any `user_id` |
| notifications | fan-out actions | Writes plus outbound email to guardian addresses |

Fixed to match the existing `attendance`/`notices` pattern: 401 on missing/invalid
token, 403 on unknown role, 403 unless `ADMIN`/`SUPER_ADMIN`, enforced **before**
any action dispatch. Regression tests added
(`tests/integration/edge_function_authz.test.mjs`).

Also fixed in the same sweep: an unrecognised notification type returned
`success: true` when nothing was sent; and `security-monitor`, `bulk-operations`
and `backup` leaked raw `error.message`, PostgREST text and internal table names
to the client.

> **These fixes are code-only. Nothing was deployed.** Until
> `scripts/deploy-edge-functions.sh --all --verify` runs with a token, the live
> functions are still the vulnerable versions.

### 3.2 Six real bugs in the ML layer, including two live 500s (fixed)

Two of these were reachable endpoints returning HTTP 500 on **every** request:

1. `fraud_detection.py` — `math` imported only inside `validate_fingerprint_v4`,
   so `_extract_fingerprint_entropy` raised `NameError` and the low-entropy
   spoof check never ran.
2. `monitoring.py` — `from scipy import stats` imported only inside
   `check_advanced_drift`, so `/analytics/drift/advanced` raised `NameError`.

Four more were silent logic failures:

3. `behavior_profiling.py` — KMeans fit on PCA-reduced data but classified on the
   4-feature vector, so the classifier was unusable after training.
4. `performance_analysis.py` — severity used lexicographic `max()` on strings, so
   `max("LOW","HIGH") == "LOW"`. The near-failing branch was **unreachable** and
   an already-HIGH severity was **downgraded**.
5. `performance_analysis.py` — `predict_performance_v4` returned `NaN`, which is
   not valid JSON.
6. `performance_analysis.py` — zero-variance correlation reported
   `direction: "negative"`, and `predict_grade` with constant history predicted
   **100.0** for any input.

Each fix has a test that failed before and passes after. 195 of the 241 AI tests
are new in this pass.

### 3.3 One breaking response change, handled in the same commit

`pearson_correlation`/`spearman_correlation` now return
`{"error": "Need variance in both attendance and grades"}` for constant input,
where they previously returned a dict of `NaN`. `AIDashboard.tsx` rendered `.r`,
`.p_value`, `.significant`, `.strength`, `.direction` unconditionally and did not
check `.error`, so it would have rendered blanks. It now has an explicit branch
and the type is updated. NaN was never renderable, so this is strictly an
improvement — but it was a visible shape change and is called out deliberately.

---

## 4. Performance

Measured with `scripts/loadtest-customers.mjs` against the live project, through
the real onboarding path (auth insert → trigger → profile + student):

| Metric | Value |
|---|---|
| Customers created | **1000 / 1000** |
| Failures | **0** |
| Throughput | **75.6 users/sec** sustained |
| Latency (per signup) | p50 ≈13 ms, p95 ≈25 ms |
| Scaling efficiency (last-100 / first-100 throughput) | **252%** — improves under load via connection pooling |
| Trigger fill | 20/20 profiles, 20/20 students |
| Read p50 | 58 ms profiles, 59 ms students |
| Dashboard RPC | 101 ms |

A genuine bug surfaced because of this: the trigger defaulted `enrollment_id` to
`'STU' || floor(extract(epoch from now()))`, which collides for any two signups
in the same second. An early run showed 210/1000 successes because of it. Fixed
to millisecond precision plus a random suffix and verified live (8 rapid inserts
→ 8 distinct ids). This bug affects production signup independently of the
GoTrue problem.

**Coverage percentages are not reported anywhere.** `pytest-cov` and `coverage`
are both absent, so there is no honest number to give. `docs/COVERAGE.md` records
a manual module-to-test map and names the real gaps: `models/liveness.py`
(439 lines) and `face_recognition_module.py` (293) have **zero** tests, every
`routes/*.py` handler is untested behaviourally, and `analyticsController.ts` /
`chatController.ts` are referenced by no test.

---

## 5. Blockers requiring a human

### 5.1 Signup is broken — needs the Supabase table owner (**critical**)

**Root cause, proven rather than guessed:** `auth.identities.email` is a
generated column —
`GENERATED ALWAYS AS (lower(identity_data->>'email')) STORED` — and the running
GoTrue build is **older than the database schema**, so it inserts `email`
explicitly. Postgres rejects that with
`"cannot insert a non-DEFAULT value into column \"email\""`, which GoTrue
flattens into the generic `500 Database error creating new user`.

**Evidence:** an A/B test against the live project (both rolled back, with a real
user row present so the FK holds) — inserting with explicit `email` **FAILS**;
omitting it **succeeds** with the generated column populating it. Separately, a
diagnostic wrapper installed around the custom `handle_new_user` trigger logged
`SQLSTATE`/`SQLERRM` and **never fired**, and a bare `auth.users` insert
reproduces cleanly. So the trigger is definitively not at fault.

RLS on `auth.users` (enabled, no policies) was the first hypothesis and it is
**wrong** — the auth service owns the table and is exempt. It is ruled out
explicitly so it does not get re-chased.

**Why it cannot be fixed from here:** the `auth` schema is owned by
`supabase_auth_admin`. The pooler `postgres` role is not the owner, is not a
superuser, and cannot `SET ROLE supabase_auth_admin`. Neither the service-role
key nor the pooler can `ALTER` these tables.

**Remediation:** `supabase/migrations/014_fix_auth_signup_blocker.sql`, two
options. Preferred is Dashboard → Project → Services → Auth → *Restart* (or
upgrade the project) so GoTrue matches the schema and the generated column works
as designed. Fallback is `ALTER TABLE auth.identities ALTER COLUMN email DROP
EXPRESSION` plus grants, RLS policies and a backfill.

### 5.2 The Company portal displays fabricated data (**high**)

Verified in code and against the live API:

- `src--frontend/pages/company/Analytics.tsx` — per-department `employees` and
  `productivity` are `Math.floor(Math.random()*30)+10` and
  `75+Math.floor(Math.random()*25)`, i.e. **different on every render**. Also
  `avgWorkHours` is the hardcoded string `'8.4'`, `change: '+8%'` is invented, and
  a 247-employee fallback is hardcoded. The whole page is fabricated numbers.
- `src--frontend/pages/company/Attendance.tsx` — queries `profile_id`,
  `check_in`, `check_out`, none of which exist on `attendance`. Confirmed live:
  **HTTP 400 `42703 column attendance.profile_id does not exist`**. The page
  cannot render at all.
- `src--frontend/pages/company/LiveTracking.tsx` — `distance` is `Math.random()`,
  and it reportedly shows the *viewer's* own location in every tile.
- A documentation survey also reported `Settings` save is a no-op and the
  security-event list is string literals. **These were not verified here.**

This is a product-integrity problem, not a cosmetic one: a customer paying for
analytics receives random numbers. Fixing it properly means deciding what
"productivity" means for a company tenant and building real queries — that is a
feature, not a patch, and it needs a product decision before anyone writes code.

Related and unresolved: `Company` is listed in the role selectors, but
`user_role` has no `COMPANY` value, and the org roles (`HR`, `MANAGER`) live only
in `user_organizations.role`. No `ALTER TYPE` migration exists. What the Company
portal is *supposed* to see is not settled, which is upstream of every fix here.

### 5.3 Face embeddings are reachable by admins (**high, not fixed)

`students.face_data` (the ArcFace embedding, the most sensitive data in the
system) sits on `students`, whose `students_admin_all` policy is
`FOR ALL USING (is_admin())`. An authenticated admin could therefore `SELECT
face_data` directly through PostgREST with the anon key. FERPA/GDPR/DPDP all
treat biometrics specially. Suggested repair is
`REVOKE SELECT (face_data) ON students FROM authenticated, anon;` — but the
legitimate readers of that column must be identified first, or face matching
breaks. **Not fixed here; needs a decision about how the matching path should
read embeddings.**

### 5.4 Edge functions still deployed vulnerable (**high**)

Every security fix in §3.1 is code-only. Deploy with a Personal Access Token:

```bash
npx supabase login
bash scripts/deploy-edge-functions.sh --all --verify
bash scripts/probe-edge-functions.sh
```

The publishable and service-role keys do **not** grant Management API access —
`supabase login` needs an `sbp_…` token.

### 5.5 Not done at all, and why

- **Phase D (monitoring, alerts, backup restore, AI-down fallback): never
  completed.** Agents were rate-limited mid-phase. Partial artifacts that
  promised modules which did not exist were deleted rather than committed.
- **Phase F (autoscaling, CDN, canary, status page, dress rehearsal): never
  started.** Same reason.
- **Phase E implementation items (consent capture, retention jobs, self-service
  export/erasure, axe-core audit, audit-log-on-admin-view): never started.**
  The documentation half of E is done.
- **Secret scan of git history:** `gitleaks`/`trufflehog` **never run**. Gate C
  requires it and it is unverified.
- **Staging/production Supabase projects:** not created.
- **Playwright E2E:** specs written, suite deliberately inert (no `@playwright/test`
  dependency without approval). Real E2E has never executed.

---

## 6. What improved, concretely

- **Critical unauthenticated-write vulnerability closed** — an anonymous caller
  could previously unlock every account and delete the security logs.
- **Two live 500s fixed**, one of which disabled the fraud-detection entropy
  check entirely.
- **Analytics restored** — two views that three consumers were querying had been
  missing from the live schema; 14 department and 398 student rows now resolve.
- **`node:20-slim-bookworm`** — a nonexistent tag that would have failed every
  backend image build.
- **`supabase/` shipping in the frontend image**, including `.temp/pooler-url`
  which can hold a credentialed connection string.
- **AI server build context aligned with Railway.** The Dockerfile assumed
  `context=./ai-server` while a root `railway.json` always builds from the repo
  root; the deploy would have failed on the first `COPY requirements.txt`.
- **Signup-config footgun documented.** `ai-server/config.py` reads
  `SUPABASE_SERVICE_KEY` while `.env` historically set
  `SUPABASE_SERVICE_ROLE_KEY`, which made the AI server silently fall back to an
  anonymous client.
- **8 CI workflows and deploy gates** with pinned action versions and a
  `production` environment approval gate.
- **397 tests tracked and green** (195 of them new).

---

## 7. Incident disclosed

Running `seed_users.mjs` to diagnose the signup failure destroyed the demo
dataset. The script deletes every profile and auth user for its 22 accounts
*before* recreating them through the admin API; because that API returns 500, the
delete succeeded and the recreate never ran. 3 of 22 accounts were recoverable
from `raw_user_meta_data` and have been rebuilt; the other 19 need the §5.1 fix
first. No attendance/notice/grade/leave data was touched.

Full write-up: `docs/INCIDENT-2026-10-09-demo-data-loss.md`. The lesson is
recorded there too: the script should pre-flight its create path so it cannot
fail destructively. This was an agent error, not a pre-existing defect.

---

## 8. Runbook summary

| Task | Where |
|---|---|
| Deploy the frontend | `docs/RUNBOOK.md` §1 (Vercel) |
| Deploy backend / AI server | `docs/RUNBOOK.md` §2 (Railway, `railway-backend.json`, `railway.json`) |
| Deploy edge functions | `scripts/deploy-edge-functions.sh --all --verify` (**needs an `sbp_…` token**) |
| Roll back | `docs/RUNBOOK.md` §4 |
| Add a migration | `docs/MIGRATIONS.md`; SQL in `supabase/migrations/` |
| Pin Python dependencies | `scripts/pin-python-deps.sh` |
| Load test | `node scripts/loadtest-customers.mjs --count 1000 --concurrency 5 --tag <t>` |
| Clean up load-test users | `node scripts/loadtest-customers.mjs --cleanup --tag <t>` |
| Restore from backup | **not written — Phase D incomplete** |

---

## 9. Handover schedule

**Weekly**

- Confirm the last backend run's migration state matches `supabase/migrations/`.
- Review rate-limit hit counts and lockout events (the lockout just became
  meaningful again now that `security-monitor` is authenticated).
- Check `vercel`/`railway` build logs for regressions.

**Monthly**

- `bash scripts/pin-python-deps.sh --check` and refresh dependencies.
- Review cost: the AI server calls an OpenAI-compatible endpoint with
  `API_TIMEOUT_MS=300000` — a **5-minute** timeout, raised during an earlier
  phase. That is a latency and spend risk worth revisiting.
- Confirm the analytics views still exist (§3 of this report documents them
  going missing once already).

**Quarterly**

- Dependency and base-image updates.
- Restore drill — **once Phase D is actually finished.**
- Re-run the security sweep that found §3.1; two functions were unprotected, so
  a second pass is warranted.

---

## 10. Remaining risk

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Signup stays broken | High if not acted on | **Fatal** — no new users | §5.1, Dashboard SQL editor |
| Edge functions still vulnerable | High if not deployed | Critical — account unlock, log deletion | §5.4 |
| Company portal keeps showing random numbers | High | High — customer trust, contractual | §5.2 |
| Face embeddings readable by admin | Medium | High — biometric data | §5.3 |
| No monitoring, no proven backup restore | Certain until Phase D | High at first incident | Phase D |
| Python deps unpinned | Medium | Medium — non-reproducible builds | `scripts/pin-python-deps.sh` |
| Secret scan never run | Unknown | Potentially high | Run `gitleaks`/`trufflehog` |
| Dual backend (Express + FastAPI) indefinitely | High | Medium — divergence | `docs/ARCHITECTURE.md` recommends converging on FastAPI, staged 0–5 |
| Test data loss from `seed_users.mjs` | Medium | Medium | §7; fix the script |

**The single highest-value next action** is §5.1: it is a two-minute paste into
the Supabase SQL editor and it unblocks signup, the remaining 19 seed accounts,
and the entire definition of done.
