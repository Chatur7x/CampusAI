# Supabase Auth Fix Required

## Problem
- RLS enabled on `auth.users` with **no policies** → blocks all non-owner INSERTs
- Auth server (role `authenticator` or `supabase_auth_admin`) cannot INSERT users
- Admin API (`/auth/v1/admin/users`) and Signup (`/auth/v1/signup`) both return 500

## Root Cause
Migration `010_auto_profile_trigger.sql` was applied (trigger exists), but RLS on `auth.users` was enabled without policies. The auth server's database role cannot INSERT into `auth.users`.

## Fix (run in Supabase Dashboard → SQL Editor as `postgres` superuser)

```sql
-- 1. Grant schema access to auth server roles
GRANT USAGE ON SCHEMA auth TO authenticator;
GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;

-- 2. Grant full permissions on auth.users
GRANT ALL ON auth.users TO authenticator;
GRANT ALL ON auth.users TO supabase_auth_admin;

-- 3. Grant permissions on public tables (for trigger)
GRANT ALL ON public.profiles TO authenticator;
GRANT ALL ON public.students TO authenticator;
GRANT ALL ON public.faculty TO authenticator;
GRANT ALL ON public.admins TO authenticator;
GRANT ALL ON public.profiles TO supabase_auth_admin;
GRANT ALL ON public.students TO supabase_auth_admin;
GRANT ALL ON public.faculty TO supabase_auth_admin;
GRANT ALL ON public.admins TO supabase_auth_admin;

-- 4. Create RLS policies to allow auth server roles
CREATE POLICY "Allow auth server to manage users" 
ON auth.users FOR ALL TO authenticator USING (true) WITH CHECK (true);

CREATE POLICY "Allow auth admin to manage users" 
ON auth.users FOR ALL TO supabase_auth_admin USING (true) WITH CHECK (true);
```

## Verification
After running the fix:
```bash
# Test admin API
node -e "
import 'dotenv/config';
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const r = await fetch(URL + '/auth/v1/admin/users', { method: 'POST', headers: h, body: JSON.stringify({ email: 'test@example.com', password: 'Test@12345', email_confirm: true, user_metadata: { first_name: 'Test', last_name: 'User', role: 'STUDENT' } }) });
console.log('status:', r.status);
"
```

## Edge Functions Deploy (after fix)
```bash
npx supabase@2.119.0 login
bash scripts/deploy-edge-functions.sh --all --verify
bash scripts/probe-edge-functions.sh
```

## Load Test (ready to run after fix)
```bash
node scripts/loadtest-customers.mjs --count 1000 --concurrency 5 --tag perf1
```

## Status
- ✅ Migration 010 applied (trigger `handle_new_user` + `on_auth_user_created`)
- ✅ Trigger verified working with direct INSERT
- ✅ Deploy scripts ready
- ✅ Load test script ready
- ❌ **Blocked**: Need superuser to run auth fix above