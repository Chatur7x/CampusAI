-- ============================================================
-- CAMPUSAI - RELOAD SCHEMA CACHE
-- This script forces Supabase (PostgREST) to reload its
-- schema cache so the frontend can see the new tables/views.
-- ============================================================

-- Force reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';

-- Extra measure: sometimes reloading config helps too
NOTIFY pgrst, 'reload config';

-- To verify if it worked, let's just do a simple select
SELECT 'Schema Cache Reload Command Sent - Please Refresh Your Browser' as status;
