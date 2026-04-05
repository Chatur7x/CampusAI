# AISMS Deployment Guide

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
| `VITE_AI_SERVER_URL` | `https://aisms-ai-server.up.railway.app` |
| `VITE_APP_ENV` | `production` |

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
| `CORS_ORIGINS` | `https://aisms.vercel.app` |
| `SUPABASE_URL` | `<from-supabase>` |
| `SUPABASE_SERVICE_KEY` | `<service-key>` |

### 3. Backend Server (Railway) - Optional

```bash
cd server--backend
railway init
railway up
```

### 4. Supabase Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref <project-ref>

# Deploy functions
supabase functions deploy --no-verify-jwt
```

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

### Workflows

| Workflow | Trigger | Action |
|----------|---------|--------|
| `ci.yml` | Push/PR | Lint, Type Check, Build |
| `frontend.yml` | Frontend changes | Build & Deploy Preview |
| `aiserver.yml` | AI Server changes | Deploy to Railway |
| `backend.yml` | Backend changes | Deploy to Railway |
| `deploy.yml` | Push to main | Full CI/CD Pipeline |

## Post-Deployment

### 1. Verify Deployments
- Frontend: https://aisms.vercel.app
- AI Server: https://aisms-ai-server.up.railway.app/health
- Backend: https://aisms-backend.up.railway.app/api/health

### 2. Configure Supabase
1. Enable Authentication providers
2. Set up Row Level Security (RLS) policies
3. Configure Realtime settings
4. Set up Storage buckets

### 3. Update DNS (Custom Domain)
- Vercel: Add custom domain in project settings
- Railway: Add custom domain in service settings

### 4. Enable Monitoring
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
