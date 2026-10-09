# CampusAI Test Suites

Security and contract tests for the three runtimes in this repo. Everything here
runs offline against the source tree — no database, no network, no seeded
fixtures — so it is safe in CI on a clean checkout.

```
tests/
  ai/            pytest  — FastAPI AI server
  backend/       node:test — Express backend + frontend data layer
  integration/   node:test — cross-service contracts
  e2e/           Playwright — browser flows (opt-in, needs approval to install)
```

## Running everything

```bash
npm test              # backend + integration + ai, in that order
```

Individual suites:

```bash
npm run test:backend      # node --test tests/backend
npm run test:integration  # node --test tests/integration
npm run test:ai           # pytest tests/ai
npm run test:watch        # node --test --watch (backend, during development)
```

Nothing here needs a dev server. Suites that *can* probe a live service skip
themselves when it is not running rather than failing — see
[Live tests](#live-tests).

## What each suite covers

### `tests/ai/` — FastAPI AI server

| File | Covers |
| --- | --- |
| `conftest.py` | Puts `ai-server/` on `sys.path` so tests exercise the real modules; provides the `live_server` skip fixture. |
| `test_auth.py` | The `require_user` gate (missing/!bearer/invalid token, valid token, subject caching), the 503-vs-401 distinction on an Auth API outage, role-lookup caching, `require_self_or_staff`, `require_staff`. |
| `test_ratelimit.py` | Budget arithmetic, per-identity isolation, window rollover, the 429 + `Retry-After` contract, identity resolution (auth subject first, IP fallback), and the production limiters' configuration. |
| `test_live_http.py` | Real HTTP against a running server: every `/api/*` router refuses a missing or invalid token, health is public, interactive docs are disabled, validation errors do not echo the payload. |

### `tests/backend/` — Express backend + frontend data layer

| File | Covers |
| --- | --- |
| `ownership.test.mjs` | The H2/H3/M2/M1/M3 guards: class ownership on attendance marking, the `registerFace` namespace fix, leave approval ownership, the enumeration oracle, the removal of client-side direct-table writes, and the avatar upload allowlist. |
| `routes.test.mjs` | The route table itself: every route is authenticated (bar the six credential endpoints), every write validates its body (bar an explicit, stale-checked exemption list), and the privilege boundaries per role. |
| `upload.test.mjs` | The upload middleware: extension allowlists, MIME allowlists, random filenames, byte-signature sniffing, markup rejection, path containment, safe serving headers, and error hygiene. Also asserts both upload routes run `verifyUpload` and the upload rate limiter. |

### `tests/integration/` — cross-service contracts

| File | Covers |
| --- | --- |
| `edge_functions.test.mjs` | Edge-function authz (`staffOwnsStudent` fails closed, `.eq('user_id')` scoping, PUT allowlists, no raw PostgREST errors), the Express↔frontend route agreement in both directions, and the AI server's request-model bounds. |

### `tests/e2e/` — Playwright browser flows

| File | Covers |
| --- | --- |
| `playwright.config.ts` | Config. Omits `webServer` entirely unless `E2E=1`, so running it does not try to boot Vite on a machine with nothing installed. |
| `support/harness.ts` | The gates. `gated(['admin', …])` wraps `test.beforeEach` with the skip logic below, plus `login()` / `logout()` helpers driving the real login form. |
| `specs/auth.spec.ts` | Four role logins landing on their own dashboard (`dashboardPath()` in `App.tsx`), plus the unauthenticated redirect to `/login`. |
| `specs/cross-role.spec.ts` | A student typing `/admin` never sees the admin shell or admin nav, and cannot read `/api/students`. |
| `specs/attendance.spec.ts` | Faculty starts a live session → student verifies with the six-digit code → the mark is visible on the faculty side. Plus the wrong-code refusal. |
| `specs/leave.spec.ts` | Student submits → class in-charge approves → the student sees the updated status. Plus the empty-form refusal. |
| `specs/avatar.spec.ts` | A 1×1 PNG is stored and rendered; `.svg` and `.html` are refused, including a PNG renamed to `.svg`. |

## Live tests

Four tests in `tests/integration/` and several in `tests/ai/` can hit a real
service. They **skip** when prerequisites are absent, so `npm test` is green on a
fresh machine.

| Variable | Enables |
| --- | --- |
| `AI_BASE_URL` | `tests/ai/test_live_http.py`, and the AI-server probe in the integration suite. Default `http://127.0.0.1:8011`. |
| `SUPABASE_URL` | Live edge-function probes. |
| `SUPABASE_ANON_KEY` | Live edge-function probes. |
| `STUDENT_JWT` | Proves a student cannot mark attendance through the edge function. |
| `FACULTY_JWT` | Proves faculty from another class cannot mark attendance. |

```bash
# AI server, in another terminal
cd ai-server && uvicorn main:app --host 127.0.0.1 --port 8011

# then, with credentials
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_ANON_KEY=... \
STUDENT_JWT=... \
FACULTY_JWT=... \
AI_BASE_URL=http://127.0.0.1:8011 \
  npm run test:integration
```

## End-to-end tests

`tests/e2e/` drives a real browser. It is **not** part of `npm test` and does
not run on a clean checkout — Playwright is deliberately absent from
`package.json`, because adding a dependency needs explicit approval and
downloading its browser binaries needs network access this machine may not have.

Nothing in the suite asserts anything unless you opt in. The gate mirrors the
pytest `live_server` fixture and the `{ skip: … }` live probes above: two
conditions, checked in `beforeEach`, that turn every case into a reported skip
rather than a failure.

| Variable | Enables |
| --- | --- |
| `E2E=1` | Master opt-in. Without it every spec skips, even with credentials set. |
| `E2E_BASE_URL` | App under test. Default `http://127.0.0.1:5173` (the Vite dev server). Point it at a staging URL to run against staging — the specs **write data**. |
| `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | `auth`, `cross-role` gate. |
| `E2E_FACULTY_EMAIL` / `E2E_FACULTY_PASSWORD` | `attendance`, `leave`. |
| `E2E_STUDENT_EMAIL` / `E2E_STUDENT_PASSWORD` | All of the above. |
| `E2E_COMPANY_EMAIL` / `E2E_COMPANY_PASSWORD` | The company/HR landing case in `auth`. |

### Installing Playwright

```bash
npm i -D @playwright/test     # exact version: pin it before committing
npx playwright install chromium
```

On a machine without egress, the `install` step will fail. That is fine — the
suite simply never runs, and `npm test` stays green.

### Running it

```bash
# 1. seed the accounts (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
node seed_users.mjs

# 2. start the app — or skip this and set E2E_BASE_URL to a deployed preview
npm run dev

# 3. seed the credentials and run
#    Windows (PowerShell):
$env:E2E = '1'
$env:E2E_BASE_URL = 'http://127.0.0.1:5173'
$env:E2E_ADMIN_EMAIL    = 'admin@anurag.edu.in';    $env:E2E_ADMIN_PASSWORD    = 'admin@anurag'
$env:E2E_FACULTY_EMAIL  = 'saikrishnait@anurag.edu.in'; $env:E2E_FACULTY_PASSWORD = 'it@saikrish'
$env:E2E_STUDENT_EMAIL  = '24eg109a28@anurag.edu.in';  $env:E2E_STUDENT_PASSWORD = 'Chatur7'
$env:E2E_COMPANY_EMAIL  = 'hr@google.com';          $env:E2E_COMPANY_PASSWORD  = 'hr@google'
npx playwright test --config tests/e2e/playwright.config.ts

#    bash/zsh equivalent
E2E=1 \
E2E_BASE_URL=http://127.0.0.1:5173 \
E2E_ADMIN_EMAIL=admin@anurag.edu.in E2E_ADMIN_PASSWORD=admin@anurag \
E2E_FACULTY_EMAIL=saikrishnait@anurag.edu.in E2E_FACULTY_PASSWORD=it@saikrish \
E2E_STUDENT_EMAIL=24eg109a28@anurag.edu.in E2E_STUDENT_PASSWORD=Chatur7 \
E2E_COMPANY_EMAIL=hr@google.com E2E_COMPANY_PASSWORD=hr@google \
  npx playwright test --config tests/e2e/playwright.config.ts

# one file
npx playwright test --config tests/e2e/playwright.config.ts specs/cross-role.spec.ts
```

Those emails and passwords come from `LOGIN_CREDENTIALS.md` — read them from
there rather than trusting the literals above, since the seeder changes.

A case reports as `skipped` with a reason naming the missing prerequisite, e.g.
`No seeded E2E_STUDENT_EMAIL + E2E_STUDENT_PASSWORD (student) — run
`node seed_users.mjs` first`.

### In CI

The `e2e` job in `.github/workflows/ci.yml` is gated on the repository variable
`E2E_ENABLED == 'true'` and reads the `E2E_*` values from repository
**variables** (seeded demo accounts, not secrets). Unset → the job is skipped.
When `E2E_ENABLED` is on but `@playwright/test` is absent, the job emits a
notice and exits without failing.

### What the e2e suite deliberately does not cover

Face recognition and liveness. Those need a real camera and a live model; they
are not browser-automatable without turning the tests into a hardware harness.
The geofence and anti-spoofing logic around them is covered by
`tests/backend/` and `tests/integration/`.

## Why so many tests read source files

Several guards are asserted by reading the controller rather than by driving it
through HTTP. That is a deliberate trade-off, not an accident:

- **What it buys.** A behavioural test needs a seeded database, a JWT and a
  running Express app. In CI there is none of that, so those tests would be
  skipped — which is exactly the state the repo was in when H2 and M2 shipped.
  A source-shape test runs everywhere.
- **What it catches.** The specific regression that keeps recurring here: a role
  check restored without the class-ownership check, or a direct-table write
  reintroduced as a "temporary" fallback. Both are visible in the source; neither
  is visible without a live fixture.
- **What it does not catch.** A guard that is present but reachable on a path
  nobody thought to test. That still needs the manual QA pass in
  `docs/PHASE_A_QA_CHECKLIST.md`.

Each source-shape assertion is paired with a comment naming the regression it
came from, so a failing test explains *why* the line matters rather than just
what it matched.

## Adding a test

- **A new write route in `routes/index.ts`** — it must get a validation schema.
  If it legitimately has no body, add it to `NO_BODY_WRITES` in
  `routes.test.mjs`; that list is stale-checked, so a deleted route will fail.
- **A new edge function** — add it to `edge_functions.test.mjs` and assert it
  verifies a JWT, scopes its role lookup, and does not return raw database
  errors.
- **A new AI endpoint** — add it to `PROTECTED` in `test_live_http.py`.
- **A new limiter** — register it in `ai-server/main.py` and add it to
  `TestProductionLimits` in `test_ratelimit.py`.
- **A new browser flow** — put it in `tests/e2e/specs/`, wrap the file's
  `test` in `gated([...roles])` from `support/harness.ts`, and add the new
  `E2E_*` variables to the tables above. A spec that can fail without its
  prerequisites set does not belong in this suite.
