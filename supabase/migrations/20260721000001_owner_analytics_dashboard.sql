-- =============================================================
-- Migration: Owner Analytics Dashboard
-- =============================================================
-- Comprehensive analytics RPC for pixel owners.
-- Leverages existing `events` and `pixel_clicks` tables.
-- Client-side user-agent parsing stores device/browser/os in
-- the events.metadata and pixel_clicks columns.
-- =============================================================

-- Add parsed UA columns to pixel_clicks (optional enrichment)
ALTER TABLE public.pixel_clicks
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS device_type TEXT,
  ADD COLUMN IF NOT EXISTS browser TEXT,
  ADD COLUMN IF NOT EXISTS os TEXT;

-- Index for fast analytics queries
CREATE INDEX IF NOT EXISTS idx_pixel_clicks_device ON public.pixel_clicks(device_type) WHERE device_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pixel_clicks_browser ON public.pixel_clicks(browser) WHERE browser IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pixel_clicks_os ON public.pixel_clicks(os) WHERE os IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pixel_clicks_country ON public.pixel_clicks(country) WHERE country IS NOT NULL;

-- Add parsed UA columns to events table too
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS device_type TEXT,
  ADD COLUMN IF NOT EXISTS browser TEXT,
  ADD COLUMN IF NOT EXISTS os TEXT;

CREATE INDEX IF NOT EXISTS idx_events_device ON public.events(device_type) WHERE device_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_browser ON public.events(browser) WHERE browser IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_os ON public.events(os) WHERE os IS NOT NULL;

-- =============================================================
-- Enhanced Owner Dashboard Analytics RPC
-- =============================================================
CREATE OR REPLACE FUNCTION get_owner_dashboard_analytics(
  target_user_id UUID,
  time_range TEXT DEFAULT 'all'  -- 'today', 'yesterday', '7d', '30d', 'all'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSON;
  range_start TIMESTAMPTZ;
  range_end TIMESTAMPTZ := now();
BEGIN
  -- Only allow users to view their own analytics
  IF auth.uid() IS DISTINCT FROM target_user_id THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  -- Calculate time range
  CASE time_range
    WHEN 'today' THEN range_start := date_trunc('day', now());
    WHEN 'yesterday' THEN
      range_start := date_trunc('day', now()) - interval '1 day';
      range_end := date_trunc('day', now());
    WHEN '7d' THEN range_start := now() - interval '7 days';
    WHEN '30d' THEN range_start := now() - interval '30 days';
    ELSE range_start := '1970-01-01'::TIMESTAMPTZ;
  END CASE;

  SELECT json_build_object(
    -- ===== TRAFFIC ANALYTICS =====
    'total_views', COALESCE((
      SELECT COUNT(*) FROM public.events e
      JOIN public.pixels p ON p.id = e.target_id
      WHERE p.owner_id = target_user_id
        AND e.event_type = 'pixel_view'
        AND e.created_at >= range_start AND e.created_at < range_end
    ), 0),

    'unique_visitors', COALESCE((
      SELECT COUNT(DISTINCT e.session_id) FROM public.events e
      JOIN public.pixels p ON p.id = e.target_id
      WHERE p.owner_id = target_user_id
        AND e.event_type = 'pixel_view'
        AND e.session_id IS NOT NULL
        AND e.created_at >= range_start AND e.created_at < range_end
    ), 0),

    'total_clicks', COALESCE((
      SELECT COUNT(*) FROM public.pixel_clicks pc
      JOIN public.pixels p ON p.id = pc.pixel_id
      WHERE p.owner_id = target_user_id
        AND pc.clicked_at >= range_start AND pc.clicked_at < range_end
    ), 0),

    'unique_clicks', COALESCE((
      SELECT COUNT(DISTINCT pc.user_agent) FROM public.pixel_clicks pc
      JOIN public.pixels p ON p.id = pc.pixel_id
      WHERE p.owner_id = target_user_id
        AND pc.clicked_at >= range_start AND pc.clicked_at < range_end
    ), 0),

    -- ===== TRAFFIC TIMELINE (daily for last 30 days or selected range) =====
    'daily_timeline', COALESCE((
      SELECT json_agg(row_to_json(d) ORDER BY d.date)
      FROM (
        SELECT
          gs::date as date,
          COALESCE(v.views, 0) as views,
          COALESCE(c.clicks, 0) as clicks
        FROM generate_series(
          GREATEST(range_start, now() - interval '30 days')::date,
          LEAST(range_end, now())::date,
          '1 day'
        ) gs
        LEFT JOIN (
          SELECT DATE(e.created_at) as d, COUNT(*) as views
          FROM public.events e
          JOIN public.pixels p ON p.id = e.target_id
          WHERE p.owner_id = target_user_id AND e.event_type = 'pixel_view'
            AND e.created_at >= range_start AND e.created_at < range_end
          GROUP BY DATE(e.created_at)
        ) v ON v.d = gs::date
        LEFT JOIN (
          SELECT DATE(pc.clicked_at) as d, COUNT(*) as clicks
          FROM public.pixel_clicks pc
          JOIN public.pixels p ON p.id = pc.pixel_id
          WHERE p.owner_id = target_user_id
            AND pc.clicked_at >= range_start AND pc.clicked_at < range_end
          GROUP BY DATE(pc.clicked_at)
        ) c ON c.d = gs::date
      ) d
    ), '[]'::json),

    -- ===== DEVICE ANALYTICS =====
    'device_breakdown', COALESCE((
      SELECT json_agg(row_to_json(dev))
      FROM (
        SELECT
          COALESCE(pc.device_type, 'Unknown') as device,
          COUNT(*) as count
        FROM public.pixel_clicks pc
        JOIN public.pixels p ON p.id = pc.pixel_id
        WHERE p.owner_id = target_user_id
          AND pc.clicked_at >= range_start AND pc.clicked_at < range_end
        GROUP BY pc.device_type
        ORDER BY count DESC
      ) dev
    ), '[]'::json),

    -- ===== BROWSER ANALYTICS =====
    'browser_breakdown', COALESCE((
      SELECT json_agg(row_to_json(br))
      FROM (
        SELECT
          COALESCE(pc.browser, 'Unknown') as browser,
          COUNT(*) as count
        FROM public.pixel_clicks pc
        JOIN public.pixels p ON p.id = pc.pixel_id
        WHERE p.owner_id = target_user_id
          AND pc.clicked_at >= range_start AND pc.clicked_at < range_end
        GROUP BY pc.browser
        ORDER BY count DESC
      ) br
    ), '[]'::json),

    -- ===== OS ANALYTICS =====
    'os_breakdown', COALESCE((
      SELECT json_agg(row_to_json(o))
      FROM (
        SELECT
          COALESCE(pc.os, 'Unknown') as os,
          COUNT(*) as count
        FROM public.pixel_clicks pc
        JOIN public.pixels p ON p.id = pc.pixel_id
        WHERE p.owner_id = target_user_id
          AND pc.clicked_at >= range_start AND pc.clicked_at < range_end
        GROUP BY pc.os
        ORDER BY count DESC
      ) o
    ), '[]'::json),

    -- ===== REFERRAL SOURCES =====
    'referral_sources', COALESCE((
      SELECT json_agg(row_to_json(ref))
      FROM (
        SELECT
          COALESCE(
            CASE
              WHEN pc.referrer IS NULL OR pc.referrer = '' THEN 'Direct'
              WHEN pc.referrer ILIKE '%google%' THEN 'Google'
              WHEN pc.referrer ILIKE '%twitter%' OR pc.referrer ILIKE '%x.com%' THEN 'Twitter/X'
              WHEN pc.referrer ILIKE '%reddit%' THEN 'Reddit'
              WHEN pc.referrer ILIKE '%facebook%' THEN 'Facebook'
              WHEN pc.referrer ILIKE '%instagram%' THEN 'Instagram'
              WHEN pc.referrer ILIKE '%discord%' THEN 'Discord'
              WHEN pc.referrer ILIKE '%linkedin%' THEN 'LinkedIn'
              WHEN pc.referrer ILIKE '%youtube%' THEN 'YouTube'
              ELSE 'Other'
            END, 'Direct'
          ) as source,
          COUNT(*) as count
        FROM public.pixel_clicks pc
        JOIN public.pixels p ON p.id = pc.pixel_id
        WHERE p.owner_id = target_user_id
          AND pc.clicked_at >= range_start AND pc.clicked_at < range_end
        GROUP BY source
        ORDER BY count DESC
      ) ref
    ), '[]'::json),

    -- ===== POPULAR VISITING HOURS =====
    'hourly_activity', COALESCE((
      SELECT json_agg(row_to_json(h) ORDER BY h.hour)
      FROM (
        SELECT
          EXTRACT(HOUR FROM pc.clicked_at) as hour,
          COUNT(*) as count
        FROM public.pixel_clicks pc
        JOIN public.pixels p ON p.id = pc.pixel_id
        WHERE p.owner_id = target_user_id
          AND pc.clicked_at >= range_start AND pc.clicked_at < range_end
        GROUP BY EXTRACT(HOUR FROM pc.clicked_at)
      ) h
    ), '[]'::json),

    -- ===== GEOGRAPHIC DISTRIBUTION =====
    'geographic', COALESCE((
      SELECT json_agg(row_to_json(geo))
      FROM (
        SELECT
          COALESCE(pc.country, 'Unknown') as country,
          COUNT(*) as count
        FROM public.pixel_clicks pc
        JOIN public.pixels p ON p.id = pc.pixel_id
        WHERE p.owner_id = target_user_id
          AND pc.clicked_at >= range_start AND pc.clicked_at < range_end
        GROUP BY pc.country
        ORDER BY count DESC
        LIMIT 20
      ) geo
    ), '[]'::json),

    -- ===== CLICK HISTORY (latest 50 anonymous events) =====
    'click_history', COALESCE((
      SELECT json_agg(row_to_json(ch))
      FROM (
        SELECT
          pc.clicked_at as timestamp,
          pc.source,
          COALESCE(pc.device_type, 'Unknown') as device,
          COALESCE(pc.browser, 'Unknown') as browser,
          COALESCE(pc.country, 'Unknown') as country,
          pb.alt_text as block_name
        FROM public.pixel_clicks pc
        JOIN public.pixels p ON p.id = pc.pixel_id
        LEFT JOIN public.pixel_blocks pb ON pb.id = pc.block_id
        WHERE p.owner_id = target_user_id
          AND pc.clicked_at >= range_start AND pc.clicked_at < range_end
        ORDER BY pc.clicked_at DESC
        LIMIT 50
      ) ch
    ), '[]'::json),

    -- ===== TOP PERFORMING BLOCKS =====
    'top_blocks', COALESCE((
      SELECT json_agg(row_to_json(blk))
      FROM (
        SELECT
          pb.id as block_id,
          pb.alt_text as name,
          pb.image_url,
          pb.pixel_count,
          COUNT(pc.id) as clicks,
          pb.link_url
        FROM public.pixel_blocks pb
        LEFT JOIN public.pixel_clicks pc ON pc.block_id = pb.id
          AND pc.clicked_at >= range_start AND pc.clicked_at < range_end
        WHERE pb.owner_id = target_user_id
        GROUP BY pb.id, pb.alt_text, pb.image_url, pb.pixel_count, pb.link_url
        ORDER BY clicks DESC
        LIMIT 10
      ) blk
    ), '[]'::json),

    -- ===== PIXEL RANKING =====
    'pixel_ranking', (
      SELECT json_build_object(
        'user_rank', COALESCE(ur.rank, 0),
        'total_owners', COALESCE(ur.total, 0),
        'percentile', CASE WHEN COALESCE(ur.total, 0) > 0
          THEN ROUND((1.0 - (COALESCE(ur.rank, ur.total)::numeric / ur.total)) * 100, 1)
          ELSE 0 END
      )
      FROM (
        SELECT
          (SELECT COUNT(*) + 1 FROM (
            SELECT pc2.owner_id, COUNT(*) as cnt
            FROM public.pixel_clicks pc2
            JOIN public.pixels p2 ON p2.id = pc2.pixel_id
            WHERE pc2.clicked_at >= range_start AND pc2.clicked_at < range_end
            GROUP BY pc2.owner_id
            HAVING COUNT(*) > (
              SELECT COUNT(*) FROM public.pixel_clicks pc3
              JOIN public.pixels p3 ON p3.id = pc3.pixel_id
              WHERE p3.owner_id = target_user_id
                AND pc3.clicked_at >= range_start AND pc3.clicked_at < range_end
            )
          ) better) as rank,
          (SELECT COUNT(DISTINCT p4.owner_id) FROM public.pixels p4 WHERE p4.owner_id IS NOT NULL) as total
      ) ur
    ),

    -- ===== GENERATED AT =====
    'generated_at', now()
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_owner_dashboard_analytics(UUID, TEXT) TO authenticated;

-- =============================================================
-- Enhanced log_pixel_click with UA fields
-- =============================================================
CREATE OR REPLACE FUNCTION public.log_pixel_click(
  p_pixel_id UUID,
  p_block_id UUID DEFAULT NULL,
  p_source TEXT DEFAULT 'grid',
  p_referrer TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_device_type TEXT DEFAULT NULL,
  p_browser TEXT DEFAULT NULL,
  p_os TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.pixel_clicks (
    pixel_id, block_id, source, referrer, user_agent,
    device_type, browser, os, country
  )
  VALUES (
    p_pixel_id, p_block_id, p_source, p_referrer, p_user_agent,
    p_device_type, p_browser, p_os, p_country
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_pixel_click(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- =============================================================
-- Enhanced log_pixel_view event
-- =============================================================
CREATE OR REPLACE FUNCTION public.log_pixel_view(
  p_pixel_id UUID,
  p_session_id TEXT DEFAULT NULL,
  p_device_type TEXT DEFAULT NULL,
  p_browser TEXT DEFAULT NULL,
  p_os TEXT DEFAULT NULL,
  p_referrer TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.events (
    event_type, target_type, target_id,
    session_id, user_agent, referrer,
    device_type, browser, os
  )
  VALUES (
    'pixel_view', 'pixel', p_pixel_id,
    p_session_id, '', p_referrer,
    p_device_type, p_browser, p_os
  )
  RETURNING id INTO v_id;

  -- Increment the view_count on the pixel itself
  UPDATE public.pixels SET view_count = view_count + 1 WHERE id = p_pixel_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_pixel_view(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
