# AI-SmartAttendance

A campus management experience that fuses AI face/biometric tools, blockchain-backed audit trails, and realtime analytics for admins, faculty, and students. The workspace includes:

- A **React + TypeScript + Vite** front-end with modular dashboards, context providers, and a fully themed UI kit.
- A **Node/Express** backend that unwraps authentication, attendance, timetable, analytics, and notification services plus Prisma/SQL models.
- **Supabase functions** and migrations wiring blockchain verification, analytics, and face verification helpers for serverless tooling.

## Key Capabilities

1. **Auto role detection login** removes manual dropdowns and routes users to their portal based on JWT-scoped roles sent by the server.
2. **Dual attendance experience** lets faculty choose manual grids or smart face/biometric recognition with live present/absent stats and bulk support.
3. **Timetable-integrated workflows** enable faculty to launch attendance sessions from a weekly view while students see ✅/❌/⏳ indicators per slot.
4. **Student registration** is a guided multi-step intake with India-specific address autofill, notifications, and credential emails.
5. **Student dashboard** keeps attendance front and center with a large gauge, safe-absence math, and contextual notices.

## Languages

The codebase primarily uses:

- **TypeScript** – React components, backend controllers, hooks, contexts, services, and CLI tooling across `src/` and `server/src/`.
- **SQL / Prisma schema** – Supabase migrations, functions, and ORM layers (Prisma models, raw SQL migrations) for data shape and RLS.
- **JavaScript/TypeScript configs & JSON** – build tooling (`vite`, ESLint, tsconfig), Supabase function manifests, and mock helpers.
- **Markdown** – documentation, feature briefs, and guides in `/README*.md` and `/docs`.
- **Shell / PowerShell** scripts – workspace utilities, CI helpers, and devOps snippets (PowerShell module uses). 

## Getting Started

```bash
# install workspace deps
npm install
cd server && npm install

# run both apps (use your preferred terminal multiplexer)
npm run dev      # front-end
cd server && npm run dev
```

Set up Supabase locally (see `/supabase/`), run migrations, and seed data as needed. Supabase functions live under `/supabase/functions` and can be deployed via `supabase deploy` if you push to a hosted project.

## Folder Highlights

- `src/` – Vite React app with dashboards, hooks, context, components, and pages.
- `server/src/` – Express controllers, Prisma integration, attendance/timetable services, and audit logging.
- `supabase/` – migrations, SQL seed scripts, and edge functions for analytics, notifications, bulk flows, and face verification.
- `docs/` – supplemental guides (if present); `README_COMPLETE.md`, `QUICK_START.md`, and others expand the story.

## Next Steps

- Re-run `npm run lint` and `npm run test` if new logic is added.
- Push changes to `main` and monitor GitHub language stats; feel free to add `.gitattributes` to control Linguist if needed.
- Connect to Supabase or Postgres with `.env.local` to hydrate services and run the Prisma client migrations.
