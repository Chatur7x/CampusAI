# Test Coverage Baseline

Baseline snapshot for Phase B of the production-readiness plan. It records what
the suites actually assert today, what they do not touch, and which defects the
new tests surfaced.

- Recorded: 2026-10-09
- Commit: `HEAD` at time of measurement (working tree, not committed)
- Suites: `npm run test:backend`, `npm run test:integration`, `npm run test:ai`

## Read this first: coverage tooling is absent

**No real line/statement/branch coverage percentage was measured for any
tier.** The coverage tooling is not installed in this repository:

```
$ python -c "import pytest_cov"
ModuleNotFoundError: No module named 'pytest_cov'

$ python -m coverage --version
No module named coverage
```

`pytest-cov` and `coverage` are both missing from the environment, and no
JavaScript coverage reporter (c8, nyc, vitest-coverage) is present either.
Per the phase constraint, no new dependency was installed to work around this.

Everything below is therefore either a **hard test count** (measured) or a
**manual module-to-test mapping** (derived by reading the test sources and the
source modules). Any percentage in this document would be fabricated, so none
is given. Treat this file as a *coverage map*, not a coverage report.

To convert this into a real report, the minimum unblocking step is
`pip install pytest-cov` plus adding `pytest --cov=ai-server` to the `test:ai`
script in `package.json`. That was out of scope here.

---

## Tier 1 — Python AI server (`ai-server/`)

### Test counts

| Metric | Before | After |
| --- | --- | --- |
| Collected | 49 | 261 |
| Passed | 30 | 225 |
| Skipped | 19 | 19 |
| Xfailed (known defects) | 0 | 17 |
| Failed | 0 | 0 |

Baseline command: `npm run test:ai` → `30 passed, 19 skipped`.
After Phase B: `225 passed, 19 skipped, 17 xfailed`.

The 19 skips are all in `test_live_http.py` and require a running AI server
(`cd ai-server && uvicorn main:app --port 8011`). They are not failures, but
they mean the HTTP layer of the AI server is **entirely unverified** unless
someone starts the server.

New files:

| File | Tests | Xfailed | Subject |
| --- | --- | --- | --- |
| `tests/ai/test_ml_helpers.py` | 171 | 12 | Statistics, forecasting, fraud, risk, geo, confidence, profiling, drift |
| `tests/ai/test_hash_chain.py` | 24 | 5 | Fingerprint hashing: determinism, tamper, replay, preimage ambiguity |

### Module-to-test mapping

`ai-server/` first-party code is ~3,300 lines across 24 modules.

| Module | Lines | Covered by | Depth after Phase B |
| --- | --- | --- | --- |
| `models/performance_analysis.py` | 250 | `test_ml_helpers.py` | **Good** — all 5 public functions, edge cases + NaN/constant series |
| `models/trend_prediction.py` | 262 | `test_ml_helpers.py` | **Good** — all 7 public helpers + 3 private helpers |
| `models/fraud_detection.py` | 258 | `test_ml_helpers.py`, `test_hash_chain.py` | **Good for the pure parts** — device/IP tracking, composite scoring, fingerprint hashing. The ML path (`train_fraud_model`) is untested: it needs PyOD, which is not installed. |
| `models/risk_prediction.py` | 258 | `test_ml_helpers.py` | **Good** — heuristic, all 4 model wrappers, ensemble, category bands, real Isolation Forest train+predict |
| `models/geo_validation.py` | 153 | `test_ml_helpers.py` | **Good** — haversine symmetry/antipodal, geofence, spoof, impossible travel |
| `models/confidence.py` | 147 | `test_ml_helpers.py` | **Good** — scoring, all flags, device trust, monotonicity |
| `models/behavior_profiling.py` | 113 | `test_ml_helpers.py` | **Partial** — heuristic and training covered; the trained KMeans classifier is broken (defect D3) |
| `models/monitoring.py` | 173 | `test_ml_helpers.py` | **Partial** — PSI covered and correct. JSD is broken (defect D4). |
| `utils/auth.py` | 109 | `test_auth.py` | **Good** (pre-existing) |
| `utils/ratelimit.py` | 81 | `test_ratelimit.py` | **Good** (pre-existing) |
| `utils/db.py` | 328 | — | **None** |
| `models/liveness.py` | 439 | — | **None** — 439 lines of challenge/frame analysis, zero tests |
| `models/face_recognition_module.py` | 293 | — | **None** — embedding + verify, zero tests |
| `models/audit_logger.py` | 217 | — | **None** |
| `routes/analytics.py` | 331 | integration (structural only) | **None behavioural** — only that every router mounts auth |
| `routes/attendance.py` | 158 | integration (structural only) | **None behavioural** |
| `routes/face.py` | 365 | integration (structural only) | **None behavioural** |
| `routes/session.py` | 76 | integration (schema only) | **None behavioural** |
| `main.py`, `config.py` | 177 | — | **None** |

### What is still uncovered, by risk

1. **`models/liveness.py` (439 lines) and `models/face_recognition_module.py`
   (293 lines) have no tests at all.** Together they are ~22% of the AI server
   and they carry the core anti-spoofing and identity decisions. This is the
   single largest coverage gap in the repository.
2. **Every `routes/*.py` handler is untested behaviourally.** The integration
   suite asserts structure (auth mounted, rate limit present, schema bounds) but
   never calls a handler and checks a response body. `analytics.py` alone is 331
   lines across ~30 endpoints.
3. **`utils/db.py` (328 lines)** — every Supabase access path. Untested.
4. **The ML training paths that need optional native deps** — `fraud_detection.train_fraud_model`
   requires PyOD, `prophet_trend` requires Prophet, `explain_risk` requires a
   trained RF plus SHAP. These degrade gracefully in production but are never
   exercised.

---

## Tier 2 — Node backend (`server--backend/`)

### Test counts

| Suite | Command | Before | After |
| --- | --- | --- | --- |
| Backend | `npm run test:backend` | 104 passed, 0 failed | **unchanged** |
| Integration | `npm run test:integration` | 25 passed, 4 skipped, 0 failed | **unchanged** |

Tier 2 was out of Phase B's edit scope and was not modified; it is recorded here
as the baseline for later phases.

The 4 integration skips are the `live:` tests, gated on `STUDENT_JWT`,
`FACULTY_JWT`, `SUPABASE_URL` + `ANON_KEY` and `AI_BASE_URL`. They are the only
tests in the repo that exercise a real running system, and by default they never
run.

### Suite breakdown (backend, 104 tests)

| File | Tests | Asserts |
| --- | --- | --- |
| `auth.test.mjs` | 18 | JWT alg pinning, separate access/refresh secrets, secret length floor, role allowlist, deactivated accounts, error/404 handlers do not leak, helmet + headers, no auth cookie |
| `routes.test.mjs` | 25 | Every route but the credential endpoints requires auth; mutating routes validate bodies; per-resource authorisation (notice, leave, timetable, user, course, bulk import, export, blockchain audit, security dashboard) |
| `upload.test.mjs` | 19 | Extension + MIME allowlists, magic-byte signature check, filename never reused, containment, file count cap, attachment disposition + CSP, rejection deletes from disk, CSV zip/ole2 rejection |
| `ownership.test.mjs` | 30 | Class-ownership enforcement on face mark / manual mark / bulk mark / leave approval; IDOR regressions on profile, leave list, stats, role-by-email; services route through the backend; geo writes bound to session user |
| `behavior.test.mjs` | 4 | Behavioural probe, role validation, error text does not echo input |

`behavior.test.mjs` is the only suite that actually spins up the app; the
others are static/structural analysis of the source.

### Route module coverage (`server--backend/src/controllers/`, ~4,150 lines)

| Controller | Lines | Covered | How |
| --- | --- | --- | --- |
| `authController.ts` | 552 | **Structural** | `routes.test.mjs` auth + rate-limit assertions; `auth.test.mjs` on `middleware/auth.ts` |
| `attendanceController.ts` | 578 | **Structural** | `routes.test.mjs` status enum, staff-only mark/bulk; `ownership.test.mjs` on the service layer |
| `analyticsController.ts` | 547 | **None** | Not referenced by any test |
| `adminController.ts` | 455 | **Structural** | `routes.test.mjs` admin-only user/course/class mutations |
| `bulkController.ts` | 380 | **Structural** | `routes.test.mjs` + `upload.test.mjs` bulk CSV |
| `leaveController.ts` | 362 | **Structural** | `routes.test.mjs` + `ownership.test.mjs` (leave approval scoping) |
| `timetableController.ts` | 323 | **Structural** | `routes.test.mjs` admin-only + time validation |
| `noticeController.ts` | 282 | **Structural** | `routes.test.mjs` read/write split |
| `chatController.ts` | 261 | **None** | Not referenced by any test |
| `blockchainController.ts` | 213 | **Structural** | `routes.test.mjs` audit view is admin-only. `utils/blockchain.ts` itself is untested. |
| `securityController.ts` | 198 | **Structural** | `routes.test.mjs` dashboard admin-only, self-service open |

**Critical gap: `utils/blockchain.ts` (179 lines) has no behavioural test.** It
is the tamper-evidence claim in the product description ("blockchain integrity
verification"). It has PoW mining, `isChainValid`, `verifyBlock` and DB
persistence — none of it is executed by a test. See "attendance hash chain"
below.

Middleware and utils:

| Module | Lines | Covered |
| --- | --- | --- |
| `middleware/validation.ts` | 263 | Yes — `behavior.test.mjs` + `routes.test.mjs` |
| `middleware/upload.ts` | 216 | Yes — `upload.test.mjs` (thorough) |
| `middleware/security.ts` | 166 | Yes — `auth.test.mjs` headers/CSRF |
| `middleware/auth.ts` | 92 | Yes — `auth.test.mjs` |
| `middleware/rateLimiter.ts` | 41 | Structural only |
| `utils/securityEvents.ts` | 191 | None |
| `utils/blockchain.ts` | 179 | **None** |
| `utils/audit.ts` | 105 | None |
| `utils/deviceTrust.ts` | 106 | None |
| `utils/geoVerification.ts` | 107 | Structural (edge-function test) |
| `utils/faceVerification.ts` | 40 | None |
| `utils/otp.ts`, `resetToken.ts`, `tokenBlacklist.ts`, `loginHistory.ts`, `jwt.ts`, `bcrypt.ts`, `email.ts` | ~285 | Structural via `auth.test.mjs` / integration |

---

## Tier 3 — Supabase edge functions (`supabase/functions/`, ~2,050 lines)

Not run directly; covered only by `tests/integration/edge_functions.test.mjs`
(29 tests, 25 passing, 4 skipped), which reads the Deno sources as text.

| Function | Lines | Covered |
| --- | --- | --- |
| `attendance/index.ts` | 194 | **Good** — JWT-before-anything, status enum, class ownership, fails closed without faculty row, no raw PostgREST error |
| `notices/index.ts` | 190 | **Good** — auth required, scoped role/faculty lookups, named-field updates only, no raw error |
| `timetable/index.ts` | 186 | **Good** — auth, scoped lookups, named columns, no raw error |
| `verify-face/index.ts` | 216 | Schema bounds only |
| `security-monitor/index.ts` | 218 | None |
| `notifications/index.ts` | 360 | None |
| `bulk-operations/index.ts` | 383 | None |
| `analytics/index.ts` | 348 | None — **includes the entire `blockchain_audit` chain-verification branch** |
| `backup/index.ts` | 157 | None |

---

## The attendance hash chain — where it actually lives

Worth stating precisely, because the Phase B brief expected a Python
hash-chain module and there is not one:

- **There is no hash chain in `ai-server/`.** A grep for
  `prev_hash|previous_hash|chain|nonce|sha256` across all of `ai-server/**/*.py`
  returns only `fraud_detection.generate_device_fingerprint`, which is a plain
  salted SHA-256 digest of device attributes — not a chain.
- The real chain is TypeScript, `server--backend/src/utils/blockchain.ts`: a
  `Blockchain` class with proof-of-work mining (`mineBlock`, difficulty 4),
  `addBlock`, `isChainValid`, `verifyBlock`, and `persistBlock` /
  `loadChainFromDB` against a `blockchain_hashes` table.
- A **second, independent** chain check exists in
  `supabase/functions/analytics/index.ts` under `case 'blockchain_audit'`, which
  walks records and compares `record.previous_hash` against a running
  `prevHash` seeded with `'GENESIS'`.

Neither is reachable from pytest. `tests/ai/test_hash_chain.py` therefore covers
the Python-side integrity primitive that genuinely exists — device-fingerprint
hashing — for determinism, tamper detection, ordering and replay, and does
**not** re-implement the TypeScript chain, since a test that reimplements the
algorithm under test proves nothing.

**Recommended for a later phase:** `blockchain.ts` deserves a real
`tests/backend/blockchain.test.mjs` covering tamper detection (mutating
`block.data` breaks `isChainValid`), ordering (index chain integrity), replay
(re-adding a known block fails to mine a duplicate), and the `GENESIS` seeding
contract. The Python AI server has no equivalent to test.

---

## Defects surfaced by Phase B

17 xfailing tests pin 6 distinct real bugs. No assertion was weakened to make
them pass; each is a `strict=True` xfail with the failure mode written into the
`reason=`, so fixing the source turns the xfail into an XPASS failure that
forces the marker to be removed.

| ID | Location | Severity | Defect |
| --- | --- | --- | --- |
| **D1** | `models/fraud_detection.py:281` | **High** | `_extract_fingerprint_entropy` calls `math.log2` but `math` is imported only inside `validate_fingerprint_v4`, never at module scope. **Every call raises `NameError`.** The `FINGERPRINT_LOW_ENTROPY` spoof check never executes, and the endpoint returns HTTP 500 for any non-empty fingerprint. Fix: add `import math` at module level. |
| **D2** | `models/monitoring.py:164` | **High** | `jensen_shannon_divergence` uses `scipy.stats`, but `from scipy import stats` exists only as a function-local import inside `check_advanced_drift`. **NameError on every call**; `/analytics/drift/advanced` returns HTTP 500 for all requests. Fix: import at module scope. |
| **D3** | `models/behavior_profiling.py:112` | **High** | `train_profiles` fits KMeans on the PCA-reduced matrix `Xp`, but `classify_student` predicts on the 4-feature scaled matrix `Xs`. When PCA retains fewer than 4 components it raises `ValueError: X has 4 features, but KMeans is expecting 1`. The classifier is **unusable after a successful training run**, and the distance-to-centre confidence is meaningless. Fix: persist the fitted PCA and transform at classify time. |
| **D4** | `models/performance_analysis.py:245` and `:282` | **High** | Severity escalation uses lexicographic `max()` on strings. `max("LOW","HIGH") == "LOW"` (since `'L' > 'H'`), so the "Predicted grade near failing" branch is unreachable — a student predicted 59 stays `LOW` / `at_risk: False`. In `suggest_intervention`, `max("HIGH","MEDIUM") == "MEDIUM"` **downgrades** a student already flagged HIGH to MEDIUM. Fix: use a rank map. |
| **D5** | `models/performance_analysis.py:188` | Medium | `predict_performance_v4` has no zero-variance guard. Constant attendance makes `ss_x == 0`, so the interval term divides by zero and the whole response is `NaN` — not valid JSON. `predict_grade` guards this case; v4 does not. |
| **D6** | `models/performance_analysis.py:45` | Medium | `pearson_correlation` on a zero-variance series returns NaN `r`/`p` and then reports `direction: "negative"` (because `NaN > 0` is False) — a confident-looking but meaningless verdict instead of an explicit error. Separately, `predict_grade` with constant history yields a **predicted grade of 100.0** for any input, since `max(0, min(100, NaN)) == 100`. |

### Related, not yet pinned as xfail

- `compare_methods` (`trend_prediction.py:198`) filters `None` out of
  `clean_rates` but passes the **original** `weekly_rates` to `_classify_trend`
  at line 252, which `np.mean()`s a list containing `None` → `TypeError`. The
  documented `None` filter therefore does not make the function `None`-safe.
  Pinned by one xfail.
- `predict_performance_v4` does not validate that the history lists are the same
  length, unlike `predict_grade`. A 5-vs-2 input passes the `< 5` guard and
  raises inside scipy. Pinned by a direct `pytest.raises` test.

## Reproducing

```bash
# Python AI server (this phase's work)
python -m pytest tests/ai -q
python -m pytest tests/ai/test_ml_helpers.py tests/ai/test_hash_chain.py -q

# To see the 17 known defects fail loudly
python -m pytest tests/ai -q --runxfail

# Other tiers (unchanged by this phase)
npm run test:backend
npm run test:integration
```

To see the xfail reasons in full: `pytest tests/ai -q -rxX`.