-- ============================================================================
-- 023: WEBHOOK SUPPORT & PAYMENT RECONCILIATION
-- BuyASpot - Event logging and webhook reconciliation infrastructure
-- ============================================================================

-- ============================================================================
-- EVENT LOG TABLE
-- Track all significant system events for debugging and reconciliation
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  description TEXT,
  payload JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient querying by event type and date
CREATE INDEX IF NOT EXISTS idx_event_log_type_date ON public.event_log(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_log_created ON public.event_log(created_at DESC);

-- ============================================================================
-- ADD WEBHOOK FIELDS TO PAYMENT ORDERS
-- For reconciliation tracking
-- ============================================================================

ALTER TABLE public.payment_orders 
ADD COLUMN IF NOT EXISTS webhook_received_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

ALTER TABLE public.payment_orders 
ADD COLUMN IF NOT EXISTS webhook_processed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.event_log ENABLE ROW LEVEL SECURITY;

-- Only admins and service role can read event logs
CREATE POLICY "event_log_admin_read" ON public.event_log
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE is_admin = true
    )
  );

-- Service role insert (via webhook function)
CREATE POLICY "event_log_insert" ON public.event_log
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- FUNCTION: Log Event
-- Wrapper for logging events
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_webhook_event(
  p_event_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.event_log (event_type, description, payload)
  VALUES (p_event_type, p_description, p_payload)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_webhook_event(TEXT, TEXT, JSONB) TO authenticated, service_role;

-- ============================================================================
-- FUNCTION: Get Payment Reconciliation Status
-- Check if a payment needs manual reconciliation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_payment_reconciliation_status(
  p_days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
  payment_id UUID,
  user_id UUID,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  status TEXT,
  amount NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  webhook_received_at TIMESTAMP WITH TIME ZONE,
  issue TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    po.id,
    po.user_id,
    po.razorpay_order_id,
    po.razorpay_payment_id,
    po.status,
    po.amount,
    po.created_at,
    po.paid_at,
    po.webhook_received_at,
    CASE
      WHEN po.status = 'created' AND po.created_at < NOW() - INTERVAL '1 hour' 
        THEN 'Order expired without payment'
      WHEN po.razorpay_payment_id IS NOT NULL AND po.status = 'created' 
        THEN 'Payment ID exists but status not updated'
      WHEN po.status = 'paid' AND po.razorpay_payment_id IS NULL 
        THEN 'Marked paid but no payment ID'
      WHEN po.webhook_received_at IS NULL AND po.paid_at IS NOT NULL 
        THEN 'Manually marked paid (no webhook)'
      ELSE NULL
    END as issue
  FROM payment_orders po
  WHERE 
    po.created_at >= NOW() - INTERVAL '1 day' * p_days_back
    AND (
      po.status IN ('created', 'failed')
      OR (po.razorpay_payment_id IS NOT NULL AND po.status != 'paid')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_payment_reconciliation_status(INTEGER) TO authenticated;

-- ============================================================================
-- END OF 023
-- ============================================================================
