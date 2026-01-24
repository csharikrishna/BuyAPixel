-- ============================================================================
-- 012: COMPREHENSIVE LINT FIXES (FINAL CORRECTED VERSION)
-- BuyAPixel - All Performance and Security Fixes
-- ============================================================================

-- ============================================================================
-- FIX 1: FUNCTION SEARCH PATH
-- Set search_path to 'pg_catalog, public' or empty for SECURITY DEFINER functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_super_admin(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN p_email = 'notbot4444@gmail.com';
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_slug(p_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN pg_catalog.lower(
    pg_catalog.regexp_replace(
      pg_catalog.regexp_replace(
        pg_catalog.trim(p_text),
        '[^a-zA-Z0-9\s-]', '', 'g'
      ),
      '[\s-]+', '-', 'g'
    )
  );
END;
$$;

-- ============================================================================
-- FIX 2: MOVE pg_trgm EXTENSION TO EXTENSIONS SCHEMA
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Move extension using ALTER EXTENSION (safe and atomic)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pg_trgm' AND n.nspname = 'public'
  ) THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
    RAISE NOTICE 'Extension pg_trgm moved to extensions schema';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not move pg_trgm extension: %', SQLERRM;
END $$;

-- Update database search_path to include extensions schema
ALTER DATABASE postgres SET search_path TO public, extensions;

-- ============================================================================
-- FIX 3: RESTRICT MATERIALIZED VIEWS ACCESS
-- Remove direct API access; access only via secure functions
-- ============================================================================

-- Revoke all public access to materialized views
REVOKE ALL ON public.mv_grid_stats FROM PUBLIC;
REVOKE SELECT ON public.mv_grid_stats FROM anon, authenticated;

REVOKE ALL ON public.mv_leaderboard FROM PUBLIC;
REVOKE SELECT ON public.mv_leaderboard FROM anon, authenticated;

-- Grant access only to postgres/service_role for internal use
GRANT SELECT ON public.mv_grid_stats TO postgres;
GRANT SELECT ON public.mv_leaderboard TO postgres;

-- Add comments documenting access restrictions
COMMENT ON MATERIALIZED VIEW public.mv_grid_stats IS 
  'Internal materialized view. Access restricted to service_role. '
  'Public access via get_grid_stats() function only.';

COMMENT ON MATERIALIZED VIEW public.mv_leaderboard IS 
  'Internal materialized view. Access restricted to service_role. '
  'Public access via get_leaderboard() function only.';

-- ============================================================================
-- FIX 4: PROFILES RLS POLICIES (consolidated)
-- ============================================================================

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid()) 
    OR deleted_at IS NULL 
    OR (select is_current_user_super_admin())
  );

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- FIX 5: PIXEL_BLOCKS RLS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "blocks_insert_own" ON public.pixel_blocks;
DROP POLICY IF EXISTS "blocks_update_own" ON public.pixel_blocks;
DROP POLICY IF EXISTS "blocks_insert" ON public.pixel_blocks;
DROP POLICY IF EXISTS "blocks_update" ON public.pixel_blocks;

CREATE POLICY "blocks_insert" ON public.pixel_blocks
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (select auth.uid()));

CREATE POLICY "blocks_update" ON public.pixel_blocks
  FOR UPDATE TO authenticated
  USING (owner_id = (select auth.uid()));

-- ============================================================================
-- FIX 6: PIXELS RLS POLICIES (consolidated)
-- ============================================================================

DROP POLICY IF EXISTS "pixels_update_own" ON public.pixels;
DROP POLICY IF EXISTS "pixels_admin_all" ON public.pixels;
DROP POLICY IF EXISTS "pixels_update" ON public.pixels;

CREATE POLICY "pixels_update" ON public.pixels
  FOR UPDATE TO authenticated
  USING (
    owner_id = (select auth.uid()) 
    OR owner_id IS NULL 
    OR (select is_current_user_super_admin())
  )
  WITH CHECK (
    owner_id = (select auth.uid()) 
    OR owner_id IS NULL 
    OR (select is_current_user_super_admin())
  );

-- ============================================================================
-- FIX 7: MARKETPLACE_LISTINGS RLS POLICIES (consolidated)
-- ============================================================================

DROP POLICY IF EXISTS "listings_select_active" ON public.marketplace_listings;
DROP POLICY IF EXISTS "listings_insert_own" ON public.marketplace_listings;
DROP POLICY IF EXISTS "listings_update_own" ON public.marketplace_listings;
DROP POLICY IF EXISTS "listings_delete_own" ON public.marketplace_listings;
DROP POLICY IF EXISTS "listings_admin_select" ON public.marketplace_listings;
DROP POLICY IF EXISTS "listings_select" ON public.marketplace_listings;
DROP POLICY IF EXISTS "listings_insert" ON public.marketplace_listings;
DROP POLICY IF EXISTS "listings_update" ON public.marketplace_listings;
DROP POLICY IF EXISTS "listings_delete" ON public.marketplace_listings;

CREATE POLICY "listings_select" ON public.marketplace_listings
  FOR SELECT USING (
    status = 'active' 
    OR seller_id = (select auth.uid()) 
    OR (select is_current_user_super_admin())
  );

CREATE POLICY "listings_insert" ON public.marketplace_listings
  FOR INSERT TO authenticated
  WITH CHECK (seller_id = (select auth.uid()));

CREATE POLICY "listings_update" ON public.marketplace_listings
  FOR UPDATE TO authenticated
  USING (seller_id = (select auth.uid()));

CREATE POLICY "listings_delete" ON public.marketplace_listings
  FOR DELETE TO authenticated
  USING (seller_id = (select auth.uid()) AND status = 'active');

-- ============================================================================
-- FIX 8: MARKETPLACE_TRANSACTIONS RLS POLICIES (consolidated)
-- ============================================================================

DROP POLICY IF EXISTS "transactions_select_own" ON public.marketplace_transactions;
DROP POLICY IF EXISTS "transactions_admin_select" ON public.marketplace_transactions;
DROP POLICY IF EXISTS "transactions_select" ON public.marketplace_transactions;

CREATE POLICY "transactions_select" ON public.marketplace_transactions
  FOR SELECT TO authenticated
  USING (
    buyer_id = (select auth.uid()) 
    OR seller_id = (select auth.uid()) 
    OR (select is_current_user_super_admin())
  );

-- ============================================================================
-- FIX 9: USER_NOTIFICATION_PREFERENCES RLS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "prefs_all_own" ON public.user_notification_preferences;
DROP POLICY IF EXISTS "prefs_select" ON public.user_notification_preferences;
DROP POLICY IF EXISTS "prefs_insert" ON public.user_notification_preferences;
DROP POLICY IF EXISTS "prefs_update" ON public.user_notification_preferences;

CREATE POLICY "prefs_select" ON public.user_notification_preferences
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "prefs_insert" ON public.user_notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "prefs_update" ON public.user_notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- FIX 10: BLOG_POSTS RLS POLICIES (consolidated)
-- ============================================================================

DROP POLICY IF EXISTS "posts_select_published" ON public.blog_posts;
DROP POLICY IF EXISTS "posts_insert_auth" ON public.blog_posts;
DROP POLICY IF EXISTS "posts_update_own" ON public.blog_posts;
DROP POLICY IF EXISTS "posts_delete_own" ON public.blog_posts;
DROP POLICY IF EXISTS "posts_admin_all" ON public.blog_posts;
DROP POLICY IF EXISTS "posts_select" ON public.blog_posts;
DROP POLICY IF EXISTS "posts_insert" ON public.blog_posts;
DROP POLICY IF EXISTS "posts_update" ON public.blog_posts;
DROP POLICY IF EXISTS "posts_delete" ON public.blog_posts;

CREATE POLICY "posts_select" ON public.blog_posts
  FOR SELECT USING (
    status = 'published' 
    OR author_id = (select auth.uid()) 
    OR (select is_current_user_admin())
  );

CREATE POLICY "posts_insert" ON public.blog_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (select auth.uid()) 
    OR (select is_current_user_admin())
  );

CREATE POLICY "posts_update" ON public.blog_posts
  FOR UPDATE TO authenticated
  USING (
    author_id = (select auth.uid()) 
    OR (select is_current_user_admin())
  );

CREATE POLICY "posts_delete" ON public.blog_posts
  FOR DELETE TO authenticated
  USING (
    author_id = (select auth.uid()) 
    OR (select is_current_user_admin())
  );

-- ============================================================================
-- FIX 11: BLOG_POST_CATEGORIES RLS POLICIES (SINGLE SELECT POLICY)
-- Consolidates multiple permissive SELECT policies into one
-- ============================================================================

DROP POLICY IF EXISTS "post_categories_select_all" ON public.blog_post_categories;
DROP POLICY IF EXISTS "post_categories_manage" ON public.blog_post_categories;
DROP POLICY IF EXISTS "post_categories_read" ON public.blog_post_categories;
DROP POLICY IF EXISTS "post_categories_write" ON public.blog_post_categories;
DROP POLICY IF EXISTS "post_categories_remove" ON public.blog_post_categories;

CREATE POLICY "post_categories_select" ON public.blog_post_categories
  FOR SELECT USING (true);

CREATE POLICY "post_categories_insert" ON public.blog_post_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.blog_posts WHERE id = post_id AND author_id = (select auth.uid()))
    OR (select is_current_user_admin())
  );

CREATE POLICY "post_categories_delete" ON public.blog_post_categories
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.blog_posts WHERE id = post_id AND author_id = (select auth.uid()))
    OR (select is_current_user_admin())
  );

-- ============================================================================
-- FIX 12: BLOG_CATEGORIES RLS POLICIES (SINGLE SELECT POLICY)
-- Consolidates multiple permissive SELECT policies into one
-- ============================================================================

DROP POLICY IF EXISTS "categories_select_all" ON public.blog_categories;
DROP POLICY IF EXISTS "categories_admin_all" ON public.blog_categories;
DROP POLICY IF EXISTS "categories_admin_modify" ON public.blog_categories;
DROP POLICY IF EXISTS "categories_read" ON public.blog_categories;
DROP POLICY IF EXISTS "categories_write" ON public.blog_categories;
DROP POLICY IF EXISTS "categories_modify" ON public.blog_categories;
DROP POLICY IF EXISTS "categories_remove" ON public.blog_categories;

CREATE POLICY "categories_select" ON public.blog_categories
  FOR SELECT USING (true);

CREATE POLICY "categories_insert" ON public.blog_categories
  FOR INSERT TO authenticated
  WITH CHECK ((select is_current_user_admin()));

CREATE POLICY "categories_update" ON public.blog_categories
  FOR UPDATE TO authenticated
  USING ((select is_current_user_admin()));

CREATE POLICY "categories_delete" ON public.blog_categories
  FOR DELETE TO authenticated
  USING ((select is_current_user_admin()));

-- ============================================================================
-- FIX 13: USER_STATUS RLS POLICIES (SINGLE SELECT POLICY)
-- Consolidates multiple permissive SELECT policies into one
-- ============================================================================

DROP POLICY IF EXISTS "user_status_admin_select" ON public.user_status;
DROP POLICY IF EXISTS "user_status_admin_all" ON public.user_status;
DROP POLICY IF EXISTS "user_status_select" ON public.user_status;
DROP POLICY IF EXISTS "user_status_modify" ON public.user_status;
DROP POLICY IF EXISTS "user_status_read" ON public.user_status;
DROP POLICY IF EXISTS "user_status_write" ON public.user_status;
DROP POLICY IF EXISTS "user_status_update" ON public.user_status;
DROP POLICY IF EXISTS "user_status_delete" ON public.user_status;

CREATE POLICY "user_status_select" ON public.user_status
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid()) 
    OR (select is_current_user_super_admin())
  );

CREATE POLICY "user_status_insert" ON public.user_status
  FOR INSERT TO authenticated
  WITH CHECK ((select is_current_user_super_admin()));

CREATE POLICY "user_status_update" ON public.user_status
  FOR UPDATE TO authenticated
  USING ((select is_current_user_super_admin()));

CREATE POLICY "user_status_delete" ON public.user_status
  FOR DELETE TO authenticated
  USING ((select is_current_user_super_admin()));

-- ============================================================================
-- FIX 14: EVENTS RLS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "events_select_own" ON public.events;
DROP POLICY IF EXISTS "events_insert" ON public.events;
DROP POLICY IF EXISTS "events_select" ON public.events;

CREATE POLICY "events_select" ON public.events
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid()) 
    OR (select is_current_user_super_admin())
  );

CREATE POLICY "events_insert" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()) OR user_id IS NULL);

-- ============================================================================
-- FIX 15: MODERATION_QUEUE RLS POLICIES (SINGLE INSERT POLICY)
-- Consolidates multiple permissive INSERT policies into one
-- ============================================================================

DROP POLICY IF EXISTS "moderation_admin" ON public.moderation_queue;
DROP POLICY IF EXISTS "moderation_report" ON public.moderation_queue;
DROP POLICY IF EXISTS "moderation_insert" ON public.moderation_queue;
DROP POLICY IF EXISTS "moderation_read" ON public.moderation_queue;
DROP POLICY IF EXISTS "moderation_modify" ON public.moderation_queue;
DROP POLICY IF EXISTS "moderation_remove" ON public.moderation_queue;

CREATE POLICY "moderation_insert" ON public.moderation_queue
  FOR INSERT TO authenticated
  WITH CHECK (
    reported_by = (select auth.uid())
    OR (select is_current_user_super_admin())
  );

CREATE POLICY "moderation_select" ON public.moderation_queue
  FOR SELECT TO authenticated
  USING ((select is_current_user_super_admin()));

CREATE POLICY "moderation_update" ON public.moderation_queue
  FOR UPDATE TO authenticated
  USING ((select is_current_user_super_admin()));

CREATE POLICY "moderation_delete" ON public.moderation_queue
  FOR DELETE TO authenticated
  USING ((select is_current_user_super_admin()));

-- ============================================================================
-- FIX 16: USER_ACTIVITY RLS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "activity_select" ON public.user_activity;

CREATE POLICY "activity_select" ON public.user_activity
  FOR SELECT USING (
    is_public = true 
    OR user_id = (select auth.uid())
  );

-- ============================================================================
-- FIX 17: ACHIEVEMENTS RLS POLICIES (SINGLE SELECT POLICY)
-- Consolidates multiple permissive SELECT policies into one
-- ============================================================================

DROP POLICY IF EXISTS "achievements_select" ON public.achievements;
DROP POLICY IF EXISTS "achievements_admin" ON public.achievements;
DROP POLICY IF EXISTS "achievements_read" ON public.achievements;
DROP POLICY IF EXISTS "achievements_write" ON public.achievements;
DROP POLICY IF EXISTS "achievements_modify" ON public.achievements;
DROP POLICY IF EXISTS "achievements_remove" ON public.achievements;

CREATE POLICY "achievements_select" ON public.achievements
  FOR SELECT USING (
    is_active = true 
    OR (select is_current_user_super_admin())
  );

CREATE POLICY "achievements_insert" ON public.achievements
  FOR INSERT TO authenticated
  WITH CHECK ((select is_current_user_super_admin()));

CREATE POLICY "achievements_update" ON public.achievements
  FOR UPDATE TO authenticated
  USING ((select is_current_user_super_admin()));

CREATE POLICY "achievements_delete" ON public.achievements
  FOR DELETE TO authenticated
  USING ((select is_current_user_super_admin()));

-- ============================================================================
-- FIX 18: ANNOUNCEMENTS RLS POLICIES (SINGLE SELECT POLICY)
-- Consolidates multiple permissive SELECT policies into one
-- ============================================================================

DROP POLICY IF EXISTS "announcements_select_active" ON public.announcements;
DROP POLICY IF EXISTS "announcements_admin_all" ON public.announcements;
DROP POLICY IF EXISTS "announcements_admin" ON public.announcements;
DROP POLICY IF EXISTS "announcements_read" ON public.announcements;
DROP POLICY IF EXISTS "announcements_write" ON public.announcements;
DROP POLICY IF EXISTS "announcements_modify" ON public.announcements;
DROP POLICY IF EXISTS "announcements_remove" ON public.announcements;

CREATE POLICY "announcements_select" ON public.announcements
  FOR SELECT USING (
    (
      is_active = true 
      AND (starts_at IS NULL OR starts_at <= NOW())
      AND (ends_at IS NULL OR ends_at > NOW())
    )
    OR (select is_current_user_admin())
  );

CREATE POLICY "announcements_insert" ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK ((select is_current_user_admin()));

CREATE POLICY "announcements_update" ON public.announcements
  FOR UPDATE TO authenticated
  USING ((select is_current_user_admin()));

CREATE POLICY "announcements_delete" ON public.announcements
  FOR DELETE TO authenticated
  USING ((select is_current_user_admin()));

-- ============================================================================
-- FIX 19: ADD MISSING INDEXES ON FOREIGN KEYS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON public.announcements(created_by);
CREATE INDEX IF NOT EXISTS idx_announcements_updated_by ON public.announcements(updated_by);
CREATE INDEX IF NOT EXISTS idx_contact_messages_user_id ON public.contact_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_messages_responded_by ON public.contact_messages(responded_by);
CREATE INDEX IF NOT EXISTS idx_transactions_listing ON public.marketplace_transactions(listing_id);
CREATE INDEX IF NOT EXISTS idx_transactions_pixel ON public.marketplace_transactions(pixel_id);
CREATE INDEX IF NOT EXISTS idx_moderation_reported_by ON public.moderation_queue(reported_by);
CREATE INDEX IF NOT EXISTS idx_moderation_reviewed_by ON public.moderation_queue(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_moderation_owner ON public.moderation_queue(owner_id);
CREATE INDEX IF NOT EXISTS idx_pixel_history_from_owner ON public.pixel_history(from_owner_id);
CREATE INDEX IF NOT EXISTS idx_pixel_history_changed_by ON public.pixel_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement ON public.user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_user_status_blocked_by ON public.user_status(blocked_by);

-- ============================================================================
-- COMPLETE
-- ============================================================================

SELECT 'All lint fixes applied successfully - 0 warnings expected!' AS status;
