# Company / HR Portal Guide

Audience: `OWNER`, `ADMIN`, `HR`, `MANAGER` and related company-side roles
using the `/company` portal.

> **Read the ⚠ markers.** This portal is the least mature part of the product.
> Several screens render **synthetic placeholder data** rather than real records.
> This guide tells you exactly which screens those are, because an HR team
> acting on invented numbers is worse than having no dashboard at all.

> **Update — 2026-11-13.** Three of the screens flagged below were fixed in
> code on 2026-11-12/13: `Attendance.tsx`, `Analytics.tsx` and
> `LiveTracking.tsx` no longer fabricate data (`Math.random()` is gone). They
> now read real data through the `company_attendance_summary` view added by
> migration `016_company_role.sql` — **which has NOT been applied to the live
> (currently PAUSED) project**, so until it is applied these screens error or
> return zero rows rather than invent numbers.
>
> - **Attendance** (`/company/attendance`) queries `company_attendance_summary`
>   (date, status, method, first/last name, enrollment_id, department, class —
>   no biometrics, no emails, no locations).
> - **Analytics** (`/company/analytics`) aggregates the same view instead of
>   generating random productivity figures.
> - **LiveTracking** (`/company/tracking`) is **unavailable by design** — it
>   shows an honest "not available" state. There is no location data for
>   company staff and the screen no longer pretends otherwise.
> - The Security / Settings / Onboarding caveats in §1 **still apply** — they
>   were not rewritten.
> - Migration `016` also adds `COMPANY` to the `user_role` enum and re-creates
>   `handle_new_user()` with STUDENT-only signup semantics (a COMPANY account
>   cannot be created by signing up; signup metadata never grants any role).
> - **Signup trust:** client-supplied role metadata is NOT trusted at signup —
>   after 016, `role: 'COMPANY'` (or any staff role) in signup metadata creates
>   an ordinary STUDENT profile. Company accounts must be provisioned
>   **out-of-band** by an administrator (service-role SQL, e.g.
>   `UPDATE profiles SET role = 'COMPANY' ...` — see the header of
>   `016_company_role.sql` for the exact snippets), never via public self-signup.
>
> The detailed sections below describe both the old behaviour (kept for
> history) and the current one; where they disagree, this update wins.

---

## 1. Read this first: what is real and what is not

| Screen | Route | Data source | Real? |
| --- | --- | --- | --- |
| Overview | `/company` | `profiles`, `attendance`, `leave_requests`, `departments` (count queries) | **Yes** |
| Employees | `/company/employees` | `profiles` | **Yes** |
| Departments | `/company/departments` | `departments` | **Yes** |
| Teams | `/company/teams` | `departments` | **Yes** (team names are derived from departments) |
| Leave Requests | `/company/leave` | `leave_requests` — reads and approve/reject | **Yes** |
| Attendance | `/company/attendance` | `company_attendance_summary` view (migration 016, **not applied live**); previously `attendance` | **Real, UNVERIFIED until 016 is applied** |
| Analytics | `/company/analytics` | `company_attendance_summary` aggregates (2026-11-13 rewrite); previously `profiles` + **`Math.random()`** | **Real, UNVERIFIED until 016 is applied** |
| Reports | `/company/reports` | `departments` + `profiles` | **Partly synthetic** |
| Live Tracking | `/company/tracking` | none — **unavailable by design** (2026-11-13); previously `profiles` + **`Math.random()`** | **Not available** |
| Onboarding | `/company/onboarding` | `profiles` + `departments`, then derived steps | **Partly synthetic** |
| Security | `/company/security` | `profiles`; event list is **hard-coded** | **Synthetic** |
| Settings | `/company/settings` | `profiles` + `departments`; **saving is a no-op** | **No-op** |

### The synthetic screens, specifically

> **2026-11-13:** Analytics and Live Tracking were rewritten (see the update
> block at the top). The descriptions below document the pre-fix behaviour and
> the screens that still ship synthetic data (Security, Settings, Onboarding).
>
> **Analytics** (`src--frontend/pages/company/Analytics.tsx`). It counts profiles
> and departments, then fills the rest *(historical description; replaced
> 2026-11-13 by aggregation over `company_attendance_summary`)*:

- "Active Today" = `floor(totalEmployees * 0.9)`
- "Avg Work Hours" = the literal string `'8.4'`
- "Productivity Score" = `min(95, 75 + floor(totalEmployees / 50))`
- per-department employee counts and productivity = `Math.floor(Math.random() * 30) + 10`
  and `75 + Math.floor(Math.random() * 25)`
- the weekly trend is derived arithmetically from the active-today number
- "Growth Rate" (`23%`), "Avg Rating" (`4.6`) and "Projects Done" (`156`) are
  literals
- if the fetch throws, a **hard-coded** block is displayed instead (247
  employees, 231 active, 87% productivity, …)

**Live Tracking** (`LiveTracking.tsx`). Fetches the first 20 active profiles, *(historical; screen is now hard-unavailable — it shows "unavailable by design" and renders no tiles)*:
then assigns each one:

```ts
status:   index % 3 === 0 ? 'online' : index % 3 === 1 ? 'on-site' : 'off-site',
distance: Math.floor(Math.random() * 500),
department: ['Engineering','Sales','Marketing','IT'][index % 4],
location: geo.currentLocation,   // the VIEWER's own browser position
```

Every "employee" tile shows **the viewer's own location**. No employee's real
location is read.

**Security** (`Security.tsx`). The five security events are string literals
with fixed timestamps and IP addresses (`192.168.1.1`, `45.33.32.156`, …). The
"security score" is `max(95, 100 - highSeverityCount * 2)`. The "Run security
scan" button waits 3 seconds and toasts "All checks passed" without touching
the database. Toggling a control (2FA, rate limiting, encryption) only updates
local component state and shows a toast — **nothing is persisted**.

**Settings** (`Settings.tsx`). `handleSave` waits 500 ms and toasts
"Settings saved successfully!" without any write.

**Onboarding** (`Onboarding.tsx`). Real profile names and emails from the first
four profiles, but the onboarding step, progress percentage, and the
in-progress/pending-review counts are derived from the array index and profile
count.

> **Operational rule: do not put Reports, Live Tracking, Security or Onboarding
> in front of a customer, an auditor or a works council. Analytics now renders
> real aggregates (2026-11-13) but is **UNVERIFIED until migration 016 is applied
> and the project is unpaused** — treat it as unproven until then. Use
> Overview, Employees, Departments, Teams, Leave Requests and Attendance.**
> If a number from those screens reaches a payslip conversation or an HR case,
> you will have to retract it.

---

## 2. Getting in, and the role model

`dashboardPath()` in `src--frontend/App.tsx` sends `COMPANY`, `OWNER`, `HR` and
`MANAGER` to `/company`.

Inside the portal, `CompanyDashboard.tsx` filters the sidebar by
`organization.role`, where `organization` comes from `useOrganization()` — which
reads the caller's rows in `user_organizations`.

| Nav item | Roles that see it |
| --- | --- |
| Dashboard | ADMIN, HR, MANAGER, EMPLOYEE, SALES, SECURITY, ANALYST |
| Employees | ADMIN, HR, MANAGER |
| Onboarding | ADMIN, HR |
| Departments | ADMIN, HR, MANAGER |
| Teams | ADMIN, MANAGER |
| Attendance | ADMIN, HR, MANAGER, EMPLOYEE, SALES |
| Leave Requests | ADMIN, HR, MANAGER, EMPLOYEE |
| Reports | ADMIN, HR, MANAGER, SALES, ANALYST |
| Analytics | ADMIN, HR, MANAGER, SECURITY, ANALYST |
| Security | ADMIN, SECURITY |
| Live Tracking | ADMIN, MANAGER, SALES |
| Settings | ADMIN |

**These checks are frontend-only.** The sidebar hides a link; the page still
mounts if you type the URL. The real boundary is Supabase RLS.

> **⚠ VERIFY — the company role model is not fully reconciled with the database.**
> `profiles.role` is a Postgres enum `user_role` with only
> `SUPER_ADMIN, ADMIN, FACULTY, CLASS_INCHARGE, STUDENT`. Migration
> `016_company_role.sql` adds `COMPANY` to that enum and re-creates
> `handle_new_user()` so signups are always STUDENT — signup metadata never
> grants a role — but **016 has NOT been applied live** and the
> project is PAUSED. Until it is, a company account cannot
> store `COMPANY` — and `HR`, `MANAGER`, `EMPLOYEE`, `SALES`, `SECURITY`,
> `ANALYST` or `OWNER` remain unsupported by the enum.
>
> **Provisioning:** company accounts must be provisioned **out-of-band**
> (administrator-created, service-role SQL), never via public self-signup —
> after 016, signup metadata never grants any role, so `role: 'COMPANY'` or
> any staff role in signup metadata creates an ordinary STUDENT profile.
> Staff promotion likewise happens out of band (013 semantics, kept by 016),
> and COMPANY accounts must follow the same rule.
> Company roles live in `user_organizations.role`, a separate `TEXT` column with
> its own `CHECK (role IN ('OWNER','ADMIN','HR','FACULTY','EMPLOYEE','STUDENT'))`
> — note that column does **not** include `SALES`, `SECURITY` or `ANALYST`, which
> the sidebar checks for.
>
> Before relying on role-scoped access, confirm against your live database:
> which column is populated for company staff, and what it contains. A company
> user whose `profiles.role` is `STUDENT` will be evaluated by `is_admin()` and
> `is_faculty()` as **neither**, which changes what RLS returns.

---

## 3. Employees

`/company/employees` lists profiles via `profileService.getAll()` →
`supabase.from('profiles').select('*')` with the caller's own JWT.

You get whatever RLS returns. `profiles` policies are
`profiles_self_read`, `profiles_admin_all` (`is_admin(auth.uid())`) and
`profiles_faculty_view_students`. So:

- a caller whose role satisfies `is_admin` sees **all profiles**;
- anyone else sees **only their own row**.

> **⚠ VERIFY** — if a company HR user is not `ADMIN` in `profiles.role`, the
> Employees screen will show one row: themselves. That is the most likely
> reason a company deployment "loses" its employee list.

The `profiles` table carries `first_name`, `last_name`, `email`, `phone`,
`avatar_url`, `address`, `city`, `state`, `country`, `postal_code`,
`date_of_birth`, `gender`, `role`, `is_active`, `mfa_enabled`, `last_login_at`,
`login_attempts`, `lockout_until`. Treat `date_of_birth`, home address and
`lockout_until` as special-category or security-sensitive: do not export them
into spreadsheets.

---

## 4. Attendance

`/company/attendance` was **rewritten 2026-11-13** to read the
`company_attendance_summary` view (migration 016) — date, status, method,
first/last name, enrollment_id, department, class. No biometric, email, IP,
device or location columns are exposed, and non-company callers get zero rows.
It no longer queries the (non-existent) `profile_id`/`check_in`/`check_out`
columns. **The view has NOT been applied live (project PAUSED), so the screen
is UNVERIFIED in production** — until 016 is applied it will error or render
empty. The historical schema-mismatch analysis below is kept for context.

<details><summary>Historical analysis (pre-2026-11-13)</summary>

> **⚠ VERIFY — three schema mismatches to resolve before trusting this screen.**
>
> 1. **The columns it selects do not match the schema.**
>    `server--backend/prisma/schema.prisma` defines `attendance` with
>    `student_id`, `date`, `status`, `method`, `confidence_score`, `location`,
>    `device_info`, `ip_address`, `verified_by`, `justification`,
>    `blockchain_hash`, … There is **no `profile_id`, no `check_in`, no
>    `check_out` and no `created_at`**. The query will error at PostgREST.
> 2. **The `attendance` table is the student attendance table.** In this schema
>    rows are keyed on `student_id` and `date`, not on employee check-in/out.
>    There is no employee time-and-attendance store in the repository.
> 3. **RLS.** `attendance_self_read` and `attendance_admin_all` test
>    `profiles.role`. A company-role user is very unlikely to satisfy
>    `is_admin`, so this read will most likely return **zero rows**.
>
> In short: the company attendance screen was written against a schema that does
> not exist in this repository. That screen was rewritten 2026-11-13 (see above).
</details>

Its CSV export now mirrors the `company_attendance_summary` fields (also
UNVERIFIED until 016 is applied). Do not use this screen as the basis for
payroll, disciplinary or works-council processes until it has been verified
end to end on the restored project.

---

## 5. Leave requests — the one genuinely useful HR screen

`/company/leave` reads `leave_requests` and can approve or reject.

Approve: `PUT /api/leaves/:id/approve` with `{ status: 'APPROVED' }`.
Reject: same endpoint with `{ status: 'REJECTED', comments: '…' }`.

Allowed roles for the endpoint: `FACULTY`, `CLASS_INCHARGE`, `ADMIN`,
`SUPER_ADMIN`.

> **⚠ VERIFY** — a company `HR` role is **not** in that list, and
> `approveLeaveRequest` additionally requires that the caller owns the student's
> class (`classes.incharge_id`), unless the caller is `ADMIN`. An `HR` user who
> is not a database `ADMIN` will get
> `403 "Not authorized to action this leave request"`.
>
> Confirm this against your deployment. If HR genuinely needs leave approval,
> the role check and the class-ownership check both have to be adjusted, and
> the audit trail should record that a non-academic role made the decision.

What an approval does: sets status/approver/timestamp, **writes or updates
`attendance` rows with status `ON_LEAVE` for every day in the range**, notifies
the requester, and writes an audit-log entry. It is not reversible by the
requester once processed.

---

## 6. Departments and teams

`/company/departments` and `/company/teams` both read the `departments` table.
`departments` has `name` (unique), `code` (unique), `description`, `hod_id`,
`is_active`, plus optional `organization_id`.

Teams are rendered from departments — there is no separate teams table in the
schema.

`departments_anyone_read` is `FOR SELECT USING (true)`, so every authenticated
user can read the department list. `departments_admin_all` gates writes.

---

## 7. Overview

`/company` issues four head-count queries:

```
profiles            count, head
attendance          count, head
leave_requests      count where status = 'pending'
departments         count, head
```

All four are real counts **subject to RLS**. A zero for `attendance` most
likely means the caller cannot read that table (see §4), not that nobody worked.

---

## 8. What the company portal explicitly cannot see

### Face embeddings — verified not exposed

This is the claim most likely to be challenged, so here is the evidence.

1. **No company page queries them.** Grepping `src--frontend/pages/company/`
   for Supabase table access yields exactly: `profiles`, `departments`,
   `attendance`, `leave_requests`. No `face_embeddings`, no
   `face_verification_logs`, no `students.face_data`.
2. **RLS forbids it regardless of the frontend.** `012_security_hardening.sql`
   drops every previous policy on `face_embeddings` and installs exactly two:

   ```sql
   -- service role only
   CREATE POLICY "service_all_face_embeddings" ON public.face_embeddings
     FOR ALL USING (auth.role() = 'service_role')
     WITH CHECK (auth.role() = 'service_role');

   -- a student may read their OWN rows
   CREATE POLICY "students_self_read_face_embeddings" ON public.face_embeddings
     FOR SELECT TO authenticated USING (
       student_id IN (SELECT s.id FROM public.students s WHERE s.user_id = auth.uid())
     );
   ```

   There is no policy granting select to admins, to `authenticated` generally, or
   to any company role. An admin using the anon key cannot read it either.
3. **The service role is not reachable from the browser.** It is used by the
   AI server (`ai-server/utils/db.py`) and edge functions, both server-side.

So: a company or HR user cannot read face embeddings through the product.

### The two things a company user *can* see that need a decision

- **`face_registered` (a boolean).** The admin students CSV export includes
  this flag. It says *whether* a person has registered a face, nothing about
  the face. It is still health-adjacent information; decide whether HR needs it.
- **`face_verification_logs`.** `ai_adaptive_schema.sql` grants
  `SELECT` to `SUPER_ADMIN`/`ADMIN` only. It contains a similarity score, a
  device id and a timestamp — not an embedding, not an image. A company user
  whose `profiles.role` is `ADMIN` would be able to read it. Confirm whether
  any company-side account carries the `ADMIN` role; if so, that is a
  separation-of-duties question to settle deliberately.

### Individual student attendance

As of 2026-11-13 the company portal reads attendance **only** through
`company_attendance_summary` (migration 016, security-definer view): it exposes
aggregate-friendly identity + status fields and denies rows to non-company
callers. It is **not applied live** and **UNVERIFIED in production**. Before
016 is applied, the honest statement is: *the company portal has no screen
that deliberately shows individual student attendance, and the RLS on
`attendance` is written against academic roles only. We have not verified
end-to-end what a company-role account can read.* Do not tell a candidate that
their attendance is definitely invisible to their employer, and do not tell an
employer they definitely can see it.

### Raw embeddings through `students.face_data`

`students.face_data` holds the primary embedding on the `students` table, and
`students_admin_all` is `FOR ALL USING (is_admin(auth.uid()))`. No frontend
page selects that column — but if any account has `profiles.role = 'ADMIN'`, the
RLS policy permits it. **Recommendation: revoke
`REVOKE SELECT (face_data) ON public.students FROM authenticated;`** so the
column is reachable only by the service role. Verify this works with your
admin screens before applying it.

### Live location history

`geo_verifications` rows do exist per user (coordinates, in/out of fence, spoof
flag). No company page reads them, and the Live Tracking screen shows the
viewer's own position for every tile. But the data is there, and adding a query
is a small change — treat "we do not track employee location" as a policy
decision, not a technical guarantee.

---

## 9. Company privacy: rules we can and cannot assert

**Safe to state, verified in code**
- The company portal never requests face embeddings or face photographs.
- RLS on `face_embeddings` permits service-role access and a student's own
  read only.
- The only biometric-related field the product surfaces to a non-student is the
  boolean `face_registered`.
- The Live Tracking screen does not read anyone's real location.

**Not safe to state yet**
- That no company account can read individual student attendance (§4, §8).
- That no admin account can read a raw embedding (§8).
- That any company screen shows real analytics (§1 — real since 2026-11-13 but
  UNVERIFIED until 016 is applied and the project is unpaused).
- That the company Security screen reflects real security events (§1).

**Recommended company policy to adopt regardless of the above**
- HR and managers receive **aggregate** figures (headcount, attendance rates,
  leave balances) — not biometric or per-employee surveillance data.
- Face-based attendance for company staff is not offered by this product; if you
  want it, do not enable it for employees without a separate DPIA and works
  council consultation.
- Publish your retention periods and your erasure process before you collect
  anything — `docs/DATA_RETENTION.md` gives the schedule.
- Keep company roles separate from `ADMIN`. Today `OWNER`/`ADMIN` is how a
  company user gets broad access, and `ADMIN` also unlocks
  `face_verification_logs`. Consider a dedicated company role that is not in the
  `user_role` enum at all.

---

## 10. Fixing the portal: priority order

> **2026-11-13:** items 1 and 3 are done in code (Analytics no longer invents
> numbers; `/company/attendance` now reads the `company_attendance_summary`
> view). Both remain **UNVERIFIED in production** until migration 016 is
> applied and the PAUSED Supabase project is restored. Item 2 is partially
> done: `016` adds the `COMPANY` enum value and STUDENT-only signup semantics
> (no role from signup metadata) — still not applied live, and company-role
> reconciliation across `profiles.role` / `user_organizations.role` is not complete.

1. ~~**Stop displaying synthetic numbers.**~~ **Done in code 2026-11-13**
   (Analytics/Attendance/LiveTracking); Security and Onboarding below still
   apply. Highest priority — invented data in an HR tool is a liability.
2. **Reconcile the role model.** Decide whether company roles live in
   `profiles.role` or `user_organizations.role`, extend the enum or the CHECK as
   needed, and make the RLS predicates agree with the sidebar. *(`016` adds the
   `COMPANY` enum value and STUDENT-only signup semantics; not applied live; not sufficient alone.)*
3. ~~**Fix or remove `/company/attendance`.**~~ **Done in code 2026-11-13** —
   re-pointed at `company_attendance_summary` (016). Unverified until applied.
4. **Persist company settings** or remove the screen.
5. **Replace the hard-coded security events** with a real `security_events`
   query scoped to company users.
6. **Decide on employee location** and implement the policy you chose.