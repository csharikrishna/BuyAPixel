-- =============================================================
-- Migration: Pixel Analytics (Click Tracking)
-- =============================================================
-- Tracks clicks on advertiser links and provides analytics
-- to pixel owners so they can measure ROI.
-- =============================================================

-- Click events table (individual click tracking)
CREATE TABLE IF NOT EXISTS pixel_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pixel_id UUID REFERENCES pixels(id) ON DELETE CASCADE,
  block_id UUID REFERENCES pixel_blocks(id) ON DELETE CASCADE,
  clicked_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  source TEXT DEFAULT 'grid',  -- grid, billboard, pixel_info, directory
  referrer TEXT,
  user_agent TEXT
);

-- Enable RLS
ALTER TABLE pixel_clicks ENABLE ROW LEVEL SECURITY;

-- Owners can view clicks on their pixels
CREATE POLICY "Owners can view their pixel clicks"
  ON pixel_clicks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pixels p
      WHERE p.id = pixel_clicks.pixel_id AND p.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM pixel_blocks pb
      WHERE pb.id = pixel_clicks.block_id AND pb.owner_id = auth.uid()
    )
  );

-- Anyone can insert a click (tracking is fire-and-forget)
CREATE POLICY "Anyone can track clicks"
  ON pixel_clicks FOR INSERT
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_pixel_clicks_pixel_id ON pixel_clicks(pixel_id);
CREATE INDEX IF NOT EXISTS idx_pixel_clicks_block_id ON pixel_clicks(block_id);
CREATE INDEX IF NOT EXISTS idx_pixel_clicks_clicked_at ON pixel_clicks(clicked_at);

-- =============================================================
-- Analytics RPC for pixel owners
-- =============================================================
CREATE OR REPLACE FUNCTION get_pixel_analytics(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSON;
BEGIN
  -- Only allow users to view their own analytics
  IF auth.uid() IS DISTINCT FROM target_user_id THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  SELECT json_build_object(
    'total_clicks', COALESCE((
      SELECT COUNT(*) FROM public.pixel_clicks pc
      JOIN public.pixels p ON p.id = pc.pixel_id
      WHERE p.owner_id = target_user_id
    ), 0),
    'clicks_last_7_days', COALESCE((
      SELECT COUNT(*) FROM public.pixel_clicks pc
      JOIN public.pixels p ON p.id = pc.pixel_id
      WHERE p.owner_id = target_user_id
        AND pc.clicked_at >= now() - interval '7 days'
    ), 0),
    'clicks_last_30_days', COALESCE((
      SELECT COUNT(*) FROM public.pixel_clicks pc
      JOIN public.pixels p ON p.id = pc.pixel_id
      WHERE p.owner_id = target_user_id
        AND pc.clicked_at >= now() - interval '30 days'
    ), 0),
    'daily_clicks', COALESCE((
      SELECT json_agg(row_to_json(daily) ORDER BY daily.date)
      FROM (
        SELECT
          DATE(pc.clicked_at) as date,
          COUNT(*) as clicks
        FROM public.pixel_clicks pc
        JOIN public.pixels p ON p.id = pc.pixel_id
        WHERE p.owner_id = target_user_id
          AND pc.clicked_at >= now() - interval '30 days'
        GROUP BY DATE(pc.clicked_at)
        ORDER BY date
      ) daily
    ), '[]'::json),
    'clicks_by_source', COALESCE((
      SELECT json_agg(row_to_json(src))
      FROM (
        SELECT
          COALESCE(pc.source, 'unknown') as source,
          COUNT(*) as clicks
        FROM public.pixel_clicks pc
        JOIN public.pixels p ON p.id = pc.pixel_id
        WHERE p.owner_id = target_user_id
        GROUP BY pc.source
        ORDER BY clicks DESC
      ) src
    ), '[]'::json),
    'top_blocks', COALESCE((
      SELECT json_agg(row_to_json(blk))
      FROM (
        SELECT
          pb.id as block_id,
          pb.alt_text as name,
          pb.pixel_count,
          COUNT(pc.id) as clicks
        FROM public.pixel_blocks pb
        LEFT JOIN public.pixel_clicks pc ON pc.block_id = pb.id
        WHERE pb.owner_id = target_user_id
        GROUP BY pb.id, pb.alt_text, pb.pixel_count
        ORDER BY clicks DESC
        LIMIT 10
      ) blk
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_pixel_analytics(UUID) TO authenticated;
