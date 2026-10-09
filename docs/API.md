# API Reference

Three HTTP surfaces plus the Supabase data API. This document enumerates what
exists in the repository, what each endpoint requires, and the request/response
shapes.

**Everything below was read from source.** Where I could not confirm something —
for example a role guard that only exists in a comment — it says so.

---

## Contents

1. [Conventions](#1-conventions)
2. [Surface map](#2-surface-map)
3. [Rate limits](#3-rate-limits)
4. [Error formats](#4-error-formats)
5. [Express API — `server--backend`](#5-express-api--server--backend)
6. [FastAPI AI server — `ai-server`](#6-fastapi-ai-server--ai-server)
7. [Supabase Edge Functions](#7-supabase-edge-functions)
8. [Supabase data API and RPCs](#8-supabase-data-api-and-rpcs)
9. [Socket.IO](#9-socketio)
10. [OpenAPI](#10-openapi)

---

## 1. Conventions

### Base URLs

| Service | Local | Production |
| --- | --- | --- |
| Frontend (Vite) | `http://localhost:5173` | Vercel |
| Express backend | `http://localhost:5000` | Railway (`VITE_BACKEND_URL`) |
| AI server | `http://localhost:8000` | Railway (`VITE_AI_SERVER_URL`) |
| Supabase | `https://<ref>.supabase.co` | — |

The frontend reads these from `VITE_BACKEND_URL` and `VITE_AI_SERVER_URL`
(`src--frontend/lib/api.ts`, `src--frontend/lib/ai/apiClient.ts`).

### Authentication

Three different schemes. This matters.

| Surface | Token | How it is validated |
| --- | --- | --- |
| Express | `Authorization: Bearer <access_token>` | HS256 JWT verified with `JWT_SECRET` (`src/utils/jwt.ts`, `alg` pinned), then `profiles` is re-read from the database for the role and `is_active`; blacklist check |
| AI server | `Authorization: Bearer <Supabase access token>` | The token is validated **remotely** by calling `GET {SUPABASE_URL}/auth/v1/user` with `apikey` + `Bearer` (`utils/auth.py`) |
| Edge functions | `Authorization: Bearer <Supabase access token>` | `supabase.auth.getUser(jwt)` inside the function |

**The Express role comes from the database, not the JWT claim.** `authenticate`
(`src/middleware/auth.ts`) looks up `profiles` by `decoded.userId` and uses
`profile.role`. A tampered role claim has no effect.

**The AI server role also comes from the database** — `_role_of()` queries
`profiles.role` through the service key, cached for 60 seconds.

Auth failures on Express return `401` with one of: `Authentication required`,
`Token not provided`, `Token has been revoked`, `Token expired`, `Invalid
token`, `User not found`, `Account is deactivated`.

### Role model

Database enum `user_role` (`supabase/migrations/001_initial_schema.sql`,
`server--backend/prisma/schema.prisma`):

```
SUPER_ADMIN | ADMIN | FACULTY | CLASS_INCHARGE | STUDENT
```

`ai-server/utils/auth.py` defines `STAFF_ROLES = {ADMIN, SUPER_ADMIN, FACULTY,
CLASS_INCHARGE}`.

`server--backend/src/middleware/validation.ts` additionally allows the literal
string `COMPANY` in the create/update-user role validator. **⚠ VERIFY** — the
enum has no `COMPANY` member and no migration adds one, so a `COMPANY` role
would fail at the database even though validation accepts it.

### Ownership rules that appear throughout

- A student may mark their own attendance, never another's.
- Faculty may mark or correct attendance, and approve leave, only for students
  whose `class_id` matches a class with `incharge_id = <their faculty row id>`.
- Admins may do either.
- All of these **fail closed**: no faculty row ⇒ no ownership ⇒ deny.

---

## 2. Surface map

```
Browser
  ├── Supabase PostgREST (direct table reads/writes, anon key + user JWT, RLS)
  ├── Supabase Edge Functions  {SUPABASE_URL}/functions/v1/<name>
  ├── Express  {BACKEND_URL}/api/*        (Bearer = Express JWT)
  ├── AI server {AI_BASE_URL}/api/*       (Bearer = Supabase JWT)
  └── Socket.IO {BACKEND_URL}             (user-scoped rooms)
```

---

## 3. Rate limits

### Express (`src/middleware/rateLimiter.ts`)

In-memory, fixed window, keyed by **`req.ip`** (honours `X-Forwarded-For`
because `app.set('trust proxy', 1)`).

| Limiter | Budget | Window | Applied to |
| --- | --- | --- | --- |
| `authRateLimiter` | 5 | 15 min | `POST /auth/login`, `/auth/verify-mfa`, `/auth/register`, `GET /auth/role` |
| `apiRateLimiter` | 100 | 15 min | **all** `/api/*` routes |
| `uploadRateLimiter` | 10 | 1 hour | `POST /bulk/upload-students`, `/bulk/upload-faculty` |

Response on breach:

```json
{ "success": false,
  "message": "Too many requests, please try again later",
  "retryAfter": 412 }
```

`retryAfter` is seconds until the window resets.

> **⚠ Operational limitation.** The store is a process-local `Map`. Behind
> multiple replicas the effective limit is `limit × replicas`. It is also never
> pruned except on access, so memory grows with distinct IPs. Treat it as
> best-effort, and do not present it as a DDoS control.

### AI server (`utils/ratelimit.py`)

In-process fixed window, keyed by **authenticated user id** when a token is
present, otherwise client IP. Runs *after* auth, per router.

| Router | Budget | Applied to |
| --- | --- | --- |
| `face_rate_limit` | 10 / min | `/api/face/*`, `/api/attendance/*` |
| `analytics_rate_limit` | 60 / min | `/api/analytics/*` |
| `session_rate_limit` | 20 / min | `/api/session/*` |

Breach → `429` with `detail` and a `Retry-After` header:

```json
{ "detail": "Too many requests — please slow down" }
```

`/health` is exempt.

> **⚠** Same process-local caveat. The module docstring itself notes a
> multi-replica deployment needs a shared (Redis) backend.

### Edge functions

**No rate limiting.** `.env.example` defines `RATE_LIMIT_MAX` and
`RATE_LIMIT_WINDOW`, but no function under `supabase/functions/` reads them.

---

## 4. Error formats

### Express — uniform envelope

```json
{ "success": false, "message": "<human readable>" }
```

Validation failures add an `errors` array:

```json
{ "success": false,
  "message": "Validation failed",
  "errors": [ { "field": "role", "message": "role must be one of: ADMIN, SUPER_ADMIN, FACULTY, CLASS_INCHARGE, STUDENT, COMPANY" } ] }
```

`requireRole` also echoes the roles:

```json
{ "success": false,
  "message": "Insufficient permissions",
  "requiredRoles": ["ADMIN","SUPER_ADMIN"],
  "currentRole": "FACULTY" }
```

Unhandled errors → `500 { "success": false, "message": "Internal server error" }`.
Unknown routes → `404 { "success": false, "message": "Endpoint not found" }`.

Successful responses are generally
`{ "success": true, "message"?: string, "data": … }`, though several controllers
return `data` without a `message`.

### FastAPI — `detail`, and a sanitised 500

- `422` (request validation) is remapped by a custom handler to
  `{"detail": "Invalid request", "errors": [{field, message}]}` — the submitted
  payload is not echoed.
- Unhandled exceptions → `500 {"detail": "Internal server error"}` with the
  traceback logged server-side only (`main.py`).
- `HTTPException` → `{"detail": <string>}`.
- Some handlers return `{"success": false, "error": "..."}` with **HTTP 200**
  instead of a 4xx (notably `/api/face/register` for liveness failure, no face
  detected, and no student record). Clients must check the body, not just the
  status code.

### Edge functions

Predominantly `{ success, message, data? }`. The `backup` and `security-monitor`
functions use `{ error: "..." }` instead.

---

## 5. Express API — `server--backend`

Mounted at `/api`. `/api/health` is public and returns
`{"status":"ok","message":"CampusAI Backend is running!","websocket":true}`.

Unless stated, all routes require `authenticate`.

### 5.1 Auth — `/api/auth`

| Method | Path | Auth | Role | Notes |
| --- | --- | --- | --- | --- |
| POST | `/auth/login` | public (`authRateLimiter`) | — | Body `{ email, password }`, min 6-char password |
| POST | `/auth/verify-mfa` | public (`authRateLimiter`) | — | Body `{ userId, otp }` |
| POST | `/auth/register` | public (`authRateLimiter`) | — | `role` must be `STUDENT`, else `403` |
| POST | `/auth/refresh-token` | public | — | Body `{ refreshToken }`; session must exist and not be expired |
| POST | `/auth/logout` | Bearer | self | Blacklists the access token, deletes the session row |
| POST | `/auth/setup-mfa` | Bearer | self | Returns `{ secret, backupCodes }`; writes to `auth.users.raw_user_meta_data` |
| POST | `/auth/forgot-password` | public | — | Always returns the same message |
| POST | `/auth/reset-password` | public | — | Body `{ token, newPassword }`; token TTL 1 h, single use |
| GET | `/auth/me` | Bearer | self | Profile + student/faculty/admin + unread notification count |
| GET | `/auth/role` | Bearer (`authRateLimiter`) | self | Answers only for the caller's own email |

**`POST /auth/login`** — success `200`:

```json
{ "success": true, "message": "Login successful",
  "data": {
    "user": { "id": "<uuid>", "email": "...", "role": "FACULTY",
              "profile": { }, "student": null, "faculty": { } },
    "accessToken": "<jwt>", "refreshToken": "<jwt>" } }
```

If MFA is enabled, returns `200 { success, message: "MFA required",
requireMFA: true, userId }` — **no tokens**.

Also performs: per-IP brute-force detection; account-lock check
(`lockout_until`); password comparison against `auth.users.encrypted_password`;
`login_attempts` reset on success; device-fingerprint registration, which raises
a `device_mismatch` security event on a new device; a `login_history` row; and a
`LOGIN` audit entry. Five consecutive failures set `lockout_until = now + 30
min`.

**`GET /auth/role`** is self-scoped on purpose — the code comment records that
it previously accepted any `?email=` unauthenticated and could be used to
enumerate accounts. A mismatched email now returns the same
`{ data: { exists: false } }` as an unknown one.

### 5.2 Attendance — `/api/attendance`

| Method | Path | Auth | Role | Validation |
| --- | --- | --- | --- | --- |
| POST | `/attendance/face` | Bearer | self / owning faculty / admin | `attendanceStatusValidation`, `attendanceValidation` |
| POST | `/attendance/manual` | Bearer | `FACULTY, CLASS_INCHARGE, ADMIN, SUPER_ADMIN` | status + attendance |
| POST | `/attendance/bulk` | Bearer | same | `bulkCorrectionValidation`-style; list ≤ 1000 |
| GET | `/attendance/student/:studentId` | Bearer | self or staff | query `startDate,endDate,subjectId` |
| GET | `/attendance/class/:classId` | Bearer | any | query `date` |
| GET | `/attendance/analytics/:studentId` | Bearer | any | — |
| POST | `/attendance/register-face` | Bearer | self (students) | `studentId` ≤128, `faceData` required |

`status` is pinned to `PRESENT | ABSENT | LATE | ON_LEAVE | EXCUSED`;
`justification` ≤ 500 chars.

`POST /attendance/manual` body: `{ studentId, status, subjectId?, justification? }`
— upserts on `(student_id, date, subject_id)`, writes
`method: 'MANUAL'`, `verified_by`, a chained `blockchain_hash`, an audit entry,
and a notification to the student.

`POST /attendance/bulk` body:
`{ classId, subjectId?, date, attendanceList: [{ studentId, status, justification? }] }`.
Per-student failures land in `data.errors` rather than failing the batch.

`POST /attendance/face` calls an **external** verification provider
(`FACE_VERIFICATION_ENDPOINT`); if it throws you get
`503 "Face verification service unavailable"`. Below
`FACE_CONFIDENCE_THRESHOLD` (default `0.6`) → `401`. Requires
`student.face_registered && student.face_data`, else `400`.

> **⚠ VERIFY** `POST /attendance/register-face` writes `faceData` straight into
> `students.face_data` with no similarity or liveness check, and any non-student
> role may call it for any `studentId` (the ownership check only applies when
> `req.user.role === 'STUDENT'`). Faculty and admin can therefore register a
> face for another student. That is probably intentional, but it means the
> Express route is not a biometric gate — the AI server's `/api/face/verify` is.

### 5.3 Notices — `/api/notices`

| Method | Path | Auth | Role |
| --- | --- | --- | --- |
| POST | `/notices` | Bearer | `ADMIN, SUPER_ADMIN, FACULTY` |
| GET | `/notices` | Bearer | any; filtered to the caller's role |
| GET | `/notices/:id` | Bearer | any |
| PUT | `/notices/:id` | Bearer | `ADMIN, SUPER_ADMIN` |
| DELETE | `/notices/:id` | Bearer | `ADMIN, SUPER_ADMIN` |
| GET | `/notices/stats` | Bearer | `ADMIN, SUPER_ADMIN` |

Validation: `title` 3–200, `content` ≥ 10, `priority` enum. Body also accepts
`target_roles`, `target_departments`, `target_classes`, `attachments`,
`expiry_date`.

Notification fan-out is **role-only** — every active profile whose role is in
`target_roles` is notified. Department and class targets are stored but not used
for delivery. See `docs/ADMIN_GUIDE.md` §5.

### 5.4 Leave — `/api/leaves`

| Method | Path | Auth | Role |
| --- | --- | --- | --- |
| POST | `/leaves` | Bearer | `STUDENT` |
| GET | `/leaves/my` | Bearer | `STUDENT` |
| PUT | `/leaves/:id/cancel` | Bearer | `STUDENT` (own) |
| GET | `/leaves/pending` | Bearer | `FACULTY, CLASS_INCHARGE, ADMIN, SUPER_ADMIN` |
| PUT | `/leaves/:id/approve` | Bearer | same + class ownership (or admin) |
| GET | `/leaves/stats/:studentId` | Bearer | any |

Validation: `startDate`/`endDate` parseable dates, `reason` 5–500, `type`
required; `endDate >= startDate` else `400`; overlapping request → error.

`leaveDecisionValidation` pins the decision `status` to `APPROVED` or
`REJECTED`; `comments` ≤ 1000. Re-deciding a processed request →
`400 "Leave request already processed"`.

**Approval side effects:** sets `status`, `approved_by` (faculty **row** id),
`approved_at`, `comments`; writes/updates `attendance` rows `ON_LEAVE` for every
day in the range; notifies the student; writes an audit entry.

### 5.5 Analytics — `/api/analytics`

| Method | Path | Auth | Role |
| --- | --- | --- | --- |
| GET | `/analytics/admin-dashboard` | Bearer | `ADMIN, SUPER_ADMIN` |
| GET | `/analytics/faculty-dashboard` | Bearer | `FACULTY, CLASS_INCHARGE` |
| GET | `/analytics/student-dashboard` | Bearer | `STUDENT` |
| GET | `/analytics/predictions/:studentId` | Bearer | any |
| GET | `/analytics/department/:departmentId` | Bearer | `ADMIN, SUPER_ADMIN` |

`student-dashboard` reads the `attendance_weights` system setting to weight labs
versus standard classes, and returns `{ summary, … }` including
`attendancePercentage`, `attendedClasses`/`totalClasses`,
`attendedLabs`/`totalLabs`, `riskLevel`, `status`, and a `calculator` block.

### 5.6 Timetable — `/api/timetable`

| Method | Path | Auth | Role |
| --- | --- | --- | --- |
| POST | `/timetable` | Bearer | `ADMIN, SUPER_ADMIN` |
| GET | `/timetable` | Bearer | any |
| GET | `/timetable/my` | Bearer | `STUDENT` / `FACULTY` |
| PUT | `/timetable/:id` | Bearer | `ADMIN, SUPER_ADMIN` |
| DELETE | `/timetable/:id` | Bearer | `ADMIN, SUPER_ADMIN` |
| POST | `/timetable/bulk` | Bearer | `ADMIN, SUPER_ADMIN` (≤ 200 entries) |

Write validation: `classId`, `subjectId`, `dayOfWeek` (integer 0–6),
`startTime`/`endTime` matching `^([01]\d|2[0-3]):[0-5]\d$`, optional
`roomNumber` ≤ 50.

`checkTimetableConflicts` rejects overlapping entries for the same class,
faculty or room and returns `409`:

```json
{ "success": false, "message": "Timetable conflicts detected",
  "data": { "conflicts": [ ] } }
```

`GET /timetable/my` returns `{ entries, groupedByDay }` — for a student, entries
for their class; for faculty, entries where they are the assigned faculty.

### 5.7 Bulk — `/api/bulk`

| Method | Path | Auth | Role | Content type |
| --- | --- | --- | --- | --- |
| POST | `/bulk/upload-students` | Bearer | `ADMIN, SUPER_ADMIN` | `multipart/form-data`, field `csv` |
| POST | `/bulk/upload-faculty` | Bearer | `ADMIN, SUPER_ADMIN` | same |
| GET | `/bulk/export-students` | Bearer | `ADMIN, SUPER_ADMIN` | — |
| GET | `/bulk/export-attendance` | Bearer | `ADMIN, SUPER_ADMIN, FACULTY` | — |
| POST | `/bulk/attendance-correction` | Bearer | `ADMIN, SUPER_ADMIN` | ≤ 1000 corrections |

Uploads run through `upload.single('csv')` + `verifyUpload`, with
`uploadRateLimiter` (10/hour/IP).

**Student CSV columns** — required: `email`, `first_name`, `last_name`,
`enrollment_id`. Optional: `password`, `phone`, `department_id`, `class_id`,
`batch_year`, `semester`, `guardian_name`, `guardian_phone`, `guardian_email`.
A missing `password` is replaced by `crypto.randomBytes(12).toString('base64url')`
— **the plaintext is not returned**, so those accounts cannot be logged into
without a password reset.

**Faculty CSV columns** — required: `email`, `first_name`, `last_name`,
`employee_id`. Optional: `phone`, `password`, `department_id`, `designation`
(default `Assistant Professor`), `joining_date` (default today),
`specialization`.

Response for both:

```json
{ "success": true, "message": "Processed N records",
  "data": { "success": 42, "failed": 3,
            "errors": [ { "row": 7, "message": "Email a@b.edu already exists" } ] } }
```

Failures are per-row; the upload is not atomic.

> **⚠** The admin UI does not use this endpoint — it parses CSVs in the browser
> and calls the `bulk-operations` **edge function** with a different header
> dialect (`firstname`, `enrollmentid`). Two dialects, two behaviours. See
> `docs/ADMIN_GUIDE.md` §4.4.

Exports accept `?format=csv|excel` (JSON when absent) and set the appropriate
`Content-Disposition`. The students export includes `face_registered` (boolean)
and guardian contacts — **not** any biometric data.

`POST /bulk/attendance-correction` takes
`{ corrections: [{ studentId, date, status, justification? }] }`. It updates rows
keyed on `subject_id: null` only.

### 5.8 Admin — `/api/admin`

| Method | Path | Role |
| --- | --- | --- |
| GET/POST | `/admin/users` | `ADMIN, SUPER_ADMIN` |
| PUT/DELETE | `/admin/users/:id` | `ADMIN, SUPER_ADMIN` |
| GET | `/admin/departments` | any authenticated |
| POST/PUT/DELETE | `/admin/departments[/:id]` | `ADMIN, SUPER_ADMIN` |
| GET | `/admin/courses` | any authenticated |
| POST | `/admin/courses` | `ADMIN, SUPER_ADMIN` |
| GET | `/admin/classes` | any authenticated |
| POST | `/admin/classes` | `ADMIN, SUPER_ADMIN` |
| GET | `/admin/settings` | `ADMIN, SUPER_ADMIN` |
| PUT | `/admin/settings/:key` | `ADMIN, SUPER_ADMIN` |

`GET /admin/users` supports `page`, `limit`, `role`, `search` and returns
`{ users, pagination: { page, limit, total, totalPages } }`.

`POST /admin/users` validation: `email` format, `password` 8–128, `first_name`
and `last_name` 1–100, `role` from a fixed list. `PUT` accepts
`first_name`, `last_name`, `is_active`, `role`.

**`DELETE /admin/users/:id` is a soft delete** — it sets
`profiles.is_active = false`. No data is removed.

`PUT /admin/settings/:key` validates `value` as a string ≤ 5000 chars. **⚠**
`system_settings.value` is a `Json` column, so a caller can only ever store a
JSON *string* through this route, never an object or number. The admin UI
stringifies booleans and numbers to match.

### 5.9 Blockchain — `/api/blockchain`

| Method | Path | Auth | Role |
| --- | --- | --- | --- |
| GET | `/blockchain/status` | Bearer | any |
| GET | `/blockchain/verify/:attendanceId` | Bearer | any |
| GET | `/blockchain/block/:hash` | Bearer | any |
| GET | `/blockchain/audit` | Bearer | `ADMIN, SUPER_ADMIN` |
| GET | `/blockchain/attendance-chain/:studentId` | Bearer | any |

Each attendance write stores `sha256(JSON.stringify({...payload, salt:
BLOCKCHAIN_SALT}))` in `blockchain_hash`, linked to the previous attendance
row's hash in `previous_hash`. `status` returns `VALID` or `TAMPERED`.

> **⚠** Three of these routes are `authenticate`-only with no ownership or role
> check: `/status`, `/blockchain/block/:hash` and
> `/attendance-chain/:studentId` return chain data for **any** authenticated
> user, including a student's full chain by student id. If chain contents are
> sensitive, add ownership checks before deploying this to students.

### 5.10 Chat — `/api/chat`

All routes are Bearer-only; every one verifies conversation participation.

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/chat/messages` | `content` 1–5000, `messageType` in `TEXT\|IMAGE\|FILE\|SYSTEM`, ≤ 10 attachments |
| GET | `/chat/conversations` | Caller's conversations |
| POST | `/chat/conversations/direct` | `{ receiverId }`; reuses an existing direct thread |
| GET | `/chat/messages/:conversationId` | Paginated |
| PUT | `/chat/messages/read/:conversationId` | Resets `unread_count` |
| DELETE | `/chat/messages/:messageId` | Sender only |
| GET | `/chat/class/:classId` | Creates/returns the class thread; only class students + its faculty + admins |

### 5.11 Security — `/api/security`

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| GET | `/security/dashboard` | `ADMIN, SUPER_ADMIN` | Counters for the admin dashboard |
| GET | `/security/events` | `ADMIN, SUPER_ADMIN` | `eventType, severity, userId, resolved, startDate, endDate, page, limit` (default 50) |
| PUT | `/security/events/:id/resolve` | `ADMIN, SUPER_ADMIN` | |
| GET | `/security/devices` | own, or all for admin | `?userId=` ignored for non-admins |
| PUT | `/security/devices/:deviceId/trust` | own | Body `{ trusted, ttlDays }`, `ttlDays` 1–365 |
| DELETE | `/security/devices/:deviceId` | own | |
| GET | `/security/login-history` | own | `?limit=` default 20 |
| GET | `/security/login-history/all` | `ADMIN, SUPER_ADMIN` | `userId, status, startDate, endDate, page, limit` |
| GET | `/security/geo-history` | Bearer | Own geo verifications |
| GET | `/security/sessions` | Bearer | Own active sessions |
| DELETE | `/security/sessions/:sessionId` | Bearer | Own |
| POST | `/security/sessions/revoke-all` | Bearer | Body `{ keepCurrent }` |
| POST | `/security/cleanup-tokens` | `ADMIN, SUPER_ADMIN` | Deletes expired blacklist rows |

### 5.12 Middleware notes

`src/index.ts` mounts, in order: `helmet()`, `extraSecurityHeaders`,
`cookieParser()`, CORS (allow-list from `CORS_ORIGINS`, `credentials: true`),
`express.json({ limit: '10mb' })`, `apiRequestLogger` on `/api`, then
`apiRateLimiter` + the router.

`extraSecurityHeaders` sets `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `X-XSS-Protection: 0`,
`Referrer-Policy: strict-origin-when-cross-origin`, and
`Permissions-Policy: camera=(self), microphone=(), geolocation=(self)`.

`apiRequestLogger` batches into `api_request_log` every 30 s or 50 entries and
flags rows on 401/403, SQL-injection patterns and XSS patterns in the URL.

> **⚠ Defined but not mounted:** `csrfCookieSetter`, `csrfProtection`,
> `ipAllowlist`, `maxPayloadSize`. Do not describe CSRF protection or IP
> allow-listing as active.

---

## 6. FastAPI AI server — `ai-server`

`docs_url`, `redoc_url` and `openapi_url` are all `None`, so `/docs`,
`/redoc` and `/openapi.json` return 404. This was a deliberate decision — the
comment in `main.py` says the schema is a full inventory of every route and
model, so it goes with the docs. See [§10](#10-openapi) for how to regenerate
it.

### Auth model

Every router mounts `Depends(require_user)`; nothing under `/api/*` is
anonymous. `require_user` requires `Authorization: Bearer <token>` and validates
it against Supabase's `GET /auth/v1/user`. Failures:

- no/malformed header → `401 "Missing bearer token"`
- rejected or unreachable → `401 "Invalid or expired token"` /
  `503 "Authentication service unreachable"`

Two extra helpers:

- `require_self_or_staff(user_id, user)` — used **inside** handlers where the
  `user_id` is a body field. Allows the token owner, or a role in
  `STAFF_ROLES`. Otherwise `403 "Not permitted for this user"`.
- `require_staff` — dependency form, `403 "Staff only"`.

### 6.1 `/health` — public

```json
{ "status": "ok", "service": "CampusAI" }
```

### 6.2 `/api/face/*` — `require_user` + 10/min

| Method | Path | Extra auth | Request | Response |
| --- | --- | --- | --- | --- |
| POST | `/register` | `require_self_or_staff(user_id)` | `{ user_id, photos: [{imageData, angle}] (1–10), liveness_frames (≤20), challenge_type? }` | `{ success, student_id, images_processed, errors, liveness_details }` |
| POST | `/verify` | `require_self_or_staff(user_id)` | see below | see below |
| POST | `/identify` | **`require_staff`** | `{ image, class_id?, session_code?, liveness_frames?, latitude?, longitude? }` | `{ identified, student_id?, similarity?, liveness?, geo? }` |
| POST | `/challenge` | — | `{}` | `{ challenge: {type, instruction, timeout_s} \| null, required, challenge_id? }` |
| POST | `/liveness` | — | `{ frames: [base64] (1–20) }` | `{ is_live, liveness_score?, avg_liveness_score?, blink_detected?, head_movement_detected?, … }` |
| POST | `/embedding` | — | query `image` | `{ embedding, face_detected, engine?, inference_ms? }` |
| POST | `/aging-update` | — | `{ stored_embedding, new_embedding, alpha = 0.1 }` | updated embedding |

**`POST /api/face/verify` request**

```json
{
  "user_id": "<auth user id>",
  "image": "<base64 jpeg>",
  "class_id": "<uuid>",
  "session_code": "123456",
  "liveness_frames": ["<base64>", "…"],
  "latitude": 17.335, "longitude": 78.714, "accuracy_m": 12.0,
  "device_fingerprint": "…", "known_devices": ["…"],
  "ip_address": "…", "known_ips": ["…"]
}
```

`session_code` must match `^\d{6}$` when present.

**Response**

```json
{
  "verified": false,
  "requires_manual_review": true,
  "reason": "No confident face match. Try again in better lighting, without obstructions.",
  "match": { "match": false, "similarity": 0.41, "primary_similarity": 0.41,
             "threshold": 0.55, "engine": "insightface_arcface",
             "ensemble": false, "inference_ms": 87 },
  "liveness": { "is_live": true, "avg_liveness_score": 0.72 },
  "geo": { "valid": true, "distance_m": 42.1, "radius_m": 100, "geo_accuracy": 0.86 },
  "confidence": {
    "score": 0.71, "category": "MEDIUM", "auto_approved": false,
    "breakdown": { "face_similarity": 0.41, "liveness_score": 0.72,
                   "geo_accuracy": 0.86, "device_trust": 0.5,
                   "weights": "Non-Linear Sigmoid (v4)" },
    "flags": ["LOW_FACE_SIMILARITY"],
    "requires_reverification": true,
    "admin_alert": false
  }
}
```

`verified` is true only when `match.match` **and**
`confidence.auto_approved`. Categories: `HIGH ≥ 0.85`, `MEDIUM ≥ 0.65`,
`LOW ≥ 0.45`, else `REJECTED`. `auto_approved` also requires **zero** flags.

Possible flags: `LOW_FACE_SIMILARITY` (<0.55), `LIVENESS_CONCERN` (<0.5),
`OUTSIDE_CAMPUS` (geo <0.4), `UNKNOWN_DEVICE` (device trust <0.4),
`IMPOSSIBLE_TRAVEL`, `HIGH_DEVICE_RISK`, `SESSION_CODE_MISMATCH`,
`PROXY_LOCATION_DETECTION`, `SHARED_DEVICE_DETECTED`.

Weights default to face 0.50, liveness 0.20, geo 0.15, device 0.15
(`CONF_WEIGHT_*`), passed through a sigmoid centred at 0.6 with α=8.

**Side effects of a verify:** reads all `face_embeddings` for the student and
keeps the best similarity; on similarity ≥ 0.90 inserts a **new** reference
embedding (adaptive learning); writes `face_verification_logs`, `geo_verifications`
and an AI audit entry.

Error responses: `404 "Student not found"`, `400 "No face registered for this
student"`.

`POST /api/face/register` returns **HTTP 200 with `success: false`** for
liveness failure and for "face not detected", and a `404` JSON body when no
student row exists. Only genuine exceptions become a `500`.

> **⚠ `POST /api/face/embedding` has no ownership check.** Any authenticated
> user can ask the server to return a face embedding for an arbitrary base64
> image. That is a small exfiltration primitive if your threat model includes it.
> Consider restricting it to `require_staff`, or removing it.

### 6.3 `/api/attendance/*` — `require_user` + 10/min

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| POST | `/risk` | `{ student_id, attendance_pct, consecutive_absences, late_count, monthly_trend }` | `{ risk_score, method, category }` |
| POST | `/trend` | `{ weekly_rates[2–520], forecast_weeks 1–26 }` | `{ method, predictions[], trend, slope?, … }` |
| POST | `/fraud` | `{ distance_from_campus, hour_of_day, day_of_week, attendance_pct, face_similarity, liveness_score, device_fingerprint?, known_devices?, ip_address?, student_id? }` | `{ fraud_score, is_fraudulent, flags[], details{}, severity }` |
| POST | `/geo/validate` | `{ latitude, longitude, accuracy_m, prev_latitude?, prev_longitude?, time_delta_s?, is_mock }` | `{ valid, distance_m, radius_m, geo_accuracy, spoofing: { spoofing_suspected, flags[] } }` |
| POST | `/confidence` | `{ face_similarity, liveness_score, geo_accuracy, device_fingerprint?, known_devices?, ip_address?, known_ips? }` | `{ score, category, auto_approved, breakdown, flags, requires_reverification, admin_alert }` |
| GET | `/liveness/challenge` | — | same as `/api/face/challenge` |
| POST | `/liveness/challenge/verify` | `{ challenge_type, frames[1–20] }` | `{ passed, … }` |
| POST | `/train/risk` | `{ records[1–10000] }` | `{ success, records }` |
| POST | `/train/fraud` | `{ records[1–10000] }` | `{ success, records }` |
| POST | `/device-fingerprint` | query `user_agent`, `ip`, `screen_res` | `{ fingerprint }` |

All numeric fields are range-bounded with `allow_inf_nan=False` — deliberate, so
NaN/inf cannot poison the haversine maths.

> **⚠** `/train/*` and `/device-fingerprint` require authentication but **no role
> check**. Any authenticated student can retrain the risk and fraud models on
> data they supply. Restrict these to staff before exposing them.

`/api/attendance/liveness/challenge/verify` supported `challenge_type` values:
`blink`, `head_left`, `head_right`, `head_up`, `smile`. Unknown →
`{ passed: false, error: "Unknown challenge: …" }`.

### 6.4 `/api/analytics/*` — `require_user` + 60/min

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| POST | `/correlation` | `{ attendances[2–5000], grades[2–5000] }` | `{ r, p_value, significant, strength, direction, interpretation, sample_size }` |
| POST | `/correlation/spearman` | same | Spearman equivalent |
| POST | `/predict-grade` | `{ attendance_pct, historical_attendances[2–5000], historical_grades[2–5000] }` | `{ predicted_grade, confidence_interval{}, model{}, input_attendance }` |
| POST | `/batch-correlation` | `{ subjects[1–1000] }` | per-subject correlations |
| POST | `/performance-risk` | `{ attendance_pct, grade, prev_grade?, absence_streak }` | performance risk |
| POST | `/risk/ensemble` | `{ attendance_pct, consecutive_absences, late_count, monthly_trend }` | ensemble score |
| POST | `/risk/explain` | same | SHAP explanation |
| POST | `/risk/train-all` | `{ records[1–10000] }` | training summary |
| POST | `/trend/prophet` | `{ weekly_rates[2–520], forecast_weeks 1–26 }` | Prophet forecast |
| POST | `/trend/moving-average` | same | EMA forecast |
| POST | `/trend/compare` | same | all methods |
| POST | `/trend/intervention` | `{ weekly_rates[2–520] }` | `{ suggestion }` |
| GET | `/fraud/dashboard` | — | fraud overview |
| POST | `/fraud/track-device` | `{ device_fingerprint, student_id }` | `{ tracked: true }` |
| POST | `/fraud/multi-student-device` | same | `{ multi_student, student_count, flag }` |
| POST | `/fraud/attendance-spike` | `{ student_id, window_seconds }` | `{ spike_detected, marks_in_window, window_seconds, flag }` |
| POST | `/profiles/train` | `{ records[1–5000], n_clusters 2–20 }` | clustering summary |
| POST | `/profiles/classify` | `{ attendance_pct, absence_streak_max, late_pct, variance_weekly, student_id? }` | `{ profile, cluster_id, confidence, method }` |
| POST | `/profiles/batch` | `{ records[1–5000] }` | list of profiles |
| GET | `/monitoring/health` | — | `[{ model, total_predictions, accuracy_drift{}, status }]` |
| GET | `/monitoring/health/{model_name}` | — | single-model health |
| POST | `/monitoring/drift` | `{ model_name }` | drift check |
| POST | `/monitoring/data-drift` | `{ model_name, baseline_features[1–1000], current_features[1–1000] }` | PSI |
| POST | `/monitoring/log-prediction` | `{ model_name, input_data, prediction, actual? }` | `{ logged: true }` |
| POST | `/monitoring/log-accuracy` | `{ model_name, accuracy 0–1 }` | `{ logged: true }` |
| GET | `/audit/recent` | `limit` (default 50), `decision_type` | recent AI decisions |
| GET | `/audit/stats` | — | `{ total_decisions, approved, …, approval_rate, fraud_rate }` |
| GET | `/audit/student/{student_id}` | `limit` (default 20) | that student's trail |
| GET | `/audit/compliance-report` | — | `{ report_generated, … }` or `{ error }` |
| POST | `/audit/search` | `start_time?, end_time?, fraud_only?, rejected_only?` | filtered decisions |
| POST | `/train` | `{ min_records (default 50), class_id? }` | trains from historical attendance |

> **⚠ Two important limits on the analytics surface.**
>
> 1. **The audit logger is in-memory.** `models/audit_logger.py` keeps
>    `_recent_logs` and `_stats` in process memory and *also* appends to
>    `${AUDIT_LOG_DIR}/audit_<date>.jsonl` when `AUDIT_LOG_ENABLED=true`.
>    `/audit/recent`, `/audit/stats`, `/audit/search` and
>    `/audit/compliance-report` read the **in-memory** copy. A restart loses it,
>    and multiple replicas see different history. Do not treat the compliance
>    report as a durable record.
> 2. **`/api/analytics/*` requires authentication but no role.** Any student can
>    read `/audit/student/{any_student_id}` and `/audit/compliance-report`.
>    Add `require_staff` before exposing it.

### 6.5 `/api/session/*` — `require_user` + 20/min

**`POST /api/session/start`**

```json
{ "faculty_id": "<uuid>", "class_id": "<uuid>", "course_id": "<uuid>",
  "timetable_entry_id": "<uuid|null>",
  "latitude": 17.335, "longitude": 78.714,
  "radius_meters": 100, "duration_mins": 5 }
```

Bounds: `radius_meters` 10–2000, `duration_mins` 1–180, coordinates ±90/±180.

Authorisation: the caller's `faculty_id` must be their own auth id, or resolve
through `faculty.user_id`, or the caller must be `ADMIN`/`SUPER_ADMIN`. Otherwise
`403 "Only the assigned faculty can start a session"`. Any existing active
session for the same class+course is deactivated first.

Response `200 { "success": true, "session": { id, session_code, latitude,
longitude, radius_meters, expires_at, is_active, … } }`.

**`POST /api/session/check`** — `{ class_id, code? }` →

```json
{ "active": true,  "session": { … } }
{ "active": false, "message": "No active session found or code mismatch" }
```

**`GET /api/session/active/{class_id}`** → `{ active: true, session }` or
`{ active: false }`. No code required.

> **⚠ `POST /api/session/check` and `GET /api/session/active/{class_id}` have
> no class-membership check.** Any authenticated user can confirm whether a
> session exists for any class and read its coordinates. That is by design for
> the student join flow, but it does mean class ids are enumerable. Consider
> restricting the response body to enrolled students.

---

## 7. Supabase Edge Functions

Base: `{SUPABASE_URL}/functions/v1/<name>`. All are CORS-preflighted and all run
with the **service-role** client, so RLS does not protect them — each handler
must authorise the caller itself.

`DEPLOYMENT.md` and `.github/workflows/deploy.yml` deploy with
`supabase functions deploy --no-verify-jwt`, which **disables the platform-level
JWT check**. Handler-level checks are therefore the only control.

| Function | Auth check | Role check |
| --- | --- | --- |
| `attendance` | yes — `getUser(jwt)`; missing header or bad token → `401` | POST/PUT: `ADMIN, SUPER_ADMIN, FACULTY, CLASS_INCHARGE`; plus `staffOwnsStudent()` class-ownership gate |
| `notices` | yes | GET: any; POST: `ADMIN, SUPER_ADMIN, FACULTY`; PUT/DELETE: `ADMIN, SUPER_ADMIN` |
| `timetable` | yes | writes: `ADMIN, SUPER_ADMIN`; also uses a `WRITABLE_COLUMNS` allowlist |
| `analytics` | yes | `ADMIN, SUPER_ADMIN, FACULTY, CLASS_INCHARGE` |
| `bulk-operations` | yes | `ADMIN, SUPER_ADMIN` |
| `backup` | yes | `ADMIN, SUPER_ADMIN` |
| `verify-face` | yes | checks the requester is the target student (or staff) |
| `notifications` | **none found** | none |
| `security-monitor` | **none found** | none |

> **⚠ HIGH — `notifications` and `security-monitor` do not authenticate the
> caller.** Neither reads the `Authorization` header nor calls `getUser`. Both
> instantiate the service-role client immediately. With `--no-verify-jwt`,
> anyone who can reach the function URL can trigger `security-monitor`'s
> `cleanup` (deletes rows) and `scan` (writes `security_events`), or drive
> `notifications`' fan-out (which inserts `notifications` rows for arbitrary
> roles and departments, and can call an outbound email provider). Confirm
> whether these are fronted by anything else; if not, add the same
> `getUser` + role check the other seven functions have, and redeploy.

### `attendance`

| Method | Purpose |
| --- | --- |
| GET | `?studentId&classId&startDate&endDate&subjectId` → `{ attendance, stats: { total, present, absent, late, percentage } }`. Percentage counts `present + late` |
| POST | `{ studentId, status, subjectId?, sessionId?, justification?, timetableEntryId?, method?, confidenceScore?, location?, deviceInfo? }` |
| PUT | `?id=` with `{ status, justification }` — only `status` and `justification` are writable |

`ALLOWED_STATUSES = ['PRESENT','ABSENT','LATE','ON_LEAVE','EXCUSED']`.

### `notices`

GET (`page`, `limit`) filtered by `target_roles cs {role}` or empty;
POST/PUT/DELETE as per the role table. `PUTTABLE_COLUMNS` allow-lists which
columns a PUT may change.

### `timetable`

GET / POST / PUT / DELETE with a `WRITABLE_COLUMNS` allowlist and a 2000-entry
cap, scoped by `getRole`/`getFacultyId`.

### `analytics`

POST with `{ reportType, filters?, format? }`. `reportType` ∈
`attendance_summary`, `department_analytics`, `student_risk_analysis`,
`faculty_workload`, `trend_analysis`, `blockchain_audit`. `format` `json|csv`.
Requires `ADMIN`/`SUPER_ADMIN`/`FACULTY`/`CLASS_INCHARGE`.

### `bulk-operations`

POST `{ operation, data[], options?: { skipDuplicates?, sendNotifications? } }`
where `operation` ∈ `import_students`, `import_faculty`, `bulk_attendance`,
`bulk_grades`, `export_report`. Admin-only. Generates a 12-char
crypto-random password per created account.

### `backup`

POST `{ type? }` → `{ success, filename, … }`. Admin-only. Exports 13 tables
(`profiles, students, faculty, departments, courses, classes, subjects,
attendance, timetable_entries, leave_requests, notices, notifications,
audit_logs`) as JSON into the private `db-backups` bucket.

> **⚠ `students` is in the backup list and `students` contains `face_data`.**
> Database backups therefore contain biometric templates. Store and rotate them
> accordingly — see `docs/DATA_RETENTION.md`.

### `notifications`

POST `{ type, payload, channels? }`. `type` ∈ `low_attendance_alert`,
`class_reminder`, `leave_status`, `exam_reminder`, `system_announcement`,
`security_alert`, `custom`. Channels `in_app` (default), `push`, `email`, `sms`.

### `security-monitor`

POST `{ action }`. `action` ∈ `cleanup`, `scan`, `stats`, `lockout-check`.
`cleanup` deletes expired `token_blacklist` rows, `api_request_log` older than
**30 days**, and `login_history` older than **90 days**. `scan` flags IPs with
≥ 5 failed logins in 15 minutes and logs impossible-travel events.

### `verify-face`

POST `{ studentId, faceEmbedding, location, deviceInfo, subjectId, timetableEntryId }`.
Computes cosine similarity against the stored embedding and marks attendance.
Note this is a **separate implementation** from the AI server's
`/api/face/verify` — it takes a pre-computed embedding from the client rather
than doing recognition itself.

> **⚠ `verify-face` accepts a client-supplied `faceEmbedding`.** The security of
> the match therefore rests on the caller not being able to forge it. Confirm
> the requester check is server-side and that the edge function is not
> reachable without a valid user JWT.

---

## 8. Supabase data API and RPCs

The frontend reads and writes tables **directly** through PostgREST using the
anon key plus the caller's JWT, so **RLS is the only access control** on those
paths. Relevant policies are listed in `docs/DATA_RETENTION.md` and the guides.

Tables the frontend touches directly: `profiles`, `students`, `faculty`,
`departments`, `courses`, `classes`, `subjects`, `timetable_entries`,
`attendance`, `attendance_sessions`, `leave_requests`, `notices`, `notice_reads`,
`notifications`, `organizations`, `user_organizations`, `settings`.

### RPCs

| Function | Returns | Notes |
| --- | --- | --- |
| `get_user_role(uuid)` | `TEXT` | `SECURITY DEFINER` |
| `is_admin(uuid)` | `BOOLEAN` | true for `SUPER_ADMIN`, `ADMIN` |
| `is_faculty(uuid)` | `BOOLEAN` | true for `FACULTY`, `CLASS_INCHARGE` |
| `get_student_id(uuid)` | `UUID` | |
| `get_faculty_id(uuid)` | `UUID` | |
| `calculate_attendance_percentage(student, from, to)` | `NUMERIC` | `PRESENT` / **all** rows |
| `get_admin_dashboard_stats()` | `JSONB` | student/faculty/department/class counts, today's attendance, pending leaves, unresolved alerts, active notices |
| `get_user_organization(uuid)` | `organizations` | |
| `check_org_role(uuid, uuid, text[])` | `BOOLEAN` | |
| `log_backup(...)` | `UUID` | inserts a `backups` row |
| `cleanup_old_backups()` | `INTEGER` | deletes completed backups older than `retention_days` |

Views: `daily_attendance_summary`, `department_attendance_summary`,
`student_attendance_overview`, `backup_summary`.

### ⚠ `SECURITY DEFINER` exposure

`get_user_role`, `is_admin`, `is_faculty`, `get_student_id`, `get_faculty_id`
and the two org helpers are all `SECURITY DEFINER` and are granted to
`authenticated`, `anon` **and** `service_role`
(`ABSOLUTE_FINAL_FIX.sql`). `is_admin(any_uuid)` returns whether an arbitrary
user id is an admin.

That is a low-severity role enumeration oracle — it returns a boolean about an
id the caller supplies. It is not a data leak, but if you want it closed, revoke
execute from `anon` and from `authenticated`:

```sql
REVOKE EXECUTE ON FUNCTION public.get_user_role(UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(UUID)     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_faculty(UUID)   FROM anon, authenticated;
```

⚠ **Do not apply this blind** — RLS policies call `is_admin()` and
`is_faculty()`, so revoking `authenticated` will break every admin policy. Test
in a staging database first.

---

## 9. Socket.IO

`ws(s)://{BACKEND_URL}`, CORS restricted to `CORS_ORIGINS`, credentials enabled.

Client emits `join` with `{ userId, token }`. The server verifies the JWT
(`verifyToken`) and requires `decoded.userId === userId`, otherwise it emits
`{ message: '...' }` on the `error` event. On success it joins room
`user:<userId>`.

The server pushes `notification` (new notification for that user) and
`message_deleted`.

> **⚠** The signature is a JWT the client supplies; the server verifies it with
> `JWT_SECRET`. Because the Express JWT and the Supabase access token are
> different schemes, confirm which token your frontend actually sends to `join`.
> Also note CORS origin checking is not access control on its own.

---

## 10. OpenAPI

The AI server deliberately exposes no schema:

```python
app = FastAPI(
    ...,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
```

So `/docs`, `/redoc` and `/openapi.json` all return `404`, and
`tests/ai/test_live_http.py::test_interactive_docs_are_disabled` asserts it.
This document is therefore hand-written from the decorators and Pydantic models
in `ai-server/routes/*.py` and `ai-server/models/*.py`.

To regenerate a schema for internal use without re-enabling it publicly, run
this **from a development machine with the dependencies installed**:

```bash
cd ai-server
python -c "
import json, main
schema = main.app.openapi()
json.dump(schema, open('openai.local.json','w'), indent=2)
print(len(schema['paths']), 'paths written')
"
```

`app.openapi()` works even with `openapi_url=None` — the URL setting only
controls whether the schema is *served*. If the import fails on missing
optional dependencies (`insightface`, `prophet`, `shap`, `mlflow`, `evidently`,
`pyod`, `statsmodels`), stub them first, the same way `.github/workflows/aiserver.yml`
does:

```bash
python -c "
import sys, types, json
for m in ['insightface','mediapipe','torch','deepface','prophet',
          'shap','evidently','mlflow','pyod','statsmodels']:
    sys.modules.setdefault(m, types.ModuleType(m))
import main
json.dump(main.app.openapi(), open('openai.local.json','w'), indent=2)
"
```

Keep the output out of version control if it is sensitive; it is a complete
inventory of routes and models.

---

## Appendix — quick reference

| Need | Call |
| --- | --- |
| Student marks attendance with a face | `POST {AI}/api/face/verify` (Supabase token) |
| Student checks a session code | `POST {AI}/api/session/check` |
| Faculty starts a session | `POST {AI}/api/session/start` |
| Faculty marks one student | `POST {BE}/api/attendance/manual` (Express JWT) |
| Faculty marks a class | `POST {BE}/api/attendance/bulk` |
| Faculty approves leave | `PUT {BE}/api/leaves/:id/approve` |
| Student applies for leave | `POST {BE}/api/leaves` |
| Admin imports students | `supabase.functions.invoke('bulk-operations', { operation: 'import_students', … })` |
| Admin exports students | `GET {BE}/api/bulk/export-students?format=csv` |
| Admin reads security events | `GET {BE}/api/security/events` |
| Anyone checks attendance integrity | `GET {BE}/api/blockchain/verify/:attendanceId` |
| Model health | `GET {AI}/api/analytics/monitoring/health` |

Where "Express JWT" applies, the token comes from `POST /api/auth/login`.
Elsewhere it is the Supabase access token from the browser session.