-- ============================================================================
-- 040: REVOKE DEFAULT PUBLIC ROLE EXECUTE
-- Fix for anon_security_definer_function_executable warnings
-- ============================================================================

-- In Postgres, functions in the 'public' schema are granted to the 'public' group role by default.
-- The previous security migrations revoked EXECUTE from 'anon', but forgot to revoke from 'public', 
-- which means 'anon' still implicitly inherited access!

-- 1. Admin & Destructive Functions (Only for service_role / explicit admins)
REVOKE EXECUTE ON FUNCTION public.admin_block_user(uuid, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_bulk_reset_area(integer, integer, integer, integer) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_bulk_reset_pixels(jsonb) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_clear_all_content() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_all_users() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_audit_logs(integer, integer) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_marketplace_analytics(integer) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_refund_history(integer, integer, integer) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_revenue_stats(integer) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_promote_user(text, boolean) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_refund_marketplace_transaction(uuid, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_refund_payment_order(uuid, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_remove_pixel(integer, integer, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_moderation(uuid, text, text, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_admin(uuid, boolean) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_unblock_user(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.delete_user_completely(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.permanently_delete_user_profile(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, text, text, jsonb) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(text) FROM public, anon;

-- 2. Maintenance & Internal Functions (Only for triggers / service_role)
REVOKE EXECUTE ON FUNCTION public.expire_old_listings() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.expire_old_payment_orders() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_soft_deleted_profiles() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.refresh_materialized_views() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.log_pixel_change() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.update_profile_counters() FROM public, anon;

-- 3. User Actions (Only for authenticated users)
REVOKE EXECUTE ON FUNCTION public.complete_marketplace_purchase(uuid, text, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.complete_pixel_purchase(uuid, text, text, text, text, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.complete_pixel_purchase(uuid, text, text, text, text, text, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.create_listing(uuid, numeric) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.create_payment_order(text, integer, text, jsonb) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.list_pixel_for_sale(uuid, numeric) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.purchase_from_marketplace(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.purchase_from_marketplace_verified(uuid, text, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.mark_payment_failed(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_profile_deletion() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.request_profile_deletion() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.report_content(text, uuid, text, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.log_activity(uuid, text, text, text, text, uuid, boolean) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.log_event(text, text, uuid, jsonb) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.log_webhook_event(text, text, jsonb) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.check_achievements(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.check_and_record_rate_limit(uuid, text, integer, integer) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.get_payment_reconciliation_status(integer) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_current_user_admin() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_current_user_super_admin() FROM public, anon;

-- Explicitly grant execute to authenticated for the user actions
GRANT EXECUTE ON FUNCTION public.complete_marketplace_purchase(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_pixel_purchase(uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_pixel_purchase(uuid, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_listing(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_payment_order(text, integer, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_pixel_for_sale(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_from_marketplace(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_from_marketplace_verified(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_payment_failed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_profile_deletion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_profile_deletion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_content(text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_activity(uuid, text, text, text, text, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_event(text, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_achievements(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_record_rate_limit(uuid, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_reconciliation_status(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_super_admin() TO authenticated;
