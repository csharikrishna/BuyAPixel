-- ============================================================================
-- 019: FIX ADMIN RPC FUNCTIONS
-- BuyAPixel - Fix column name mismatches and DELETE clauses
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
-- Add WHERE true clauses to DELETE statements and remove all users except super admin
-- ============================================================================

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
  v_announcements INTEGER;
  v_users INTEGER;
  v_profiles INTEGER;
  v_transactions INTEGER;
  v_payment_orders INTEGER;
BEGIN
  IF NOT is_current_user_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Delete marketplace transactions (with WHERE clause)
  DELETE FROM public.marketplace_transactions WHERE true;
  GET DIAGNOSTICS v_transactions = ROW_COUNT;

  -- Delete marketplace listings (with WHERE clause)
  DELETE FROM public.marketplace_listings WHERE true;
  GET DIAGNOSTICS v_listings = ROW_COUNT;
  
  -- Delete pixel blocks (with WHERE clause)
  DELETE FROM public.pixel_blocks WHERE true;
  GET DIAGNOSTICS v_blocks = ROW_COUNT;

  -- Delete announcements (with WHERE clause)
  DELETE FROM public.announcements WHERE true;
  GET DIAGNOSTICS v_announcements = ROW_COUNT;

  -- Delete payment orders (with WHERE clause)
  DELETE FROM public.payment_orders WHERE true;
  GET DIAGNOSTICS v_payment_orders = ROW_COUNT;

  -- Reset all pixels
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
  WHERE owner_id IS NOT NULL;
  GET DIAGNOSTICS v_pixels = ROW_COUNT;

  -- Delete user statuses (except super admin)
  DELETE FROM public.user_status 
  WHERE user_id != (SELECT id FROM auth.users WHERE email = 'notbot4444@gmail.com');

  -- Delete profiles (except super admin) - this sets up for user deletion
  DELETE FROM public.profiles 
  WHERE user_id != (SELECT id FROM auth.users WHERE email = 'notbot4444@gmail.com');
  GET DIAGNOSTICS v_profiles = ROW_COUNT;

  -- Delete all users except super admin from auth.users
  DELETE FROM auth.users 
  WHERE email != 'notbot4444@gmail.com';
  GET DIAGNOSTICS v_users = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'pixels_reset', v_pixels,
    'blocks_deleted', v_blocks,
    'listings_deleted', v_listings,
    'announcements_deleted', v_announcements,
    'transactions_deleted', v_transactions,
    'payment_orders_deleted', v_payment_orders,
    'users_deleted', v_users,
    'profiles_deleted', v_profiles
  );
END;
$$;

-- ============================================================================
-- END OF 019
-- ============================================================================
