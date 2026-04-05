# AISMS - AI-Powered Student Management System

## Architecture Overview

AISMS is a comprehensive student management system that combines traditional attendance tracking with AI-powered face recognition and predictive analytics.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
│  React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Supabase Platform                           │
│  PostgreSQL │ Auth │ Edge Functions │ Storage │ Realtime        │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
        ┌───────────────────┐   ┌───────────────────┐
        │   AI Server       │   │  Optional Backend │
        │   (FastAPI)       │   │  (Express/Prisma) │
        │   - Face Recog    │   │  - WebSocket Chat │
        │   - Predictions   │   │  - Legacy APIs    │
        └───────────────────┘   └───────────────────┘
```

## Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Animations**: Framer Motion
- **State Management**: React Context + hooks

### Backend (Primary)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Edge Functions**: Deno + TypeScript
- **Storage**: Supabase Storage

### AI Server
- **Framework**: FastAPI (Python)
- **Face Recognition**: InsightFace
- **ML Models**: scikit-learn, PyOD
- **Anomaly Detection**: Isolation Forest

## Core Features

### 1. Authentication System
- Email/Password authentication
- Magic link authentication
- OAuth (Google, GitHub, Azure)
- Role-based access control (RBAC)

### 2. Attendance Management
- **Manual Marking**: Faculty can manually mark attendance
- **AI Face Recognition**: Students mark attendance via face verification
- **Location Verification**: Geolocation validation for campus boundaries
- **Blockchain Audit**: Hash chain integrity verification

### 3. Predictive Analytics
- **Risk Prediction**: ML-based student risk assessment
  - Isolation Forest (unsupervised)
  - Logistic Regression (supervised)
  - Random Forest (ensemble)
  - Gradient Boosting
- **Trend Analysis**: Attendance trend forecasting
  - Prophet
  - ARIMA
  - Moving Average
- **Early Warning Alerts**: Automatic notifications for at-risk students

### 4. Notifications System
- Low attendance alerts
- Class reminders
- Leave status updates
- Exam reminders
- Security alerts

### 5. Security Monitoring
- Brute force detection
- Geo-spoofing detection (impossible travel)
- Account lockout management
- Audit logging

## Database Schema

### Core Tables
- `profiles` - User profiles with roles
- `students` - Student records with face data
- `faculty` - Faculty records
- `departments` - Department information
- `classes` - Class/section management
- `courses` - Course catalog
- `attendance` - Attendance records with blockchain hashes
- `leave_requests` - Student leave management
- `notices` - Announcements and notices
- `notifications` - User notifications
- `assignments` - Course assignments
- `submissions` - Assignment submissions
- `grades` - Student grades

### Summary Tables (Materialized/Views)
- `daily_attendance_summary` - Aggregated daily stats
- `department_attendance_summary` - Department-level stats
- `student_attendance_overview` - Individual student stats

## Edge Functions

All Supabase Edge Functions are deployed in the `supabase/functions/` directory:

| Function | Purpose |
|----------|---------|
| `attendance` | Fetch/mark attendance |
| `analytics` | Advanced reporting |
| `bulk-operations` | Batch imports/exports |
| `notices` | Notice CRUD |
| `verify-face` | Face recognition verification |
| `security-monitor` | Security scanning |
| `notifications` | Smart notification system |
| `timetable` | Timetable management |

## API Design

### Services Layer (`src--frontend/lib/api.ts`)

```typescript
// Service exports
export const authService = { signIn, signUp, signOut, ... }
export const studentService = { getAll, getById, create, ... }
export const attendanceService = { getForStudent, mark, ... }
export const assignmentService = { getForStudent, submit, ... }
export const analyticsService = { getAdminDashboard, ... }
```

### Data Flow
1. UI components call service methods
2. Services validate input and call Supabase
3. Edge Functions handle complex server-side logic
4. Results are cached and returned to UI

## AI Models

### Risk Prediction (`ai-server/models/risk_prediction.py`)

**Features:**
- `attendance_pct` - Current attendance percentage
- `consecutive_absences` - Days absent in a row
- `late_count` - Number of late arrivals
- `monthly_trend` - Slope of recent attendance
- `behavioral_shift` - Deviation from historical average

**Risk Categories:**
- CRITICAL: risk >= 0.75
- HIGH: risk >= 0.50
- MEDIUM: risk >= 0.25
- LOW: risk < 0.25

### Trend Prediction (`ai-server/models/trend_prediction.py`)

**Methods (auto-selected by data size):**
- `>= 10 weeks`: Prophet forecasting
- `>= 8 weeks`: ARIMA model
- `>= 3 weeks`: Moving average
- `< 3 weeks`: Linear regression

## Deployment

### Frontend
- **Platform**: Vercel
- **CI/CD**: GitHub Actions
- **Build**: `npm run build`

### AI Server
- **Platform**: Railway
- **Docker**: Multi-stage build
- **CI/CD**: GitHub Actions

### Supabase
- **Project**: Cloud-hosted
- **Edge Functions**: Supabase Edge Functions
- **Database**: Supabase PostgreSQL

## Environment Variables

### Frontend
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_AI_SERVER_URL=
VITE_BACKEND_URL=
```

### AI Server
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CAMPUS_LAT=
CAMPUS_LNG=
```

## Security Considerations

1. **Row Level Security (RLS)**: All tables have RLS enabled
2. **JWT Verification**: All edge functions verify auth tokens
3. **Role Checks**: Sensitive operations check user roles
4. **Input Validation**: All inputs are validated server-side
5. **SQL Injection Prevention**: Using parameterized queries
6. **XSS Prevention**: React's built-in escaping
7. **CORS**: Proper CORS headers configured

## Future Enhancements

- [ ] Real-time attendance dashboard
- [ ] Parent portal integration
- [ ] Exam scheduling automation
- [ ] Fee management module
- [ ] Library management
- [ ] Transport tracking
- [ ] Hostel management
