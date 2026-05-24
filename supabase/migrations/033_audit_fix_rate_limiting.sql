-- ============================================================================
-- 033: AUDIT FIX - Database-Backed Rate Limiting
-- BuyASpot - Move rate limiting from in-memory to persistent storage
-- ============================================================================

-- ============================================================================
-- CREATE RATE_LIMITS TABLE (for C8 fix)
-- Persistent rate limiting that survives cold starts
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL, -- 'create_order', 'verify_payment', etc.
  request_count INTEGER DEFAULT 1,
  window_start_at TIMESTAMPTZ DEFAULT NOW(),
  window_end_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 minute',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint, window_start_at)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint 
ON rate_limits(user_id, endpoint);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window_end_at 
ON rate_limits(window_end_at);

-- ✅ C8: RLS Policy for rate_limits (service role only)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role to access rate limits"
  ON rate_limits
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- FUNCTION: check_and_record_rate_limit
-- Atomically checks rate limit and increments counter
-- Returns: allowed (boolean), remaining (int)
-- ============================================================================

CREATE OR REPLACE FUNCTION check_and_record_rate_limit(
  p_user_id UUID,
  p_endpoint TEXT,
  p_max_requests INTEGER DEFAULT 5,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS TABLE (allowed BOOLEAN, remaining INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit_record rate_limits%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_bucket_epoch BIGINT;
  v_window_start TIMESTAMPTZ;
  v_window_end TIMESTAMPTZ;
  v_existing_count INTEGER;
BEGIN
  -- Clean up expired rate limit windows first
  DELETE FROM rate_limits
  WHERE window_end_at <= v_now;
  -- Bucket the window_start to deterministic boundary to avoid race-created buckets
  v_bucket_epoch := floor(extract(epoch from v_now) / p_window_seconds)::BIGINT * p_window_seconds;
  v_window_start := to_timestamp(v_bucket_epoch)::timestamptz;
  v_window_end := v_window_start + (p_window_seconds || ' seconds')::INTERVAL;

  -- Try to get or create rate limit record for this window
  -- Using INSERT ... ON CONFLICT to atomically handle concurrent requests
  INSERT INTO rate_limits (user_id, endpoint, request_count, window_start_at, window_end_at)
  VALUES (p_user_id, p_endpoint, 1, v_window_start, v_window_end)
  ON CONFLICT (user_id, endpoint, window_start_at)
  DO UPDATE SET
    request_count = rate_limits.request_count + 1,
    updated_at = v_now
  RETURNING * INTO v_limit_record;

  -- Check if limit exceeded
  v_existing_count := v_limit_record.request_count;
  
  RETURN QUERY SELECT 
    (v_existing_count <= p_max_requests)::BOOLEAN as allowed,
    GREATEST(0, p_max_requests - v_existing_count)::INTEGER as remaining;
END;
$$;

-- ============================================================================
-- END OF 033
-- ============================================================================
