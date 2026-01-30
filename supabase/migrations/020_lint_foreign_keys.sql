-- ============================================================================
-- 020: LINT FIXES - FOREIGN KEYS
-- BuyAPixel - Performance optimizations
-- ============================================================================

-- Fix: Unindexed foreign key in marketplace_transactions
-- Detail: marketplace_transactions.refunded_by references auth.users(id) but lacked an index
CREATE INDEX IF NOT EXISTS idx_transactions_refunded_by ON public.marketplace_transactions(refunded_by);

-- ============================================================================
-- END OF 020
-- ============================================================================
