# AI-SmartAttendance

Your campus assistant that blends AI attendance, blockchain-backed audit trails, and Supabase-powered APIs. This repo now separates the backend as `server--backend/` for easier navigation.

## What’s inside (plain and polite)
- **Frontend**: React + TypeScript + Vite in `src--frontend/` (dashboards, contexts, UI kit).
- **Backend**: Node/Express + Prisma in `server--backend/` (controllers for attendance, timetable, analytics, notifications).
- **Supabase**: Edge functions in `supabase/functions/` (attendance, notices, timetable, analytics) plus SQL seeds/migrations.

## Quick start
```bash
npm install
cd server--backend && npm install

# run front-end
npm run dev

# run backend API (if you use the Express server locally)
cd server--backend && npm run dev
```

Supabase edge functions are deployed at:
- https://doxhysprkwywsrbdtmpo.functions.supabase.co/attendance
- https://doxhysprkwywsrbdtmpo.functions.supabase.co/notices
- https://doxhysprkwywsrbdtmpo.functions.supabase.co/timetable

Send `Authorization: Bearer <supabase_access_token>` with each request.

## Folder map
- `src--frontend/` – React app (dashboards, hooks, contexts, components, pages).
- `server--backend/` – Express + Prisma sources and configuration.
- `supabase/` – migrations, seeds, and edge functions.
- `docs/` – any extended guides.

## Housekeeping
- Run `npm run lint` before commits; add tests where logic changes.
- Keep tokens out of Git and rotate them if shared.
- Deploy edge functions with `npx supabase functions deploy <name> --project-ref doxhysprkwywsrbdtmpo`.
