-- ============================================================================
-- 019: ADMIN RPC FIXES
-- BuyAPixel - Consolidated fixes for admin RPC functions
-- Includes: Marketplace analytics, Clear All Content with proper FK order
-- ============================================================================

-- ============================================================================
-- FIX admin_get_marketplace_analytics
-- Uses correct column names: sale_price instead of amount, featured instead of is_featured
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
    'total_revenue', COALESCE((SELECT SUM(sale_price) FROM marketplace_transactions WHERE status = 'completed' AND created_at >= v_start_date), 0),
    'total_refunds', COALESCE((SELECT SUM(sale_price) FROM marketplace_transactions WHERE status = 'refunded' AND created_at >= v_start_date), 0),
    'platform_fees', COALESCE((SELECT SUM(platform_fee) FROM marketplace_transactions WHERE status = 'completed' AND created_at >= v_start_date), 0),
    'active_listings', (SELECT COUNT(*) FROM marketplace_listings WHERE status = 'active'),
    'featured_listings', (SELECT COUNT(*) FROM marketplace_listings WHERE status = 'active' AND featured = true),
    'top_sellers', (
      SELECT COALESCE(jsonb_agg(seller_stats), '[]'::jsonb)
      FROM (
        SELECT 
          seller_id,
          COUNT(*) as sales,
          SUM(sale_price) as earned,
          SUM(seller_net) as net_earned
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
-- FIX admin_clear_all_content
-- Comprehensive cleanup with correct FK deletion order
-- Deletes: transactions, history, activity, achievements, moderation, content, pixels, users
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_clear_all_content()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pixels INTEGER;
  v_users INTEGER;
BEGIN
  IF NOT is_current_user_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- ========================================================================
  -- PHASE 1: DELETE DEPENDENT TABLES (Prevents FK violations)
  -- Order: Most dependent first (leaf nodes)
  -- ========================================================================

  -- 1.1 Marketplace & Transactions
  DELETE FROM public.marketplace_transactions WHERE true;
  
  -- 1.2 Activity & History (These caused 409 errors before)
  DELETE FROM public.pixel_history WHERE true;
  DELETE FROM public.user_activity WHERE true;
  DELETE FROM public.admin_audit_log WHERE true;

  -- 1.3 User Engagements
  DELETE FROM public.user_achievements WHERE true;
  DELETE FROM public.user_notification_preferences WHERE true;
  DELETE FROM public.contact_messages WHERE true;
  
  -- 1.4 Moderation
  DELETE FROM public.moderation_queue WHERE true;

  -- 1.5 Content
  DELETE FROM public.marketplace_listings WHERE true;
  DELETE FROM public.pixel_blocks WHERE true;
  DELETE FROM public.announcements WHERE true;
  DELETE FROM public.blog_posts WHERE true; -- Cascades to blog_post_categories

  -- ========================================================================
  -- PHASE 2: BREAK CYCLES (Pixels <-> Payment Orders)
  -- ========================================================================

  -- 2.1 Reset Pixels (Removes references to Owners and Payment Orders)
  UPDATE public.pixels SET
    owner_id = NULL,
    block_id = NULL,
    image_url = NULL,
    link_url = NULL,
    alt_text = NULL,
    price_paid = NULL,
    purchased_at = NULL,
    payment_order_id = NULL,
    times_resold = 0,
    last_sale_price = NULL,
    last_sale_date = NULL,
    view_count = 0,
    is_active = true
  WHERE owner_id IS NOT NULL OR payment_order_id IS NOT NULL;
  
  GET DIAGNOSTICS v_pixels = ROW_COUNT;

  -- 2.2 Payment Orders (Now safe to delete)
  DELETE FROM public.payment_orders WHERE true;

  -- ========================================================================
  -- PHASE 3: USERS & PROFILES (Except Super Admin)
  -- ========================================================================

  -- 3.1 User Status
  DELETE FROM public.user_status 
  WHERE user_id != (SELECT id FROM auth.users WHERE email = 'notbot4444@gmail.com');

  -- 3.2 Profiles
  DELETE FROM public.profiles 
  WHERE user_id != (SELECT id FROM auth.users WHERE email = 'notbot4444@gmail.com');

  -- 3.3 Auth Users
  DELETE FROM auth.users 
  WHERE email != 'notbot4444@gmail.com';
  
  GET DIAGNOSTICS v_users = ROW_COUNT;

  -- ========================================================================
  -- RETURN SUMMARY
  -- ========================================================================
  
  RETURN jsonb_build_object(
    'success', true,
    'pixels_reset', v_pixels,
    'users_deleted', v_users,
    'message', 'All content cleared successfully.'
  );
END;
$$;

-- ============================================================================
-- END OF 019
-- ============================================================================
