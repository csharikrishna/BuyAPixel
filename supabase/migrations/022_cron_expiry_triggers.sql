-- ============================================================================
-- Migration 022: Add Cron Triggers for Expiry Functions
-- ============================================================================
-- The expire_old_payment_orders() and expire_old_listings() functions exist
-- but have no scheduled triggers. Without cron jobs, payment orders and
-- marketplace listings never expire automatically.
-- ============================================================================

-- Enable pg_cron extension (available on Supabase by default)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Expire stale payment orders every 5 minutes
-- Payment orders typically expire after 30 minutes (set by Razorpay)
SELECT cron.schedule(
  'expire-payment-orders',
  '*/5 * * * *',  -- every 5 minutes
  $$SELECT expire_old_payment_orders()$$
);

-- Expire old marketplace listings once per hour
SELECT cron.schedule(
  'expire-marketplace-listings',
  '0 * * * *',  -- top of every hour
  $$SELECT expire_old_listings()$$
);
