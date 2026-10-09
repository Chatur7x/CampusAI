# Onboarding — a new university goes live

A numbered end-to-end checklist. Work top to bottom; each step lists what to
do, how to check it, and what will block you if you skip it.

Assumptions: you are deploying a new Supabase project for one institution, and
you have shell access, a Supabase account with an access token, and Railway and
Vercel accounts.

> **Two things to settle before you start.** First, the role model: the database
> enum `user_role` only has `SUPER_ADMIN, ADMIN, FACULTY, CLASS_INCHARGE,
> STUDENT`, so there is no HR/manager role for the company portal — decide
> whether you need the company portal at all (see `docs/COMPANY_GUIDE.md`).
> Second, biometric consent: there is no consent-capture screen and no column
> that records it. You cannot lawfully enable face recognition for students
> without one. Steps 12–13 below are where you build it.

---

## Phase 1 — Accounts and access (day 1)

### 1. Create the Supabase project
- [ ] Supabase → New project. Choose the region closest to the campus.
- [ ] Record the project ref and the region.
- [ ] **Enable the pgvector extension** (Database → Extensions). Required by
      `supabase/migrations/v4_biometric_optimization.sql`.

**Check:** the extension is listed as enabled.
**If skipped:** the biometric-optimisation migration fails and face search
degrades to a full table scan.

### 2. Gather credentials
- [ ] `VITE_SUPABASE_URL`
- [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (server-side only — never a `VITE_` variable)
- [ ] `SUPABASE_ACCESS_TOKEN` (personal access token, for the CLI)
- [ ] `SUPABASE_PROJECT_REF`

**Check:** `SUPABASE_SERVICE_ROLE_KEY` does not appear in `vercel.json` env, in
any `VITE_*` variable, or anywhere a browser could read it.

### 3. Create the platform accounts
- [ ] Supabase → Account → Access Tokens → new token.
- [ ] Railway account; Vercel account.
- [ ] Add GitHub secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`,
      `RAILWAY_TOKEN`, `RAILWAY_PROJECT_ID`, `SUPABASE_ACCESS_TOKEN`,
      `SUPABASE_PROJECT_REF`.

**Check:** `Settings → Secrets and variables → Actions` shows all seven.

### 4. Link the CLI
```bash
npm install -g supabase
supabase login            # or export SUPABASE_ACCESS_TOKEN=sbp_…
supabase link --project-ref <ref>
supabase status
```
**Check:** `supabase status` reports the linked project ref.

---

## Phase 2 — Schema (day 1–2)

### 5. Create the database
Two viable routes.

**Route A — fresh from Prisma (recommended for a new institution)**
```bash
cd server--backend
# edit .env with DATABASE_URL for the new project
npx prisma migrate deploy      # or: npx prisma db push
npx prisma generate
```
Then apply only the *feature* migrations — `006`, `007`, `008`, `009`, `010`,
`011`, `012`, `013`, `ai_adaptive_schema.sql`, `v4_biometric_optimization.sql` —
skipping `001`–`005`, which assume a snake_case schema that Prisma does not
produce. `004_fix_camelcase_schema.sql` exists solely to repair that mismatch.

**Route B — replay the migrations**
```bash
for f in supabase/migrations/0*.sql supabase/migrations/ai_adaptive_schema.sql \
         supabase/migrations/v4_biometric_optimization.sql; do
  echo "== $f"; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" || break
done
```

**Check:** `SELECT count(*) FROM pg_tables WHERE schemaname='public';` is
non-zero and `students`, `profiles`, `face_embeddings` all exist.

### 6. Enable Row Level Security everywhere
The migrations enable it per table. Verify rather than assume:
```sql
SELECT tablename FROM pg_tables
WHERE schemaname='public' AND rowsecurity = false
ORDER BY tablename;
```
Review the result deliberately. Any table you add yourself must have RLS
enabled — the product's security model is entirely RLS plus middleware.

**Check:** the query returns only tables you consciously exempted.

### 7. Confirm the critical policies
```sql
SELECT policyname, cmd, roles::text FROM pg_policies
WHERE tablename = 'face_embeddings';

SELECT count(*) FROM pg_policies WHERE schemaname='public';
```
Expect exactly two policies on `face_embeddings`: service-role full access and
student self-read (`012_security_hardening.sql`). **Nothing else.**

**Check:** matches. If `face_embeddings` has a `USING (true)` policy, stop —
biometrics are public.

### 8. Lock down the SECURITY DEFINER helpers
`is_admin`, `is_faculty`, `get_user_role`, `get_student_id`, `get_faculty_id`
and the org helpers are `SECURITY DEFINER` granted to `anon` and `authenticated`.
They expose a boolean about a user id you supply — low severity, but worth
closing.

**⚠ Do not apply blind.** RLS policies call `is_admin()` and `is_faculty()`;
revoking `authenticated` will break every admin policy. Test in staging:
```sql
REVOKE EXECUTE ON FUNCTION public.get_user_role(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(UUID)     FROM anon;
```
Then re-run the RLS check in step 7.

**Check:** a student can still read their own profile and attendance, and an
admin can still read all.

### 9. Deploy the edge functions
```bash
./scripts/deploy-edge-functions.sh --all --verify
```
**Check:** all nine functions listed in `supabase/functions/` deploy, and the
probes report `401` for missing and tampered tokens.

> **⚠ Two functions have no caller authentication.** `notifications` and
> `security-monitor` never read the `Authorization` header, and the deploy uses
> `--no-verify-jwt`. Fix this **before** you hand out the URL — see
> `docs/API.md` §7. If you cannot fix it now, do not expose them through a
> public URL.

### 10. Create your first admin
The signup trigger forces `STUDENT` (migration 013) and `/api/auth/register`
rejects any other role — by design. So bootstrap the first admin out of band:

```bash
supabase/seed_users.mjs    # creates demo users — see LOGIN_CREDENTIALS.md
```
or directly in SQL:
```sql
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000',
        gen_random_uuid(), 'authenticated', 'authenticated',
        'admin@<institution-domain>', crypt('<strong-password>', gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}',
        '{"first_name":"Admin","last_name":"User"}');

INSERT INTO profiles (user_id, email, role, first_name, last_name, is_active)
SELECT id, email, 'ADMIN', 'Admin', 'User', true FROM auth.users
WHERE email = 'admin@<institution-domain>';
```
Prefer the email provider's real signup flow for the password; the SQL above is
only for the bootstrap account.

**Check:** `admin@…` logs in at `/login` and lands on `/admin`.

---

## Phase 3 — Configuration (day 2)

### 11. Set the environment for each service

**AI server (Railway `ai-server`)** — from `ai-server/config.py`:

| Variable | Default | Set it to |
| --- | --- | --- |
| `SUPABASE_URL` | *required* | your project URL |
| `SUPABASE_SERVICE_KEY` | *required* | service-role key |
| `SUPABASE_ANON_KEY` | — | anon key (**needed** — `_auth_user()` uses it) |
| `CORS_ORIGINS` | localhost list | your production frontend origin(s), comma-separated |
| `CAMPUS_LAT` / `CAMPUS_LON` | `17.335` / `78.714` | **your campus coordinates** |
| `CAMPUS_RADIUS_M` | `500` | campus radius in metres |
| `FACE_SIMILARITY_THRESHOLD` | `0.55` | tune during the pilot |
| `LIVENESS_CHALLENGE_ENABLED` | `true` | keep `true` |
| `DEEPFAKE_DETECTION_ENABLED` | `true` | keep `true` |
| `CONF_WEIGHT_FACE/LIVENESS/GEO/DEVICE` | `.50/.20/.15/.15` | defaults are sensible |
| `AUDIT_LOG_ENABLED` | `true` | keep `true` |
| `MLFLOW_TRACKING_URI` | `./mlruns` | leave or point at a mounted volume |

> **⚠ The campus defaults are a hard-coded Hyderabad coordinate.** If you do
> not set `CAMPUS_LAT`/`CAMPUS_LON`, every geofence check is computed against
> the wrong place and `OUTSIDE_CAMPUS` fires for all of your students.

**Express backend (Railway `backend`)** — `server--backend/src/config/env.ts`
throws at startup if any of these is missing, so set all of them:
`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SMTP_HOST`, `SMTP_USER`,
`SMTP_PASS`, `FRONTEND_URL`. Optional: `CORS_ORIGINS`, `JWT_EXPIRES_IN`
(default `7d`), `FACE_CONFIDENCE_THRESHOLD` (`0.6`), `BLOCKCHAIN_SALT`,
`BLOCKCHAIN_DIFFICULTY` (`4`), `BCRYPT_ROUNDS` (`12`), `SMTP_PORT` (`587`),
`SMTP_SECURE`, `FROM_EMAIL`.

> **⚠ Set `BLOCKCHAIN_SALT` to a unique random value now.** The default is the
> literal `change-me` and the server only warns. Every attendance hash depends
> on it, so changing it later invalidates the entire chain. Generate once and
> store it like a secret.

**Frontend (Vercel)**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`VITE_AI_SERVER_URL`, `VITE_BACKEND_URL`, `VITE_CAMPUS_LATITUDE`,
`VITE_CAMPUS_LONGITUDE`, `VITE_MAX_ATTENDANCE_DISTANCE`.

**Check:** every service restarts cleanly; `GET /health` and `GET /api/health`
both return `ok`.

### 12. Configure authentication
- [ ] Supabase → Authentication → Providers: enable **Email**.
- [ ] Set the **Site URL** and **redirect URLs** to your production frontend,
      including `/auth/callback` and `/auth/reset-password` (the app defines both
      routes).
- [ ] Decide on MFA. `mfa_required_roles` is seeded in `system_settings` and
      `authController.login` branches on `profile.mfa_enabled`; admins can enable
      MFA per user from `Security → Identity/MFA`.
- [ ] Set session timeout to your policy.

**Check:** a real user can log in, reset their password, and land on the right
dashboard.

### 13. Build the consent and data-protection groundwork ⚠

There is **no consent UI and no consent column** in the repository. Before you
enable face recognition for real students you must add:

- [ ] A consent artefact — a signed or ticked, timestamped, versioned consent
      recorded per student, linked to the purpose and the policy version.
- [ ] A `students.face_registered_at` timestamp and a consent reference.
- [ ] A route for withdrawal, which must actually delete the embeddings.
- [ ] Your published `PRIVACY_POLICY.md` and `TERMS_OF_SERVICE.md` customised
      with your institution's name, contact and lawful basis
      (`docs/PRIVACY_POLICY.md`, `docs/TERMS_OF_SERVICE.md` are drafts for this).
- [ ] A retention schedule agreed with your legal team
      (`docs/DATA_RETENTION.md` is a starting position, not legal advice).
- [ ] Signage at every capture point. For India, check whether your institution
      falls under the DPDP Act 2023 and, where it does, whether consent plus a
      DPIA is required.

**Check:** you can demonstrate, for any enrolled student, who consented, when,
to which policy version, and how to withdraw.

**This is the step most likely to be skipped and the least forgiving if it is.**

---

## Phase 4 — Institution data (day 2–4)

### 14. Departments
- [ ] Create each department (`/admin/departments`). `name` unique, `code` unique
      and ≤ 20 chars.
- [ ] Assign HODs later, once faculty exist.

**Check:** `/admin/courses` and `/admin/classes` show them in their dropdowns.

### 15. Courses
- [ ] Create each course: `name`, unique `code`, `credits` (0–30), `semester`
      (1–12), owning `department_id`.

**Check:** appears in the class form.

### 16. Faculty
- [ ] Create each faculty member (`/admin/faculty`): name, email, **employee ID**
      (unique), designation, department, joining date, specialisation.
- [ ] Or import a CSV with headers
      `firstname, lastname, email, employeeid` plus optional
      `departmentid, designation, joiningdate, specialization`.

**Check:** every faculty record is listed, with a department and an employee ID.

### 17. Classes
- [ ] For each class/section: `name`, `section`, department, course,
      **class in-charge** (required — faculty must exist), room, capacity,
      academic year.
- [ ] Remember: class in-charge ownership is what grants a faculty member the
      right to mark attendance and approve leave. Get this right or nobody can
      teach.

**Check:** the in-charge appears on the class record.

### 18. Students
- [ ] Smallest possible test first: create one student through
      `/admin/register-student`. Confirm a profile **and** a `students` row
      exist.
- [ ] Then import the cohort via `/admin/students` → Import CSV, headers
      `firstname, lastname, email, enrollmentid` plus optional
      `departmentid, classid, batchyear, semester`.
- [ ] Import in batches of a few hundred, checking the count each time.
- [ ] Communicate credentials. Accounts created by import get a random password
      that is **never displayed** — every one of them needs a password reset
      before first use. Budget for that support load.

**Check:** `SELECT count(*) FROM students;` matches your roster; every student
has a department and a class.

### 19. Timetable
- [ ] Build a week by hand in `/admin/timetable` for one class first, to confirm
      conflicts are caught.
- [ ] Then CSV import: `day, course_code, faculty_employee_id, start_time,
      end_time, room`. Match `day` to weekday names and `course` to a course
      code or name.
- [ ] Faculty are notified automatically of bulk-imported periods.

**Check:** `/faculty/timetable` shows each faculty member their own schedule;
no double-booked room or person.

### 20. Seed the settings
- [ ] `/admin/settings`: institution name, contact email, `min_attendance`
      (75), `late_threshold` (15), notification toggles.
- [ ] `attendance_weights` — read by the student dashboard to weight labs versus
      standard classes. Configure it to your policy.

> **⚠ Do not rely on `enforce_2fa`.** No code path reads that setting. It is
> stored, not enforced. Enforce MFA by enabling it on accounts individually, and
> do not tell anyone the switch protects them.

**Check:** the student dashboard reflects your weighting.

### 21. Publish a test notice
- [ ] `/admin/notices` → post a notice targeting `STUDENT`.

**Check:** it appears for students and not for faculty, and a notification
arrives.

> **⚠ Notice delivery fans out by role only.** `target_departments` and
> `target_classes` are stored but not used when sending. If you need
> department-targeted delivery, change `noticeController.createNotice` before
> relying on it.

---

## Phase 5 — Verification (day 4–5)

### 22. Functional pass with five accounts
Create: one admin, two faculty (in **different** classes), one student, and one
non-admin. The second faculty account is required for the cross-class negative
tests.

| # | Test | Expected |
| --- | --- | --- |
| 1 | Admin logs in | lands on `/admin` |
| 2 | Faculty logs in | lands on `/faculty` |
| 3 | Student logs in | lands on `/student` |
| 4 | Student opens `/admin` | sidebar renders; **every** admin write is refused server-side |
| 5 | Faculty A starts a session for their class | 6-digit code |
| 6 | Student B (other class) tries that code | refused |
| 7 | Student marks attendance with a face | `verified: true`, attendance row written |
| 8 | Same student from outside the geofence | not verified; `OUTSIDE_CAMPUS` |
| 9 | Same student holding a photo | liveness fails |
| 10 | Faculty A marks a student in Faculty B's class | `403` |
| 11 | Faculty B approves Faculty A's student's leave | `403` |
| 12 | Student approves their own leave | `403` (route is `STUDENT`-only and approve is faculty) |
| 13 | Admin exports students | CSV; no biometric column beyond the boolean flag |
| 14 | Any user reads `face_embeddings` via the anon key | refused |
| 15 | AI server `/docs`, `/redoc`, `/openapi.json` | `404` |

**Check:** every row behaves as expected. Record failures.

### 23. Automated suites
```bash
npm test                    # backend + integration + ai
npx tsc -b
npx eslint .
cd server--backend && npx tsc --noEmit
cd ../ai-server && python -m py_compile main.py
```
**Check:** all green. Suites that need a live service skip themselves — a skip is
not a pass; run them against the deployed environment too.

### 24. Security posture review
- [ ] `PRIVACY_POLICY.md` and `TERMS_OF_SERVICE.md` published with your details.
- [ ] Retention schedule agreed and **implemented** (`docs/DATA_RETENTION.md`).
- [ ] Data-protection contact published and staffed.
- [ ] Incident response owner named; `docs/RUNBOOK.md` reviewed with them.
- [ ] Sub-processors listed (Supabase, Railway, Vercel, your mail provider, your
      face/OCR vendor if any).
- [ ] Admin accounts: named individuals, MFA on, no shared logins.
- [ ] Confirm `notifications` and `security-monitor` are not publicly reachable.

**Check:** signed off by someone accountable.

### 25. Restore drill
- [ ] Restore a backup into a **scratch** project.
- [ ] Verify row counts and the RLS policy set.
- [ ] Verify a student cannot read another student's attendance.

**Check:** documented, with timings. You need to know how long a restore takes
before you need it.

---

## Phase 6 — Go live (day 5–7)

### 26. Seed production data
- [ ] Final cohort import, in batches, with counts verified after each.
- [ ] Faculty accounts created and passwords reset.
- [ ] Timetable imported and conflict-free.

### 27. Dry run of a real class
- [ ] Run one class end to end with the real roster: session start, 10 students
      marking in, live roster, manual correction.
- [ ] Check the AI server logs for errors.
- [ ] Check `attendance` rows: correct `student_id`, `date`, `status`,
      `method`, `confidence_score`.
- [ ] Check `/api/blockchain/status` is `VALID`.

**Check:** no errors, chain valid.

### 28. Communications
- [ ] Faculty: how to run a session, what the code means, the manual fallback.
- [ ] Students: how to register their face, how to mark attendance, what to do
      when marked absent, and **what happens to their face data** —
      `docs/STUDENT_FAQ.md` is written to be shared.
- [ ] Privacy notice at every capture point.
- [ ] Support channel and expected response times.

### 29. Enable monitoring and alerts
- [ ] Alert if `/health` or `/api/health` fails.
- [ ] Alert if `backup_summary.last_successful_backup` > 26 h old.
- [ ] Daily review of unresolved `security_events`.
- [ ] Schedule the jobs in `docs/RUNBOOK.md` §6.

> **⚠** Nothing that prunes `face_embeddings`, `face_verification_logs`,
> `geo_verifications` or `sessions` is implemented. Your retention schedule is
> not real until you build and schedule it. See `docs/DATA_RETENTION.md`.

### 30. Freeze the baseline
- [ ] Tag the release: `git tag v1.0.0-<institution>` and push the tag.
- [ ] Record the deployed Supabase project ref, Railway service versions, and the
      Vercel deployment URL in your change log.
- [ ] Export and store the current RLS policy set (§2.4 of the runbook) — this is
      your rollback for the security layer.

**Check:** you can name exactly what is running in production.

### 31. Hypercare — first two weeks
- [ ] Daily: health checks, backup freshness, unresolved security events.
- [ ] Twice weekly: review failed verifications with faculty. A spike usually
      means lighting or a device-trust problem, not cheating.
- [ ] Weekly: attendance and leave data spot-check against the registrar's
      records.
- [ ] **Fix or hide the synthetic company screens** before anyone internal sees
      them (`docs/COMPANY_GUIDE.md` §1).
- [ ] Reconcile the outstanding defects these guides flagged: the `FLAGGED`
      status, `ON_LEAVE` + `subject_id` collisions, and the differing attendance
      percentages.

### 32. Post-go-live review (day 30)
- [ ] Did the face-registration completion rate justify the consent process?
- [ ] Which faculties hit false negatives most, and why?
- [ ] Is the geofence radius right for every building, not just the centre?
- [ ] Did the retention jobs actually run?
- [ ] Any data-subject request received, and did the manual procedure hold up?
- [ ] Update these documents with what you learned.

---

## Appendix — go/no-go gate

Do not announce go-live until every box is ticked.

**Infrastructure**
- [ ] All three health endpoints return `ok`
- [ ] `VITE_*` build variables point at production
- [ ] `CAMPUS_LAT`/`LONG`/`RADIUS_M` set to the real campus
- [ ] `BLOCKCHAIN_SALT` set to a unique value

**Data and security**
- [ ] RLS enabled on every table; policy set captured
- [ ] `face_embeddings` has exactly two policies, neither permissive
- [ ] `face_data` not selectable by `authenticated` (or the reason it is
      acceptable is documented)
- [ ] `notifications` and `security-monitor` authenticated or unreachable
- [ ] No default secrets: `JWT_SECRET`, `JWT_REFRESH_SECRET`,
      `SUPABASE_SERVICE_ROLE_KEY`, `BLOCKCHAIN_SALT`
- [ ] Service-role key is not in any `VITE_*` variable or in the bundle

**Legal**
- [ ] `PRIVACY_POLICY.md` published with your institution's details
- [ ] `TERMS_OF_SERVICE.md` published
- [ ] `DATA_RETENTION.md` agreed with legal **and implemented**
- [ ] Biometric consent mechanism built, tested and deployed
- [ ] Withdrawal path works and actually deletes embeddings
- [ ] DPIA completed where required

**Operations**
- [ ] Backups running and a restore drill completed
- [ ] Alerts on health, backups and security events
- [ ] Retention jobs scheduled and observed running
- [ ] Incident response owner named; runbook reviewed
- [ ] Support channel staffed

**People**
- [ ] Every admin, faculty and student account provisioned with working
      credentials
- [ ] Faculty trained on running a session, including the manual fallback
- [ ] Students given the FAQ and the privacy notice