-- ============================================================================
-- 014: FINAL POLICY OPTIMIZATIONS
-- BuyAPixel - Performance fixes and missing function
-- ============================================================================

-- ============================================================================
-- FIX 1: CREATE MISSING get_user_badges FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_badges(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'name', a.name,
        'description', a.description,
        'icon', a.icon,
        'category', a.category,
        'badge_color', a.badge_color,
        'points', a.points,
        'earned_at', ua.earned_at
      ) ORDER BY ua.earned_at DESC
    ), '[]'::jsonb)
    FROM public.user_achievements ua
    JOIN public.achievements a ON a.id = ua.achievement_id
    WHERE ua.user_id = target_user_id
      AND a.is_active = true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_badges(UUID) TO anon, authenticated;

-- ============================================================================
-- FIX 2: DROP ALL CONFLICTING POLICIES AND RECREATE WITH OPTIMIZATIONS
-- Using (select auth.uid()) and (select auth.jwt()) for performance
-- Avoiding FOR ALL to prevent multiple permissive policy conflicts
-- ============================================================================

-- --------------------------------
-- 2.1: achievements
-- --------------------------------
DROP POLICY IF EXISTS "achievements_select" ON public.achievements;
DROP POLICY IF EXISTS "achievements_admin_modify" ON public.achievements;

-- SELECT: public for active achievements
CREATE POLICY "achievements_select" ON public.achievements
  FOR SELECT
  USING (is_active = true);

-- Admin: INSERT/UPDATE/DELETE only (not SELECT to avoid conflict)
CREATE POLICY "achievements_admin_insert" ON public.achievements
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin((select auth.jwt()) ->> 'email'));

CREATE POLICY "achievements_admin_update" ON public.achievements
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin((select auth.jwt()) ->> 'email'))
  WITH CHECK (public.is_super_admin((select auth.jwt()) ->> 'email'));

CREATE POLICY "achievements_admin_delete" ON public.achievements
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin((select auth.jwt()) ->> 'email'));

-- --------------------------------
-- 2.2: announcements
-- --------------------------------
DROP POLICY IF EXISTS "announcements_select" ON public.announcements;
DROP POLICY IF EXISTS "announcements_modify" ON public.announcements;

-- SELECT: active announcements visible to all, admin sees all
CREATE POLICY "announcements_select" ON public.announcements
  FOR SELECT
  USING (
    (is_active = true 
     AND (starts_at IS NULL OR starts_at <= NOW())
     AND (ends_at IS NULL OR ends_at > NOW()))
    OR public.is_super_admin((select auth.jwt()) ->> 'email')
  );

-- Admin: INSERT/UPDATE/DELETE only
CREATE POLICY "announcements_admin_insert" ON public.announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin((select auth.jwt()) ->> 'email'));

CREATE POLICY "announcements_admin_update" ON public.announcements
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin((select auth.jwt()) ->> 'email'))
  WITH CHECK (public.is_super_admin((select auth.jwt()) ->> 'email'));

CREATE POLICY "announcements_admin_delete" ON public.announcements
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin((select auth.jwt()) ->> 'email'));

-- --------------------------------
-- 2.3: blog_categories
-- --------------------------------
DROP POLICY IF EXISTS "blog_categories_select" ON public.blog_categories;
DROP POLICY IF EXISTS "blog_categories_modify" ON public.blog_categories;

-- SELECT: public
CREATE POLICY "blog_categories_select" ON public.blog_categories
  FOR SELECT
  USING (true);

-- Admin: INSERT/UPDATE/DELETE only
CREATE POLICY "blog_categories_admin_insert" ON public.blog_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin((select auth.jwt()) ->> 'email'));

CREATE POLICY "blog_categories_admin_update" ON public.blog_categories
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin((select auth.jwt()) ->> 'email'))
  WITH CHECK (public.is_super_admin((select auth.jwt()) ->> 'email'));

CREATE POLICY "blog_categories_admin_delete" ON public.blog_categories
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin((select auth.jwt()) ->> 'email'));

-- --------------------------------
-- 2.4: blog_post_categories
-- --------------------------------
DROP POLICY IF EXISTS "blog_post_categories_select" ON public.blog_post_categories;
DROP POLICY IF EXISTS "blog_post_categories_modify" ON public.blog_post_categories;

-- SELECT: public
CREATE POLICY "blog_post_categories_select" ON public.blog_post_categories
  FOR SELECT
  USING (true);

-- Admin: INSERT/UPDATE/DELETE only
CREATE POLICY "blog_post_categories_admin_insert" ON public.blog_post_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin((select auth.jwt()) ->> 'email'));

CREATE POLICY "blog_post_categories_admin_update" ON public.blog_post_categories
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin((select auth.jwt()) ->> 'email'))
  WITH CHECK (public.is_super_admin((select auth.jwt()) ->> 'email'));

CREATE POLICY "blog_post_categories_admin_delete" ON public.blog_post_categories
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin((select auth.jwt()) ->> 'email'));

-- --------------------------------
-- 2.5: moderation_queue
-- --------------------------------
DROP POLICY IF EXISTS "moderation_queue_insert" ON public.moderation_queue;
DROP POLICY IF EXISTS "moderation_queue_admin" ON public.moderation_queue;
DROP POLICY IF EXISTS "moderation_queue_admin_modify" ON public.moderation_queue;
DROP POLICY IF EXISTS "moderation_queue_admin_delete" ON public.moderation_queue;

-- INSERT: any authenticated user can report
CREATE POLICY "moderation_queue_insert" ON public.moderation_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (reported_by = (select auth.uid()));

-- Admin: SELECT/UPDATE/DELETE
CREATE POLICY "moderation_queue_admin_select" ON public.moderation_queue
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin((select auth.jwt()) ->> 'email'));

CREATE POLICY "moderation_queue_admin_update" ON public.moderation_queue
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin((select auth.jwt()) ->> 'email'))
  WITH CHECK (public.is_super_admin((select auth.jwt()) ->> 'email'));

CREATE POLICY "moderation_queue_admin_delete" ON public.moderation_queue
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin((select auth.jwt()) ->> 'email'));

-- --------------------------------
-- 2.6: user_status
-- --------------------------------
DROP POLICY IF EXISTS "user_status_select" ON public.user_status;
DROP POLICY IF EXISTS "user_status_modify" ON public.user_status;

-- SELECT: everyone can see status
CREATE POLICY "user_status_select" ON public.user_status
  FOR SELECT
  USING (true);

-- INSERT: own only
CREATE POLICY "user_status_insert" ON public.user_status
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- UPDATE: own or admin
CREATE POLICY "user_status_update" ON public.user_status
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()) OR public.is_super_admin((select auth.jwt()) ->> 'email'))
  WITH CHECK (user_id = (select auth.uid()) OR public.is_super_admin((select auth.jwt()) ->> 'email'));

-- DELETE: own or admin
CREATE POLICY "user_status_delete" ON public.user_status
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()) OR public.is_super_admin((select auth.jwt()) ->> 'email'));

-- ============================================================================
-- END OF 014
-- ============================================================================
