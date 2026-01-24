-- ============================================================================
-- 013: FINAL LINT CLEANUP
-- BuyAPixel - Resolves ALL remaining Supabase linter warnings
-- Run this in Supabase SQL Editor after 012_lint_fixes.sql
-- ============================================================================

-- ============================================================================
-- FIX 1: FUNCTION SEARCH PATH (is_super_admin, generate_slug)
-- ============================================================================

-- Drop and recreate is_super_admin with explicit search_path
DROP FUNCTION IF EXISTS public.is_super_admin(TEXT);
CREATE FUNCTION public.is_super_admin(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_email = 'notbot4444@gmail.com';
$$;

-- Drop and recreate generate_slug with explicit search_path
DROP FUNCTION IF EXISTS public.generate_slug(TEXT);
CREATE FUNCTION public.generate_slug(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT lower(regexp_replace(regexp_replace(trim(p_text), '[^a-zA-Z0-9\s-]', '', 'g'), '[\s-]+', '-', 'g'));
$$;

-- ============================================================================
-- FIX 2: MOVE pg_trgm EXTENSION TO EXTENSIONS SCHEMA
-- ============================================================================

-- Create extensions schema if not exists
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Move extension (handles case where it's already moved)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pg_trgm' AND n.nspname = 'public'
  ) THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
END $$;

-- ============================================================================
-- FIX 3: RESTRICT MATERIALIZED VIEWS ACCESS
-- Revoke ALL access from anon/authenticated roles
-- ============================================================================

REVOKE ALL ON public.mv_grid_stats FROM PUBLIC;
REVOKE ALL ON public.mv_grid_stats FROM anon;
REVOKE ALL ON public.mv_grid_stats FROM authenticated;

REVOKE ALL ON public.mv_leaderboard FROM PUBLIC;
REVOKE ALL ON public.mv_leaderboard FROM anon;
REVOKE ALL ON public.mv_leaderboard FROM authenticated;

-- Grant only to service role (for RPC functions)
GRANT SELECT ON public.mv_grid_stats TO service_role;
GRANT SELECT ON public.mv_leaderboard TO service_role;

-- ============================================================================
-- FIX 4: CONSOLIDATE MULTIPLE PERMISSIVE POLICIES
-- For each table, drop conflicting policies and create single consolidated ones
-- ============================================================================

-- --------------------------------
-- 4.1: achievements (SELECT conflict)
-- --------------------------------
DROP POLICY IF EXISTS "achievements_admin" ON public.achievements;
DROP POLICY IF EXISTS "achievements_select" ON public.achievements;
DROP POLICY IF EXISTS "achievements_select_all" ON public.achievements;

-- Single SELECT policy for all
CREATE POLICY "achievements_select" ON public.achievements
  FOR SELECT
  USING (true);  -- Achievements are public data

-- Admin-only for INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "achievements_admin_modify" ON public.achievements;
CREATE POLICY "achievements_admin_modify" ON public.achievements
  FOR ALL
  TO authenticated
  USING (is_super_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_super_admin(auth.jwt() ->> 'email'));

-- --------------------------------
-- 4.2: announcements (SELECT conflict)
-- --------------------------------
DROP POLICY IF EXISTS "announcements_admin" ON public.announcements;
DROP POLICY IF EXISTS "announcements_select_active" ON public.announcements;
DROP POLICY IF EXISTS "announcements_admin_all" ON public.announcements;

-- Single SELECT policy (active announcements visible to all)
CREATE POLICY "announcements_select" ON public.announcements
  FOR SELECT
  USING (
    is_active = true 
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (ends_at IS NULL OR ends_at > NOW())
    OR is_super_admin(auth.jwt() ->> 'email')  -- Admin sees all
  );

-- Admin-only for modifications
CREATE POLICY "announcements_modify" ON public.announcements
  FOR ALL
  TO authenticated
  USING (is_super_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_super_admin(auth.jwt() ->> 'email'));

-- --------------------------------
-- 4.3: blog_categories (SELECT conflict)
-- --------------------------------
DROP POLICY IF EXISTS "categories_admin_modify" ON public.blog_categories;
DROP POLICY IF EXISTS "categories_select_all" ON public.blog_categories;

-- Single SELECT policy (categories are public)
CREATE POLICY "blog_categories_select" ON public.blog_categories
  FOR SELECT
  USING (true);

-- Admin-only for modifications
CREATE POLICY "blog_categories_modify" ON public.blog_categories
  FOR ALL
  TO authenticated
  USING (is_super_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_super_admin(auth.jwt() ->> 'email'));

-- --------------------------------
-- 4.4: blog_post_categories (SELECT conflict)
-- --------------------------------
DROP POLICY IF EXISTS "post_categories_manage" ON public.blog_post_categories;
DROP POLICY IF EXISTS "post_categories_select_all" ON public.blog_post_categories;

-- Single SELECT policy (junction table is public)
CREATE POLICY "blog_post_categories_select" ON public.blog_post_categories
  FOR SELECT
  USING (true);

-- Admin-only for modifications
CREATE POLICY "blog_post_categories_modify" ON public.blog_post_categories
  FOR ALL
  TO authenticated
  USING (is_super_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_super_admin(auth.jwt() ->> 'email'));

-- --------------------------------
-- 4.5: moderation_queue (INSERT conflict)
-- --------------------------------
DROP POLICY IF EXISTS "moderation_admin" ON public.moderation_queue;
DROP POLICY IF EXISTS "moderation_report" ON public.moderation_queue;

-- Single INSERT policy (any authenticated user can report)
CREATE POLICY "moderation_queue_insert" ON public.moderation_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (reported_by = auth.uid());

-- Admin-only for SELECT/UPDATE/DELETE
CREATE POLICY "moderation_queue_admin" ON public.moderation_queue
  FOR SELECT
  TO authenticated
  USING (is_super_admin(auth.jwt() ->> 'email'));

CREATE POLICY "moderation_queue_admin_modify" ON public.moderation_queue
  FOR UPDATE
  TO authenticated
  USING (is_super_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_super_admin(auth.jwt() ->> 'email'));

CREATE POLICY "moderation_queue_admin_delete" ON public.moderation_queue
  FOR DELETE  
  TO authenticated
  USING (is_super_admin(auth.jwt() ->> 'email'));

-- --------------------------------
-- 4.6: user_status (SELECT conflict)
-- --------------------------------
DROP POLICY IF EXISTS "user_status_modify" ON public.user_status;
DROP POLICY IF EXISTS "user_status_select" ON public.user_status;

-- Single SELECT policy (everyone can see status)
CREATE POLICY "user_status_select" ON public.user_status
  FOR SELECT
  USING (true);

-- Modification restricted to owner or admin
CREATE POLICY "user_status_modify" ON public.user_status
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid() OR is_super_admin(auth.jwt() ->> 'email')
  )
  WITH CHECK (
    user_id = auth.uid() OR is_super_admin(auth.jwt() ->> 'email')
  );

-- ============================================================================
-- VERIFICATION QUERIES (run these to verify fixes)
-- ============================================================================

-- Check function search_path:
-- SELECT proname, prosecdef, proconfig 
-- FROM pg_proc 
-- WHERE proname IN ('is_super_admin', 'generate_slug');

-- Check extension location:
-- SELECT e.extname, n.nspname 
-- FROM pg_extension e 
-- JOIN pg_namespace n ON e.extnamespace = n.oid 
-- WHERE e.extname = 'pg_trgm';

-- Check materialized view grants:
-- SELECT grantee, privilege_type 
-- FROM information_schema.role_table_grants 
-- WHERE table_name IN ('mv_grid_stats', 'mv_leaderboard');

-- ============================================================================
-- END OF 013
-- ============================================================================
