-- =============================================================
-- Migration: Update Platform Stats to use Project/Brand Leaderboard
-- =============================================================
-- Modifies get_platform_stats to pull top advertisers from vw_project_leaderboard
-- and formats recent purchases to use project name/logo.
-- =============================================================

CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    -- Core metrics
    'total_pixels_sold', (SELECT COUNT(*) FROM public.pixels WHERE owner_id IS NOT NULL),
    'total_pixels', 10000,
    'fill_rate_percent', ROUND((SELECT COUNT(*)::numeric FROM public.pixels WHERE owner_id IS NOT NULL) / 10000 * 100, 1),
    'total_revenue', (SELECT COALESCE(SUM(price_paid), 0) FROM public.pixels WHERE owner_id IS NOT NULL),
    'active_advertisers', (SELECT COUNT(DISTINCT owner_id) FROM public.pixels WHERE owner_id IS NOT NULL),
    'total_blocks', (SELECT COUNT(*) FROM public.pixel_blocks),

    -- Activity metrics
    'pixels_sold_today', (
      SELECT COUNT(*) FROM public.pixels
      WHERE owner_id IS NOT NULL AND purchased_at >= CURRENT_DATE
    ),
    'pixels_sold_this_week', (
      SELECT COUNT(*) FROM public.pixels
      WHERE owner_id IS NOT NULL AND purchased_at >= date_trunc('week', now())
    ),
    'pixels_sold_this_month', (
      SELECT COUNT(*) FROM public.pixels
      WHERE owner_id IS NOT NULL AND purchased_at >= date_trunc('month', now())
    ),

    -- Tier breakdown
    'tier_breakdown', (
      SELECT json_build_object(
        'economy', COALESCE(SUM(CASE WHEN price_paid < 299 THEN 1 ELSE 0 END), 0),
        'premium', COALESCE(SUM(CASE WHEN price_paid >= 299 AND price_paid < 499 THEN 1 ELSE 0 END), 0),
        'gold', COALESCE(SUM(CASE WHEN price_paid >= 499 THEN 1 ELSE 0 END), 0)
      )
      FROM public.pixels
      WHERE owner_id IS NOT NULL
    ),

    -- Daily purchase velocity (last 30 days)
    'daily_velocity', COALESCE((
      SELECT json_agg(row_to_json(daily) ORDER BY daily.date)
      FROM (
        SELECT
          DATE(purchased_at) as date,
          COUNT(*) as count,
          COALESCE(SUM(price_paid), 0) as revenue
        FROM public.pixels
        WHERE owner_id IS NOT NULL AND purchased_at >= now() - interval '30 days'
        GROUP BY DATE(purchased_at)
        ORDER BY date
      ) daily
    ), '[]'::json),

    -- Top advertisers (by project name using the new view)
    'top_advertisers', COALESCE((
      SELECT json_agg(row_to_json(top_adv))
      FROM (
        SELECT
          project_name as name,
          avatar_url,
          pixel_count,
          total_spent
        FROM public.vw_project_leaderboard
        ORDER BY pixel_count DESC
        LIMIT 10
      ) top_adv
    ), '[]'::json),

    -- Recent purchases (last 10) - updated to use alt_text and image_url
    'recent_purchases', COALESCE((
      SELECT json_agg(row_to_json(recent))
      FROM (
        SELECT
          pb.pixel_count,
          pb.total_price,
          pb.created_at,
          COALESCE(NULLIF(TRIM(pb.alt_text), ''), pr.full_name, 'Anonymous') as buyer_name,
          COALESCE(NULLIF(TRIM(pb.image_url), ''), pr.avatar_url) as buyer_avatar
        FROM public.pixel_blocks pb
        LEFT JOIN public.profiles pr ON pr.user_id = pb.owner_id
        ORDER BY pb.created_at DESC
        LIMIT 10
      ) recent
    ), '[]'::json),

    -- Most active zones (grid quadrants)
    'zone_activity', (
      SELECT json_build_object(
        'top_left', (SELECT COUNT(*) FROM public.pixels WHERE owner_id IS NOT NULL AND x < 50 AND y < 50),
        'top_right', (SELECT COUNT(*) FROM public.pixels WHERE owner_id IS NOT NULL AND x >= 50 AND y < 50),
        'bottom_left', (SELECT COUNT(*) FROM public.pixels WHERE owner_id IS NOT NULL AND x < 50 AND y >= 50),
        'bottom_right', (SELECT COUNT(*) FROM public.pixels WHERE owner_id IS NOT NULL AND x >= 50 AND y >= 50)
      )
    ),

    -- Marketplace stats
    'marketplace', json_build_object(
      'active_listings', (SELECT COUNT(*) FROM public.marketplace_listings WHERE status = 'active'),
      'total_transactions', (SELECT COUNT(*) FROM public.marketplace_transactions WHERE status = 'completed'),
      'total_volume', (SELECT COALESCE(SUM(sale_price), 0) FROM public.marketplace_transactions WHERE status = 'completed')
    ),

    -- Generated at timestamp
    'generated_at', now()
  ) INTO result;

  RETURN result;
END;
$$;
