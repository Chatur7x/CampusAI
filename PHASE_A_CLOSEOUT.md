# Phase A Closeout — Stabilize & Secure

**Repo:** CampusAI (`Chatur7x/CampusAI`) · **Branch:** `main` · **Date:** 2026-10-02
**Status:** Phase A complete except two items that require a machine with
credentials and a browser — both are listed under [Unresolved](#unresolved).

---

## Summary

Phase A closed the five outstanding vulnerabilities (H2, H3, M1, M2, M3), added
rate limiting, input validation and centralised error handling across both
backends, promoted the ad-hoc security scripts into a tracked `tests/` suite,
and ran a focused white-box review that surfaced four further issues — all fixed.

| Gate | Result |
| --- | --- |
| `npm test` | **159 pass, 23 skip, 0 fail** |
| `npx tsc -b` | 0 errors |
| `npx eslint .` | 0 errors (301 pre-existing warnings) |
| backend `npx tsc --noEmit` | 0 errors |
| `python -m py_compile` | clean |
| `npx vite build` | passes |
| Route crawl (7 role routes) | 0 console errors |
| Deploy script | syntax-checked, probe logic tested against live Supabase |

Per suite: backend 104, integration 25 (+4 live, skipped), ai 30 (+19 live, skipped).

---

## Task 1 — Test suites promoted to `tests/`

The security assertions lived in `scratch/`, which is gitignored because it also
holds scripts with real credentials. That meant the regression tests for H2/M2
were one `rm` away from disappearing — which is how they ended up absent when
those bugs were found in the first place.

### Layout

```
tests/
  README.md                      how to run, what each suite covers, why source-shape tests
  ai/
    conftest.py                  sys.path setup + the live-server skip fixture
    test_auth.py                 require_user gate, role cache, ownership helpers
    test_ratelimit.py            budget, isolation, window rollover, 429 contract
    test_live_http.py            real HTTP: every /api/* router fails closed
  backend/
    ownership.test.mjs           H2/H3/M2/M1/M3 guards
    routes.test.mjs              route table: auth + validation coverage + privilege boundaries
    upload.test.mjs              extension/MIME allowlists, sniffing, safe serving
    auth.test.mjs                JWT pinning, role re-read, error hygiene
  integration/
    edge_functions.test.mjs      edge-function authz, Express↔frontend route agreement, AI bounds
```

### Scripts

```bash
npm test                  # all three suites
npm run test:backend      # node --test tests/backend
npm run test:integration  # node --test tests/integration
npm run test:ai           # pytest tests/ai
npm run test:watch        # node --test --watch, for development
```

No new dependencies: `node:test` and `pytest` were already available. Suites
that can hit a live service skip themselves when it is absent, so `npm test` is
green on a clean checkout with nothing running.

### Coverage added while promoting

Promoting the scripts surfaced gaps worth closing, so the suites grew from 58
ad-hoc assertions to 159:

- **Route-table coverage.** Every route must be authenticated (bar six named
  credential endpoints) and every write must validate its body (bar an explicit,
  stale-checked exemption list). Writing this test is what found the validation
  gaps in Task 4.
- **Frontend↔backend agreement.** Every `BACKEND_URL` call in `api.ts` must
  resolve to a registered route, with the right verb. A test asserts the parser
  found ≥15 calls, so it cannot pass vacuously.
- **JWT algorithm pinning.** `verifyToken` must pin `algorithms: ['HS256']`
  rather than infer it from the token header.

---

## Task 2 — Edge function deploy

### What is modified and not yet live

```
supabase/functions/attendance/index.ts   staffOwnsStudent() gate on POST+PUT,
                                         ALLOWED_STATUSES enum, new PUT handler,
                                         PostgREST errors no longer returned
supabase/functions/notices/index.ts      getRole/getFacultyId scoped with .eq('user_id'),
                                         PUTTABLE_COLUMNS allowlist replacing
                                         field-by-field copies, error hygiene
supabase/functions/timetable/index.ts    getRole/getFacultyId scoping,
                                         WRITABLE_COLUMNS allowlist (was raw-body
                                         mass assignment), 2000-entry bulk cap,
                                         error hygiene
```

These three are the Phase A set. `analytics`, `backup`, `bulk-operations`,
`notifications`, `security-monitor` and `verify-face` were not touched and are
available behind `--all`.

### Why it is a script and not a deploy

The Supabase CLI is not installed in this environment (`npx supabase@2.119.0`
works, but there is no `SUPABASE_ACCESS_TOKEN` and `~/.supabase` holds only
telemetry). Deploying is not possible here, so:

```bash
scripts/deploy-edge-functions.sh            # the three Phase A functions
scripts/deploy-edge-functions.sh --all      # every function
scripts/deploy-edge-functions.sh --verify   # deploy, then probe
scripts/probe-edge-functions.sh             # probes only, no deploy
```

The script resolves the CLI from a global install or `npx`, fails fast on bad
credentials rather than half-deploying, and carries the three-function list
inline so widening it is a deliberate edit.

### Script verification

| Check | Result |
| --- | --- |
| `bash -n scripts/deploy-edge-functions.sh` | passes |
| `--help` | prints usage |
| No CLI + no token | exits 1 with install instructions |
| Fake token | exits 1 at preflight, deploys nothing |
| `verify()` against **live** pre-deploy functions | all probes pass |

The last row is worth reading carefully. Run against the functions currently
deployed, the negative probes pass:

```
Probing https://akgjpqvpcugbmdenpxny.supabase.co/functions/v1/ …
  ok  attendance: no token -> 401
  ok  attendance: tampered token -> 401
  skip  student probe (set STUDENT_JWT)
  skip  faculty probe (set FACULTY_JWT)
  ok  notices: tampered token -> 401
  ok  timetable: tampered token -> 401
All probes passed.
```

That proves the **auth gate** is already live. It does **not** prove the Phase A
changes are deployed — the ownership checks, PUT allowlists and status enums are
repo-only until the script runs. The two positive probes need a `STUDENT_JWT`
and a `FACULTY_JWT`, and skip without them.

### What to run

```bash
export SUPABASE_ACCESS_TOKEN=sbp_…        # from https://supabase.com/dashboard/account/tokens
export SUPABASE_ANON_KEY=eyJ…             # already in .env as VITE_SUPABASE_ANON_KEY
export STUDENT_JWT=…                      # a real student access token
export FACULTY_JWT=…                      # a faculty token for a DIFFERENT class
bash scripts/deploy-edge-functions.sh --verify
```

Expected: three `ok` deploys, then all five probes green including the two
positive ones (`403` for the student, `403`/`404` for the foreign faculty).

---

## Task 3 — QA checklist

`docs/PHASE_A_QA_CHECKLIST.md` — 130 unticked items across 11 sections.

Role-complete: admin, faculty, student, company each get a login flow, every nav
page, and their negative tests. Notable additions:

- **Cross-class negative tests** need a *second* faculty account in a different
  class. Creating one is a prerequisite in the header.
- **Section 6** tells you to build `evil.svg` and `evil.html` containing
  `<script>alert(document.domain)</script>` before starting, then tries five
  upload bypasses including a renamed `.png.svg` and an `.xlsx` renamed to
  `.csv` (which the byte-signature check should catch).
- **Section 10** is a role×resource matrix. Every cell is asserted, so a single
  wrong cell is visible rather than lost in a paragraph.
- **Section 9** includes the enumeration test: `/api/auth/role` for another
  user's email must report "not found", not "this user exists and is an ADMIN".

This could not be executed here — the environment has no external egress, so
Supabase login cannot complete. It needs your machine.

---

## Task 4 — Security audit

The Phase A step-A7 manual review had **not** been formally completed. Ran it
now, focused on the six classes in scope.

### Confirmed clean

| Area | Finding |
| --- | --- |
| SQL injection | No `$queryRawUnsafe`/`$executeRawUnsafe` outside `src/scripts/apply_trigger.ts`, a one-off dev script that reads a local `.sql` file and is not wired into the server. Prisma parameterises everywhere else. |
| Stored XSS | The only `dangerouslySetInnerHTML` is `chart.tsx`, interpolating developer-authored colour tokens into a `<style>` block. No user or API data reaches it. Uploads are allowlisted and served as attachments. |
| CSRF | Not applicable: auth is a `Bearer` header and refresh tokens travel in the request body, so there is no ambient credential for a cross-origin request to ride on. The CSRF middleware in `security.ts` is dead code — recorded by a test so a future cookie-based auth change revisits it deliberately. |
| Sensitive data exposure | No `VITE_SUPABASE_SERVICE_ROLE_KEY` reference anywhere in `src--frontend/`, so the service key cannot reach the client bundle. |
| Auth middleware | Re-reads the role from the database on every request (a demotion takes effect immediately rather than at token expiry), checks the blacklist before verifying, and rejects deactivated accounts. |

### New findings, all fixed

| # | Sev | Finding | Fix |
| --- | --- | --- | --- |
| 1 | **High** | `timetable` edge function `POST`/`PUT` passed the raw request body to Supabase. Mass assignment: a caller could set `id` or any server-owned column. | `WRITABLE_COLUMNS` allowlist + `pickWritable()`, applied to single and bulk writes. 2000-entry cap on the bulk path. |
| 2 | **Medium** | `notices`/`timetable`/`attendance` edge functions returned raw PostgREST `error.message`, which names columns, constraints and relation paths — a schema disclosure aid. | Logged server-side; clients get `"Could not load …"` / a 404 for a missing notice. |
| 3 | **Medium** | 14 write routes in `routes/index.ts` had no input validation. `POST /admin/users` accepted an arbitrary `role`, and the flag/enum fields (`is_active`, status strings, `dayOfWeek`, times) were unbounded. | 20 new validation schemas; every route now pins its enums, bounds its lengths and rejects malformed bodies. |
| 4 | **Low** | `verifyToken` did not pin the algorithm, so it was inferred from the token header — the algorithm-confusion class. | `algorithms: ['HS256']` on both verify paths, `algorithm: 'HS256'` on both sign paths. |

**No open critical or high findings.**

---

## Files changed in the closeout

```
tests/                                    new, 9 files
scripts/deploy-edge-functions.sh          new
scripts/probe-edge-functions.sh           new
docs/PHASE_A_QA_CHECKLIST.md              new
package.json                              test scripts
server--backend/src/middleware/validation.ts   +20 schemas
server--backend/src/routes/index.ts             validation wired in
server--backend/src/utils/jwt.ts                algorithm pinning
supabase/functions/attendance/index.ts   error hygiene
supabase/functions/notices/index.ts      PUTTABLE_COLUMNS + error hygiene
supabase/functions/timetable/index.ts    WRITABLE_COLUMNS + error hygiene
ai-server/main.py                         openapi_url disabled
ai-server/utils/ratelimit.py              gate exposed for inspection
```

---

## Unresolved

Two items, both requiring something this environment does not have. Neither is
a code problem.

### 1. Edge functions are not deployed

The three hardened functions are committed but not live. Until
`scripts/deploy-edge-functions.sh` runs, the production functions still have the
pre-Phase A behaviour: `timetable` still allows mass assignment, and
`attendance` still marks on a role check alone. **This is the highest-priority
follow-up.**

### 2. Logged-in QA has not been run

`docs/PHASE_A_QA_CHECKLIST.md` is unticked. The static suites cover the guards;
they cannot tell you whether a page renders the right data for a real account,
whether the consent flow is coherent, or whether a guard is reachable by a path
nobody enumerated. That needs a browser with network access.

### Also outstanding, from earlier phases

- **16 admin profiles in the live Supabase project** cannot be distinguished
  between seeded and compromised. Worth reviewing.
- **Prisma schema drift.** `face_embeddings.embedding_vec`, a missing
  `metadata` column and broken FKs in migrations 002/003. The snake_case
  dual-write shims in `ai-server/utils/db.py` and `lib/api.ts` are a workaround,
  not a fix.
- **`websockets` was pinned down to 15.0.1** in this environment because
  `supabase` (realtime) needs `websockets.asyncio`, which 12.0 lacks. If
  `ai-server/requirements.txt` does not pin it, a fresh install will fail the
  same way.
- **DB-expert schema notes** from the earlier session (snake_case
  canonicalisation, unversioned SQL in `supabase/`) remain unapplied.

---

## Verification commands

```bash
npm test                  # 159 pass, 23 skip
npm run test:backend
npm run test:integration
npm run test:ai

npx tsc -b                # 0 errors
npx eslint .              # 0 errors
cd server--backend && npx tsc --noEmit
cd ai-server && python -m py_compile main.py utils/*.py routes/*.py
npx vite build

# live suites
cd ai-server && uvicorn main:app --port 8011
AI_BASE_URL=http://127.0.0.1:8011 npm run test:ai

# deploy
bash scripts/deploy-edge-functions.sh --verify
```

---

## Suggested Phase B order

1. Deploy the edge functions, with `--verify`. Blocks everything else.
2. Run the QA checklist end to end, all four roles.
3. Review the 16 admin profiles.
4. Fix the Prisma schema drift so the snake_case shims can go.
5. Automated testing — the suites in `tests/` are the fixture to build on.
