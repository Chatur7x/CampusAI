# πŸš€ CampusAI - Supabase Setup Guide

## Overview

CampusAI uses **Supabase** as the backend platform, providing:
- **PostgreSQL Database** - Enterprise-grade relational database
- **Row Level Security (RLS)** - Fine-grained access control
- **Real-time Subscriptions** - Live data updates via WebSocket
- **Edge Functions** - Serverless functions for complex logic
- **Storage** - File uploads for documents and avatars
- **Authentication** - Built-in auth with multiple providers

---

## πŸ"‹ Prerequisites

- Node.js 18+ and npm/pnpm
- Supabase account (free tier available)
- Docker (for local development)

---

## ⚑ Quick Start

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **API Keys** from Settings > API

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env.local

# Edit with your Supabase credentials
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Run Database Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase  
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push

# (Optional) Seed with sample data
psql -h db.your-project.supabase.co -U postgres -d postgres -f supabase/seed.sql
```

### 4. Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy verify-face
supabase functions deploy bulk-operations
supabase functions deploy analytics
supabase functions deploy notifications
```

### 5. Start Development Server

```bash
# Install frontend dependencies
npm install

# Start development server
npm run dev
```

---

## πŸ" GitHub OAuth Setup

Since your GitHub account (**Chatur7x**) is linked to Supabase, you can enable GitHub OAuth for user authentication:

### 1. Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in the details:
   - **Application name**: CampusAI
   - **Homepage URL**: `http://localhost:5173` (or your production URL)
   - **Authorization callback URL**: `https://your-project.supabase.co/auth/v1/callback`
4. Click **"Register application"**
5. Note your **Client ID** and generate a **Client Secret**

### 2. Configure in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Authentication β†' Providers**
3. Enable **GitHub** provider
4. Enter your **Client ID** and **Client Secret**
5. Save changes

### 3. Use GitHub Sign-In

```typescript
import { supabase } from '@/lib/supabase';

// Sign in with GitHub
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'github',
  options: {
    redirectTo: window.location.origin + '/dashboard'
  }
});
```

### Additional OAuth Providers

You can also enable:
- **Google** - Great for edu domains (.edu emails)
- **Azure AD** - For Microsoft organization accounts
- **SAML** - Enterprise SSO integration

---

## πŸ—„οΈ Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `profiles` | User profiles linked to Supabase Auth |
| `departments` | Academic departments |
| `faculty` | Faculty members with specializations |
| `students` | Student records with enrollment info |
| `classes` | Class sections with semester info |
| `courses` | Course catalog with credits |
| `attendance` | Attendance records with blockchain hash |
| `leaves` | Leave requests and approvals |
| `notices` | Announcements and bulletins |
| `notifications` | User notifications |
| `timetable_entries` | Class schedules |
| `audit_logs` | Activity audit trail |
| `security_alerts` | Security event logging |

### Views

- `daily_attendance_summary` - Daily attendance aggregates
- `department_attendance_summary` - Department-wise statistics
- `student_attendance_overview` - Per-student attendance metrics

### Database Functions

- `calculate_attendance_percentage()` - Calculate student attendance
- `get_admin_dashboard_stats()` - Admin dashboard metrics
- `get_attendance_by_day_of_week()` - Day-wise trends

---

## πŸ" Security (Row Level Security)

All tables have RLS policies enforcing:

- **Students** can only view/modify their own data
- **Faculty** can manage their assigned classes
- **Admins** have full CRUD access
- **Class Incharges** can approve leaves for their class

Example policy:
```sql
-- Students can view their own attendance
CREATE POLICY "Students view own attendance" ON attendance
  FOR SELECT USING (
    auth.uid() = student_id OR
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN', 'FACULTY'))
  );
```

---

## ⚑ Edge Functions

### verify-face
AI-powered face recognition for attendance verification.

```typescript
// Request
POST /functions/v1/verify-face
{
  "studentId": "uuid",
  "faceEmbedding": [0.1, 0.2, ...],
  "courseId": "uuid",
  "location": { "latitude": 12.97, "longitude": 77.59 }
}
```

### bulk-operations
Admin bulk import/operations.

```typescript
// Request
POST /functions/v1/bulk-operations
{
  "operation": "import_students",
  "data": [{...}, {...}],
  "options": { "sendWelcomeEmail": true }
}
```

### analytics
Generate reports and insights.

```typescript
// Request
POST /functions/v1/analytics
{
  "reportType": "attendance_summary",
  "filters": { "startDate": "2024-01-01", "endDate": "2024-01-31" },
  "format": "json"
}
```

### notifications
Smart notification dispatch.

```typescript
// Request
POST /functions/v1/notifications
{
  "type": "low_attendance_alert",
  "payload": { "threshold": 75 },
  "channels": ["in_app", "email"]
}
```

---

## πŸ"„ Real-time Subscriptions

The app uses Supabase Realtime for live updates:

```typescript
import { useRealtimeNotifications } from '@/lib/realtime';

function NotificationBell() {
  const { notifications, unreadCount } = useRealtimeNotifications(userId);
  // Notifications update automatically when new ones arrive
}
```

Available hooks:
- `useRealtimeNotifications()` - Live notification feed
- `useRealtimeAttendance()` - Live attendance updates
- `useRealtimeNotices()` - Notice board updates
- `useRealtimeSecurityAlerts()` - Security monitoring
- `usePresence()` - Online user presence

---

## πŸ§ͺ Local Development

### Using Supabase Local

```bash
# Start local Supabase
supabase start

# Access local dashboard
open http://localhost:54323

# Run with local database
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<local-anon-key>
```

### Demo Mode

For development without Supabase:

```bash
# Enable demo mode in .env.local
VITE_DEMO_MODE=true
```

This uses mock data and simulated auth.

---

## πŸ"Š Monitoring

### Supabase Dashboard
- Database queries and performance
- Auth user management
- Storage usage
- Edge function logs

### Application Metrics
- Attendance trends via Analytics dashboard
- Security alerts monitoring
- Audit log review

---

## πŸš€ Deployment

### Vercel/Netlify

```bash
# Build for production
npm run build

# Deploy (Vercel)
vercel deploy --prod

# Deploy (Netlify)
netlify deploy --prod
```

### Environment Variables for Production

Set these in your deployment platform:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_ENV=production`

---

## πŸ"' Backup & Recovery

### Database Backups
Supabase Pro/Enterprise plans include automatic backups.

For manual backups:
```bash
pg_dump -h db.your-project.supabase.co -U postgres -d postgres > backup.sql
```

### Point-in-Time Recovery
Available on Pro plan - restore to any point in the last 7 days.

---

## πŸ†˜ Troubleshooting

### Common Issues

**1. "Invalid JWT" errors**
- Check that `VITE_SUPABASE_ANON_KEY` is correct
- Ensure the user session hasn't expired

**2. RLS policy blocking access**
- Check user role in `profiles` table
- Review policy conditions in Supabase dashboard

**3. Edge function timeouts**
- Check function logs: `supabase functions logs verify-face`
- Increase timeout in function config

**4. Real-time not updating**
- Verify WebSocket connection in browser console
- Check that RLS allows SELECT on the table

---

## πŸ"š Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
