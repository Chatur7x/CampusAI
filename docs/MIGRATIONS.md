# AISMS — Database Migrations

> Schema authority for AISMS lives in **`supabase/migrations/`**.
> Read this before adding or reversing any migration.

---

## 1. The convention

`supabase/migrations/` is applied in **lexicographic filename order**, so
the numeric prefix is the only thing determining execution order.

```text
NNN_snake_case_description.sql
```

Rules, as observed in the existing files:

1. **Three-digit, zero-padded, monotonic prefix.** `001`, `002`, … `013`.
   Never reuse a number, even after a rollback.
2. **`_` separator**, then a lowercase snake_case description of what the
   migration does.
3. **One concern per file.** Security, schema fixes and performance indexes
   are separate migrations, not one bundle.
4. **Forward-only, idempotent where possible.** Files use
   `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` and
   `DROP ... IF EXISTS` so a partially-applied migration can be re-run.
5. **Never edit a migration that has been applied to a shared or
   production database.** Add a new numbered migration instead. Editing
   history causes the local ledger and production to diverge silently.
6. **RLS is not optional.** Any migration that creates a table must enable
   row-level security and define its policies in the same file. Several
   files in the "not read by any service" era omitted this and had to be
   fixed retroactively by `005_fix_rls_camelcase.sql`.

### Known drift in the current directory

Two things violate the convention above and are recorded here so they are
not repeated:

- **Duplicate numbers.** `002_multi_organization.sql` and
  `002_rls_policies.sql` both start with `002`. Likewise
  `003_backups.sql` and `003_employee_id_sequences.sql` both start with
  `003`. Lexicographic ordering makes
  `002_multi_organization` sort before `002_rls_policies`, but the pairing
  is accidental, not designed. A new migration must therefore use a number
  **strictly greater than every existing file**, i.e. start at `014`.
- **Unnumbered files.** `ai_adaptive_schema.sql` and
  `v4_biometric_optimization.sql` do not follow `NNN_` at all. They have
  been applied out of band. Do not use them as a naming model; if they need
  to change, create `014_…` that supersedes them.

### A second, separate migration directory

`server--backend/prisma/migrations/` contains exactly two files:

| File | Purpose |
|---|---|
| `008_cybersecurity_layer.sql` | Prisma-side copy of the same cybersecurity tables that `supabase/migrations/008_cybersecurity_layer.sql` creates |
| `009_beast_upgrade.sql` | Ad-hoc schema upgrade applied through the Prisma client |

This directory is **not** the schema authority. It exists because some
changes were made through Prisma rather than through the Supabase CLI.
Treat any new divergence between it and `supabase/migrations/` as a bug.
The durable rule: schema changes go through `supabase/migrations/`, and
`server--backend/prisma/schema.prisma` is regenerated to *match* — it is
never the input to a production migration.

---

## 2. Files currently present

Sixteen files in `supabase/migrations/`, in application order.

| # | File | One-line purpose |
|---|---|---|
| 001 | `001_initial_schema.sql` | Creates the core schema: profiles, students, faculty, admins, departments, courses, classes, subjects, timetable, attendance, leaves, grades, notices, notifications, chat, audit logs, security alerts and settings, plus the helper functions (`get_user_role`, `calculate_attendance_percentage`, …) and `generate_attendance_hash()` for the tamper-evident ledger. |
| 002 | `002_multi_organization.sql` | Adds multi-tenancy: `organizations`, `user_organizations`, `organization_invitations`, `organization_audit_logs`, `organization_id` columns on the core tables, and the `get_user_organization` / `check_org_role` helpers. |
| 002 | `002_rls_policies.sql` | Enables row-level security on every core table and defines the first full set of role-based policies (self / faculty / admin). |
| 003 | `003_backups.sql` | Adds the `backups` table with admin-only RLS, so the Prisma `Backups` model has a target. |
| 003 | `003_employee_id_sequences.sql` | Adds per-organization employee-ID sequence allocation via `generate_employee_id()` and `set_employee_id_trigger()`. |
| 004 | `004_fix_camelcase_schema.sql` | Repairs RPC functions and summary views after discovering the live database uses Prisma-style **camelCase** columns, not the snake_case the original migrations assumed; creates `daily_attendance_summary`, `department_attendance_summary`, `student_attendance_overview`. |
| 005 | `005_fix_rls_camelcase.sql` | Drops and recreates **every** RLS policy against the real camelCase column names, and enables RLS on `users` — called out in its own header as a critical security fix. |
| 006 | `006_backup_infrastructure.sql` | Makes backups operational: creates the storage bucket and retention policy, adds `log_backup()` and `cleanup_old_backups()`, and repairs the `backups` table if `003` never applied. |
| 007 | `007_security_and_performance.sql` | Closes RLS gaps found in `002`, adds roughly a dozen indexes on the columns the policies filter on, and locks down the backups storage bucket. |
| 008 | `008_cybersecurity_layer.sql` | The security surface: `token_blacklist`, `trusted_devices`, `login_history`, `security_events`, `geo_verifications`, `mfa_backup_codes`, `api_request_log`, service-role-only policies, and `cleanup_expired_tokens()`. |
| 009 | `009_attendance_sessions.sql` | Adds `attendance_sessions` — faculty-initiated marking windows with a session code and geo-fencing — plus `session_id` on `geo_verifications`. |
| 010 | `010_auto_profile_trigger.sql` | Installs `handle_new_user()` so every `auth.users` signup automatically receives a matching `profiles` row and role record. |
| 011 | `011_attendance_security_revamp.sql` | Links `attendance` to `attendance_sessions` (`session_id`) for anti-proxy proof, and opens RLS so a student can mark **their own** attendance. |
| 012 | `012_security_hardening.sql` | Live-verified RLS lockdown: service-role-only policies on `login_history`, `security_events`, `geo_verifications`, `api_request_log`, `attendance`, `notifications`, `password_resets`, `face_embeddings`; index hardening. Header records that it was verified against production on 2026-09-24. |
| 013 | `013_signup_role_lockdown.sql` | Closes self-granted roles: `handle_new_user()` no longer trusts `raw_user_meta_data->>'role'`, so every signup is a `STUDENT` with no auto-enrollment, and staff are promoted out of band. |
| — | `ai_adaptive_schema.sql` | Unnumbered. Adds `face_embeddings` and `face_verification_logs` with service-role-only access and admin-visible verification logs. |
| — | `v4_biometric_optimization.sql` | Unnumbered. Enables the `vector` extension, adds a 512-dimension pgvector column plus an HNSW index to `face_embeddings`, and adds `match_face_v4()` and `audit_biometric_security()`. |

### Reading order that actually matches production

Applying `001` → `013` in order on a clean database is **not** the same as
reproducing the live schema. Migrations `004` and `005` exist precisely
because `001`–`003` were wrong about column naming; `012` and `013` were
written against a live database after the fact. A fresh environment
therefore gets a slightly different (cleaner) history than production has.

> **This is the largest outstanding database risk in the repository.** It
> should be resolved by dumping the production schema and diffing it against
> a clean `001`–`013` replay, then adding a reconciliation migration. That is
> follow-up work, not part of Phase C.

---

## 3. Adding a new migration

### 3.1 Procedure

```bash
# 1. Write the SQL by hand in the editor of your choice.
#    Target: supabase/migrations/014_<snake_case_description>.sql

# 2. Create a scratch local project and replay everything.
npx supabase start
npx supabase db reset          # drops and replays all migrations in order

# 3. Inspect the result before trusting it.
npx supabase db diff --schema public   # should show only what you intended

# 4. Apply to staging, verify the app's main flows, then production.
npx supabase db push --linked
```

### 3.2 Template

```sql
-- =============================================================
-- 014_short_description.sql
-- =============================================================
-- Why this migration exists, in one or two sentences.
-- What breaks if it is not applied.
-- Any dependency on a specific earlier migration number.

-- Guard: this migration must be safe to re-run after a partial failure.
CREATE TABLE IF NOT EXISTS example (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_example_org ON example(org_id);

-- MANDATORY for any new table: RLS plus explicit policies.
ALTER TABLE example ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own example rows" ON example
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage example rows" ON example
    FOR ALL USING (is_admin(auth.uid()));
```

### 3.3 Checklist before opening a pull request

- [ ] Number is strictly greater than every existing file (currently **014**).
- [ ] Filename matches `NNN_snake_case_description.sql`.
- [ ] Every `CREATE TABLE` is followed by `ENABLE ROW LEVEL SECURITY` **and**
      at least one `CREATE POLICY`.
- [ ] Column names use **camelCase** to match the live schema (see `004`).
- [ ] `IF NOT EXISTS` / `IF EXISTS` used so a partial apply can be retried.
- [ ] If it changes an RPC function, the function body uses `SECURITY
      DEFINER` **only** with an explicit `search_path`, and does not leak
      `auth.uid()` to non-privileged roles.
- [ ] `npx supabase db reset` completes with no error.
- [ ] The diff from `supabase db diff` contains only the intended changes.
- [ ] Any service-role write path is documented, since RLS is bypassed there.

### 3.4 Things that specifically go wrong here

- **Snake_case column names.** `001`–`003` assumed them; the live schema is
  camelCase. `004` and `005` had to undo the damage. Check the actual
  column name in `prisma/schema.prisma` before writing a policy.
- **Tables without policies.** RLS enabled with no policy means the table
  is unreadable to everyone, including admins, because the policies are the
  grants. This fails closed, which is safe but looks like a bug.
- **Multiple migration roots.** Editing `prisma/schema.prisma` and pushing
  from the backend instead of adding a migration creates divergence. Do not.
- **`handle_new_user()` drift.** It has been redefined by both `010` and
  `013`. A future change must `CREATE OR REPLACE` the latest version, not
  reconstruct the original.

---

## 4. Reversing a migration

Migrations are **forward-only**. There is no down-migration convention in
this repository and none should be introduced casually.

### 4.1 Decide first: roll forward, or roll back?

**Prefer rolling forward.** Write `015_<fix>.sql` that undoes the damage.

- It is auditable, replayable and safe on a database that has already had
  time to diverge.
- It preserves the ledger. `supabase_migrations.schema_migrations` records
  what was applied and when; deleting rows from it to pretend something
  never happened breaks that guarantee.

Roll back only when the change is genuinely wrong **and** nothing depends
on it yet — typically within minutes of applying it, before release.

### 4.2 Roll back the last migration (the only supported "undo")

```bash
# 1. Stop writes. There is no transactional DDL wrapper around a deploy.

# 2. Read the migration ledger to confirm what is actually applied.
npx supabase migration list --linked

# 3. Take a backup FIRST. Do not skip this.
npx supabase db dump --linked -f backup-before-revert.sql
npx supabase db dump --linked --data-only -f backup-data-before-revert.sql

# 4. Remove the file from the repository, then repair the ledger to match.
#    Removing the file alone leaves the ledger claiming it ran.
```

### 4.3 Manual reversal

When the ledger has already been edited, or when reverting more than one
migration, do it in the SQL editor against a snapshot, in reverse order,
with an explicit snapshot between steps:

```sql
-- Take a snapshot before each destructive step.
BEGIN;

DROP POLICY IF EXISTS "Admins can manage example rows" ON example;
DROP INDEX  IF EXISTS idx_example_org;
DROP TABLE  IF EXISTS example;     -- CASCADE is almost always wrong here

COMMIT;
```

Then verify:

```sql
-- Policies that exist
SELECT tablename, policyname FROM pg_policies
 WHERE schemaname = 'public' ORDER BY tablename, policyname;

-- Tables WITHOUT row-level security — should be empty except for
-- tables that are intentionally service-role-only.
SELECT c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind = 'r'
   AND NOT c.relrowsecurity;
```

### 4.4 Reverting is not a rollback of application code

Rolling back a migration while the application still expects the new column
produces runtime errors that look like authentication failures, because
RLS policy functions referencing a dropped column raise at query time.
Roll back application code first, or both together — never one without the
other.

---

## 5. Reference

| Concern | Location |
|---|---|
| Schema authority | `supabase/migrations/` |
| Local / CI CLI | `npx supabase start`, `npx supabase db reset`, `npx supabase db push` |
| Seed data | `supabase/seed*.sql`, `supabase/functions/` |
| Ad-hoc repair scripts (not migrations) | `supabase/*.sql` at the top level — `fix_schema*.sql`, `NUCLEAR_FIX_v5.sql`, etc. These are one-off operational scripts. Never treat them as migrations and never re-run them against production. |
| Client-side schema view | `server--backend/prisma/schema.prisma` — regenerate, do not hand-edit |
| Divergent Prisma migrations | `server--backend/prisma/migrations/` — 2 files, see §1 |