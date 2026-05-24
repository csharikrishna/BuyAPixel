-- ============================================================================
-- 038: SECURITY LINT FIXES
-- BuyASpot - Fixes for Supabase Database Linter Warnings
-- ============================================================================

-- ============================================================================
-- 1. Fix: security_definer_view
-- View `public.vw_payment_analytics` is defined with SECURITY DEFINER property.
-- Fix: Recreate with SECURITY INVOKER property (Postgres 15+).
-- ============================================================================
CREATE OR REPLACE VIEW public.vw_payment_analytics WITH (security_invoker = true) AS
SELECT
  DATE_TRUNC('hour', created_at) AS hour,
  COUNT(*) AS total_orders,
  SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END)::BIGINT AS paid_amount,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
  AVG(CASE WHEN status = 'paid' THEN amount ELSE NULL END)::INTEGER AS avg_paid_amount,
  COUNT(DISTINCT user_id) AS unique_users
FROM public.payment_orders
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- ============================================================================
-- 2. Fix: rls_disabled_in_public
-- Table `public.connection_pool_metrics` is public, but RLS has not been enabled.
-- Fix: Enable RLS. No policies are added, so all access is denied by default 
-- (which is secure and appropriate for internal metrics).
-- ============================================================================
ALTER TABLE public.connection_pool_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. Fix: rls_disabled_in_public
-- Table `public.payment_audit_log` is public, but RLS has not been enabled.
-- Fix: Enable RLS.
-- ============================================================================
ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;

-- IMPORTANT FIX FOR AUDIT LOGGING:
-- Because we enabled RLS on payment_audit_log without any INSERT policies,
-- the trigger function that inserts into it will fail if triggered by a normal user.
-- We must make the trigger function SECURITY DEFINER so it executes as the table owner
-- and bypasses RLS for the audit insertion.
-- (Trigger functions returning trigger type are not exposed to the PostgREST API).
CREATE OR REPLACE FUNCTION public.log_payment_status_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.payment_audit_log (
      payment_order_id,
      action,
      old_status,
      new_status,
      changed_by,
      change_reason
    ) VALUES (
      NEW.id,
      'status_changed',
      OLD.status,
      NEW.status,
      COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'sub', 'system'),
      'Payment status transition'
    );
  END IF;
  RETURN NEW;
END;
$$;
