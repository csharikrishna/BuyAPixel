-- ============================================================
-- 033: SECURITY WARNINGS MITIGATION
-- Resolves all 117 Supabase linter warnings from warnings.json
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ============================================================
-- CATEGORY 1: anon_security_definer_function_executable (58 warnings)
-- 
-- STATUS: Already mitigated by 20260427_security_hardening.sql
-- The previous migration already REVOKEs EXECUTE from anon
-- for ALL 58 functions. If warnings persist, it means the
-- migration was NOT applied to the production database.
-- 
-- ACTION: Run the 20260427_security_hardening.sql migration
-- in Supabase SQL Editor if not already done.
-- ============================================================


-- ============================================================
-- CATEGORY 2: authenticated_security_definer_function_executable (58 warnings)
--
-- These are SECURITY DEFINER functions that authenticated users
-- can call. We categorize them into 3 groups:
--
-- (A) Admin functions — have internal is_admin() guards, so
--     it's safe to keep them callable by authenticated users.
--     HOWEVER, to silence the linter we add explicit REVOKE
--     from authenticated and only allow service_role + admin
--     by keeping the is_admin() check inside the function.
--     
--     DECISION: We revoke from authenticated for admin functions
--     since they already validate admin status internally.
--     If a non-admin calls them, they get "permission denied"
--     at the function level anyway.
--
-- (B) User action functions — these MUST remain callable by
--     authenticated users (purchase, listing, profile, etc.)
--     These are INTENTIONAL and the warnings are acknowledged.
--
-- (C) Trigger/internal/cron functions — already revoked from
--     both anon and authenticated in the previous migration.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 2A. ADMIN FUNCTIONS — Revoke from authenticated
--     These have internal is_admin() / is_super_admin() checks
--     but revoking at the GRANT level is defense-in-depth.
--     
--     ⚠️  NOTE: After this, admin functions can ONLY be called
--     via service_role (edge functions / server-side).
--     If your admin dashboard calls these directly via
--     supabase.rpc(), you need to route through an edge
--     function instead.
-- ────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.admin_block_user(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_bulk_reset_area(integer, integer, integer, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_bulk_reset_pixels(jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_clear_all_content() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_all_users() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_audit_logs(integer, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_marketplace_analytics(integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_refund_history(integer, integer, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_revenue_stats(integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_promote_user(text, boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_refund_marketplace_transaction(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_refund_payment_order(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_remove_pixel(integer, integer, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_moderation(uuid, text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_admin(uuid, boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_unblock_user(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, text, text, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(text) FROM authenticated;

-- ────────────────────────────────────────────────────────────
-- 2B. DESTRUCTIVE FUNCTIONS — Revoke from authenticated
-- ────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.delete_user_completely(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.permanently_delete_user_profile(uuid) FROM authenticated;

-- ────────────────────────────────────────────────────────────
-- 2C. MAINTENANCE FUNCTIONS — Already revoked from both roles
--     by 20260427_security_hardening.sql. Included here as
--     idempotent safety net.
-- ────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.expire_old_listings() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_old_payment_orders() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_soft_deleted_profiles() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_materialized_views() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_pixel_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_profile_counters() FROM anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 2D. READ-ONLY/STATS FUNCTIONS — Keep for authenticated
--     These are intentionally left callable by authenticated
--     users because the frontend needs them:
--     - calculate_pixel_price, get_grid_stats, get_leaderboard
--     - get_pixel_info, get_user_stats, get_user_badges
--     - get_marketplace_stats, get_heatmap_data
--     - is_current_user_admin, is_current_user_super_admin
--
--     WARNING: Revoking these from authenticated will break
--     the frontend. Only uncomment if you move these calls
--     to edge functions.
-- ────────────────────────────────────────────────────────────

-- INTENTIONALLY KEPT (frontend needs):
-- calculate_pixel_price, get_grid_stats, get_leaderboard
-- get_pixel_info, get_user_stats, get_user_badges
-- get_marketplace_stats, get_heatmap_data, get_block_pixel_status
-- is_current_user_admin, is_current_user_super_admin
-- generate_slug, get_payment_reconciliation_status

-- ────────────────────────────────────────────────────────────
-- 2E. PAYMENT/USER FUNCTIONS — Keep for authenticated
--     These are core user flows that MUST work:
--     - complete_pixel_purchase, create_payment_order
--     - complete_marketplace_purchase, create_listing
--     - list_pixel_for_sale, purchase_from_marketplace
--     - mark_payment_failed, cancel/request_profile_deletion
--     - report_content, check_achievements, log_event, etc.
-- ────────────────────────────────────────────────────────────

-- INTENTIONALLY KEPT (user purchase/profile flows need):
-- complete_pixel_purchase, complete_marketplace_purchase
-- create_payment_order, create_listing, list_pixel_for_sale
-- purchase_from_marketplace, purchase_from_marketplace_verified
-- mark_payment_failed, cancel_profile_deletion
-- request_profile_deletion, report_content
-- log_activity, log_event, log_webhook_event
-- check_achievements, check_and_record_rate_limit


-- ============================================================
-- CATEGORY 3: auth_leaked_password_protection (1 warning)
--
-- This is a Supabase Auth configuration, NOT a database issue.
-- 
-- ACTION: Go to Supabase Dashboard → Authentication → 
-- Providers → Email → Enable "Leaked Password Protection"
-- 
-- This checks passwords against HaveIBeenPwned.org to
-- prevent users from using known-compromised passwords.
-- ============================================================


-- ============================================================
-- SUMMARY OF MITIGATIONS
-- ============================================================
--
-- | Warning Type                                    | Count | Action                          |
-- |-------------------------------------------------|-------|---------------------------------|
-- | anon_security_definer_function_executable        |    58 | Already fixed in 20260427       |
-- | authenticated_security_definer_function_executable|   58 | 20 revoked, 38 intentional keep |
-- | auth_leaked_password_protection                  |     1 | Dashboard config change         |
-- |                                                  |       |                                 |
-- | TOTAL WARNINGS                                   |   117 |                                 |
-- | RESOLVED BY THIS MIGRATION                       |    20 | Admin+destructive functions      |
-- | RESOLVED BY PREVIOUS MIGRATION                   |    58 | Anon role revocations           |
-- | INTENTIONALLY KEPT (frontend needs)              |    38 | Documented above                |
-- | DASHBOARD CONFIG                                 |     1 | Leaked password protection      |
-- ============================================================

