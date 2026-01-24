-- ============================================================================
-- 000: DATABASE RESET
-- BuyAPixel - Complete Schema Reset
-- WARNING: This drops ALL existing tables, functions, and data
-- ============================================================================

-- Drop all existing tables (in dependency order)
DROP TABLE IF EXISTS public.blog_post_categories CASCADE;
DROP TABLE IF EXISTS public.blog_posts CASCADE;
DROP TABLE IF EXISTS public.blog_categories CASCADE;
DROP TABLE IF EXISTS public.marketplace_transactions CASCADE;
DROP TABLE IF EXISTS public.marketplace_listings CASCADE;
DROP TABLE IF EXISTS public.user_notification_preferences CASCADE;
DROP TABLE IF EXISTS public.admin_audit_log CASCADE;
DROP TABLE IF EXISTS public.user_status CASCADE;
DROP TABLE IF EXISTS public.announcements CASCADE;
DROP TABLE IF EXISTS public.contact_messages CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.pixel_blocks CASCADE;
DROP TABLE IF EXISTS public.pixels CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop materialized views
DROP MATERIALIZED VIEW IF EXISTS public.mv_grid_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_leaderboard CASCADE;

-- Drop all custom functions
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- Reset complete
SELECT 'Database reset complete' AS status;
