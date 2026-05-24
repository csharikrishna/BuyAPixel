-- ============================================================================
-- 042: FIX ADMIN FUNCTION PERMISSIONS
-- Migration 040 revoked EXECUTE from 'public' (which implicitly removed
-- access for 'authenticated' too), but never re-granted it.
-- The admin functions already have internal is_current_user_super_admin()
-- guards, so granting EXECUTE to authenticated is safe.
-- ============================================================================

-- Admin & management functions (all have internal super-admin checks)
GRANT EXECUTE ON FUNCTION public.admin_block_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_bulk_reset_area(integer, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_bulk_reset_pixels(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_all_content() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_all_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_audit_logs(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_marketplace_analytics(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_refund_history(integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_revenue_stats(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_promote_user(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_refund_marketplace_transaction(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_refund_payment_order(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_pixel(integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_moderation(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_admin(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unblock_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_completely(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.permanently_delete_user_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(text) TO authenticated;

-- Also grant the webhook/logging functions that may be called from authenticated context
GRANT EXECUTE ON FUNCTION public.log_webhook_event(text, text, jsonb) TO authenticated;
