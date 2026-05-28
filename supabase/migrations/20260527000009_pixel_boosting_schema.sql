-- =============================================================
-- Migration: Pixel Boosting Schema (Future Use)
-- =============================================================
-- Schema only — no frontend yet. Establishes the data model
-- for paid pixel boosting (glow, featured sidebar, etc.)
-- =============================================================

CREATE TABLE IF NOT EXISTS pixel_boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pixel_id UUID REFERENCES pixels(id) ON DELETE CASCADE,
  block_id UUID REFERENCES pixel_blocks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Boost configuration
  boost_type TEXT NOT NULL DEFAULT 'glow',  -- glow, featured_sidebar, spotlight
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  amount_paid INTEGER NOT NULL DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'active',  -- active, expired, cancelled
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT boost_type_check CHECK (boost_type IN ('glow', 'featured_sidebar', 'spotlight')),
  CONSTRAINT boost_status_check CHECK (status IN ('active', 'expired', 'cancelled')),
  CONSTRAINT boost_dates_check CHECK (ends_at > starts_at)
);

-- Enable RLS
ALTER TABLE pixel_boosts ENABLE ROW LEVEL SECURITY;

-- Users can view their own boosts
CREATE POLICY "Users can view their own boosts"
  ON pixel_boosts FOR SELECT
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pixel_boosts_active ON pixel_boosts(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_pixel_boosts_user ON pixel_boosts(user_id);
CREATE INDEX IF NOT EXISTS idx_pixel_boosts_dates ON pixel_boosts(starts_at, ends_at);
