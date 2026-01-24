-- ============================================================================
-- 016: ADMIN EXTRAS
-- BuyAPixel - Admin Audit Logs, Analytics & User Management
-- ============================================================================

-- ============================================================================
-- ADMIN AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_admin_select" ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin());

CREATE POLICY "audit_log_admin_insert" ON public.admin_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (is_current_user_super_admin());

-- ============================================================================
-- ADMIN ANALYTICS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_marketplace_analytics(p_days INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  IF NOT is_current_user_super_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  v_start_date := NOW() - (p_days || ' days')::INTERVAL;

  SELECT jsonb_build_object(
    'total_revenue', COALESCE((SELECT SUM(amount) FROM marketplace_transactions WHERE status = 'completed' AND created_at >= v_start_date), 0),
    'total_refunds', COALESCE((SELECT SUM(amount) FROM marketplace_transactions WHERE status = 'refunded' AND created_at >= v_start_date), 0),
    'active_listings', (SELECT COUNT(*) FROM marketplace_listings WHERE status = 'active'),
    'featured_listings', (SELECT COUNT(*) FROM marketplace_listings WHERE status = 'active' AND is_featured = true),
    'top_sellers', (
      SELECT COALESCE(jsonb_agg(seller_stats), '[]'::jsonb)
      FROM (
        SELECT 
          seller_id,
          COUNT(*) as sales,
          SUM(amount) as earned
        FROM marketplace_transactions
        WHERE status = 'completed' AND created_at >= v_start_date
        GROUP BY seller_id
        ORDER BY earned DESC
        LIMIT 5
      ) seller_stats
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- DELETE USER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_user_completely(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_current_user_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- 1. Delete basic content (cascade should handle most, but being explicit is safer)
  DELETE FROM public.blog_posts WHERE author_id = target_user_id;
  DELETE FROM public.marketplace_listings WHERE seller_id = target_user_id;
  DELETE FROM public.user_status WHERE user_id = target_user_id;
  
  -- 2. Reset pixels owned by user
  UPDATE public.pixels 
  SET 
    owner_id = NULL,
    block_id = NULL,
    image_url = NULL, 
    link_url = NULL,
    alt_text = NULL,
    price_paid = NULL,
    purchased_at = NULL,
    is_active = true
  WHERE owner_id = target_user_id;

  -- 3. Delete from auth.users (this will cascade to profiles)
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- ADMIN PROMOTE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_promote_user(
  target_email TEXT,
  make_admin BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT is_current_user_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Find user by email
  SELECT id INTO v_user_id FROM auth.users WHERE email = target_email;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Update profile
  UPDATE public.profiles
  SET is_admin = make_admin
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'is_admin', make_admin);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_marketplace_analytics(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_completely(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_promote_user(TEXT, BOOLEAN) TO authenticated;

