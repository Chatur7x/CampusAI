# Admin Guide — CampusAI Admin Portal

Audience: university/college administrators (`SUPER_ADMIN`, `ADMIN`) using the
`/admin` portal.

> **How this document was produced.** Every screen, route and API call named
> below was read out of the repository (`src--frontend/`,
> `server--backend/src/`, `supabase/`, `ai-server/`). Where the code does *not*
> support a claim — because a screen is a placeholder, or a guard is
> client-side only — this guide says so explicitly instead of describing the
> intended behaviour. Those lines are marked **⚠ VERIFY**.

---

## 1. Getting in

| Step | What happens |
| --- | --- |
| 1. Open `/login` and enter your email | The login page inspects the email domain and shows a *guess* at the organisation type (educational → neumorphism theme, otherwise glassmorphism). This is cosmetic only. |
| 2. Submit credentials | Sign-in goes through Supabase Auth (`supabase.auth.signInWithPassword`). |
| 3. MFA step | If `profiles.mfa_enabled` is true the page asks for a 6-digit code. |
| 4. Landing | `dashboardPath()` in `src--frontend/App.tsx` maps `SUPER_ADMIN`/`ADMIN` → `/admin`, `FACULTY`/`CLASS_INCHARGE` → `/faculty`, `COMPANY`/`OWNER`/`HR`/`MANAGER` → `/company`, everything else → `/student`. |

### Roles that exist

The database enum `user_role` (`supabase/migrations/001_initial_schema.sql`,
`server--backend/prisma/schema.prisma`) contains exactly:

`SUPER_ADMIN`, `ADMIN`, `FACULTY`, `CLASS_INCHARGE`, `STUDENT`

Company-side roles (`HR`, `MANAGER`, `EMPLOYEE`, `SALES`, `SECURITY`,
`ANALYST`, `OWNER`) are **not** in that enum. They exist in two other places:

- `user_organizations.role` — a `TEXT` column with its own `CHECK` constraint
  (`OWNER`, `ADMIN`, `HR`, `FACULTY`, `EMPLOYEE`, `STUDENT`) — created by
  `002_multi_organization.sql`;
- the company portal's frontend role checks in
  `src--frontend/dashboards/CompanyDashboard.tsx`.

**⚠ VERIFY** — before you document company roles to customers, confirm which
column your deployment actually populates. `profiles.role` cannot store `HR` or
`MANAGER` without an `ALTER TYPE user_role ADD VALUE`, and no such migration
exists in `supabase/migrations/`. Everything the company portal renders is
gated on `organization.role`, which comes from `user_organizations`.

### Self-registration cannot make you an admin

- `supabase/migrations/013_signup_role_lockdown.sql` rewrote the
  `handle_new_user()` trigger so **every** signup creates a `STUDENT` profile and
  ignores any `role` in client metadata.
- `server--backend/src/controllers/authController.ts` `register` returns `403`
  unless `role === 'STUDENT'`.

Staff accounts are therefore provisioned out of band — by the admin portal, by
CSV import, or by direct SQL with the service key.

### ⚠ VERIFY — client-side route guard is not an authorisation boundary

`ProtectedRoute` in `src--frontend/App.tsx` only checks
`isAuthenticated`. It does **not** check the role. Any signed-in user who
navigates to `/admin/*` will have the admin dashboard mounted. The real
boundaries are server-side:

- `requireRole(...)` middleware (`server--backend/src/middleware/auth.ts`) on
  every `/api/admin/*` route;
- Supabase Row Level Security on the tables the frontend reads directly.

Do not rely on the sidebar hiding a link as a control.

---

## 2. The admin sidebar

From `src--frontend/dashboards/AdminDashboard.tsx`:

| Screen | Route | What it is for |
| --- | --- | --- |
| Dashboard | `/admin` | Institution-wide stat cards, today's attendance, unresolved security alerts |
| Organization | `/admin/organization` | Org profile, branding, per-org feature toggles |
| Members | `/admin/organization/members` | Who belongs to this organisation and with what role |
| Departments | `/admin/departments` | CRUD + HOD assignment |
| Courses | `/admin/courses` | CRUD, credits, semester, owning department |
| Classes | `/admin/classes` | Sections, room, capacity, class in-charge, academic year |
| Students | `/admin/students` | Roster, single add, **CSV import/export**, edit, deactivate |
| Register Student | `/admin/register-student` | Multi-step guided registration |
| Faculty | `/admin/faculty` | Faculty CRUD, **CSV import/export** |
| Timetable | `/admin/timetable` | Timetable builder, drag-and-drop, **CSV import** |
| Live Attendance | `/admin/live-attendance` | Real-time class roster view |
| Security | `/admin/security` | Threat dashboard, incident log, device trust, login history, MFA |
| Blockchain | `/admin/blockchain` | Attendance hash-chain verification |
| Analytics | `/admin/analytics` | Attendance trend + department comparison |
| AI Analytics | `/admin/ai-analytics` | Model-backed risk/trend/fraud panels |
| Messages | `/admin/chat` | Direct and class conversations |
| Notices | `/admin/notices` | Campus announcements |
| Assignments | `/admin/assignments` | Assignment definitions |
| Settings | `/admin/settings` | Institution settings key/value store |

---

## 3. Building the institution — order matters

Foreign keys mean some steps must precede others. A safe order:

1. **Departments** (`name`, unique `code`). Requires `name` ≥ 2 chars.
2. **Courses** (`name`, unique `code`, `credits` 0–30, `semester` 1–12,
   `department_id`).
3. **Faculty** — you need faculty records before classes, because a class
   requires an `incharge_id` (a faculty row id).
4. **Classes** (`name`, `section`, `department_id`, `course_id`,
   `incharge_id`, `room_number`, `capacity` 0–1000, `academic_year`).
   Unique on `(name, section, academic_year)`.
5. **Students** — single add, guided registration, or CSV import.
6. **Timetable** — needs class + subject + faculty.
7. **Notices / settings** — anything else.

### 3.1 Departments

`src--frontend/pages/admin/Departments.tsx` over
`departmentService` → `POST /api/admin/departments` etc.

- Create requires `name` (2–120 chars); `code` ≤ 20 and must be unique.
- Update is restricted to `name`, `description`, `hod_id` by
  `departmentUpdateValidation` — `code` cannot be changed after creation.
- Delete is a hard delete (`prisma.department.delete`). If students or courses
  still reference it, the database will reject it; there is no soft-delete path.

### 3.2 Courses

`src--frontend/pages/admin/Courses.tsx`. Server-side validation
(`courseValidation`) permits `credits` 0–30 and `semester` 1–12 only.

### 3.3 Classes

`src--frontend/pages/admin/Classes.tsx`. Note the schema quirk: `classes` has a
`course_id`, and the UI calls the course picker "Course" — so a "class" is a
section of a course within a department and an academic year, not a course.

### 3.4 Faculty

`src--frontend/pages/admin/Faculty.tsx`.

- Single add: first/last name, email, employee ID, designation (Professor,
  Associate Professor, Assistant Professor, Lecturer, Lab Instructor),
  department, joining date, specialisation.
- `DELETE` is routed through `facultyService.delete`.
- Every create/update/delete on this page also writes an audit entry via
  `auditLogService.log('CREATE'|'UPDATE'|'DELETE'|'BULK_IMPORT', 'faculty', ...)`.

---

## 4. Students

### 4.1 Roster and search

`src--frontend/pages/admin/Students.tsx` uses React Query +
`@tanstack/react-virtual`, so the table virtualises long rosters. Search is
client-side over the fetched page.

### 4.2 Single add

The "Add student" dialog calls the **`bulk-operations` edge function** with
`operation: 'import_students'` and a one-row array
(`{ email, firstName, lastName, enrollmentId, departmentId, classId, batchYear,
semester }`), options `{ sendNotifications: true, skipDuplicates: true }`.

The edge function (`supabase/functions/bulk-operations/index.ts`) authenticates
the caller with `supabase.auth.getUser(jwt)`, then requires
`profiles.role ∈ {SUPER_ADMIN, ADMIN}` before doing anything — returning `401`
for an invalid token and `403` for a non-admin.

### 4.3 Guided registration

`/admin/register-student` (`StudentRegistration.tsx`) is a multi-step wizard that
writes `profiles` and `students` directly with the caller's session. New
students are created with `face_registered: false`.

### 4.4 Bulk CSV import (students)

The **Students page import button** parses the file in the browser and then calls
the `bulk-operations` edge function.

Required headers (lowercase, compared after trimming):

```
firstname, lastname, email, enrollmentid
```

Optional headers, and the fallback applied when absent:

| Header (or alias) | Falls back to |
| --- | --- |
| `departmentid` / `department_id` | the first department in the dropdown |
| `classid` / `class_id` | the first class in the dropdown |
| `batchyear` / `batch_year` | current year |
| `semester` | `1` |
| `lastname` | `"Student"` |

Row filter: rows without both `firstname` and `email` are dropped before the
request. Success toast reports the row count; a full error list is not returned
to the UI.

> ### ⚠ Two different CSV dialects exist
>
> | Path | Header style | Required |
> | --- | --- | --- |
> | Admin UI → `bulk-operations` edge function | `firstname`, `enrollmentid` | `firstname, lastname, email, enrollmentid` |
> | `POST /api/bulk/upload-students` (multipart, Express) | `first_name`, `enrollment_id` | `email, first_name, last_name, enrollment_id` |
>
> The backend endpoint additionally accepts `phone`, `password`, `department_id`,
> `class_id`, `batch_year`, `semester`, `guardian_name`, `guardian_phone`,
> `guardian_email`, and generates a random 12-byte base64url password when
> `password` is absent. It also **soft-deletes nothing** — it fails the row on a
> duplicate email or enrollment id.
>
> Pick one and document it. Users will otherwise export from one and import to
> the other and lose every row.

### 4.5 Export

`handleExportCSV` builds the file client-side from the currently loaded rows.
The backend also offers `GET /api/bulk/export-students?format=csv|excel` and
`?format=` (JSON by default), which exports
`enrollment_id, email, first_name, last_name, phone, department, class,
batch_year, semester, face_registered, guardian_name, guardian_phone`.
Note `face_registered` is a **boolean flag only** — no biometric data is
included in the export.

### 4.6 Faculty CSV import

`/admin/faculty` → Import CSV.

```
firstname, lastname, email, employeeid      # required
departmentid, designation, joiningdate, specialization   # optional
```

`designation` defaults to `Assistant Professor`; `joiningDate` defaults to today;
`departmentId` falls back to the first department in the list.

### 4.7 Timetable CSV import

`/admin/timetable` → CSV import. Column detection is fuzzy — it looks for
headers *containing* `day`, `course`, `faculty`/`employee`, `start`, `end`,
`room`:

```
day, course_code, faculty_employee_id, start_time, end_time, room
```

- `day` is matched against the weekday names, prefix-tolerant.
- `course` is matched against course `code` **or** `name`, case-insensitive.
- `faculty` is matched against `employee_id` or the faculty's first name.
- Missing `start_time`/`end_time` default to `09:00`/`10:00`.
- Rows whose day or course cannot be resolved are counted as *skipped*.
- After import, every affected faculty member gets a notification
  ("Bulk Update — N new periods added to your schedule via CSV import").
- The whole operation is written to the audit log as
  `BULK_IMPORT` / `timetable_entry`.

Conflicts are also checked **server-side**: `POST /api/timetable` and
`POST /api/timetable/bulk` run `checkTimetableConflicts()` and return
`409 { success: false, message: 'Timetable conflicts detected', data: { conflicts } }`
when the class, faculty or room is double-booked. A conflicting CSV row raises
and is counted as skipped.

### 4.8 Timetable builder

Drag-and-drop writes go through `timetableService.update`. The bulk endpoint
caps a request at **200 entries** (`timetableBulkValidation`); the bulk
attendance-correction endpoint caps at **1000 corrections**.

---

## 5. Notices

`/admin/notices`, or `POST /api/notices` (roles: `ADMIN`, `SUPER_ADMIN`,
`FACULTY`).

Validation: `title` 3–200 chars, `content` ≥ 10 chars, `priority` one of
`LOW | MEDIUM | HIGH | URGENT`.

Targeting fields accepted by the controller: `target_roles` (a `user_role[]`),
`target_departments`, `target_classes`, `attachments`, `expiry_date`.

When a notice is created, the backend notifies **every active profile whose role
is in `target_roles`** — it does not consult `target_departments` or
`target_classes` when sending. Those two arrays are stored and used for display
filtering, but the notification fan-out is role-only.

> **⚠ VERIFY** before you rely on department/class targeting for delivery. If
> you need it, the fan-out in `noticeController.createNotice` has to change.

**⚠ VERIFY — notices read path.** Two different read implementations exist:
the Express controller filters by `target_roles` and `expiry_date`, and the
`notices` edge function filters by `target_roles` too. Migration
`012_security_hardening.sql` separately installs an RLS policy
(`notices_audience_read`) that filters on `is_active`, `expiry_date` and
`target_roles`. Confirm which layer is authoritative in your deployment before
promising "notices are only visible to their target audience".

`GET /api/notices/stats` is admin-only and returns delivery counts.

---

## 6. Settings

`/admin/settings` edits the `system_settings` key/value table one key at a time.
`settingsService.set(key, String(value))` is called **sequentially** for every
field — a partial save can leave the store half-updated. Saving writes booleans
as the strings `"true"`/`"false"` and numbers as decimal strings; the page parses
them back on load.

Keys the UI reads:

| Key | Type | Meaning |
| --- | --- | --- |
| `institution_name` | string | Display name |
| `contact_email` | string | Outbound contact |
| `email_notifications` | bool | Email alerts |
| `push_notifications` | bool | Push alerts |
| `attendance_alerts` | bool | Low-attendance alerts |
| `enforce_2fa` | bool | MFA requirement (⚠ see below) |
| `face_required` | bool | Whether face marking is mandatory |
| `session_timeout` | number | Minutes |
| `min_attendance` | number | Threshold percent |
| `late_threshold` | number | Minutes before `LATE` |
| `auto_mark_absent` | bool | Auto-absent at session close |

> **⚠ VERIFY — do not advertise `enforce_2fa` as a control until tested.**
> `mfa_required_roles` is seeded in `system_settings` by migration 001, and
> `authController.login` branches on `profile.mfa_enabled`. I found **no code
> path that reads the `enforce_2fa` setting** to enforce anything. The switch is
> stored, not obeyed. Enabling it will not lock anyone out — and equally, do not
> tell users it protects them.

Separately, `attendance_weights` is read by
`analyticsController.getStudentDashboardStats` to weight labs versus standard
classes when computing a student's percentage. That one is genuinely load-bearing.

Server endpoint: `GET /api/admin/settings`, `PUT /api/admin/settings/:key`
(admin-only; `value` ≤ 5000 chars).

---

## 7. Security centre

`/admin/security` (`SecurityPage.tsx`) has six tabs, all backed by real data
except where noted:

| Tab | Backing call |
| --- | --- |
| Monitor | `GET /api/security/dashboard` (admin-only) |
| Fraud Intel | AI server `/api/analytics/fraud/dashboard` |
| Incident Log | `securityService.getAlerts(false \| true)` over `security_alerts` |
| Device Trust | `GET /api/security/devices` |
| Audit Trail | `GET /api/security/login-history/all` (admin-only) |
| Identity/MFA | `MFASetup` component |

### What the backend auto-responds to

`server--backend/src/utils/securityEvents.ts` reacts without human input:

- **`CRITICAL` + a `user_id`** → sets `profiles.is_active = false`, sets
  `lockout_until = now + 24h`, **deletes every session row for that user**, and
  notifies every active admin.
- **`HIGH` + a `user_id`** → notifies admins.

If a user is deactivated this way, `authenticate` returns
`401 "Account is deactivated"` on every subsequent request until an admin
reactivates the profile.

Recognised event types: `login_anomaly`, `geo_spoof`, `device_mismatch`,
`brute_force`, `api_abuse`, `data_tamper`, `token_reuse`,
`unauthorized_access`, `mfa_bypass_attempt`, `suspicious_export`.

### Resolving an incident

`PUT /api/security/events/:id/resolve` (admin-only) sets `resolved`, `resolved_by`,
`resolved_at`.

### ⚠ Two scanners, and they are not the same thing

- `server--backend` brute-force detection is per-IP (`detectBruteForce`), and
  `securityController` exposes an admin-only
  `POST /api/security/cleanup-tokens` that purges expired blacklist rows.
- The `security-monitor` edge function has a `scan` action (≥5 failed logins
  from one IP in 15 minutes; impossible travel >500 km in 30 minutes) and a
  `cleanup` action (expired blacklist rows, `api_request_log` older than 30 days,
  `login_history` older than 90 days).

> **⚠ VERIFY — `supabase/functions/security-monitor/index.ts` does not
> authenticate its caller.** Unlike `attendance`, `analytics`, `notices`,
> `timetable`, `bulk-operations`, `backup` and `verify-face`, it never reads the
> `Authorization` header and never calls `getUser`. It runs with the service-role
> client. Its `cleanup` action deletes rows and its `scan` action writes
> `security_events`. `DEPLOYMENT.md` also deploys functions with
> `--no-verify-jwt`, which disables the platform-level JWT check.
>
> Until that is fixed and gateway JWT verification is confirmed on, treat this
> function as **unauthenticated** and do not expose it through a public URL.

### ⚠ VERIFY — what actually blocks a request

`server--backend/src/middleware/security.ts` defines `csrfCookieSetter` and
`csrfProtection`, but `src/index.ts` does **not** mount either. Only
`apiRequestLogger` and `extraSecurityHeaders` are mounted. So the CSRF
double-submit token is currently inert. The API is Bearer-token based (not
cookie-session based), which is why this has not caused problems — but do not
describe CSRF protection as active.

`ipAllowlist()` and `maxPayloadSize()` are likewise defined but unmounted.
`express.json({ limit: '10mb' })` is the only body-size control in effect.

Active headers: `helmet()` defaults plus `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy: camera=(self), microphone=(), geolocation=(self)`.

---

## 8. Analytics

`/admin/analytics` reads:

- `analyticsService.getAdminDashboard()` → RPC `get_admin_dashboard_stats()`
  (defined in `004_fix_camelcase_schema.sql`, returns
  `totalStudents, totalFaculty, totalDepartments, totalClasses,
  todayAttendance, pendingLeaves, recentAlerts, activeNotices`). The client
  falls back to counting rows directly if the RPC fails.
- `analyticsService.getDailyAttendanceSummary()` → the
  `daily_attendance_summary` view.
- `analyticsService.getDepartmentSummary()` → the
  `department_attendance_summary` view.

`/admin/ai-analytics` talks to the AI server: risk prediction, trend
forecasting, fraud dashboard, model health and drift. See `docs/API.md`.

Departments with fewer than three attendance rows will show `NULL` averages —
the views use plain `AVG()` over a `LEFT JOIN`, not `COALESCE`.

---

## 9. Blockchain integrity

`/admin/blockchain` verifies the attendance hash chain. Every attendance write
computes

```
sha256(JSON.stringify({ ...payload, salt: BLOCKCHAIN_SALT }))
```

and links it to the previous row's `blockchain_hash`
(`attendanceController.generateAttendanceHash`). `GET /api/blockchain/status`
reports `VALID` or `TAMPERED`; `GET /api/blockchain/audit` is admin-only and
lists orphaned/tampered blocks.

> **⚠ Operational consequence:** changing `BLOCKCHAIN_SALT` invalidates every
> stored hash and will make the whole chain report `TAMPERED`. Treat the salt as
> a long-lived secret — see `docs/RUNBOOK.md`.

---

## 10. Bulk import — practical checklist

1. Export your existing roster first so you have a rollback copy.
2. Build the CSV with the exact header casing the target path expects (see the
   table in §4.4).
3. Start with 5 rows. Confirm the toast count matches and the rows appear in
   `/admin/students`.
4. Then run the full file.
5. Check `Security → Audit Trail` for a `BULK_IMPORT` entry.
6. Check `Messages`/notifications — `sendNotifications: true` on the student
   import path notifies every imported user.

Import limits: the upload endpoints are rate-limited to
**10 uploads per hour per IP** (`uploadRateLimiter`), on top of the general
100 requests / 15 minutes.

---

## 11. Daily and weekly admin routine

**Daily**
- `Security → Monitor` — critical threats, open issues, failed logins, secured
  sessions.
- `Dashboard` — today's attendance %, pending leaves, unresolved alerts.
- Approve or reject leave requests. Approving writes `ON_LEAVE` attendance rows
  for every day in the range, so a wrong approval writes real attendance data.

**Weekly**
- `Analytics` — attendance trend and department comparison.
- `Blockchain` — chain still `VALID`.
- Reconcile the student roster against the registrar's list; deactivate
  leavers (`DELETE /api/admin/users/:id` is a **soft** delete — it sets
  `profiles.is_active = false`, it does not remove the account or its data).

**Start of term**
- `Settings` — `min_attendance`, `late_threshold`, `attendance_weights`.
- Verify geofence radius: the AI server uses `CAMPUS_LAT`, `CAMPUS_LON`,
  `CAMPUS_RADIUS_M` (default 500 m) when a session has no fence of its own.
- Confirm backups ran (see `docs/RUNBOOK.md`).

---

## 12. Things an admin cannot currently do

Say these out loud to anyone who asks; they are not oversights you can work
around in the UI.

- **No self-service data export or account deletion for a data subject.** There
  is no GDPR/DPDP "download my data" or "delete my account" endpoint anywhere in
  the repository. Admin delete is a deactivate. See `docs/DATA_RETENTION.md` for
  the manual procedure.
- **No consent-capture screen.** There is no UI that records a student's
  explicit biometric consent, and no column that stores it. Before enabling face
  recognition for a real student body you need one — see
  `docs/PRIVACY_POLICY.md` §4.
- **No automatic purge of face embeddings.** Retention is currently manual.
- **No rate limiting inside the edge functions.** `RATE_LIMIT_MAX` and
  `RATE_LIMIT_WINDOW` exist in `.env.example` but are not read by any function.