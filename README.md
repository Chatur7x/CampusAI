# CampusAI — AI-Powered Smart Attendance System

> A full-stack university attendance platform that uses **face recognition**, **blockchain integrity verification**, and **real-time analytics** to make attendance tracking smarter, tamper-proof, and genuinely useful for students, faculty, and administrators.

[![CI](https://github.com/Chatur7x/AI-SmartAttendance/actions/workflows/ci.yml/badge.svg)](https://github.com/Chatur7x/AI-SmartAttendance/actions)

---

## Why This Exists

Traditional attendance systems rely on manual roll calls or basic biometric scanners — both are easy to game and hard to analyze. CampusAI replaces all of that with a camera-based face recognition system backed by liveness detection (so you can't just hold up a photo), geolocation validation (so you have to actually be on campus), and a blockchain audit trail (so nobody can quietly edit records after the fact).

On top of attendance, the platform gives faculty real-time analytics about their classes, lets students track their own attendance health, and gives administrators a bird's-eye view of the entire institution.

---

## Tech Stack at a Glance

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + TypeScript + Vite | Single-page app with role-based dashboards |
| **UI** | Tailwind CSS + shadcn/ui + Framer Motion | Dark-themed, responsive components |
| **Auth & Database** | Supabase (PostgreSQL + Auth + Realtime) | Primary backend — handles auth, data, and live subscriptions |
| **AI Server** | Python FastAPI + InsightFace + scikit-learn | Face recognition, liveness detection, fraud detection, risk prediction |
| **Edge Functions** | Supabase Edge Functions (Deno) | Serverless API endpoints for attendance, timetable, notices, analytics |
| **Legacy Backend** | Node.js + Express + Prisma | Optional REST API with Socket.IO (kept for reference) |
| **DevOps** | Docker + GitHub Actions + Vercel + Railway | CI/CD pipeline, containerized deployment |

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.10+ (for the AI server)
- A **Supabase** project (free tier works fine)

### 1. Clone and Install

```bash
git clone https://github.com/Chatur7x/AI-SmartAttendance.git
cd AI-SmartAttendance

# Frontend dependencies
npm install

# AI server dependencies
cd ai-server
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### 2. Environment Variables

Copy the example and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

The key variables you'll need:

| Variable | What It Does |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `VITE_AI_SERVER_URL` | AI server URL (default: `http://localhost:8000`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side key for edge functions |

### 3. Run Everything

```bash
# Terminal 1 — Frontend (http://localhost:5173)
npm run dev

# Terminal 2 — AI Server (http://localhost:8000)
cd ai-server
uvicorn main:app --reload --port 8000
```

### 4. Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@anurag.edu.in | Admin@123456 |
| Faculty | saikrishnait@anurag.edu.in | Faculty@123456 |
| Student | 24eg109a28@anurag.edu.in | Student@123456 |

---

## Project Structure — The Full Map

Here's every file and folder in the project, organized by what it does. This isn't auto-generated boilerplate — each section explains the *why*, not just the *what*.

### Root Files

```
├── index.html                 → The single HTML entry point that Vite uses to mount the React app
├── vite.config.ts             → Vite bundler config — path aliases (@/ → src--frontend/), proxy rules
├── tailwind.config.js         → Tailwind CSS setup — custom colors, dark mode, animation extensions
├── postcss.config.js          → PostCSS pipeline (just Tailwind + autoprefixer)
├── tsconfig.json              → Base TypeScript config, shared by app and node configs
├── tsconfig.app.json          → TS config for the frontend source code
├── tsconfig.node.json         → TS config for Vite and build tooling
├── eslint.config.js           → ESLint flat config with React and TypeScript rules
├── components.json            → shadcn/ui component registry config
├── package.json               → Frontend dependencies and scripts (dev, build, lint, preview)
├── .env.example               → Template for all environment variables the project needs
├── .gitignore                 → Ignores node_modules, dist, .env files, __pycache__, .venv, IDE files
├── seed_users.mjs             → Standalone script to create auth users via Supabase Admin API
```

### Deployment & DevOps

```
├── Dockerfile                 → Multi-stage build: Node (vite build) → nginx (serve the SPA)
├── docker-compose.yml         → Orchestrates 3 services: frontend, ai-server, backend (optional)
├── nginx.conf                 → Production nginx — SPA fallback, AI proxy, caching, security headers
├── vercel.json                → Vercel deploy config — rewrites for SPA + AI proxy + asset caching
├── railway.json               → Railway deploy config for the AI server (Dockerfile-based)
├── Procfile                   → Heroku/Railway process definition for the AI server
├── .github/
│   └── workflows/
│       └── ci.yml             → GitHub Actions pipeline — lint, build, type-check, Docker build
```

---

### `src--frontend/` — The React Application

This is the heart of the user-facing app. Everything a student, faculty member, or admin interacts with lives here.

#### Entry Points

```
src--frontend/
├── main.tsx                   → React DOM entry — wraps everything in providers (Auth, Theme, Router)
├── App.tsx                    → Route definitions — maps URLs to dashboards and pages
├── index.css                  → Global styles — Tailwind base, custom CSS variables for theming
```

#### Context Providers

These provide global state across the entire app without prop drilling:

```
├── context/
│   ├── SupabaseAuthContext.tsx → Authentication state — sign in, sign out, session management,
│   │                            role detection, profile loading. The backbone of the whole auth flow.
│   └── ThemeContext.tsx        → Dark/light mode toggle with localStorage persistence
```

#### Dashboard Shells

Each role gets its own dashboard layout with a sidebar, header, and nested route outlet:

```
├── dashboards/
│   ├── AdminDashboard.tsx     → Admin layout — sidebar with links to all admin pages, role guard
│   ├── FacultyDashboard.tsx   → Faculty layout — attendance sessions, classes, timetable, analytics
│   └── StudentDashboard.tsx   → Student layout — my attendance, timetable, notices, face registration
```

#### Pages — Admin

The admin role has the most pages. Each one manages a different part of the institution:

```
├── pages/
│   ├── LoginPage.tsx          → Animated 3D login page with Supabase auth (email/password, magic link)
│   ├── ResetPasswordPage.tsx  → Password reset page (works with Supabase recovery flow)
│   │
│   ├── admin/
│   │   ├── Overview.tsx       → Dashboard home — live stats, attendance trends, department breakdown,
│   │   │                        blockchain integrity score, security alerts. All fetched from real APIs.
│   │   ├── Students.tsx       → Full CRUD for student records — search, filter, import/export
│   │   ├── Faculty.tsx        → Faculty management — add, edit, assign to departments
│   │   ├── Departments.tsx    → Department CRUD — create departments, assign HODs
│   │   ├── Classes.tsx        → Class/section management — assign class incharge, rooms
│   │   ├── Courses.tsx        → Course catalog — link courses to departments and faculty
│   │   ├── Timetable.tsx      → Visual timetable builder — drag-and-drop scheduling grid
│   │   ├── Notices.tsx        → Notice board — create, edit, broadcast announcements
│   │   ├── Blockchain.tsx     → Blockchain explorer — view attendance hash chains, verify integrity
│   │   ├── Analytics.tsx      → Institution-wide analytics — attendance patterns, department comparison
│   │   ├── Security.tsx       → Security dashboard — audit logs, suspicious activity alerts
│   │   ├── Settings.tsx       → System settings — app config, maintenance toggles
│   │   └── StudentRegistration.tsx → Bulk student registration with CSV import
```

#### Pages — Faculty

Faculty pages are focused on running classes and tracking attendance:

```
│   ├── faculty/
│   │   ├── Overview.tsx       → Faculty home — today's schedule, quick attendance stats
│   │   ├── AttendanceSession.tsx → Live attendance session — start session, scan faces in real-time
│   │   ├── MyClasses.tsx      → View assigned classes and their student rosters
│   │   ├── MyStudents.tsx     → Detailed student list with individual attendance records
│   │   ├── Timetable.tsx      → Personal timetable view fetched from Supabase
│   │   ├── Notices.tsx        → Create and manage faculty-specific notices
│   │   ├── Analytics.tsx      → Class analytics — daily trends, subject-wise attendance charts
│   │   │                        with adjustable time range (7/14/30 days)
│   │   └── Settings.tsx       → Profile settings — update name, department, password
```

#### Pages — Student

Students can track their own attendance and plan ahead:

```
│   ├── student/
│   │   ├── Overview.tsx       → Student home — attendance percentage ring, today's classes from
│   │   │                        timetable, recent notices. All live from Supabase.
│   │   ├── MyAttendance.tsx   → Full attendance history, subject-wise breakdown with progress bars,
│   │   │                        calendar view, and a working "notify class incharge" form
│   │   ├── AttendanceCalculator.tsx → "What if" calculator — plan how many classes you need to
│   │   │                              attend to reach your target percentage
│   │   ├── Timetable.tsx      → Personal weekly timetable view
│   │   ├── Notices.tsx        → Read notices posted by faculty and admin
│   │   └── Settings.tsx       → Profile settings — update personal info, password
```

#### Components — AI Features

These are the components that connect to the Python AI server:

```
├── components/
│   ├── ai/
│   │   ├── AIDashboard.tsx    → AI analytics hub — risk scores, anomaly detection, behavior
│   │   │                        profiling, fraud alerts. Pulls data from all 10 ML modules.
│   │   ├── FaceRegistration.tsx → Camera capture UI — takes face photos, sends to AI server
│   │   │                         for embedding extraction and storage
│   │   └── FaceAttendance.tsx → Live face attendance — captures a frame from the webcam,
│   │                            verifies identity + liveness, validates location
│   │
│   ├── attendance/
│   │   ├── LiveAttendanceFaculty.tsx → Faculty-side live attendance panel with session management
│   │   └── SecureAttendanceStudent.tsx → Student-side secure attendance with face + geo verification
```

#### Components — Shared UI

```
│   ├── CommandPalette.tsx     → Cmd+K command palette for quick navigation across the app
│   ├── DataTable.tsx          → Reusable data table with sorting, filtering, pagination
│   ├── NotificationBell.tsx   → Real-time notification bell powered by Supabase Realtime
│   ├── StatsCard.tsx          → Animated stat card component used across all dashboards
│   ├── ThemeToggle.tsx        → Dark/light mode toggle button
│   │
│   └── ui/                    → 53 shadcn/ui components — accordion, alert, avatar, badge, button,
│                                 calendar, card, carousel, chart, checkbox, command, dialog, drawer,
│                                 dropdown-menu, form, input, label, menubar, pagination, popover,
│                                 progress, radio-group, scroll-area, select, separator, sheet,
│                                 sidebar, skeleton, slider, switch, table, tabs, textarea, toggle,
│                                 tooltip, and more. All dark-themed and customized.
```

#### Libraries & Utilities

```
├── lib/
│   ├── api.ts                 → The main API service layer (1,494 lines). Contains attendanceService,
│   │                            leaveService, noticeService, timetableService, analyticsService,
│   │                            securityService, and more. All queries go through Supabase with
│   │                            automatic camelCase/snake_case column name fallback.
│   ├── supabase.ts            → Supabase client initialization with environment variables
│   ├── realtime.ts            → Supabase Realtime subscription manager (624 lines) — live attendance
│   │                            updates, notification streams, user presence tracking
│   ├── database.types.ts      → Auto-generated Supabase types (snake_case — kept for backward
│   │                            compatibility, new code uses types/index.ts instead)
│   ├── utils.ts               → Shared utilities — cn() for class merging, date formatters
│   │
│   └── ai/
│       ├── apiClient.ts       → HTTP client for talking to the Python AI server
│       └── index.ts           → Barrel export for AI client functions
│
├── hooks/
│   └── use-mobile.ts          → Responsive hook — detects mobile viewport for layout adjustments
│
├── types/
│   └── index.ts               → Application-wide TypeScript types (camelCase, matching the DB)
```

---

### `ai-server/` — Python AI & Machine Learning Server

A FastAPI application that handles all the computationally heavy AI/ML work. The frontend never runs ML models directly — it sends requests here and gets back results.

```
ai-server/
├── main.py                    → FastAPI app entry point — registers all routes, sets up CORS,
│                                pre-loads the InsightFace model at startup (lifespan hook) so the
│                                first face verification request doesn't wait for a 300MB download
├── config.py                  → Environment config — Supabase credentials, CORS origins, model paths.
│                                Secrets come from environment variables, never hardcoded.
├── requirements.txt           → Python dependencies — fastapi, uvicorn, insightface, onnxruntime,
│                                opencv-python, scikit-learn, scipy, numpy, Pillow, mediapipe, pyod
├── Dockerfile                 → Production container — Python 3.12-slim, installs OpenCV system deps,
│                                pre-downloads the InsightFace buffalo_l model at build time
│
├── models/                    → Each file is a self-contained ML module:
│   ├── face_recognition_module.py → Face detection and 512-dimensional embedding extraction using
│   │                                InsightFace's buffalo_l model. Verification is done by cosine
│   │                                similarity between the live capture and the stored embedding.
│   ├── liveness.py            → Anti-spoofing — uses MediaPipe Face Mesh to track eye blinks and
│   │                            analyze skin texture. Prevents attacks with printed photos or screens.
│   ├── fraud_detection.py     → Flags suspicious attendance patterns using One-Class SVM and
│   │                            Isolation Forest from the pyod library
│   ├── risk_prediction.py     → Predicts which students are at risk of falling below attendance
│   │                            thresholds using Isolation Forest and Logistic Regression
│   ├── behavior_profiling.py  → Groups students into clusters (regular, irregular, at-risk) using
│   │                            KMeans clustering based on their attendance patterns
│   ├── performance_analysis.py → Correlates attendance data with academic performance using
│   │                             scipy statistical methods
│   ├── trend_prediction.py    → Time-series forecasting to predict future attendance rates
│   ├── geo_validation.py      → Verifies the student's GPS coordinates are within the campus
│   │                            boundary (configurable radius)
│   ├── confidence.py          → Computes confidence scores for face match results
│   ├── monitoring.py          → Tracks ML model performance over time — detects drift
│   └── __init__.py
│
├── routes/                    → API endpoint definitions:
│   ├── face.py                → POST /api/face/verify — compare a live face against stored embeddings
│   │                            POST /api/face/register — extract and store a new face embedding
│   ├── attendance.py          → POST /api/attendance/mark — the full pipeline: face verification,
│   │                            then liveness check, then geo-validation, then fraud check.
│   │                            Only marks attendance if ALL checks pass.
│   ├── analytics.py           → GET /api/analytics/risk — per-student risk scores
│   │                            GET /api/analytics/anomalies — detected outliers
│   │                            POST /api/analytics/train — retrain all models on fresh data
│   └── __init__.py
│
├── utils/
│   ├── db.py                  → Supabase database helpers — fetches student records and attendance
│   │                            history. Has a clever dual-column fallback that tries camelCase
│   │                            first, then snake_case, so it works regardless of which migration ran.
│   └── __init__.py
```

---

### `server--backend/` — Express.js Backend (Optional)

This is an alternative REST API built with Express and Prisma. The frontend primarily talks to Supabase directly, so this backend is **optional** — it's useful if you need traditional server-side logic, WebSocket-based chat, or custom middleware that can't run in edge functions.

```
server--backend/
├── README.md                  → Documents when and why you'd use this backend vs Supabase
├── package.json               → Dependencies — express, prisma, socket.io, cors, jsonwebtoken, etc.
├── tsconfig.json              → TypeScript config for the backend
├── Dockerfile                 → Production container — Node 20, npm ci, prisma generate
│
├── prisma/
│   └── schema.prisma          → Complete database schema (493 lines) — 22 models: User, Profile,
│                                Student, Faculty, Admin, Department, Course, Subject, Class,
│                                TimetableEntry, Attendance, LeaveRequest, Grade, Notice,
│                                Notification, Message, AuditLog, SecurityAlert, SystemSetting,
│                                Backup, Session, PasswordReset, BlockchainHash. All camelCase.
│
├── src/
│   ├── index.ts               → Express server entry — sets up middleware, routes, Socket.IO
│   │
│   ├── controllers/           → One file per feature area, each handling the business logic:
│   │   ├── authController.ts  → Login, signup, token refresh, password reset
│   │   ├── adminController.ts → Admin-only operations — user management, system configuration
│   │   ├── attendanceController.ts → Mark attendance, query records, bulk mark operations
│   │   ├── leaveController.ts → Student leave requests — create, approve/reject, auto-notify
│   │   │                        the class incharge faculty member
│   │   ├── timetableController.ts → Timetable CRUD
│   │   ├── noticeController.ts → Notice board management
│   │   ├── analyticsController.ts → Analytics queries and report generation
│   │   ├── blockchainController.ts → Blockchain hash chain verification endpoints
│   │   ├── bulkController.ts  → Bulk student import from CSV with validation
│   │   └── chatController.ts  → Real-time messaging via Socket.IO
│   │
│   ├── middleware/
│   │   ├── auth.ts            → JWT authentication — verifies tokens on protected routes
│   │   ├── rateLimiter.ts     → Rate limiting to prevent API abuse
│   │   ├── upload.ts          → File upload handling with multer
│   │   └── validation.ts      → Request body validation and sanitization
│   │
│   ├── routes/
│   │   └── index.ts           → Central route registry — maps URL paths to controllers
│   │
│   ├── services/
│   │   └── notificationService.ts → Creates in-app notifications and triggers email dispatch
│   │
│   ├── types/
│   │   ├── index.ts           → Backend TypeScript types
│   │   └── modules.d.ts       → Type declarations for external modules (xlsx, etc.)
│   │
│   └── utils/
│       ├── prisma.ts          → Prisma client singleton (shared across all controllers)
│       ├── blockchain.ts      → SHA-256 hash chain implementation for attendance integrity.
│       │                        Each attendance record is hashed into a block. persistBlock()
│       │                        saves to the database, loadChainFromDB() restores on startup.
│       ├── audit.ts           → Audit log helper — records every significant action with timestamp
│       ├── bcrypt.ts          → Password hashing with bcrypt
│       ├── jwt.ts             → JWT token creation and verification
│       ├── otp.ts             → One-time password generation for 2FA
│       ├── email.ts           → Email dispatch via Resend API
│       ├── faceVerification.ts → Delegates face checks to the AI server (no local ML here)
│       └── resetToken.ts      → Password reset token generation and validation
```

---

### `supabase/` — Database, Migrations & Edge Functions

Everything that touches the Supabase backend — the database schema, security policies, serverless functions, and seed data for development.

#### Migrations (Applied in Order)

```
supabase/
├── migrations/
│   ├── 001_initial_schema.sql     → Creates all tables — students, faculty, attendance, courses,
│   │                                 classes, timetable_entries, notices, leave_requests, profiles,
│   │                                 notifications, grades, audit_logs, and more.
│   ├── 002_rls_policies.sql       → Row-Level Security policies — students can only see their own
│   │                                 data, faculty can see their classes, admins see everything.
│   │                                 This is what makes the app secure even with client-side queries.
│   ├── 003_backups.sql            → Backup infrastructure tables and scheduled backup functions
│   ├── 004_fix_camelcase_schema.sql → Adds RPC functions that return camelCase column names so
│   │                                  the frontend can use consistent naming (Prisma convention)
│   └── 005_fix_rls_camelcase.sql  → Updated RLS policies to work correctly with the camelCase
│                                     column names from migration 004
```

#### Edge Functions (Serverless API)

These run on Supabase's edge network — no server to manage, they scale automatically:

```
├── functions/
│   ├── _shared/               → Shared utilities and helpers used across all edge functions
│   ├── attendance/
│   │   └── index.ts           → Attendance CRUD — mark attendance, query records, bulk operations
│   ├── verify-face/
│   │   └── index.ts           → Face verification gate — validates GPS coordinates are within
│   │                            campus boundaries before allowing attendance marking
│   ├── analytics/
│   │   └── index.ts           → Analytics queries — dashboard statistics, blockchain audit reports
│   ├── timetable/
│   │   └── index.ts           → Timetable CRUD — has a dual-table fallback that works with
│   │                            both the `timetable` and `timetable_entries` tables
│   ├── notices/
│   │   └── index.ts           → Notice board — create, read, update, delete announcements
│   ├── notifications/
│   │   └── index.ts           → Notification dispatch — creates in-app notifications and sends
│   │                            email via the Resend API (gracefully skips if no API key set)
│   ├── bulk-operations/
│   │   └── index.ts           → Bulk student registration — creates accounts and sends welcome
│   │                            emails through Resend
│   ├── deno.d.ts              → Deno type definitions for the edge function runtime
│   └── tsconfig.json          → TypeScript config for edge functions
```

#### Seed Data

```
├── seed.sql                   → Master seed file that references the other seed scripts
├── seed_basic.sql             → Core reference data — departments, default admin account
├── seed_complete.sql          → Extended seed with sample students, faculty, and courses
├── seed_fake_data.sql         → Intentionally disabled — placeholder for test data generation
├── seed_users.sql             → SQL-based user creation (alternative to the JavaScript approach)
├── seed_users.mjs             → JavaScript seed script that creates auth users via Supabase Admin API
├── config.toml                → Supabase CLI project configuration
```

---

## How the Architecture Fits Together

```
┌─────────────────────────────────────────────────────┐
│                     Frontend                         │
│            React + Vite + Tailwind                   │
│       (src--frontend/ → builds to dist/)             │
└───────────┬───────────────────────┬─────────────────┘
            │                       │
            │  Supabase SDK         │  HTTP requests
            │  (Auth + DB +         │
            │   Realtime)           │
            ▼                       ▼
┌────────────────────┐   ┌────────────────────┐
│     Supabase       │   │    AI Server       │
│   (PostgreSQL +    │   │  (FastAPI/Python)   │
│    Edge Functions   │   │                    │
│    + Auth +        │   │  Face Recognition   │
│    Realtime)       │   │  Liveness Detection │
│                    │   │  Fraud Detection    │
│   ── PRIMARY ──    │   │  Risk Prediction    │
│   ── BACKEND ──    │   │  Behavior Profiling │
└────────────────────┘   └────────────────────┘
                                  │
                          Optional│
                                  ▼
                     ┌────────────────────┐
                     │   Express Server   │
                     │  (server--backend) │
                     │  Prisma + Socket   │
                     │  OPTIONAL / LEGACY │
                     └────────────────────┘
```

**The short version:**
- The **frontend** talks directly to **Supabase** for everything auth and database related.
- For anything that needs ML — face verification, risk prediction, fraud detection — the frontend calls the **AI server**.
- The **Express backend** exists as an alternative API layer. You only need it if you want WebSocket chat or server-side logic that doesn't fit into edge functions.

---

## Docker Deployment

Run the full stack locally with Docker:

```bash
# Frontend + AI server (the typical setup)
docker-compose up

# Include the Express backend too
docker-compose --profile full up
```

Build individual images:

```bash
docker build -t campusai-frontend .                            # Frontend → nginx
docker build -t campusai-ai -f ai-server/Dockerfile ai-server  # AI Server
docker build -t campusai-backend server--backend                # Express (optional)
```

---

## CI/CD Pipeline

Every push to `main` triggers a GitHub Actions workflow that:

1. **Lints** the frontend code with ESLint
2. **Type-checks** with TypeScript compiler
3. **Builds** the Vite production bundle (catches import errors and dead code)
4. **Validates** that the AI server boots and all imports resolve
5. **Builds** Docker images (only on the main branch)

The full pipeline is defined in `.github/workflows/ci.yml`.

---

## Production Deployment

| Service | Where to Deploy | Config File |
|---------|----------------|-------------|
| Frontend | Vercel | `vercel.json` |
| AI Server | Railway | `railway.json` + `Procfile` |
| Database & Auth | Supabase (hosted) | `supabase/config.toml` |
| Everything | Docker Compose | `docker-compose.yml` |

---

## What Makes This Project Different

- **No fake data** — every page fetches from real APIs. Student dashboards pull live attendance, faculty analytics compute from actual records, admin stats are aggregated from the database.
- **Blockchain audit trail** — attendance records are chained using SHA-256. You can verify that no record has been tampered with after the fact.
- **Anti-spoofing** — liveness detection uses eye blink analysis and texture checks. You can't mark attendance with a photograph.
- **Dual-naming compatibility** — the entire stack handles both camelCase and snake_case column names gracefully, because real-world databases are messy.
- **Graceful degradation** — if the AI server is down, the app still works for everything except face-based features. If email isn't configured, notifications still appear in-app.

---

## License

This project was built as an academic capstone at Anurag University. Feel free to learn from it, fork it, or adapt it for your own institution.
