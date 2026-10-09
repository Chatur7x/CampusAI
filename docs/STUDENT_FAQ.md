# Student FAQ

Everything here is answered from what the code actually does. Where the system
cannot do something you might expect, the answer says so rather than implying
otherwise. Lines marked **⚠ VERIFY** are places where the code does not yet
match what a student would reasonably assume.

---

## Signing up and logging in

### How do I get an account?

Ask your institution's admin. There is no open self-registration that produces a
usable student account.

Two independent locks are in place:

- The database trigger `handle_new_user()` (migration
  `013_signup_role_lockdown.sql`) creates **every** signup as `STUDENT` and
  ignores any `role` you put in the sign-up form. It will only enrol you in
  `students` if your sign-up explicitly names a **valid existing**
  `department_id`.
- The API's `/api/auth/register` returns
  `403 "Self-registration is open for students only"` for any role other than
  `STUDENT`.

So signing up on your own creates a profile with no class and no department —
you will log in and see an empty dashboard. Get your account from the admin.

### How do I log in?

Go to `/login` and use the email your institution registered for you. If your
account has MFA enabled you will be asked for a 6-digit code.

Your dashboard is chosen from your role: students land on `/student`, faculty on
`/faculty`, admins on `/admin`.

### I forgot my password

Use "Forgot password" on the login page. It creates a single-use token valid for
**1 hour** and emails you a reset link. Only one outstanding reset exists per
user — requesting a new one invalidates the previous.

The response is deliberately identical whether or not the email exists
(`"If the email exists, a reset link has been sent."`), so nobody can use the
form to discover which addresses are registered.

Resetting your password **deletes all your sessions and blacklists all your
tokens**. You will be signed out everywhere, including on your phone.

### My account is locked

Five failed sign-ins locks the account for **30 minutes**. During the lock the
login page tells you how many minutes remain. Wait it out, or ask an admin to
clear it.

### I am not on the dashboard I expected

The dashboard comes from the `role` column on your profile. Students cannot
change it — the profile update allowlist in `src--frontend/lib/api.ts`
deliberately omits `role`, `email` and `is_active`, so passing them is a no-op.
Ask an admin.

---

## Registering your face

### Do I have to register my face?

Only if your institution requires face marking. Your admin controls this with
the `face_required` setting. Manual attendance is always available to faculty.

### How do I register it?

`Student → Face Registration` (`/student/face-register`). You will:

1. Grant camera permission.
2. Capture **4 photos** — straight ahead, slightly left, slightly right,
   slightly up.
3. Complete a **liveness challenge** over 5 frames (for example blink or turn
   your head).

Tips that make the difference: face the camera, even lighting, no sunglasses or
hat, no hand covering your face. The screen overlays a face mesh — wait for it
to lock on before the shutter fires.

### What is stored, and is it reversible?

The system stores a **numeric vector** derived from your face — a mathematical
description of facial geometry — not a photograph. That vector is stored in
`students.face_data` and, as your usage progresses, in the `face_embeddings`
table.

It is not a photograph and you cannot be recognised from it by eye. But it *is*
biometric data: it is derived from your face, it cannot be changed without
re-registering, and it can be used to verify your identity. Treat it as such.

See the privacy question further down.

### What if my face changes?

Re-register. The verification threshold adapts to how many reference embeddings
exist and how old they are, so gradual change is usually tolerated — but a
major change (beard, injury, glasses permanently) is a good reason to
re-register.

> **⚠ There is no self-service deletion of your face data.** No endpoint in the
> repository removes an embedding. Ask an admin; the manual procedure is in
> `docs/DATA_RETENTION.md`.

---

## Marking your attendance

### How does marking attendance work?

`Student → Live Attendance` (`/student/live-attendance`) runs a five-step flow:

1. **Focus mode** — the page goes fullscreen.
2. **Session code** — type the 6-digit code your faculty member reads out, or
   scan their QR code.
3. **Location** — your device's GPS is read.
4. **Liveness** — 5 frames of your face.
5. **Verification** — the server decides.

You will see a clear PASS or FAIL. Do not close the tab; leaving fullscreen or
switching away is recorded as a focus violation.

### Do I have to be on campus?

You have to be within the geofence around **where your faculty member was
standing when they started the session** — usually 100 metres. That is the
anti-proxy design, not a bug.

A second, softer check compares you against a campus default
(`CAMPUS_LAT` / `CAMPUS_LON` / `CAMPUS_RADIUS_M`, default 500 m) when a session
fence is unavailable.

If GPS is blocked or the fix is poor, the geo component of your confidence
score drops and you can fail despite a perfect face match. Enable location for
the site and stand somewhere with a clear view of the sky.

### The code says "invalid or expired"

The session is time-limited — 5 or 15 minutes depending on which screen your
faculty member used. Ask them to start a new session and read out the fresh
code.

### It says my face matched but I still failed

Read the message. It distinguishes two cases:

- "No confident face match" — lighting, angle, obstruction or an old
  registration. Retry, or re-register.
- "Face matched but the combined signals (liveness, geofence, device) were
  insufficient" — your face was fine; something else was not.

Retry in better light with a clearer GPS fix. If it keeps failing, ask your
faculty member to mark you present manually, and mention it to the admin — a
pattern of failures on one device usually means the device fingerprint is not
being trusted.

### Why does it ask for my device?

The system fingerprints your browser to detect proxy attendance — one phone
marking in for several students. An unrecognised device lowers the confidence
score slightly. It is a heuristic, not a fingerprinting tool used for tracking;
see the privacy question below.

### Does my photo get stored when I mark attendance?

No. The images you submit are processed in memory to produce an embedding and a
similarity score. What is written is:

- an `attendance` row (date, status, method, confidence score, optional
  location and device string);
- a `face_verification_logs` row (student, similarity score, device id,
  timestamp);
- a `geo_verifications` row (coordinates, whether inside the fence, any spoof
  flag);
- and, on a strong match (similarity ≥ 0.90), **a new reference embedding** in
  `face_embeddings`.

That last one is worth knowing: your reference set **grows each time you
successfully verify**. It improves accuracy over time, and it is also more
biometric data about you. See `docs/DATA_RETENTION.md`.

---

## Absent, late, or wrong

### I was there but it says ABSENT

1. Open `Student → My Records` and find the date.
2. Check whether you completed the flow and it failed at the last step.
3. Raise it with the faculty member **the same day**. Manual marking is
   supported, and the faculty member who owns your class is the only one who can
   change it (or an admin).

Ask for a justification to be recorded — the `attendance` row stores
`verified_by` and `justification`, so corrections are attributable. That is
part of the tamper-evidence design.

### I marked LATE but I was on time

Faculty set `LATE` using the `late_threshold` setting. If the threshold is
wrong, it is an admin setting, not something you can change.

### My percentage dropped suddenly

Check whether you have approved leave. An approved leave writes `ON_LEAVE`
attendance rows for each day in the range, which changes your denominator.

> **⚠ A known wrinkle.** Approved leave writes rows with `subject_id: null`.
> If attendance is also marked for that day *with* a subject, you can end up
> with two rows for one day — one `ON_LEAVE` and one `PRESENT`. Different
> screens read different subsets, so the numbers you see may not add up. If your
> total looks wrong, ask your faculty member or the admin to reconcile it, and
> report it — this is a defect, not your mistake.

### Can I change my own attendance?

No. Attendance writes are server-authoritative. The frontend deliberately has
**no** fallback path that writes the attendance table directly with the public
key — if the marking service is down, the attempt fails rather than silently
creating an unverified row. Attempting to mark for another student through the
API returns `403`.

---

## Leave requests

### How do I apply for leave?

`Student → Leave Requests` (`/student/leaves`). Give a type
(`PERSONAL`, `SICK`, `FAMILY_EMERGENCY`, `ACADEMIC`, `OTHER`), a start and end
date, and a reason.

The reason must be 5–500 characters. The end date must not precede the start
date. **You cannot have two overlapping leave requests** — the API returns
`409`-style "Overlapping leave request already exists".

### Who approves it?

The faculty member who is in charge of your class — not a general faculty
member, and not the AI system. If you disagree with who that is, ask your
admin; the ownership rule is `classes.incharge_id`.

### What happens when leave is approved?

The faculty member's approval:

- sets the status and records who approved it and when;
- **writes or updates an `attendance` row with status `ON_LEAVE` for every day
  in the range**;
- sends you a notification.

So approved leave does protect your attendance percentage. It also means the
days are recorded as `ON_LEAVE` rather than simply being absent.

### Can I cancel a request?

Yes, while it is still `PENDING`. Once it has been approved or rejected, the API
returns `400 "Cannot cancel processed leave request"`.

### Nobody has responded

Leave requests are read by your class in-charge. There is no automatic
escalation and no reminder timer. Chase them.

---

## Your privacy

### What does the school collect about me?

- **Identity**: name, email, enrollment ID, department, class, batch year,
  semester, guardian contact, optional date of birth and address.
- **Biometric**: a face embedding vector and a `face_registered` flag.
- **Attendance**: date, status, method, confidence score, location (when
  supplied), device string.
- **Security**: sign-in history with IP, user agent, device hash and result;
  security events; trusted devices; active sessions; geo-verification history.
- **Communications**: notices you received and read, notifications, and any
  messages.

### Is my face data visible to my employer, my teachers, or the company portal?

No. Verified in the code:

- `face_embeddings` has exactly two row-level-security policies
  (`012_security_hardening.sql`): full access for the **service role** only, and
  a **self-read** policy letting a student read their *own* rows. Nothing grants
  an admin, a faculty member or a company user a read.
- The company portal's pages query `profiles`, `departments`, `attendance`,
  `leave_requests`, `attendance_sessions` and `organizations` — never
  `face_embeddings` or `face_verification_logs`.
- Admin CSV export of students includes the boolean `face_registered` flag and
  nothing biometric.

`face_verification_logs` *are* readable by `ADMIN`/`SUPER_ADMIN`
(`ai_adaptive_schema.sql`) — but they contain only a similarity score, a device
id and a timestamp, not an embedding or an image.

> **⚠ VERIFY** — `students.face_data` sits on the `students` table, which *is*
> covered by RLS, but its policies include `students_admin_all`
> (`FOR ALL USING (is_admin(auth.uid()))`). That means an admin querying
> `students` with the anon key could in principle select `face_data`. I did not
> find a frontend page that does this, and the admin student list uses explicit
> column selection — but verify the deployed column privileges before promising
> that no admin can ever read a raw embedding. If you cannot rule it out, revoke
> `SELECT (face_data)` from `authenticated`.

### Can a manager see my location over time?

Not as a live feed. The company portal's "Live Tracking" screen exists, but
reading `LiveTracking.tsx` shows it renders **synthetic data**: it assigns each
employee a status and distance derived from the row index and
`Math.random()`, and it uses the *viewer's own* browser position for every
person. It is not reading anyone's real location. The same is true of the
company Analytics screen — its "productivity score", "growth rate" and weekly
trend are computed from `Math.random()` and hard-coded fallbacks.

So the honest answer is: the company portal does not currently display your real
location history. Do not rely on this as a permanent guarantee, though —
`geo_verifications` rows do exist in the database, and adding a query is a small
change.

### Can the company portal see my attendance?

The company portal queries the shared `attendance` table, which in this schema
is the **student** attendance table. Whether a company user can actually read
it is governed by RLS, and company roles (`HR`, `MANAGER`) are not in the
`user_role` enum that those policies test — see `docs/ADMIN_GUIDE.md` §1.

> **⚠ VERIFY** this end-to-end against a live database with a real company-role
> account before telling a student their attendance is or is not visible to
> their employer. It is an important question and I could not settle it from the
> schema alone.

### Who can see my individual attendance?

- You — via `attendance_self_read` RLS.
- The faculty member in charge of your class — via `attendance_faculty_class`.
- An admin — via `attendance_admin_all`.
- Other students: no.

### Can I get my data or delete my account?

Not through the product. There is no data-export endpoint and no
account-deletion endpoint anywhere in the repository. Admin "delete user" is a
**deactivate**: it sets `profiles.is_active = false` and leaves everything in
place.

To exercise a right of access or erasure, contact your institution's data
protection contact and follow the manual procedure in
`docs/DATA_RETENTION.md`. Your institution's published `PRIVACY_POLICY.md` and
`TERMS_OF_SERVICE.md` describe the commitments and the process.

---

## Account and security problems

### "Authentication service unreachable"

The AI server could not reach Supabase's auth API. It returns `503`. Retry;
if it persists, face marking is down — ask your faculty member to mark you
manually.

### "Too many requests"

The AI server rate-limits face endpoints to **10 requests per minute per
user**. Face registration and verification both count. If you are retrying
rapidly after a failure, wait about a minute.

### "Token has been revoked" / signed out unexpectedly

Your token was blacklisted — that happens on logout, on a password change, or
when an admin revokes sessions. Also: a `CRITICAL` security event
**auto-deactivates the account and deletes all sessions** (see
`docs/ADMIN_GUIDE.md` §7). If you were not expecting it, contact your admin.

### Notifications are not arriving

Notifications are in-app. Check the bell icon. Push and email are configured
separately (`email_notifications`, `push_notifications` in admin settings) and
depend on your institution's mail provider being configured.

### I want to see my attendance history

`Student → My Records` shows the percentage, a trend chart and a per-subject
breakdown. `Student → Calculator` projects how many sessions you need to reach
the target (75% by default).

> **⚠** the per-student percentage shown to you and the percentage your faculty
> member sees are computed differently — yours weights `LATE` at 0.5 and
> weights labs versus standard classes using the `attendance_weights` setting;
> the faculty-side number counts `PRESENT` over all rows. They can disagree.
> This is a defect worth reporting, not something you did wrong.