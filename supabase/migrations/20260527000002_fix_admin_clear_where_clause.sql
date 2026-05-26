-- ============================================================================
-- FIX: admin_clear_all_content UPDATE requires WHERE clause
-- pgBouncer in transaction mode rejects UPDATE without WHERE
-- ============================================================================

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
  -- WHERE true is required because pgBouncer rejects UPDATE without WHERE
  UPDATE public.profiles SET
    pixel_count = 0,
    total_spent = 0
  WHERE true;

  RETURN jsonb_build_object(
    'success', true,
    'pixels_reset', v_pixels,
    'users_deleted', 0,
    'message', 'All content cleared successfully and profile stats reset to 0.'
  );
END;
$$;
