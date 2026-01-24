-- ============================================================================
-- 007: ANALYTICS & EVENTS
-- BuyAPixel - Event Tracking, Views, and Materialized Views
-- ============================================================================

-- ============================================================================
-- EVENTS TABLE (Universal Event Tracking)
-- ============================================================================

CREATE TABLE public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Event identification
  event_type TEXT NOT NULL,
  event_category TEXT,
  
  -- Actor
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  
  -- Target
  target_type TEXT,
  target_id UUID,
  
  -- Event data
  metadata JSONB DEFAULT '{}',
  
  -- Request info
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_events_type ON public.events(event_type, created_at DESC);
CREATE INDEX idx_events_user ON public.events(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_events_target ON public.events(target_type, target_id, created_at DESC);
CREATE INDEX idx_events_created ON public.events(created_at DESC);

-- Partitioning hint (for future scaling)
COMMENT ON TABLE public.events IS 'Universal event tracking. Consider partitioning by created_at for large datasets.';

-- ============================================================================
-- EVENT TYPES REFERENCE
-- ============================================================================

COMMENT ON COLUMN public.events.event_type IS 'Event types: pixel_view, pixel_purchase, block_purchase, listing_created, listing_sold, login, signup, profile_update, blog_view';

-- ============================================================================
-- MATERIALIZED VIEWS
-- ============================================================================

-- Grid stats (refreshed periodically for fast dashboard)
CREATE MATERIALIZED VIEW public.mv_grid_stats AS
SELECT
  10000 AS total_pixels,
  COUNT(*) FILTER (WHERE owner_id IS NOT NULL) AS sold_pixels,
  COUNT(*) FILTER (WHERE owner_id IS NULL) AS available_pixels,
  COALESCE(SUM(price_paid), 0)::NUMERIC(12,2) AS total_revenue,
  COUNT(DISTINCT owner_id) AS unique_owners,
  COUNT(DISTINCT block_id) FILTER (WHERE block_id IS NOT NULL) AS total_blocks,
  COALESCE(AVG(price_paid), 0)::NUMERIC(10,2) AS avg_price,
  MAX(purchased_at) AS last_sale_at
FROM public.pixels;

-- Create unique index for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX idx_mv_grid_stats ON public.mv_grid_stats(total_pixels);

-- Leaderboard (refreshed periodically)
CREATE MATERIALIZED VIEW public.mv_leaderboard AS
SELECT
  p.user_id,
  pr.full_name,
  pr.avatar_url,
  COUNT(px.id) AS pixel_count,
  COALESCE(SUM(px.price_paid), 0)::NUMERIC(12,2) AS total_spent,
  COUNT(DISTINCT px.block_id) AS block_count
FROM public.profiles p
LEFT JOIN public.pixels px ON px.owner_id = p.user_id
LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
WHERE p.deleted_at IS NULL
GROUP BY p.user_id, pr.full_name, pr.avatar_url
HAVING COUNT(px.id) > 0
ORDER BY COUNT(px.id) DESC;

CREATE UNIQUE INDEX idx_mv_leaderboard ON public.mv_leaderboard(user_id);

-- ============================================================================
-- REFRESH FUNCTIONS
-- ============================================================================

-- Refresh all materialized views
CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_grid_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_leaderboard;
END;
$$;

-- ============================================================================
-- EVENT LOGGING FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_event(
  p_event_type TEXT,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.events (event_type, user_id, target_type, target_id, metadata)
  VALUES (p_event_type, auth.uid(), p_target_type, p_target_id, p_metadata)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Events: users can see their own, admins can see all
CREATE POLICY "events_select_own" ON public.events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_current_user_super_admin());

-- Events: authenticated users can insert their own
CREATE POLICY "events_insert" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Anonymous can also log events (for pixel views, etc.)
CREATE POLICY "events_insert_anon" ON public.events
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.log_event(TEXT, TEXT, UUID, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_materialized_views() TO authenticated;

-- Grant SELECT on materialized views
GRANT SELECT ON public.mv_grid_stats TO anon, authenticated;
GRANT SELECT ON public.mv_leaderboard TO anon, authenticated;

-- ============================================================================
-- END OF 007
-- ============================================================================
