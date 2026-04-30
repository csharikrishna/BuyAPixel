-- ============================================================
-- SECURITY HARDENING MIGRATION
-- Fixes all Supabase Linter warnings from production audit
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ============================================================
-- 1. FIX: Function Search Path Mutable
--    Pin search_path to prevent search-path hijacking attacks
-- ============================================================

ALTER FUNCTION public.update_orphaned_orders_updated_at()
  SET search_path = '';


-- ============================================================
-- 2. FIX: RLS Policy Always True (INSERT with true)
--    Restrict admin_audit_log and event_log inserts to
--    authenticated users only (not anonymous)
-- ============================================================

-- admin_audit_log: only authenticated users (admin functions) should insert
DROP POLICY IF EXISTS "admin_audit_insert" ON public.admin_audit_log;
CREATE POLICY "admin_audit_insert" ON public.admin_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- event_log: only authenticated users should insert events
DROP POLICY IF EXISTS "event_log_insert" ON public.event_log;
CREATE POLICY "event_log_insert" ON public.event_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);


-- ============================================================
-- 3. FIX: Public Bucket Allows Listing
--    Remove broad SELECT policies that let anyone enumerate
--    all files in public buckets. Public buckets already serve
--    files via direct URL — listing is unnecessary and leaks
--    file paths.
-- ============================================================

DROP POLICY IF EXISTS "avatars_public_select" ON storage.objects;
DROP POLICY IF EXISTS "blog_images_public_select" ON storage.objects;
DROP POLICY IF EXISTS "pixel_images_public_select" ON storage.objects;


-- ============================================================
-- 4. FIX: CRITICAL — Revoke EXECUTE from anon role
--    These functions are SECURITY DEFINER and currently callable
--    by unauthenticated users via /rest/v1/rpc/<function_name>
--
--    Categorized by risk level:
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 4a. ADMIN FUNCTIONS — Revoke from anon (keep authenticated
--     because they have internal is_admin() checks)
-- ────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.admin_block_user(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_bulk_reset_area(integer, integer, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_bulk_reset_pixels(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_clear_all_content() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_all_users() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_audit_logs(integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_marketplace_analytics(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_refund_history(integer, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_revenue_stats(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_promote_user(text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_refund_marketplace_transaction(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_refund_payment_order(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_remove_pixel(integer, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_moderation(uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_admin(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_unblock_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(text) FROM anon;

-- ────────────────────────────────────────────────────────────
-- 4b. DESTRUCTIVE / SENSITIVE FUNCTIONS — Revoke from anon
-- ────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.delete_user_completely(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.permanently_delete_user_profile(uuid) FROM anon;

-- ────────────────────────────────────────────────────────────
-- 4c. TRIGGER / INTERNAL FUNCTIONS — Revoke from BOTH anon
--     AND authenticated. These are only called by DB triggers,
--     never by users directly via the API.
-- ────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_pixel_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_profile_counters() FROM anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 4d. MAINTENANCE / CRON FUNCTIONS — Revoke from BOTH anon
--     AND authenticated. Only service_role should run these.
-- ────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.expire_old_listings() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_old_payment_orders() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_soft_deleted_profiles() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_materialized_views() FROM anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 4e. USER ACTION FUNCTIONS — Revoke from anon only
--     (authenticated users need these for the purchase flow)
-- ────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.complete_marketplace_purchase(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_pixel_purchase(uuid, text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_pixel_purchase(uuid, text, text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_listing(uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_payment_order(text, integer, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_pixel_for_sale(uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.purchase_from_marketplace(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.purchase_from_marketplace_verified(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_payment_failed(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_profile_deletion() FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_profile_deletion() FROM anon;
REVOKE EXECUTE ON FUNCTION public.report_content(text, uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_activity(uuid, text, text, text, text, uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_event(text, text, uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_webhook_event(text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_achievements(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_and_record_rate_limit(uuid, text, integer, integer) FROM anon;

-- ────────────────────────────────────────────────────────────
-- 4f. PUBLIC READ FUNCTIONS — Revoke from anon
--     These return stats/leaderboard data. If you want them
--     visible to non-logged-in users, comment these out.
--     For now we keep them authenticated-only for safety.
-- ────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.calculate_pixel_price(integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_block_pixel_status(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_grid_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_heatmap_data() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_leaderboard(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_marketplace_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_payment_reconciliation_status(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_pixel_info(integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_badges(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_stats(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_current_user_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_current_user_super_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_slug(text) FROM anon;


-- ============================================================
-- 5. VERIFICATION QUERY
--    Run this after applying the migration to confirm fixes.
--    Should return 0 rows for anon-callable admin functions.
-- ============================================================

-- SELECT p.proname AS function_name
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
--   AND p.proname LIKE 'admin_%'
--   AND has_function_privilege('anon', p.oid, 'EXECUTE');
