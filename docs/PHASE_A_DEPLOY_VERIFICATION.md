# Phase A — Deploy & Verification Status

Phase A code changes are complete and tested, but **only some of them are live**.
This document is the handoff for the one step that cannot be run from this
machine (Supabase edge function deployment), plus the per-check verification
status so nobody has to guess what is already proven.

Last run: 2026-10-03. Evidence files: `tmp/probe-evidence.txt`,
`tmp/admin-probe-evidence.json` (both gitignored, regenerate with the commands
below).

---

## 1. Status at a glance

| # | Check | Layer | Status | Evidence |
|---|-------|-------|--------|----------|
| 1 | Edge functions reject missing/tampered JWT (`attendance`, `notices`, `timetable`) | Supabase edge (live) | ✅ live-verified | `tmp/probe-evidence.txt` — no token → `401`, tampered token → `401`, exit 0 |
| 2 | Backend rejects `alg=none` JWT | Backend (live, local) | ✅ live-verified | `POST /api/admin/users` with an unsigned token → `401 {"message":"Invalid token"}` |
| 3 | Backend rejects `role:"superadmin"` on create | Backend (live, local) | ✅ live-verified | `POST /api/admin/users` → `400 role must be one of: ADMIN, SUPER_ADMIN, ...` |
| 4 | Backend rejects `role:"superadmin"` on update | Backend (live, local) | ✅ live-verified | `PUT /api/admin/users/:id` → `400` same message |
| 5 | Backend role check uses the DB profile, not the JWT claim | Backend (source) | ✅ covered by `authenticate` + tests | `server--backend/src/middleware/auth.ts` |
| 6 | `timetable` raw-body mass assignment fixed (`WRITABLE_COLUMNS`, 2000-entry cap) | Supabase edge | ⛔ **not deployed** | code in repo; live function still pre-Phase-A |
| 7 | `timetable` / `notices` raw PostgREST `error.message` no longer leaks | Supabase edge | ⛔ **not deployed** | same |
| 8 | `notices` PUT allowlist + role/faculty scoping | Supabase edge | ⛔ **not deployed** | same |
| 9 | `attendance` `staffOwnsStudent()` gate, `ALLOWED_STATUSES`, PUT handler | Supabase edge | ⛔ **not deployed** | same |
| 10 | 14 unvalidated write routes now schema-validated | Backend | ✅ in repo, deployed with backend | 20 schemas wired in `routes/index.ts` |
| 11 | JWT HS256 pinned on sign **and** verify | Backend | ✅ in repo, deployed with backend | `src/utils/jwt.ts` `ALG = 'HS256'` |
| 12 | `websockets==15.0.1` pinned | AI server | ✅ committed (`241d304`) | `ai-server/requirements.txt` |

Items 6–9 are the only **code** that is finished but **not live**. Everything in
rows 1–5 and 10–12 is verified.

---

## 2. Why deployment could not be run here

The Supabase CLI needs an access token that this machine does not have:

```
SUPABASE_ACCESS_TOKEN : absent from process env, absent from .env,
                        no global `supabase` login
```

`npx supabase@2.119.0` itself works, so the only missing input is the token.
No fake/dry-run token was used — a deploy that silently fails is worse than no
deploy.

**What the deploy changes (and why it matters):** the functions currently
serving from `akgjpqvpcugbmdenpxny` are the pre-Phase-A versions. Until this
runs, the timetable mass-assignment fix, the notices PUT allowlist, the
attendance ownership gate and the sanitized error messages are **not in effect
in production**, even though `npm test` and the repo are green.

---

## 3. Handoff — run these three commands

From the repo root, on a machine with Supabase credentials:

```bash
# 1. authenticate (once)
npx supabase@2.119.0 login
# or: export SUPABASE_ACCESS_TOKEN=...

# 2. deploy the three Phase A functions and probe them
bash scripts/deploy-edge-functions.sh --all --verify

# 3. standalone re-check any time (safe: read-only probes)
bash scripts/probe-edge-functions.sh
```

`deploy-edge-functions.sh --all` deploys all 9 functions in `ALL_FUNCTIONS`;
drop `--all` to deploy only `attendance`, `notices`, `timetable`.
`SUPABASE_CMD` can be overridden if the CLI resolution picks the wrong one,
`SUPABASE_PROJECT_REF` if the project ref ever changes.

Expected probe output (this is what a healthy post-deploy run looks like):

```
ok  attendance: no token -> 401
ok  attendance: tampered token -> 401
ok  notices: tampered token -> 401
ok  timetable: tampered token -> 401
All probes passed.
```

After a successful deploy, update rows 6–9 in the table above to ✅ and record
the deploy timestamp here: `____________________`.

---

## 4. How the backend checks were proven (rows 2–4)

`tmp/admin-probe.cjs` (gitignored, reproducible) against a live backend on
`http://127.0.0.1:5000`:

1. Reads `server--backend/.env` without printing any secret; rewrites
   `DATABASE_URL` to the Supavisor transaction pooler
   (`aws-1-ap-south-1.pooler.supabase.com:6543`, tenant-qualified user) because
   the direct host (`db.<ref>:5432`) is not reachable from this machine —
   the same path the migrations used.
2. Picks a real **active ADMIN** profile from the database (read-only query).
3. Signs an HS256 token with `JWT_SECRET`, then drives three requests:

| Request | Result | Why it proves the fix |
|---------|--------|------------------------|
| `POST /api/admin/users` with `{"alg":"none"}` unsigned token | `401 Invalid token` | `verifyToken` pins `algorithms: ['HS256']` |
| `POST /api/admin/users` with valid admin token, `role:"superadmin"` | `400 role must be one of: ADMIN, ...` | `createUserValidation` rejects before the controller runs |
| `PUT /api/admin/users/:id` with valid admin token, `role:"superadmin"` | `400` same | update path is schema-gated too |

The control case matters: the *same* valid admin token that gets `400`
(validation reached) on `role:"superadmin"` gets past authentication, so the
`401` on the `alg=none` token is a signature rejection and not a database
failure leaking as `Invalid token`.

---

## 5. Known limitations of this evidence

* Backend probes were run against a **local** process, not the deployed
  backend. The code is identical to `main`; re-run
  `node tmp/admin-probe.cjs` (point `VITE_BACKEND_URL`/the probe base URL at
  staging) after the backend is redeployed.
* Edge probes prove the **auth gate** on the currently deployed functions, not
  the Phase A logic — that is exactly what items 6–9 are waiting on.
* No database writes are performed by any probe; validation rejects before the
  controller, and the profile lookup is read-only.
