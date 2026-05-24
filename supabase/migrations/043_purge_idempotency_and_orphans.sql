-- ============================================================================
-- 043: PURGE IDEMPOTENCY LOG & CLEANUP ORPHANED ORDERS
-- Adds maintenance functions and cron jobs to prevent table bloat
-- ============================================================================

-- Function: purge_expired_idempotency
CREATE OR REPLACE FUNCTION public.purge_expired_idempotency()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER := 0;
BEGIN
  DELETE FROM idempotency_log WHERE expires_at <= NOW()
  RETURNING 1 INTO v_deleted;

  -- Using GET DIAGNOSTICS to return row count
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Function: purge_old_resolved_orphaned_orders
CREATE OR REPLACE FUNCTION public.purge_old_resolved_orphaned_orders(p_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER := 0;
BEGIN
  DELETE FROM orphaned_orders
  WHERE status = 'resolved' AND resolved_at IS NOT NULL
    AND resolved_at < NOW() - (p_days || ' days')::INTERVAL
  RETURNING 1 INTO v_deleted;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Schedule cron jobs (Supabase Cron extension required)
-- Purge idempotency daily at 03:00 UTC
-- NOTE: pg_cron extension may not be available on all Supabase tiers
-- These functions can be called manually or via edge functions
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
--     PERFORM cron.schedule('purge-idempotency', '0 3 * * *', $$SELECT public.purge_expired_idempotency()$$);
--     PERFORM cron.schedule('purge-orphaned-resolved', '30 3 * * *', $$SELECT public.purge_old_resolved_orphaned_orders()$$);
--   END IF;
-- END;
-- $$;

-- Note: If your Supabase project uses the 'cron' extension or has the scheduled jobs UI,
-- confirm these tasks were created successfully in the project's Cron Jobs page.

-- ============================================================================
-- END OF 043
-- ============================================================================
