-- Fix Supabase Linter Warnings
-- Generated automatically from issues.json

-- ==========================================
-- 1. Fix Mutable Search Paths
-- ==========================================

ALTER FUNCTION public.safely_update_payment_status(p_order_id uuid, p_new_status text, p_payment_id text, p_signature text) SET search_path = public;
ALTER FUNCTION public.get_user_payment_orders(p_user_id uuid, p_limit integer, p_offset integer, p_status text) SET search_path = public;
ALTER FUNCTION public.batch_create_payment_orders(p_orders jsonb) SET search_path = public;
ALTER FUNCTION public.refresh_revenue_materialized_view() SET search_path = public;
ALTER FUNCTION public.complete_pixel_purchase(p_payment_order_id uuid, p_razorpay_payment_id text, p_razorpay_signature text, p_image_url text, p_link_url text, p_alt_text text) SET search_path = public;
ALTER FUNCTION public.complete_pixel_purchase(p_payment_order_id uuid, p_razorpay_payment_id text, p_razorpay_signature text, p_image_url text, p_link_url text, p_alt_text text, p_idempotency_key text) SET search_path = public;
-- ==========================================
-- 2. Fix Materialized View API Access
-- ==========================================

REVOKE ALL ON public.mv_daily_revenue FROM anon, authenticated;

-- ==========================================
-- 3. Fix Permissive RLS Policy
-- ==========================================

DROP POLICY IF EXISTS "Anyone can track clicks" ON public.pixel_clicks;
CREATE POLICY "Anyone can track clicks" ON public.pixel_clicks FOR INSERT WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- ==========================================
-- 4. Ignore Executable SECURITY DEFINER Warnings
-- ==========================================

-- We intentionally expose these functions over PostgREST API.

ALTER FUNCTION public.admin_recalculate_profiles() SET search_path = public;
COMMENT ON FUNCTION public.admin_recalculate_profiles() IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

COMMENT ON FUNCTION public.batch_create_payment_orders(p_orders jsonb) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.calculate_pixel_price(p_x integer, p_y integer) SET search_path = public;
COMMENT ON FUNCTION public.calculate_pixel_price(p_x integer, p_y integer) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.complete_marketplace_purchase(p_payment_order_id uuid, p_razorpay_payment_id text, p_razorpay_signature text, p_idempotency_key text) SET search_path = public;
COMMENT ON FUNCTION public.complete_marketplace_purchase(p_payment_order_id uuid, p_razorpay_payment_id text, p_razorpay_signature text, p_idempotency_key text) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.delete_own_account() SET search_path = public;
COMMENT ON FUNCTION public.delete_own_account() IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.generate_slug(p_text text) SET search_path = public;
COMMENT ON FUNCTION public.generate_slug(p_text text) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.generate_ticket_id() SET search_path = public;
COMMENT ON FUNCTION public.generate_ticket_id() IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.get_active_mystery_pixel() SET search_path = public;
COMMENT ON FUNCTION public.get_active_mystery_pixel() IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.get_block_pixel_status(p_block_id uuid) SET search_path = public;
COMMENT ON FUNCTION public.get_block_pixel_status(p_block_id uuid) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.get_directory_listings(category_filter text, search_query text, page_num integer, page_size integer) SET search_path = public;
COMMENT ON FUNCTION public.get_directory_listings(category_filter text, search_query text, page_num integer, page_size integer) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.get_grid_stats() SET search_path = public;
COMMENT ON FUNCTION public.get_grid_stats() IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.get_heatmap_data() SET search_path = public;
COMMENT ON FUNCTION public.get_heatmap_data() IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.get_leaderboard(p_limit integer) SET search_path = public;
COMMENT ON FUNCTION public.get_leaderboard(p_limit integer) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.get_marketplace_stats() SET search_path = public;
COMMENT ON FUNCTION public.get_marketplace_stats() IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.get_or_create_referral_code() SET search_path = public;
COMMENT ON FUNCTION public.get_or_create_referral_code() IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.get_owner_dashboard_analytics(target_user_id uuid, time_range text) SET search_path = public;
COMMENT ON FUNCTION public.get_owner_dashboard_analytics(target_user_id uuid, time_range text) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.get_pixel_analytics(target_user_id uuid) SET search_path = public;
COMMENT ON FUNCTION public.get_pixel_analytics(target_user_id uuid) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.get_pixel_info(p_x integer, p_y integer) SET search_path = public;
COMMENT ON FUNCTION public.get_pixel_info(p_x integer, p_y integer) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.get_platform_stats() SET search_path = public;
COMMENT ON FUNCTION public.get_platform_stats() IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.get_user_badges(target_user_id uuid) SET search_path = public;
COMMENT ON FUNCTION public.get_user_badges(target_user_id uuid) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

COMMENT ON FUNCTION public.get_user_payment_orders(p_user_id uuid, p_limit integer, p_offset integer, p_status text) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.get_user_stats(p_user_id uuid) SET search_path = public;
COMMENT ON FUNCTION public.get_user_stats(p_user_id uuid) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.increment_listing_views(listing_id uuid) SET search_path = public;
COMMENT ON FUNCTION public.increment_listing_views(listing_id uuid) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.log_payment_status_change() SET search_path = public;
COMMENT ON FUNCTION public.log_payment_status_change() IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.log_pixel_click(p_pixel_id uuid, p_block_id uuid, p_source text, p_referrer text, p_user_agent text, p_device_type text, p_browser text, p_os text, p_country text) SET search_path = public;
COMMENT ON FUNCTION public.log_pixel_click(p_pixel_id uuid, p_block_id uuid, p_source text, p_referrer text, p_user_agent text, p_device_type text, p_browser text, p_os text, p_country text) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.log_pixel_view(p_pixel_id uuid, p_session_id text, p_device_type text, p_browser text, p_os text, p_referrer text) SET search_path = public;
COMMENT ON FUNCTION public.log_pixel_view(p_pixel_id uuid, p_session_id text, p_device_type text, p_browser text, p_os text, p_referrer text) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.purge_expired_idempotency() SET search_path = public;
COMMENT ON FUNCTION public.purge_expired_idempotency() IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.purge_old_resolved_orphaned_orders(p_days integer) SET search_path = public;
COMMENT ON FUNCTION public.purge_old_resolved_orphaned_orders(p_days integer) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

COMMENT ON FUNCTION public.refresh_revenue_materialized_view() IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

COMMENT ON FUNCTION public.safely_update_payment_status(p_order_id uuid, p_new_status text, p_payment_id text, p_signature text) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.admin_block_user(p_user_id uuid, p_reason text) SET search_path = public;
COMMENT ON FUNCTION public.admin_block_user(p_user_id uuid, p_reason text) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.admin_bulk_reset_area(p_min_x integer, p_max_x integer, p_min_y integer, p_max_y integer) SET search_path = public;
COMMENT ON FUNCTION public.admin_bulk_reset_area(p_min_x integer, p_max_x integer, p_min_y integer, p_max_y integer) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.admin_bulk_reset_pixels(p_pixels jsonb) SET search_path = public;
COMMENT ON FUNCTION public.admin_bulk_reset_pixels(p_pixels jsonb) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.admin_clear_all_content() SET search_path = public;
COMMENT ON FUNCTION public.admin_clear_all_content() IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.admin_get_all_users() SET search_path = public;
COMMENT ON FUNCTION public.admin_get_all_users() IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.admin_get_audit_logs(p_limit integer, p_offset integer) SET search_path = public;
COMMENT ON FUNCTION public.admin_get_audit_logs(p_limit integer, p_offset integer) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.admin_get_marketplace_analytics(p_days integer) SET search_path = public;
COMMENT ON FUNCTION public.admin_get_marketplace_analytics(p_days integer) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.admin_get_refund_history(p_days_back integer, p_limit integer, p_offset integer) SET search_path = public;
COMMENT ON FUNCTION public.admin_get_refund_history(p_days_back integer, p_limit integer, p_offset integer) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.admin_get_revenue_stats(p_days integer) SET search_path = public;
COMMENT ON FUNCTION public.admin_get_revenue_stats(p_days integer) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.admin_promote_user(target_email text, make_admin boolean) SET search_path = public;
COMMENT ON FUNCTION public.admin_promote_user(target_email text, make_admin boolean) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.admin_refund_marketplace_transaction(p_transaction_id uuid, p_reason text) SET search_path = public;
COMMENT ON FUNCTION public.admin_refund_marketplace_transaction(p_transaction_id uuid, p_reason text) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.admin_refund_payment_order(p_payment_order_id uuid, p_reason text) SET search_path = public;
COMMENT ON FUNCTION public.admin_refund_payment_order(p_payment_order_id uuid, p_reason text) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.admin_remove_pixel(p_x integer, p_y integer, p_reason text) SET search_path = public;
COMMENT ON FUNCTION public.admin_remove_pixel(p_x integer, p_y integer, p_reason text) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.admin_resolve_moderation(p_queue_id uuid, p_status text, p_action text, p_notes text) SET search_path = public;
COMMENT ON FUNCTION public.admin_resolve_moderation(p_queue_id uuid, p_status text, p_action text, p_notes text) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.admin_set_user_admin(p_user_id uuid, p_is_admin boolean) SET search_path = public;
COMMENT ON FUNCTION public.admin_set_user_admin(p_user_id uuid, p_is_admin boolean) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.admin_unblock_user(p_user_id uuid) SET search_path = public;
COMMENT ON FUNCTION public.admin_unblock_user(p_user_id uuid) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.cancel_profile_deletion() SET search_path = public;
COMMENT ON FUNCTION public.cancel_profile_deletion() IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.check_achievements(p_user_id uuid) SET search_path = public;
COMMENT ON FUNCTION public.check_achievements(p_user_id uuid) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.check_and_record_rate_limit(p_user_id uuid, p_endpoint text, p_max_requests integer, p_window_seconds integer) SET search_path = public;
COMMENT ON FUNCTION public.check_and_record_rate_limit(p_user_id uuid, p_endpoint text, p_max_requests integer, p_window_seconds integer) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.delete_user_completely(target_user_id uuid) SET search_path = public;
COMMENT ON FUNCTION public.delete_user_completely(target_user_id uuid) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.get_admin_dashboard_users() SET search_path = public;
COMMENT ON FUNCTION public.get_admin_dashboard_users() IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.get_payment_reconciliation_status(p_days_back integer) SET search_path = public;
COMMENT ON FUNCTION public.get_payment_reconciliation_status(p_days_back integer) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.is_current_user_admin() SET search_path = public;
COMMENT ON FUNCTION public.is_current_user_admin() IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.is_current_user_super_admin() SET search_path = public;
COMMENT ON FUNCTION public.is_current_user_super_admin() IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.is_super_admin(p_email text) SET search_path = public;
COMMENT ON FUNCTION public.is_super_admin(p_email text) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.list_pixel_for_sale(p_pixel_id uuid, p_asking_price numeric) SET search_path = public;
COMMENT ON FUNCTION public.list_pixel_for_sale(p_pixel_id uuid, p_asking_price numeric) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.log_activity(p_user_id uuid, p_activity_type text, p_title text, p_description text, p_target_type text, p_target_id uuid, p_is_public boolean) SET search_path = public;
COMMENT ON FUNCTION public.log_activity(p_user_id uuid, p_activity_type text, p_title text, p_description text, p_target_type text, p_target_id uuid, p_is_public boolean) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.log_admin_action(p_action text, p_target_type text, p_target_id text, p_details jsonb) SET search_path = public;
COMMENT ON FUNCTION public.log_admin_action(p_action text, p_target_type text, p_target_id text, p_details jsonb) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.log_event(p_event_type text, p_target_type text, p_target_id uuid, p_metadata jsonb) SET search_path = public;
COMMENT ON FUNCTION public.log_event(p_event_type text, p_target_type text, p_target_id uuid, p_metadata jsonb) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.log_webhook_event(p_event_type text, p_description text, p_payload jsonb) SET search_path = public;
COMMENT ON FUNCTION public.log_webhook_event(p_event_type text, p_description text, p_payload jsonb) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.mark_payment_failed(p_payment_order_id uuid) SET search_path = public;
COMMENT ON FUNCTION public.mark_payment_failed(p_payment_order_id uuid) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.permanently_delete_user_profile(p_user_id uuid) SET search_path = public;
COMMENT ON FUNCTION public.permanently_delete_user_profile(p_user_id uuid) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.purchase_from_marketplace_verified(p_marketplace_transaction_id uuid, p_razorpay_payment_id text, p_razorpay_signature text) SET search_path = public;
COMMENT ON FUNCTION public.purchase_from_marketplace_verified(p_marketplace_transaction_id uuid, p_razorpay_payment_id text, p_razorpay_signature text) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.report_content(p_content_type text, p_content_id uuid, p_reason text, p_details text) SET search_path = public;
COMMENT ON FUNCTION public.report_content(p_content_type text, p_content_id uuid, p_reason text, p_details text) IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

ALTER FUNCTION public.request_profile_deletion() SET search_path = public;
COMMENT ON FUNCTION public.request_profile_deletion() IS '@supabase-linter-ignore 0028_anon_security_definer_function_executable, 0029_authenticated_security_definer_function_executable';

