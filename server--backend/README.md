# Express Backend (Optional / Legacy)

## Architecture Decision

The CampusAI system uses **three backend services**:

| Service | Role | Status |
|---------|------|--------|
| **Supabase** (primary) | Auth, DB, Edge Functions, Realtime | **Active** — all frontend calls go here |
| **Python AI Server** (`ai-server/`) | Face recognition, ML analytics | **Active** — called for AI features |
| **Express Backend** (this directory) | REST API, WebSocket, Blockchain | **Optional** — not called by frontend |

### Why does this exist?

This Express backend was built as a traditional REST API layer with:
- Prisma ORM for database access
- Socket.IO for real-time WebSocket notifications and chat
- Blockchain integrity verification for attendance records
- Rate limiting, validation middleware, audit logging

However, the frontend was migrated to use **Supabase directly** (client-side SDK + Edge Functions), making this backend unnecessary for core operations.

### When to use this backend

- **WebSocket notifications**: If you need server-push beyond Supabase Realtime
- **Blockchain verification**: Attendance hash integrity (persists to `blockchain_hashes` table)
- **Heavy server-side processing**: Bulk operations that shouldn't run in edge functions

### Setup (if needed)

```bash
cd server--backend
cp ../.env.example .env  # Edit with your values
npm install
npx prisma generate
npm run dev  # Starts on port 5000
```

### Environment Variables

Required in `server--backend/.env`:
```
DATABASE_URL=postgresql://...
JWT_SECRET=your-jwt-secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SMTP_HOST=smtp.gmail.com  # Optional for email
SMTP_USER=your-email
SMTP_PASS=your-app-password
```
