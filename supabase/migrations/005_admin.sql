-- ============================================================================
-- 005: ADMIN SYSTEM
-- BuyAPixel - Admin Functions, User Management, Permissions
-- Super Admin Email: notbot4444@gmail.com
-- ============================================================================

-- ============================================================================
-- USER STATUS (for blocking/managing users)
-- ============================================================================

CREATE TABLE public.user_status (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Blocking
  is_blocked BOOLEAN DEFAULT false,
  blocked_reason TEXT,
  blocked_at TIMESTAMPTZ,
  blocked_by UUID REFERENCES auth.users(id),
  
  -- Warnings
  warning_count INTEGER DEFAULT 0,
  last_warning_at TIMESTAMPTZ,
  
  -- Admin notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_status_blocked ON public.user_status(is_blocked) WHERE is_blocked = true;

-- ============================================================================
-- ADMIN HELPER FUNCTIONS
-- ============================================================================

-- Check if email is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN p_email = 'notbot4444@gmail.com';
END;
$$;

-- Check if current user is super admin
CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND email = 'notbot4444@gmail.com'
  );
END;
$$;

-- Check if current user is admin (profile.is_admin OR super admin)
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE u.id = auth.uid() 
      AND (u.email = 'notbot4444@gmail.com' OR p.is_admin = true)
  );
END;
$$;

-- ============================================================================
-- ADMIN FUNCTIONS
-- ============================================================================

-- Block a user
CREATE OR REPLACE FUNCTION public.admin_block_user(
  p_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_current_user_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  INSERT INTO public.user_status (user_id, is_blocked, blocked_reason, blocked_at, blocked_by)
  VALUES (p_user_id, true, p_reason, NOW(), auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET
    is_blocked = true,
    blocked_reason = p_reason,
    blocked_at = NOW(),
    blocked_by = auth.uid(),
    updated_at = NOW();

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Unblock a user
CREATE OR REPLACE FUNCTION public.admin_unblock_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_current_user_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  UPDATE public.user_status
  SET is_blocked = false, updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Get all users (admin only)
CREATE OR REPLACE FUNCTION public.admin_get_all_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  pixel_count INTEGER,
  total_spent NUMERIC,
  is_blocked BOOLEAN,
  created_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_current_user_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::TEXT,
    p.full_name,
    COALESCE(p.pixel_count, 0) AS pixel_count,
    COALESCE(p.total_spent, 0) AS total_spent,
    COALESCE(us.is_blocked, false) AS is_blocked,
    u.created_at,
    p.last_active_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN public.user_status us ON us.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

-- Remove pixel content (admin only)
CREATE OR REPLACE FUNCTION public.admin_remove_pixel(
  p_x INTEGER,
  p_y INTEGER,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_current_user_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  UPDATE public.pixels
  SET
    owner_id = NULL,
    block_id = NULL,
    image_url = NULL,
    link_url = NULL,
    alt_text = NULL,
    price_paid = NULL,
    purchased_at = NULL,
    is_active = true,
    updated_at = NOW()
  WHERE x = p_x AND y = p_y;

  RETURN jsonb_build_object('success', true, 'x', p_x, 'y', p_y);
END;
$$;

-- Clear all content (admin only)
CREATE OR REPLACE FUNCTION public.admin_clear_all_content()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pixels INTEGER;
  v_blocks INTEGER;
  v_listings INTEGER;
BEGIN
  IF NOT is_current_user_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Delete marketplace listings
  DELETE FROM public.marketplace_listings;
  GET DIAGNOSTICS v_listings = ROW_COUNT;
  
  -- Delete pixel blocks
  DELETE FROM public.pixel_blocks;
  GET DIAGNOSTICS v_blocks = ROW_COUNT;

  -- Reset all pixels
  UPDATE public.pixels SET
    owner_id = NULL,
    block_id = NULL,
    image_url = NULL,
    link_url = NULL,
    alt_text = NULL,
    price_paid = NULL,
    purchased_at = NULL,
    times_resold = 0,
    last_sale_price = NULL,
    last_sale_date = NULL,
    view_count = 0,
    is_active = true
  WHERE owner_id IS NOT NULL;
  GET DIAGNOSTICS v_pixels = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'pixels_reset', v_pixels,
    'blocks_deleted', v_blocks,
    'listings_deleted', v_listings
  );
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.user_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_status_admin_select" ON public.user_status
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin() OR user_id = auth.uid());

CREATE POLICY "user_status_admin_all" ON public.user_status
  FOR ALL TO authenticated
  USING (is_current_user_super_admin());

-- ============================================================================
-- SUPER ADMIN OVERRIDE POLICIES
-- ============================================================================

-- Pixels: super admin full access
CREATE POLICY "pixels_admin_all" ON public.pixels
  FOR ALL TO authenticated
  USING (is_current_user_super_admin())
  WITH CHECK (is_current_user_super_admin());

-- Profiles: super admin can view all
CREATE POLICY "profiles_admin_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin());

-- Blog posts: admin full access
CREATE POLICY "posts_admin_all" ON public.blog_posts
  FOR ALL TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

-- Blog categories: admin full access
CREATE POLICY "categories_admin_all" ON public.blog_categories
  FOR ALL TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

-- Listings: admin can view all
CREATE POLICY "listings_admin_select" ON public.marketplace_listings
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin());

-- Transactions: admin can view all
CREATE POLICY "transactions_admin_select" ON public.marketplace_transactions
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin());

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.is_super_admin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_block_user(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unblock_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_all_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_pixel(INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_all_content() TO authenticated;

-- ============================================================================
-- END OF 005
-- ============================================================================
