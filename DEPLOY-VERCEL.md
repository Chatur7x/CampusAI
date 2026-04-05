# =============================================================
# AISMS - Vercel Deployment Guide
# =============================================================

## Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/AISMS)

## Manual Setup

1. **Fork/Clone Repository**
   ```bash
   git clone https://github.com/your-username/AISMS.git
   cd AISMS
   ```

2. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel --prod
   ```

## Environment Variables (Vercel Dashboard)

Go to Project Settings > Environment Variables and add:

| Name | Value | Notes |
|------|-------|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | From Supabase Dashboard |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key | Public, safe for client |
| `VITE_AI_SERVER_URL` | `https://aisms-ai-server.up.railway.app` | Or your AI server URL |
| `VITE_APP_ENV` | `production` | |

## Domain Configuration

After deployment, set your custom domain in Vercel Dashboard:
- Project Settings > Domains
- Add your domain (e.g., `aisms.yourdomain.com`)

## Preview Deployments

Pull requests automatically create preview deployments.
Merge to `main` triggers production deployment.

## Performance

- Deployed to Vercel Edge Network
- Automatic SSL certificates
- Global CDN caching
- ~100ms cold start
