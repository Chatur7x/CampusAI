# =============================================================
# AISMS - Railway Deployment Guide
# =============================================================

## AI Server Deployment (Recommended)

Railway is ideal for the Python FastAPI AI server with ML models.

### Quick Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new?template=https://github.com/your-username/AISMS)

### Manual Setup

1. **Create Railway Account**
   - Sign up at [railway.app](https://railway.app)
   - Connect GitHub repository

2. **Deploy AI Server**
   ```bash
   # From project root
   cd ai-server
   railway init
   railway up
   ```

3. **Configure Variables**
   
   In Railway Dashboard > Variables:

   | Name | Value | Notes |
   |------|-------|-------|
   | `ENVIRONMENT` | `production` | |
   | `LOG_LEVEL` | `INFO` | Debug for development |
   | `SUPABASE_URL` | Your Supabase URL | |
   | `SUPABASE_SERVICE_KEY` | Your service role key | Server-side only |
   | `CORS_ORIGINS` | Your Vercel domains | Comma-separated |
   | `CAMPUS_LAT` | Campus latitude | e.g., `17.5` |
   | `CAMPUS_LNG` | Campus longitude | e.g., `78.5` |

4. **Set Start Command**
   
   Railway auto-detects from `railway.json`:
   ```
   uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2
   ```

5. **Health Check**
   
   Endpoint: `https://your-app.railway.app/health`
   
   Response should include:
   ```json
   {"status": "healthy", "models_loaded": true}
   ```

## Backend Server (Optional)

For the Node.js backend server:

```bash
cd server--backend
railway init
railway up
```

Variables:
| Name | Value |
|------|-------|
| `DATABASE_URL` | Prisma connection string |
| `FRONTEND_URL` | Your Vercel frontend URL |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key |

## Custom Domain

1. Railway Dashboard > Settings > Domains
2. Add custom domain (e.g., `api.aisms.edu`)
3. Configure DNS records as shown

## Scaling

- **Starter Plan**: 1GB RAM, shared CPU
- **Pro Plan**: Up to 4GB RAM, dedicated CPU
- **Team Plan**: Unlimited replicas, metrics

## Monitoring

Railway provides:
- Real-time logs
- CPU/Memory graphs
- Request tracing
- Error tracking

## Regions

Deploy closest to your users:
- `us-east1` - US East (default)
- `eu-west1` - Europe
- `asia-northeast1` - Asia Pacific
