-- ============================================================================
-- COMPREHENSIVE POSTGRES OPTIMIZATION
-- BuyASpot - All 8 Best Practice Categories
-- ============================================================================
-- This migration applies Supabase Postgres Best Practices across:
-- 1. Query Performance (CRITICAL)
-- 2. Connection Management (CRITICAL)
-- 3. Security & RLS (CRITICAL)
-- 4. Schema Design (HIGH)
-- 5. Concurrency & Locking (MEDIUM-HIGH)
-- 6. Data Access Patterns (MEDIUM)
-- 7. Monitoring & Diagnostics (LOW-MEDIUM)
-- 8. Advanced Features (LOW)
-- ============================================================================

-- ============================================================================
-- CATEGORY 1: QUERY PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Add missing covering indexes for payment orders
CREATE INDEX IF NOT EXISTS idx_payment_orders_status_amount 
  ON public.payment_orders(status, amount) 
  INCLUDE (user_id, created_at)
  WHERE status IN ('created', 'paid');

-- Composite index for user payment queries with timestamps
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_status_time
  ON public.payment_orders(user_id, status, created_at DESC)
  WHERE status IN ('paid', 'completed');

-- Partial index for active orders (faster for typical queries)
CREATE INDEX IF NOT EXISTS idx_payment_orders_active
  ON public.payment_orders(created_at DESC, user_id)
  WHERE status = 'created' AND expires_at IS NOT NULL;

-- Add index on razorpay_payment_id for verification lookups
CREATE INDEX IF NOT EXISTS idx_payment_orders_razorpay_payment_id
  ON public.payment_orders(razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

-- Add index for expired order cleanup (cron job)
CREATE INDEX IF NOT EXISTS idx_payment_orders_expires_cleanup
  ON public.payment_orders(expires_at)
  WHERE status = 'created';

-- ============================================================================
-- CATEGORY 2: CONNECTION MANAGEMENT
-- ============================================================================

-- Set reasonable connection timeouts for Edge Functions
-- Note: ALTER SYSTEM requires elevated privileges and is not available on hosted Supabase.
-- Configure timeouts through project settings or connection/session settings in application code.

-- Enable connection pooling statistics
CREATE TABLE IF NOT EXISTS public.connection_pool_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_connections INTEGER,
  active_connections INTEGER,
  idle_connections INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CATEGORY 3: SECURITY & RLS POLICY OPTIMIZATION
-- ============================================================================

-- Add RLS policy for payment verification (prevent tampering)
ALTER TABLE public.payment_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

-- Users can only view their own orders
DROP POLICY IF EXISTS "payment_orders_select_own" ON public.payment_orders;
CREATE POLICY "payment_orders_select_own" ON public.payment_orders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert for themselves only
DROP POLICY IF EXISTS "payment_orders_insert_own" ON public.payment_orders;
CREATE POLICY "payment_orders_insert_own" ON public.payment_orders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Deny user updates (only service role can update)
DROP POLICY IF EXISTS "payment_orders_deny_update" ON public.payment_orders;
CREATE POLICY "payment_orders_deny_update" ON public.payment_orders
  FOR UPDATE TO authenticated
  USING (FALSE);

-- Deny user deletes
DROP POLICY IF EXISTS "payment_orders_deny_delete" ON public.payment_orders;
CREATE POLICY "payment_orders_deny_delete" ON public.payment_orders
  FOR DELETE TO authenticated
  USING (FALSE);

-- ============================================================================
-- CATEGORY 4: SCHEMA DESIGN OPTIMIZATION
-- ============================================================================

-- Normalize razorpay_payment_id and razorpay_signature storage
-- They should be NOT NULL when status = 'paid'
ALTER TABLE public.payment_orders
  DROP CONSTRAINT IF EXISTS check_paid_requires_signature;

ALTER TABLE public.payment_orders 
  ADD CONSTRAINT check_paid_requires_signature 
  CHECK (
    (status != 'paid') OR 
    (razorpay_payment_id IS NOT NULL AND razorpay_signature IS NOT NULL)
  );

-- Add data type validation for amounts (ensure positive)
ALTER TABLE public.payment_orders 
  DROP CONSTRAINT IF EXISTS payment_orders_amount_check;

ALTER TABLE public.payment_orders 
  ADD CONSTRAINT check_amount_valid 
  CHECK (amount >= 100 AND amount <= 100000000); -- 100 paise (~₹1) to ₹10,00,000

-- Add check for currency (prevent invalid currencies)
ALTER TABLE public.payment_orders 
  DROP CONSTRAINT IF EXISTS check_currency;

ALTER TABLE public.payment_orders 
  ADD CONSTRAINT check_currency_valid 
  CHECK (currency IN ('INR', 'USD', 'EUR'));

-- Add check for purchase_type
ALTER TABLE public.payment_orders 
  DROP CONSTRAINT IF EXISTS check_purchase_type;

ALTER TABLE public.payment_orders 
  ADD CONSTRAINT check_purchase_type_valid 
  CHECK (purchase_type IN ('pixel_purchase', 'marketplace_purchase', 'bundle_purchase'));

-- ============================================================================
-- CATEGORY 5: CONCURRENCY & LOCKING OPTIMIZATION
-- ============================================================================

-- Add explicit FOR UPDATE handling for payment verification
CREATE OR REPLACE FUNCTION public.safely_update_payment_status(
  p_order_id UUID,
  p_new_status TEXT,
  p_payment_id TEXT DEFAULT NULL,
  p_signature TEXT DEFAULT NULL
) RETURNS TABLE (success BOOLEAN, message TEXT) AS $$
DECLARE
  v_current_status TEXT;
BEGIN
  -- Use short transaction with explicit lock
  BEGIN
    SELECT status INTO v_current_status 
    FROM public.payment_orders 
    WHERE id = p_order_id 
    FOR UPDATE;
    
    -- Validate state transition
    IF v_current_status IS NULL THEN
      RETURN QUERY SELECT FALSE, 'Order not found'::TEXT;
      RETURN;
    END IF;
    
    -- Prevent re-payment
    IF v_current_status = 'paid' THEN
      RETURN QUERY SELECT FALSE, 'Order already paid'::TEXT;
      RETURN;
    END IF;
    
    -- Update with new status
    UPDATE public.payment_orders 
    SET 
      status = p_new_status,
      razorpay_payment_id = COALESCE(p_payment_id, razorpay_payment_id),
      razorpay_signature = COALESCE(p_signature, razorpay_signature),
      paid_at = CASE WHEN p_new_status = 'paid' THEN NOW() ELSE paid_at END,
      updated_at = NOW()
    WHERE id = p_order_id;
    
    RETURN QUERY SELECT TRUE, 'Status updated'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, SQLERRM::TEXT;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CATEGORY 6: DATA ACCESS PATTERNS OPTIMIZATION
-- ============================================================================

-- Create function for paginated payment queries (N+1 prevention)
CREATE OR REPLACE FUNCTION public.get_user_payment_orders(
  p_user_id UUID,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_status TEXT DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  razorpay_order_id TEXT,
  amount INTEGER,
  status TEXT,
  created_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    po.id,
    po.razorpay_order_id,
    po.amount,
    po.status,
    po.created_at,
    po.paid_at
  FROM public.payment_orders po
  WHERE po.user_id = p_user_id
    AND (p_status IS NULL OR po.status = p_status)
  ORDER BY po.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optimize batch operations for marketplace
CREATE OR REPLACE FUNCTION public.batch_create_payment_orders(
  p_orders JSONB
) RETURNS TABLE (
  order_id UUID,
  razorpay_order_id TEXT,
  success BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.payment_orders (
    user_id,
    razorpay_order_id,
    amount,
    currency,
    purchase_type,
    purchase_metadata,
    status
  )
  SELECT 
    (elem->>'user_id')::UUID,
    elem->>'razorpay_order_id',
    (elem->>'amount')::INTEGER,
    elem->>'currency',
    elem->>'purchase_type',
    (elem->'metadata')::JSONB,
    'created'
  FROM jsonb_array_elements(p_orders) elem
  WHERE (elem->>'user_id') IS NOT NULL
  ON CONFLICT (razorpay_order_id) DO NOTHING
  RETURNING id, razorpay_order_id, TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CATEGORY 7: MONITORING & DIAGNOSTICS
-- ============================================================================

-- Create audit log table for payment modifications
CREATE TABLE IF NOT EXISTS public.payment_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_order_id UUID NOT NULL REFERENCES public.payment_orders(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  changed_by TEXT NOT NULL DEFAULT 'system',
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_payment_audit_log_order_id
  ON public.payment_audit_log(payment_order_id, created_at DESC);

-- Create trigger for automatic audit logging
CREATE OR REPLACE FUNCTION public.log_payment_status_change()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS payment_status_change_trigger ON public.payment_orders;

-- Create trigger
CREATE TRIGGER payment_status_change_trigger
AFTER UPDATE ON public.payment_orders
FOR EACH ROW
EXECUTE FUNCTION public.log_payment_status_change();

-- View for monitoring payment performance
CREATE OR REPLACE VIEW public.vw_payment_analytics AS
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
-- CATEGORY 8: ADVANCED FEATURES
-- ============================================================================

-- Create materialized view for revenue dashboard (refresh periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_daily_revenue AS
SELECT
  DATE(created_at) AS date,
  purchase_type,
  COUNT(*) AS order_count,
  SUM(amount) AS total_amount,
  AVG(amount) AS avg_amount,
  MIN(amount) AS min_amount,
  MAX(amount) AS max_amount,
  COUNT(DISTINCT user_id) AS unique_users
FROM public.payment_orders
WHERE status = 'paid'
GROUP BY DATE(created_at), purchase_type;

-- Index on materialized view
CREATE INDEX IF NOT EXISTS idx_mv_daily_revenue_date
  ON public.mv_daily_revenue(date DESC);

-- Refresh function for materialized view
CREATE OR REPLACE FUNCTION public.refresh_revenue_materialized_view()
RETURNS TABLE (message TEXT) AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.mv_daily_revenue;
  RETURN QUERY SELECT 'Revenue materialized view refreshed'::TEXT;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT ('Error refreshing view: ' || SQLERRM)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PERFORMANCE STATISTICS & CONFIGURATION
-- ============================================================================

-- Server-level logging and shared_preload settings are managed by Supabase.
-- Keep extension enablement only.

-- pg_stat_statements tracking
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ============================================================================
-- FINAL CLEANUP & VERIFICATION
-- ============================================================================

-- Analyze table to update planner statistics
ANALYZE public.payment_orders;

-- Verification queries should be run manually from SQL editor after migration.

COMMENT ON TABLE public.payment_audit_log IS 'Audit trail for payment order modifications';
COMMENT ON VIEW public.vw_payment_analytics IS 'Real-time payment analytics for the last 7 days';
COMMENT ON MATERIALIZED VIEW public.mv_daily_revenue IS 'Daily revenue report by purchase type (refresh daily)';
