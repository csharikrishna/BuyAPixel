-- ============================================================================
-- DROP UNUSED COLUMNS
-- Removes dead weight (view_count and expires_at) from marketplace_listings
-- Note: pixels.view_count is retained because it's actively used by get_pixel_info RPC
-- ============================================================================

-- Remove unused view_count and expires_at from marketplace_listings
ALTER TABLE public.marketplace_listings DROP COLUMN IF EXISTS view_count;
ALTER TABLE public.marketplace_listings DROP COLUMN IF EXISTS expires_at;
