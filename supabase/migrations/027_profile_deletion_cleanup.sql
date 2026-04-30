-- ============================================================================
-- 027: PROFILE DELETION CLEANUP JOB
-- BuyASpot - GDPR-compliant profile deletion with data cleanup
-- ============================================================================

-- ============================================================================
-- FUNCTION: Delete User Profile Permanently
-- Handles cascading deletion and data cleanup for GDPR
-- ============================================================================

CREATE OR REPLACE FUNCTION public.permanently_delete_user_profile(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pixel_count INTEGER;
  v_deleted_count INTEGER;
BEGIN
  -- Security: only allow deletion of user's own profile or by admin
  IF auth.uid() != p_user_id AND NOT is_current_user_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Step 1: Count pixels to be orphaned
  SELECT COUNT(*) INTO v_pixel_count
  FROM pixels WHERE owner_id = p_user_id;

  -- Step 2: Orphan/Release all pixels by removing owner
  UPDATE pixels
  SET owner_id = NULL, block_id = NULL, updated_at = NOW()
  WHERE owner_id = p_user_id;

  -- Step 3: Remove pixel blocks
  DELETE FROM pixel_blocks WHERE owner_id = p_user_id;

  -- Step 4: Remove marketplace listings
  DELETE FROM marketplace_listings
  WHERE seller_id = p_user_id;

  -- Step 5: Remove marketplace transactions
  DELETE FROM marketplace_transactions
  WHERE buyer_id = p_user_id OR seller_id = p_user_id;

  -- Step 6: Remove announcements by this user (if any)
  DELETE FROM announcements WHERE created_by = p_user_id;

  -- Step 7: Remove contact messages from this user
  DELETE FROM contact_messages WHERE user_id = p_user_id;

  -- Step 8: Clear user status (blocks, warnings)
  DELETE FROM user_status WHERE user_id = p_user_id;

  -- Step 9: Clear payment orders
  DELETE FROM payment_orders WHERE user_id = p_user_id;

  -- Step 10: Clear profile data
  DELETE FROM profiles WHERE user_id = p_user_id;

  -- Step 11: Update leaderboard materialized view (will auto-refresh on cron)
  -- Deleted user's scores will no longer appear

  -- Log the deletion
  PERFORM log_event('profile_permanently_deleted', 'user', p_user_id::text,
    jsonb_build_object('pixels_orphaned', v_pixel_count));

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Profile permanently deleted',
    'pixels_orphaned', v_pixel_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.permanently_delete_user_profile(UUID) TO authenticated;

-- ============================================================================
-- FUNCTION: Cleanup Soft-Deleted Profiles
-- Called by cron job to clean up profiles marked as deleted
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_soft_deleted_profiles()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_deleted_count INTEGER := 0;
  v_cursor CURSOR FOR
    SELECT user_id FROM profiles
    WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days'; -- Grace period of 30 days
BEGIN
  -- Process each soft-deleted profile
  OPEN v_cursor;
  LOOP
    FETCH v_cursor INTO v_user_id;
    EXIT WHEN v_user_id IS NULL;

    -- Permanently delete the profile
    PERFORM permanently_delete_user_profile(v_user_id);
    v_deleted_count := v_deleted_count + 1;
  END LOOP;
  CLOSE v_cursor;

  -- Log the cleanup operation
  PERFORM log_event('cleanup_job_completed', 'system',
    'profile_deletion_cleanup',
    jsonb_build_object('profiles_deleted', v_deleted_count)
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Cleanup completed',
    'profiles_permanently_deleted', v_deleted_count
  );
END;
$$;

-- ============================================================================
-- FUNCTION: Request Profile Deletion
-- User can request their profile to be deleted (soft delete)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.request_profile_deletion()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Soft delete: mark as deleted but keep data for 30 days
  UPDATE profiles
  SET deleted_at = NOW()
  WHERE user_id = auth.uid();

  -- Get user email for notification
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  -- Log the deletion request
  PERFORM log_event('profile_deletion_requested', 'user', auth.uid()::text,
    jsonb_build_object('email', v_email));

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Profile marked for deletion. You have 30 days to cancel.',
    'grace_period_days', 30
  );
END;
$$;

-- ============================================================================
-- FUNCTION: Cancel Profile Deletion
-- User can cancel deletion request within grace period
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cancel_profile_deletion()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check if deletion was requested recently
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND deleted_at IS NOT NULL
    AND deleted_at > NOW() - INTERVAL '30 days'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active deletion request found');
  END IF;

  -- Restore deleted_at
  UPDATE profiles
  SET deleted_at = NULL
  WHERE user_id = auth.uid();

  -- Log the cancellation
  PERFORM log_event('profile_deletion_cancelled', 'user', auth.uid()::text);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Profile deletion cancelled'
  );
END;
$$;

-- ============================================================================
-- CRON SETUP
-- Schedule profile cleanup to run daily at 2 AM UTC
-- ============================================================================

-- Ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-soft-deleted-profiles');
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore error if job doesn't exist
END $$;

-- Create new cron job
SELECT cron.schedule(
  'cleanup-soft-deleted-profiles',
  '0 2 * * *', -- 2 AM UTC daily
  'SELECT public.cleanup_soft_deleted_profiles();'
);

-- ============================================================================
-- END OF 027
-- ============================================================================
