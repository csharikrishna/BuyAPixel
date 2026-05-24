-- Fix admin_clear_all_content to NOT delete user accounts
-- This aligns with the frontend promise: "User accounts and profiles remain intact."

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
  -- Order: Most dependent first (leaf nodes)
  -- ========================================================================

  -- 1.1 Marketplace & Transactions
  DELETE FROM public.marketplace_transactions WHERE true;
  
  -- 1.2 Activity & History
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
  DELETE FROM public.blog_posts WHERE true;

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

  -- PHASE 3 (Users & Profiles) intentionally removed to preserve accounts

  -- ========================================================================
  -- RETURN SUMMARY
  -- ========================================================================
  
  RETURN jsonb_build_object(
    'success', true,
    'pixels_reset', v_pixels,
    'users_deleted', 0,
    'message', 'All content cleared successfully while keeping users intact.'
  );
END;
$$;
