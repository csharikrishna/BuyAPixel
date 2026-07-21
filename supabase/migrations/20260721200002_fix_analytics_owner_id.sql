-- Fix: pixel_clicks doesn't have owner_id column, use p2.owner_id from joined pixels table
CREATE OR REPLACE FUNCTION get_owner_dashboard_analytics(
  target_user_id UUID,
  time_range TEXT DEFAULT 'all'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  range_start TIMESTAMPTZ;
  range_end TIMESTAMPTZ := now();
BEGIN
  IF auth.uid() IS DISTINCT FROM target_user_id THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

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
        GROUP BY 1
        ORDER BY count DESC
      ) ref
    ), '[]'::json),

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
            SELECT p2.owner_id, COUNT(*) as cnt
            FROM public.pixel_clicks pc2
            JOIN public.pixels p2 ON p2.id = pc2.pixel_id
            WHERE pc2.clicked_at >= range_start AND pc2.clicked_at < range_end
            GROUP BY p2.owner_id
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

    'generated_at', now()
  ) INTO result;

  RETURN result;
END;
$$;
