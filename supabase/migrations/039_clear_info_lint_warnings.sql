-- ============================================================================
-- 039: CLEAR INFO LINT WARNINGS
-- BuyASpot - Add explicit policies for tables with RLS enabled
-- ============================================================================

-- The linter complains if a table has RLS enabled but no policies (even though 
-- this is a valid way to explicitly deny all access to regular users). 
-- To clear the "rls_enabled_no_policy" INFO warnings, we will add explicit 
-- read-only policies for the Super Admin role.

-- 1. Explicit policy for connection_pool_metrics
CREATE POLICY "admin_select_pool_metrics" ON public.connection_pool_metrics
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin());

-- 2. Explicit policy for payment_audit_log
CREATE POLICY "admin_select_audit_log" ON public.payment_audit_log
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin());
