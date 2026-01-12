-- ============================================================================
-- Clear Database Content Function
-- Admin operation to reset all user content in the database
-- Requires: Admin authentication (hardcoded email check)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_clear_all_content()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_admin_email TEXT;
  v_pixels_reset INTEGER := 0;
  v_listings_deleted INTEGER := 0;
  v_announcements_deleted INTEGER := 0;
BEGIN
  -- Get authenticated user
  v_admin_id := auth.uid();
  
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get admin email from auth.users
  SELECT email INTO v_admin_email
  FROM auth.users
  WHERE id = v_admin_id;

  -- Verify caller is the super admin (matching useIsAdmin.ts)
  IF v_admin_email != 'notbot4444@gmail.com' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin access required');
  END IF;

  -- Step 1: Reset all pixel ownership and content
  UPDATE public.pixels
  SET 
    owner_id = NULL,
    image_url = NULL,
    link_url = NULL,
    alt_text = NULL,
    purchased_at = NULL,
    price_paid = NULL
  WHERE owner_id IS NOT NULL;
  
  GET DIAGNOSTICS v_pixels_reset = ROW_COUNT;

  -- Step 2: Delete all marketplace listings
  DELETE FROM public.marketplace_listings;
  GET DIAGNOSTICS v_listings_deleted = ROW_COUNT;

  -- Step 3: Delete all announcements
  DELETE FROM public.announcements;
  GET DIAGNOSTICS v_announcements_deleted = ROW_COUNT;

  -- Step 4: Log the action to audit log (if table exists)
  BEGIN
    INSERT INTO public.admin_audit_log (
      admin_email,
      action,
      target_type,
      target_id,
      details,
      created_at
    ) VALUES (
      v_admin_email,
      'CLEAR_DATABASE',
      'system',
      'all',
      jsonb_build_object(
        'pixels_reset', v_pixels_reset,
        'listings_deleted', v_listings_deleted,
        'announcements_deleted', v_announcements_deleted,
        'timestamp', now()
      ),
      now()
    );
  EXCEPTION WHEN undefined_table THEN
    -- Audit log table doesn't exist, continue silently
    NULL;
  END;

  -- Return success response with stats
  RETURN jsonb_build_object(
    'success', true,
    'pixels_reset', v_pixels_reset,
    'listings_deleted', v_listings_deleted,
    'announcements_deleted', v_announcements_deleted,
    'admin_email', v_admin_email
  );

EXCEPTION WHEN OTHERS THEN
  -- Return error details
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Grant execute permission to authenticated users (function itself checks for admin)
GRANT EXECUTE ON FUNCTION public.admin_clear_all_content() TO authenticated;

COMMENT ON FUNCTION public.admin_clear_all_content IS 
  'Admin-only function to clear all user content from the database. Resets pixel ownership, deletes marketplace listings and announcements. Logs action to audit log.';
