-- ============================================================================
-- 032: AUDIT FIX - Idempotency Log and Orphaned Orders Recovery
-- BuyAPixel - Add tables for C5 (Idempotency) and C3 (Orphaned Orders)
-- ============================================================================

-- ============================================================================
-- CREATE IDEMPOTENCY_LOG TABLE (for C5 fix)
-- Prevents duplicate execution of complete_pixel_purchase
-- ============================================================================

CREATE TABLE IF NOT EXISTS idempotency_log (
  key TEXT PRIMARY KEY,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

-- Automatic cleanup of expired entries
CREATE INDEX IF NOT EXISTS idx_idempotency_log_expires_at 
ON idempotency_log(expires_at);

-- ✅ C5: RLS Policy for idempotency_log (service role only)
ALTER TABLE idempotency_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role to read/write idempotency logs"
  ON idempotency_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- CREATE ORPHANED_ORDERS TABLE (for C3 fix)
-- Tracks failed payment orders for manual reconciliation
-- ============================================================================

CREATE TABLE IF NOT EXISTS orphaned_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_order_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL, -- in paise
  error_message TEXT,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending_manual_review', -- 'pending_manual_review', 'refunded', 'resolved'
  refund_id TEXT, -- Razorpay refund ID if refunded
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for recovery queries
CREATE INDEX IF NOT EXISTS idx_orphaned_orders_status 
ON orphaned_orders(status);

CREATE INDEX IF NOT EXISTS idx_orphaned_orders_razorpay_order_id 
ON orphaned_orders(razorpay_order_id);

CREATE INDEX IF NOT EXISTS idx_orphaned_orders_user_id 
ON orphaned_orders(user_id);

-- ✅ C3: RLS Policy for orphaned_orders (service role + admins)
ALTER TABLE orphaned_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role to read/write orphaned orders"
  ON orphaned_orders
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Allow admins to view orphaned orders"
  ON orphaned_orders
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_orphaned_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orphaned_orders_updated_at_trigger ON orphaned_orders;
CREATE TRIGGER orphaned_orders_updated_at_trigger
BEFORE UPDATE ON orphaned_orders
FOR EACH ROW
EXECUTE FUNCTION update_orphaned_orders_updated_at();

-- ============================================================================
-- END OF 032
-- ============================================================================
