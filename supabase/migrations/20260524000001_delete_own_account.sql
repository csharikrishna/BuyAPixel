-- Self-service account deletion for authenticated users
-- This function allows a user to delete their own account
-- It properly cascades: resets pixels, deletes profile, deletes auth record

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_pixels_reset integer;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- 1. Reset all pixels owned by this user (make them available again)
  UPDATE public.pixels SET
    owner_id = NULL,
    block_id = NULL,
    image_url = NULL,
    link_url = NULL,
    alt_text = NULL,
    price_paid = NULL,
    purchased_at = NULL,
    payment_order_id = NULL,
    is_active = true
  WHERE owner_id = v_user_id;
  
  GET DIAGNOSTICS v_pixels_reset = ROW_COUNT;

  -- 2. Delete dependent records
  DELETE FROM public.marketplace_listings WHERE seller_id = v_user_id;
  DELETE FROM public.user_status WHERE user_id = v_user_id;
  DELETE FROM public.user_achievements WHERE user_id = v_user_id;
  DELETE FROM public.user_notification_preferences WHERE user_id = v_user_id;
  DELETE FROM public.user_activity WHERE user_id = v_user_id;

  -- 3. Delete profile (must happen before auth.users due to FK)
  DELETE FROM public.profiles WHERE user_id = v_user_id;

  -- 4. Delete auth record (this is the final, irreversible step)
  DELETE FROM auth.users WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'pixels_reset', v_pixels_reset,
    'message', 'Account deleted successfully'
  );
END;
$$;

-- Grant execute to authenticated users (they can only delete themselves via auth.uid())
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
