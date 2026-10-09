# Supabase auth signup blocker — root cause and fix

**Status: root-caused and proven. Fix cannot be applied from here — it needs the
true table owner or a Management API token.**

## Symptom

Every attempt to create a user fails:

| Path | Result |
|---|---|
| `POST /auth/v1/admin/users` | `500 {"msg":"Database error creating new user"}` |
| `POST /auth/v1/signup` | `500 {"msg":"Database error saving new user"}` |
| `node seed_users.mjs` | every account reports `⚠ <email>: error` |

Self-service signup and admin user creation have been broken.

## Root cause

`auth.identities.email` is a **generated column**:

```sql
email text GENERATED ALWAYS AS (lower(identity_data ->> 'email')) STORED
```

The Supabase auth service (GoTrue) running against this project is an **older
build than the database schema**. Old GoTrue writes the email explicitly:

```sql
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, email, ...)
```

Postgres rejects that with:

```
cannot insert a non-DEFAULT value into column "email"
```

GoTrue wraps any database error from that transaction as a generic
`500 Database error creating new user`, which hides the real cause.

## How this was proven

Rather than guessing, the investigation isolated each candidate:

**1. The custom trigger is NOT at fault.** A diagnostic wrapper was installed
around `handle_new_user` that logs `SQLSTATE`, `SQLERRM` and `PG_CONTEXT` to a
table before re-raising. A real signup attempt produced **no log row** — the
trigger never raised. A bare `INSERT INTO auth.users` also reproduces cleanly and
the trigger fires correctly.

**2. A/B test of the identity insert shapes** (both run against the live project
inside a transaction and rolled back, with a real user row present so the foreign
key holds):

| Insert shape | Result |
|---|---|
| A — `email` listed explicitly (old GoTrue) | **FAILS**: `cannot insert a non-DEFAULT value into column "email"` |
| B — `email` omitted (new GoTrue) | **OK**, the generated column populates it |

That is the exact asymmetry between the running binary and the schema.

**3. RLS on `auth.users` is enabled with no policies — but is NOT the cause.**
Worth stating explicitly because it was the first hypothesis and it is wrong.
`auth.users` is owned by `supabase_auth_admin`, and the auth service runs as that
owner, so table-owner RLS exemption applies. Granting policies does not fix the
symptom.

## Why the fix cannot be applied from here

The `auth` schema is owned by `supabase_auth_admin`. The `postgres` role reached
through the connection pooler:

- is **not** the owner (`ALTER TABLE auth.users ...` → `must be owner of table users`)
- is **not** a superuser
- **cannot** `SET ROLE supabase_auth_admin`

So neither the service-role key nor the pooler can alter these tables. Only the
Supabase Dashboard SQL editor (true owner) or the Management API with a Personal
Access Token (`sbp_…`) can.

## Fix

Full remediation, both options, in
[`supabase/migrations/014_fix_auth_signup_blocker.sql`](../supabase/migrations/014_fix_auth_signup_blocker.sql).

**Option 1 — preferred, no schema change.** Dashboard → Project → Services →
Auth → *Restart*, or upgrade the project so GoTrue matches the schema. New GoTrue
omits `email` and the generated column works as designed. This keeps Supabase's
optimisation intact.

**Option 2 — fallback.** `ALTER TABLE auth.identities ALTER COLUMN email DROP
EXPRESSION;` plus backfill, grants and RLS policies. This reverts the schema to
match the old binary, at the cost of Supabase's generated-column optimisation.

## Verification after applying

```bash
curl -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"verify@example.com","password":"Verify@12345",
       "email_confirm":true,
       "user_metadata":{"first_name":"Verify","last_name":"Test","role":"STUDENT"}}'
```

Expect `200` plus a user id, then confirm the trigger populated the rest:

```sql
SELECT p.email, p.role, s.enrollment_id
FROM profiles p LEFT JOIN students s ON s.user_id = p.user_id
WHERE p.email = 'verify@example.com';
```

## Second bug found alongside this: enrollment_id collision

The trigger defaulted `enrollment_id` to `'STU' || floor(extract(epoch from now()))`.
`extract(epoch …)` returns **whole seconds**, so any two signups within the same
second collide on `students_enrollment_id_key` and the insert fails.

This surfaced as a load test reporting 210/1000 successes, and it is a real
production bug independent of the GoTrue problem — it also affects self-service
signup under normal concurrent use.

**Fixed** in the live database and in migration 014: the default is now
millisecond precision plus a random suffix,
`'STU' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(md5(random()::text),1,6)`.

Verified live: 8 rapid inserts produced 8 student rows with 8 distinct
`enrollment_id` values.

## Edge function deploys are blocked on the same missing token

`scripts/deploy-edge-functions.sh` needs a Personal Access Token:

```bash
npx supabase login          # or: export SUPABASE_ACCESS_TOKEN=sbp_…
bash scripts/deploy-edge-functions.sh --all --verify
bash scripts/probe-edge-functions.sh
```

The publishable key and service-role key do **not** grant Management API access;
`supabase login` requires an `sbp_…` token specifically.
