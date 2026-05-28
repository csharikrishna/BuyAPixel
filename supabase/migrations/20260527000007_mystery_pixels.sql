-- =============================================================
-- Migration: Mystery Pixel Drops
-- =============================================================
-- Weekly treasure hunt — a random unsold pixel becomes
-- available at ₹1, creating a weekly engagement event.
-- =============================================================

CREATE TABLE IF NOT EXISTS mystery_pixels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  original_price INTEGER NOT NULL,
  mystery_price INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',  -- active, claimed, expired
  claimed_by UUID REFERENCES auth.users(id),
  claimed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT mystery_pixel_status_check CHECK (status IN ('active', 'claimed', 'expired'))
);

-- Enable RLS
ALTER TABLE mystery_pixels ENABLE ROW LEVEL SECURITY;

-- Anyone can view mystery pixels (needed for the treasure hunt)
CREATE POLICY "Anyone can view mystery pixels"
  ON mystery_pixels FOR SELECT
  USING (true);

-- Only the system (via service role) can insert/update mystery pixels
-- Users interact through RPC functions

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mystery_pixels_status ON mystery_pixels(status);
CREATE INDEX IF NOT EXISTS idx_mystery_pixels_coords ON mystery_pixels(x, y);

-- =============================================================
-- RPC: Get current active mystery pixel (if any)
-- =============================================================
CREATE OR REPLACE FUNCTION get_active_mystery_pixel()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSON;
BEGIN
  -- First, expire any past-due mystery pixels
  UPDATE public.mystery_pixels
  SET status = 'expired'
  WHERE status = 'active' AND expires_at < now();

  -- Return the active one (if any)
  SELECT row_to_json(mp)
  INTO result
  FROM (
    SELECT id, x, y, original_price, mystery_price, status, expires_at, created_at
    FROM public.mystery_pixels
    WHERE status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  ) mp;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_active_mystery_pixel() TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_mystery_pixel() TO anon;
