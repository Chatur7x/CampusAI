# CampusAI Test Suites

Security and contract tests for the three runtimes in this repo. Everything here
runs offline against the source tree — no database, no network, no seeded
fixtures — so it is safe in CI on a clean checkout.

```
tests/
  ai/            pytest  — FastAPI AI server
  backend/       node:test — Express backend + frontend data layer
  integration/   node:test — cross-service contracts
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
