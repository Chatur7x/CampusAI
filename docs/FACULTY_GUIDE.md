# Faculty Guide — CampusAI Faculty Portal

Audience: teaching staff (`FACULTY`, `CLASS_INCHARGE`) using the `/faculty`
portal.

Every screen, route and API call below was read out of the repository. Claims
the code does not support are marked **⚠ VERIFY**.

---

## 1. Getting in and what you can reach

`dashboardPath()` in `src--frontend/App.tsx` routes `FACULTY` and
`CLASS_INCHARGE` to `/faculty`.

**Everything you can do is scoped to the classes you are in charge of.** The
rule is `classes.incharge_id = <your faculty row id>`:

- `attendanceController.markAttendanceManual` — refuses unless a class with
  that `incharge_id` matches the student's `class_id`.
- `attendanceController.markBulkAttendance` — same, against `classId`.
- `leaveController.approveLeaveRequest` — same, against the leave's student's
  `class_id`.
- `attendanceController.markAttendanceWithFace` — same, when acting for another
  student.

Each of these **fails closed**: if you have no `faculty` row, the ownership
query is skipped and the request is denied.

Note the granularity: the check is *class in-charge*, not *subject*. If you are
in charge of a class, you can mark attendance for every student in it for any
subject row you are given.

`CLASS_INCHARGE` is granted the same code paths as `FACULTY` throughout; the
distinction is organisational, not technical.

> **⚠ VERIFY** — the *read* paths are enforced by Supabase RLS, not by the
> Express middleware. `005_fix_rls_camelcase.sql` installs
> `attendance_faculty_class`, `students_faculty_class`, `leaves_faculty_manage`
> and `profiles_faculty_view_students`, each gated on
> `classes.incharge_id = get_faculty_id(auth.uid())`. Because the frontend
> reads some tables directly with the anon key plus the caller's JWT, confirm in
> a live database that these policies are actually installed and that they have
> not been superseded by a later migration, before you tell a faculty member
> they "cannot see other classes".

---

## 2. Your sidebar

From `src--frontend/dashboards/FacultyDashboard.tsx`:

| Screen | Route |
| --- | --- |
| Dashboard | `/faculty` |
| Live Session | `/faculty/live-attendance` |
| My Classes | `/faculty/classes` |
| My Students | `/faculty/students` |
| Timetable | `/faculty/timetable` |
| Attendance | `/faculty/attendance` |
| Analytics | `/faculty/analytics` |
| Assignments | `/faculty/assignments` |
| Notices | `/faculty/notices` |
| Leave Approvals | `/faculty/leaves` |
| Messages | `/faculty/chat` |
| Register Student | `/faculty/register-student` |
| Reports | `/faculty/reports` |
| Settings | `/faculty/settings` |
| AI Analytics | `/faculty/ai-analytics` |

---

## 3. Running an attendance session (the code flow)

This is the core workflow. Two screens implement it; they differ in defaults.

### 3.1 What a session is

`attendance_sessions` rows carry: the faculty id, class id, course id,
**faculty's own GPS coordinates at start**, a `radius_meters` fence, a
**6-digit `session_code`**, `is_active`, and `expires_at`. The AI server creates
them (`ai-server/routes/session.py` → `utils/db.create_attendance_session`) and
deactivates any existing active session for the same class+course first.

The session code is the anti-proxy anchor: the fence is centred on **where the
faculty member was standing when they started it**, not on a fixed campus
coordinate.

### 3.2 Starting a session

From `AttendanceSession.tsx` (the `/faculty/attendance` screen):

```ts
sessionService.start({
  faculty_id: user.faculty.id,
  class_id:   selectedEntry.class_id,
  course_id:  selectedEntry.course_id,
  timetable_entry_id: selectedEntry.id,
  latitude:   <your browser GPS>,
  longitude:  <your browser GPS>,
  radius_meters: 100,
  duration_mins:  15,
});
```

From `LiveAttendanceFaculty.tsx` (the `/faculty/live-attendance` screen): the
same call with `radius_meters: 100` and `duration_mins: 5`.

So the two screens give you **100 m in both cases** but **15 minutes vs 5
minutes**. The UI on the attendance screen draws a countdown bar computed as
`(codeTimeLeft / 30) * 100` — that assumes a 30-second window while the request
asks for 5–15 minutes. Treat the on-screen timer as cosmetic and use the
`expires_at` returned by the server as the truth.

**If your browser blocks geolocation the session will not start.** The handler
awaits `navigator.geolocation.getCurrentPosition` before calling the API and
surfaces "Failed to start anti-proxy session. Check GPS permissions." Ask IT to
allow location for the site origin before class.

Server-side authorisation on `POST /api/session/start`: the caller's
`faculty_id` must equal their own auth id, or resolve through the `faculty`
table to a row whose `user_id` is the caller, or the caller must be
`ADMIN`/`SUPER_ADMIN`. Anything else is `403 "Only the assigned faculty can
start a session"`.

### 3.3 How a student joins

1. **Focus mode.** The student screen requests fullscreen. Leaving fullscreen,
   or switching away, increments a violation counter; the client invalidates the
   attempt at two violations. This is a browser-side control — a determined
   student can defeat it. Do not treat it as an anti-cheat guarantee.
2. **Session code or QR.** The code is 6 digits, matched against
   `^\d{6}$`. The QR path accepts either the bare code or a URL containing
   `/attend/<code>`.
3. `POST /api/session/check` with `{ class_id, code }` →
   `{ active: false, message: 'No active session found or code mismatch' }` or
   `{ active: true, session }`. `fetch_active_session` filters on
   `is_active = true AND expires_at > now()`.
4. **Location, liveness, face.** See §4.

### 3.4 Marking manually while a session runs

`AttendanceSession.tsx` offers two modes:

- **MANUAL** — per-student Present / Absent / Flagged buttons.
- **SMART** — the record is still written by you, but `method` is recorded as
  `FACE` (or `FINGERPRINT`).

`POST /api/attendance/manual` with `{ studentId, status, subjectId,
justification }` writes an `attendance` row with `method: 'MANUAL'`,
`verified_by: <your user id>`, a fresh hash chained to the previous attendance
hash, and an audit-log entry. The student receives a notification.

Status is pinned by `attendanceStatusValidation` to
`PRESENT | ABSENT | LATE | ON_LEAVE | EXCUSED`. `justification` ≤ 500 chars.

> **⚠ `FLAGGED` is not a status the server accepts.** The faculty screen's
> manual mode offers a `FLAGGED` button and sends `{ status: 'FLAGGED' }`. The
> validation middleware rejects anything outside the five statuses above with
> `400`. So the Flagged button will fail at the server. Use a normal status plus
> a `justification` string, and raise this as a bug.

`POST /api/attendance/bulk` with
`{ classId, subjectId, date, attendanceList: [{ studentId, status, justification }] }`
marks a whole class in one call, chained so each student's hash links to the
previous one. Partial failures are reported per student in
`data.errors` rather than failing the batch.

### 3.5 Live updates

The attendance screen subscribes via `useRealtimeAttendance({ classId, date })`
(`src--frontend/lib/realtime.ts`, Supabase Realtime) and toasts when a new
`PRESENT` row arrives with its `confidence_score`.

> **⚠ VERIFY** — that Realtime channel depends on your Supabase project having
> the `attendance` table added to the `supabase_realtime` publication. Test it
> with two accounts before you rely on it in class; if it is not enabled the
> screen still works, it just will not refresh live and you will need to
> reload.

---

## 4. What the AI actually checks when a student marks attendance

`POST /api/face/verify` (`ai-server/routes/face.py`) runs, in order:

1. **Session and proximity.** If `class_id` is supplied, the session is looked
   up and the code checked. A mismatch sets `session_mismatch`. If the student's
   GPS is more than `radius_meters` from the *faculty member's* recorded
   position, `proxy_location` is set.
2. **Face verification.** All embeddings in `face_embeddings` for that student
   are tried; the best similarity wins. The threshold is adaptive
   (`_adaptive_threshold`) based on how many embeddings exist and how old they
   are.
3. **Adaptive write-back.** On a similarity ≥ 0.90 the probe image's embedding
   is inserted into `face_embeddings`. **The reference set grows with each
   successful match.** This has retention consequences — see
   `docs/DATA_RETENTION.md`.
4. **Liveness.** `analyse_liveness_sequence()` over the supplied frames, or
   `analyse_liveness()` on the single image.
5. **Geo validation + impossible travel.** Logs a `geo_verifications` row.
6. **Shared-device check.** More than one distinct student on the same device
   fingerprint within the window sets `shared_device`.
7. **Confidence.** Four weighted components (default face 0.50, liveness 0.20,
   geo 0.15, device 0.15) passed through a sigmoid centred at 0.6, then
   categorised `HIGH ≥ 0.85`, `MEDIUM ≥ 0.65`, `LOW ≥ 0.45`, else `REJECTED`.
   `auto_approved` requires `MEDIUM`/`HIGH` **and zero flags**.

**The verdict you get back is explicit:** `verified` is true only when the face
matched *and* the confidence auto-approved. Otherwise `reason` explains why —
either "No confident face match…" or "Face matched but the combined signals
(liveness, geofence, device) were insufficient…".

`requires_manual_review` is set when the category is `LOW`, there are ≥ 2 flags,
or the session code did not match. `admin_alert` when the category is
`REJECTED`, there are ≥ 3 flags, or proxy-location / impossible-travel fired.

**What this means for you:** a student can fail verification without anything
being wrong with their face. Weak lighting, a poor GPS fix, campus Wi-Fi
interference and an unfamiliar phone all lower the score. When a student
complains, read `confidence.breakdown` and `confidence.flags` before assuming
cheating.

---

## 5. Your classes and students

`/faculty/classes` loads your timetable, then per class fetches the roster and
today's attendance. Each card shows the class, student count and a live present
/absent count.

`/faculty/students` flattens every class in your timetable into one roster with
a per-student attendance percentage and a risk band computed in the browser:

```
< 60%  → HIGH
< 75%  → MEDIUM
else   → LOW
```

You can message a student directly from the row — that creates a direct
conversation through `POST /api/chat/conversations/direct`.

> **⚠ VERIFY** — `attendanceService.getStatistics` calls the Postgres function
> `calculate_attendance_percentage`, which counts `status = 'PRESENT'` only and
> divides by **all** rows (`004_fix_camelcase_schema.sql`). So `LATE` and
> `EXCUSED` count against a student here, while the student-facing dashboard
> weights `LATE` at 0.5 and weights labs separately via `attendance_weights`.
> The two numbers will not match. Do not use one to argue with the other.

---

## 6. Leave approvals

`/faculty/leaves` → `leaveService.getPending()` → `GET /api/leaves/pending`
(roles `FACULTY`, `CLASS_INCHARGE`, `ADMIN`, `SUPER_ADMIN`).

Approve: `PUT /api/leaves/:id/approve` `{ status: 'APPROVED' }`.
Reject: same endpoint with `{ status: 'REJECTED', comments: '…' }`.

`leaveDecisionValidation` pins `status` to exactly `APPROVED` or `REJECTED` —
any other string is a `400`. `comments` ≤ 1000 chars.

What approval actually does:

1. Sets `status`, `approved_by` (your **faculty row id**, not your user id),
   `approved_at`, `comments`.
2. **Writes or updates an `attendance` row with status `ON_LEAVE` for every
   calendar day in the range**, `method: 'MANUAL'`, `subject_id: null`.
3. Sends the student a notification.
4. Writes an audit-log entry `APPROVED_LEAVE_REQUEST` / `REJECTED_LEAVE_REQUEST`
   with the before and after values.

Guards you can rely on:

- a request that is not `PENDING` returns
  `400 'Leave request already processed'`;
- a faculty member who does not own the student's class gets
  `403 'Not authorized to action this leave request'`.

> **⚠ Approved leave writes attendance rows keyed on `subject_id: null`.**
> Marking attendance for that same day with a `subject_id` creates a *second*
> row, because `attendance` is unique on
> `(student_id, date, subject_id)`. Students can therefore end up with an
> `ON_LEAVE` row and a `PRESENT` row on the same date. If you see that, correct
> it manually and report it — this is a data-model issue, not a user error.

---

## 7. Notices

`/faculty/notices` lets faculty publish notices (`CREATE_ROLES` on the
`notices` edge function is `ADMIN`, `SUPER_ADMIN`, `FACULTY`). The list is
filtered client-side to `role: 'FACULTY'`.

Note that `noticeController.createNotice` notifies every active profile whose
role appears in `target_roles` — it does not narrow by department or class. See
the warning in `docs/ADMIN_GUIDE.md` §5.

---

## 8. Analytics and reports

`/faculty/analytics` — `GET /api/analytics/faculty-dashboard` returns your
class count, today's schedule, total students and per-class attendance.

`/faculty/reports` — attendance and performance summaries for your classes.

`/faculty/ai-analytics` — the AI server panels: risk prediction
(`/api/attendance/risk`, `/api/analytics/risk/ensemble`, `/api/analytics/risk/explain`),
trends (`/api/attendance/trend`, `/api/analytics/trend/compare`) and correlation
(`/api/analytics/correlation`).

Treat model output as a prompt for a conversation, not a decision. Nothing in the
code bars you from acting on a low attendance percentage; nothing requires you
to act on a risk score either.

---

## 9. Timetable

`/faculty/timetable` reads your entries. You are **read-only** here — the write
endpoints (`POST`, `PUT /api/timetable`, `DELETE /api/timetable/:id`,
`POST /api/timetable/bulk`) are admin-only. Ask your admin to change your
schedule.

---

## 10. Face registration — for your awareness

Face registration is a **student** flow (`/student/face-register`). The
faculty sidebar does not include it. Faculty do not register faces, and nothing
in the schema ties an embedding to a faculty record — embeddings reference
`students.id`.

When a student registers, `POST /api/face/register` requires a liveness pass
over the frame sequence before generating the multi-angle embedding, and only
the student themselves or a staff role may call it for a given `user_id`
(`require_self_or_staff`).

---

## 11. When something goes wrong

| Symptom | Cause | Fix |
| --- | --- | --- |
| "Session failed to start" | Geolocation blocked or unavailable | Allow location for the site origin; retry |
| "Invalid or expired session code" | Wrong code, or `expires_at` passed | Start a fresh session |
| Student cannot verify | Score below the auto-approve bar | Read `confidence.flags`; retry in better light, or mark manually |
| Manual Flagged button fails `400` | `FLAGGED` is not an accepted status | Use `ABSENT`/`LATE` with a justification — see §3.5 |
| Leave approve returns `403` | You are not the class in-charge | Route to the correct faculty member or an admin |
| Leave approve returns `400` "already processed" | Already decided | Refresh; the list is stale |
| Attendance shows no live updates | Realtime publication missing | Reload manually; verify publication — see §3.5 |
| "Face verification service unavailable" (`503`) | AI server or its downstream provider is down | Mark manually; escalate to IT |
| Student sees a different percentage than you do | Different weighting — see §5 | Reconcile with the student, do not "fix" the number |

Escalate to an admin: any `403` that looks wrong, any security alert on the
Security dashboard, and any request to export data outside your classes.