-- ============================================================================
-- FIX PROFILE COUNTERS & ADMIN CLEAR
-- Resets orphaned profile stats and ensures admin_clear_all_content resets them
-- ============================================================================

-- 1. Create a function to recalculate profile stats based on actual data
CREATE OR REPLACE FUNCTION public.admin_recalculate_profiles()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_users_updated INTEGER;
BEGIN
  IF NOT is_current_user_super_admin() THEN
    -- Allow the migration runner to execute this, but protect via API
    IF current_user != 'postgres' AND current_user != 'supabase_admin' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;
  END IF;

  -- Recalculate pixel_count based on actual owned pixels
  -- Recalculate total_spent based on payment_orders + marketplace_transactions
  UPDATE public.profiles p
  SET 
    pixel_count = (
      SELECT COUNT(*) FROM public.pixels WHERE owner_id = p.user_id
    ),
    total_spent = (
      COALESCE((
        SELECT SUM(total_price) 
        FROM public.pixel_blocks 
        WHERE owner_id = p.user_id
      ), 0) +
      COALESCE((
        SELECT SUM(sale_price) 
        FROM public.marketplace_transactions 
        WHERE buyer_id = p.user_id AND status = 'completed'
      ), 0)
    );
    -- Note: pixel_blocks tracks the total price of grouped purchases
    -- Alternatively we can sum from payment_orders, but payment_orders stores amount in paise
    -- and we want consistent rupees. pixel_blocks + marketplace_transactions is the source of truth for assets acquired.

  GET DIAGNOSTICS v_users_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'users_updated', v_users_updated,
    'message', 'All profile stats have been synchronized with actual database state.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_recalculate_profiles() TO authenticated;

-- 2. Update admin_clear_all_content to reset profile stats
CREATE OR REPLACE FUNCTION public.admin_clear_all_content()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pixels INTEGER;
BEGIN
  IF NOT is_current_user_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- ========================================================================
  -- PHASE 1: DELETE DEPENDENT TABLES (Prevents FK violations)
  -- ========================================================================

  DELETE FROM public.marketplace_transactions WHERE true;
  DELETE FROM public.pixel_history WHERE true;
  DELETE FROM public.user_activity WHERE true;
  DELETE FROM public.admin_audit_log WHERE true;
  DELETE FROM public.user_achievements WHERE true;
  DELETE FROM public.user_notification_preferences WHERE true;
  DELETE FROM public.contact_messages WHERE true;
  DELETE FROM public.moderation_queue WHERE true;
  DELETE FROM public.marketplace_listings WHERE true;
  DELETE FROM public.pixel_blocks WHERE true;
  DELETE FROM public.announcements WHERE true;
  DELETE FROM public.blog_posts WHERE true;

  -- ========================================================================
  -- PHASE 2: BREAK CYCLES (Pixels <-> Payment Orders)
  -- ========================================================================

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
    is_active = true
  WHERE owner_id IS NOT NULL OR payment_order_id IS NOT NULL;
  
  GET DIAGNOSTICS v_pixels = ROW_COUNT;

  DELETE FROM public.payment_orders WHERE true;

  -- ========================================================================
  -- PHASE 3: RESET PROFILE STATS (Fix for orphaned stats)
  -- ========================================================================
  
  -- We don't delete profiles, but we MUST reset their denormalized stats
  UPDATE public.profiles SET
    pixel_count = 0,
    total_spent = 0;

  RETURN jsonb_build_object(
    'success', true,
    'pixels_reset', v_pixels,
    'users_deleted', 0,
    'message', 'All content cleared successfully and profile stats reset to 0.'
  );
END;
$$;

-- 3. Execute the recalculation immediately to fix the user's current data
DO $$
BEGIN
  -- We run it as postgres so it bypasses the super_admin check
  PERFORM public.admin_recalculate_profiles();
  RAISE NOTICE '✓ Profile counters successfully synchronized';
END $$;
