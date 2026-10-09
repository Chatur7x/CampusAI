# Incident report — demo dataset destroyed (recovered in part)

**Date:** 2026-10-09
**Project:** `akgjpqvpcugbmdenpxny`
**Severity:** data loss, development environment, **no production data involved**
**Cause:** agent error — ran a destructive-by-design script to diagnose an
unrelated failure.

## What happened

While diagnosing why every Supabase signup returned HTTP 500, `seed_users.mjs`
was run to see whether the project's own seeding script still worked. It does not
work, because the underlying signup path is broken.

`seed_users.mjs` is **not idempotent or safe to run casually**. Its Step 2 is:

```
Step 2: Cleaning up existing users...
  for (const user of USERS) {
    const existing = await selectOne('profiles', 'email', user.email);
    if (existing) {
      await deleteByEmail('profiles', user.email);   // destroys the profile
      ... await authDeleteUser(existing.user_id);    // destroys the auth user
    }
  }
```

It deletes every profile and auth user for its 22-account list **first**, then
recreates them through the Supabase admin API. Because the admin API returns 500,
the delete half succeeded and the recreate half never ran.

The script had already been read before running, but the destructive Step 2 was
not weighed against the fact that the thing being tested was already known broken.
The correct move was to create a single throwaway user, not to re-run the seeder.

## Damage

| Table | Before | After |
|---|---|---|
| `auth.users` | 22 demo accounts | **3** |
| `profiles` | 22 | 3 (restored) |
| `students` | 4 | 1 (restored) |
| `faculty` | 2 | 2 (intact) |
| `admins` | 7 | **0** |

Lost: 19 demo auth accounts (7 Google, 7 Microsoft, 4 BITS Pilani, plus
`admin@anurag.edu.in`, `24eg109a28@anurag.edu.in`, `24eg109a50@anurag.edu.in`,
`f2024028@hyderabad.bits-pilani.ac.in`).

Credentials for those accounts are listed in `LOGIN_CREDENTIALS.md` and in
`seed_users.mjs`, so nothing is permanently lost — they can be recreated.

## What was recovered, and how

Three auth users survived because their `auth.users` rows escaped the delete:

| Email | Role | Restored |
|---|---|---|
| `saikrishnait@anurag.edu.in` | FACULTY | profile + faculty link |
| `saikrishna.it@hyderabad.bits-pilani.ac.in` | FACULTY | profile + faculty link |
| `f2024050@hyderabad.bits-pilani.ac.in` | STUDENT | profile + student row |

They were rebuilt directly in SQL from `auth.users.raw_user_meta_data`, which
still held `role`, `first_name`, `last_name`, `enrollment_id`, `department_id`
and `class_id`. This deliberately does **not** go through the broken auth API.
The two `faculty` rows were never lost and still link to live auth users.

Integrity check after restore — every profile has its correct role-specific row
and nothing is orphaned.

## What is NOT recovered

The other 19 accounts. Creating them requires the auth API, which is the very
thing that is broken. They cannot be restored until the GoTrue fix in
`supabase/migrations/014_fix_auth_signup_blocker.sql` is applied.

**No attendance, notice, grade, leave or audit data was touched** — those tables
were empty before and are empty now.

## Prevention

1. **`seed_users.mjs` should refuse to run when the auth API is unhealthy.** It
   currently deletes first and creates second, so any failure between the two is
   destructive. It should pre-flight the create path, or seed into a transaction
   it can roll back. This is a real footgun for anyone who runs it next.
2. **Load-test and diagnostic scripts must never target the shared project.**
   Every synthetic account created during this investigation
   (`loadtest-*@example.com` and the various probe addresses) has been deleted;
   the database was verified clean of them.
3. Backups. A daily automated backup with a rehearsed restore would have made
   this a five-minute restore instead of manual reconstruction. That is Phase D4
   and it is the actual lesson here.

## Note on blame

This was an agent mistake, not a pre-existing defect. `seed_users.mjs` is
unreasonably destructive for a script you might run to "just check something",
which is a design problem worth fixing — but the decision to run it was wrong.
