# AISMS Deployment Guide

> **Status update — 2026-11-13 (verified).** The production frontend is
> **https://ai-smart-attendance-lyart.vercel.app**. `https://aisms.vercel.app`
> serves an unrelated "Telegram" page — do **not** use it as the app URL; this
> discrepancy is called out here because older sections of this file (kept for
> history) still reference it. `.env.production` is no longer tracked in git;
> production env vars live in the Vercel project settings. The two Railway
> service domains return **404** (no service deployed at either):
> `https://aisms-ai-server.up.railway.app` and
> `https://aisms-backend.up.railway.app`. The Supabase project
> `akgjpqvpcugbmdenpxny` is **PAUSED** (HTTP 540), so all Supabase flows are
> down until it is restored. See the bring-up checklist at the bottom of this
> file. Everything marked UNVERIFIED below has not been confirmed against a
> live system.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│                     (Vercel - Vite)                         │
│                                                              │
│   Routes: /, /login, /admin/*, /faculty/*, /student/*     │
│           /company/* (Glassmorphism UI)                       │
└─────────────────┬───────────────────────────────────────────┘
                  │ API Routes
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    AI SERVER                                 │
│                  (Railway - FastAPI)                         │
│                                                              │
│   - Face Recognition (InsightFace, MediaPipe)               │
│   - Predictive Analytics (Prophet, StatsModels)              │
│   - Anomaly Detection (PyOD)                                 │
│   - Behavior Profiling                                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   BACKEND SERVER                             │
│                  (Railway - Node.js)                         │
│                                                              │
│   - REST API (Optional)                                      │
│   - Business Logic                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      SUPABASE                                │
│                                                              │
│   - Authentication                                           │
│   - Database (PostgreSQL)                                    │
│   - Edge Functions                                           │
│   - Realtime Subscriptions                                   │
│   - Storage                                                   │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

### Required Services
- [Vercel Account](https://vercel.com) - Frontend deployment
- [Railway Account](https://railway.app) - Backend deployment
- [Supabase Account](https://supabase.com) - Database & Auth

### Required Secrets

#### Vercel Environment Variables
```
VERCEL_TOKEN=<your-vercel-token>
VERCEL_ORG_ID=<your-vercel-org-id>
VERCEL_PROJECT_ID=<your-vercel-project-id>
```

#### Railway Environment Variables
```
RAILWAY_TOKEN=<your-railway-token>
RAILWAY_PROJECT_ID=<your-railway-project-id>
```

#### Supabase Environment Variables
```
SUPABASE_ACCESS_TOKEN=<your-supabase-access-token>
SUPABASE_PROJECT_REF=<your-supabase-project-ref>
```

## Deployment Steps

### 1. Frontend (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

Or connect via GitHub:
1. Go to https://vercel.com/new
2. Import repository
3. Configure environment variables
4. Deploy

#### Environment Variables (Vercel)
| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://<project>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `<anon-key>` |
| `VITE_AI_SERVER_URL` | `https://aisms-ai-server.up.railway.app` — **DOWN/UNVERIFIED** (404 as of 2026-11-13) |
| `VITE_APP_ENV` | `production` |

Note: `.env.production` was untracked from git. Production frontend env vars
are configured in the Vercel project settings, not in the repository.

### 2. AI Server (Railway)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
cd ai-server
railway init
railway up
```

#### Environment Variables (Railway)
| Variable | Value |
|----------|-------|
| `ENVIRONMENT` | `production` |
| `LOG_LEVEL` | `INFO` |
| `CORS_ORIGINS` | `https://ai-smart-attendance-lyart.vercel.app` |
| `SUPABASE_URL` | `<from-supabase>` |
| `SUPABASE_SERVICE_KEY` | `<service-key>` |

### 3. Backend Server (Railway) - Optional

```bash
cd server--backend
railway init
railway up
```

### 4. Supabase Edge Functions

The recommended path is the repo script (deploys, then probes the live
functions — see "Deploying edge functions manually" below):

```bash
export SUPABASE_ACCESS_TOKEN=sbp_…
export SUPABASE_PROJECT_REF=akgjpqvpcugbmdenpxny
bash scripts/deploy-edge-functions.sh --all --verify
```

Manual equivalent:

```bash
npm install -g supabase
supabase link --project-ref <project-ref>
supabase functions deploy --no-verify-jwt
```

Note the Supabase project is PAUSED as of 2026-11-13 — nothing here works until
it is restored (see the bring-up checklist).

## GitHub Actions Setup

### Required Secrets

Go to `Settings > Secrets and variables > Actions` in your GitHub repository:

```bash
# Vercel
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID

# Railway
RAILWAY_TOKEN
RAILWAY_PROJECT_ID

# Supabase
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_REF
```

> **2026-11-13: GitHub secrets are currently NONE set.** The `preflight` job
> in `deploy-prod.yml` fails fast and lists every missing secret rather than
> deploying partially. Note also: the environment must be named **`production`**
> (lowercase) — as of 2026-11-13 the repository only has a `Production`
> environment plus three auto-named environments, none with protection rules,
> and no lowercase `production` environment. Create it (Settings → Environments
> → New environment → `production`, with required reviewers) before relying on
> the approval gate.

### Workflows

CI is build/verify-only. **`deploy-prod.yml` is the ONLY deploy path.**
`deploy.yml` and `deploy-staging.yml` were deleted; no workflow auto-deploys
on push.

| Workflow | Trigger | Action |
|----------|---------|--------|
| `ci.yml` | Push/PR | Lint, type check, tests, build — **no deploy** |
| `frontend.yml` | Frontend changes | Build & verify only — no deploy |
| `aiserver.yml` | AI Server changes | Build & verify only — no deploy |
| `backend.yml` | Backend changes | Build & verify only — no deploy |
| `deploy-prod.yml` | **`workflow_dispatch` only** | Production deploy (requires `production` environment approval) |

#### `deploy-prod.yml` — the manual production path

1. Trigger manually: Actions → "Deploy production" → **Run workflow**, with
   inputs `service` (`all` | `ai-server` | `backend` | `frontend`), `reason`,
   and `confirm` (must be exactly `DEPLOY`).
2. The **`preflight`** job runs first and checks all seven secrets; if any are
   missing it fails fast with the full list and nothing is deployed. It runs
   under `environment: production` because the seven secrets are set on that
   environment, not at repo level — the reviewer prompt therefore appears at
   preflight, before `verify`.
3. The **`verify`** job re-runs lint, typecheck, tests and build on the exact
   commit.
4. The **`confirm`** job also carries `environment: production` and checks the
   typed confirmation. **Create the lowercase
   `production` environment with required reviewers first** — without it the
   gate passes instantly and anyone with Actions write access can approve
   their own run.
5. Deploy jobs then run per service; edge functions are deployed only when
   `service == 'all'` (`supabase functions deploy --no-verify-jwt`).

Every third-party action in this workflow is pinned to an exact tag.

### Deploying edge functions manually

Edge function fixes (the `attendance`/`notices`/`timetable` and
`analytics`/`notifications` security and auth fixes) have **never been
deployed** — the live functions are still the vulnerable versions. Deploy them
with a Supabase Personal Access Token (`sbp_…`; the publishable/service-role
keys do NOT grant Management API access):

```bash
export SUPABASE_ACCESS_TOKEN=sbp_…
export SUPABASE_PROJECT_REF=akgjpqvpcugbmdenpxny

bash scripts/deploy-edge-functions.sh --all --verify
```

`--verify` probes the live functions (401 on missing/tampered tokens, 403/401
for cross-user access). Until this runs, treat every edge function as
unpatched.

## Post-Deployment

### 1. Verify Deployments
- Frontend: https://ai-smart-attendance-lyart.vercel.app (**live, verified 2026-11-13**). Do not use `https://aisms.vercel.app` — it serves an unrelated "Telegram" page.
- AI Server: https://aisms-ai-server.up.railway.app/health — **DOWN/UNVERIFIED** (404 as of 2026-11-13)
- Backend: https://aisms-backend.up.railway.app/api/health — **DOWN/UNVERIFIED** (404 as of 2026-11-13)

### 2. Supabase — restore and migrate (required, in order)

The Supabase project `akgjpqvpcugbmdenpxny` is **PAUSED** (HTTP 540). Until it
is restored, authentication, database, edge functions and realtime are all
down. When bringing it back, apply migrations in this order:

1. **Restore** the project: Dashboard → project → restore/unpause.
2. **`supabase/migrations/014_fix_auth_signup_blocker.sql`** — signup returns HTTP
   500 without it. Preferred fix per the file's header: Dashboard → Project →
   Services → Auth → Restart (or upgrade the auth service); the migration is
   the fallback. 014 has **never been confirmed applied**.
3. **Verify signup works** with a real test account before proceeding.
4. **`supabase/migrations/015_restore_analytics_views.sql`** — recreates
   `daily_attendance_summary` / `department_attendance_summary` /
   `student_attendance_overview` (idempotent; the 2026-10 pass verified these
   were created live, but re-apply to be safe on the restored project).
5. **`supabase/migrations/016_company_role.sql`** — adds the `COMPANY` value to
   the `user_role` enum, re-creates `handle_new_user()` with STUDENT-only
   signup semantics (no privileged role is ever taken from signup metadata;
   staff and company accounts are provisioned out-of-band ONLY (never via public self-signup) — see the migration
   header for the exact SQL), and the `company_attendance_summary` view the
   company portal consumes. **Not applied live.** Idempotent.

### 3. Configure Supabase
1. Enable Authentication providers
2. Set up Row Level Security (RLS) policies
3. Configure Realtime settings
4. Set up Storage buckets

### 4. Bring-up checklist (human required)

Definition of done is **NOT met** — fresh-user signup, enrollment and
attendance journeys are unverifiable until a human with dashboard access does
the following, in order:

- [ ] **Unpause** the Supabase project (Dashboard → restore).
- [ ] **Apply 014** (or restart/upgrade Auth per its header). Verify a fresh
      signup succeeds.
- [ ] **Apply 015**, then **016** (see order above).
- [ ] **Deploy edge functions**: `export SUPABASE_ACCESS_TOKEN=sbp_…` then
      `bash scripts/deploy-edge-functions.sh --all --verify`; confirm probes
      return 401 for missing/tampered tokens.
- [ ] **Redeploy the AI server** on Railway (`railway.json`, service root
      `ai-server/`, `ai-server/Dockerfile`) and confirm
      `GET /health` returns 200. Face attendance cannot work until this is done.
- [ ] **Set/verify Vercel env vars** on the production frontend project
      (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AI_SERVER_URL`,
      `VITE_APP_ENV=production`) — they live in Vercel project settings, not in
      git.
- [ ] **Set the 7 GitHub secrets** (see "Required Secrets" above) and create
      the lowercase `production` environment with required reviewers.
- [ ] **E2E**: fresh signup → enrollment → mark attendance; company portal
      against the `company_attendance_summary` view.

### 5. Update DNS (Custom Domain)
- Vercel: Add custom domain in project settings
- Railway: Add custom domain in service settings

### 6. Enable Monitoring
- Set up Vercel Analytics
- Enable Railway Metrics
- Configure Supabase Monitoring

## Troubleshooting

### Frontend Build Fails
```bash
# Clear cache and rebuild
npm cache clean --force
rm -rf node_modules
npm install
npm run build
```

### AI Server Not Starting
```bash
# Check logs
railway logs

# Restart service
railway up
```

### Edge Functions Deployment Fails
```bash
# Verify Supabase CLI version
supabase --version

# Re-login
supabase logout
supabase login
```

## Security Checklist

- [ ] All environment variables set
- [ ] CORS configured for production domains
- [ ] Supabase RLS policies enabled
- [ ] API keys rotated (if needed)
- [ ] Rate limiting enabled
- [ ] Security headers configured (vercel.json)

## Support

For issues, check:
1. GitHub Issues: https://github.com/your-org/aisms/issues
2. Vercel Status: https://vercel.status
3. Railway Status: https://railway.app/status
4. Supabase Status: https://status.supabase.com
