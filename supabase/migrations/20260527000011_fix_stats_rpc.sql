-- =============================================================
-- Migration: Platform Stats RPC Fix
-- =============================================================
-- Public-facing stats for the BuyASpot Live Index page.
-- Fixes column name error "price" to "sale_price"
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
    'total_pixels_sold', (SELECT COUNT(*) FROM public.pixels),
    'total_pixels', 10000,
    'fill_rate_percent', ROUND((SELECT COUNT(*)::numeric FROM public.pixels) / 10000 * 100, 1),
    'total_revenue', (SELECT COALESCE(SUM(price_paid), 0) FROM public.pixels),
    'active_advertisers', (SELECT COUNT(DISTINCT owner_id) FROM public.pixels),
    'total_blocks', (SELECT COUNT(*) FROM public.pixel_blocks),

    -- Activity metrics
    'pixels_sold_today', (
      SELECT COUNT(*) FROM public.pixels
      WHERE purchased_at >= CURRENT_DATE
    ),
    'pixels_sold_this_week', (
      SELECT COUNT(*) FROM public.pixels
      WHERE purchased_at >= date_trunc('week', now())
    ),
    'pixels_sold_this_month', (
      SELECT COUNT(*) FROM public.pixels
      WHERE purchased_at >= date_trunc('month', now())
    ),

    -- Tier breakdown
    'tier_breakdown', (
      SELECT json_build_object(
        'economy', COALESCE(SUM(CASE WHEN price_paid < 299 THEN 1 ELSE 0 END), 0),
        'premium', COALESCE(SUM(CASE WHEN price_paid >= 299 AND price_paid < 499 THEN 1 ELSE 0 END), 0),
        'gold', COALESCE(SUM(CASE WHEN price_paid >= 499 THEN 1 ELSE 0 END), 0)
      )
      FROM public.pixels
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
        WHERE purchased_at >= now() - interval '30 days'
        GROUP BY DATE(purchased_at)
        ORDER BY date
      ) daily
    ), '[]'::json),

    -- Top advertisers (by pixel count)
    'top_advertisers', COALESCE((
      SELECT json_agg(row_to_json(top_adv))
      FROM (
        SELECT
          p.full_name as name,
          p.avatar_url,
          COUNT(px.*) as pixel_count,
          COALESCE(SUM(px.price_paid), 0) as total_spent
        FROM public.profiles p
        JOIN public.pixels px ON px.owner_id = p.user_id
        GROUP BY p.user_id, p.full_name, p.avatar_url
        ORDER BY pixel_count DESC
        LIMIT 10
      ) top_adv
    ), '[]'::json),

    -- Recent purchases (last 10)
    'recent_purchases', COALESCE((
      SELECT json_agg(row_to_json(recent))
      FROM (
        SELECT
          pb.pixel_count,
          pb.total_price,
          pb.created_at,
          pr.full_name as buyer_name,
          pr.avatar_url as buyer_avatar
        FROM public.pixel_blocks pb
        LEFT JOIN public.profiles pr ON pr.user_id = pb.owner_id
        ORDER BY pb.created_at DESC
        LIMIT 10
      ) recent
    ), '[]'::json),

    -- Most active zones (grid quadrants)
    'zone_activity', (
      SELECT json_build_object(
        'top_left', (SELECT COUNT(*) FROM public.pixels WHERE x < 50 AND y < 50),
        'top_right', (SELECT COUNT(*) FROM public.pixels WHERE x >= 50 AND y < 50),
        'bottom_left', (SELECT COUNT(*) FROM public.pixels WHERE x < 50 AND y >= 50),
        'bottom_right', (SELECT COUNT(*) FROM public.pixels WHERE x >= 50 AND y >= 50)
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

-- Allow anyone (including anonymous) to view platform stats
GRANT EXECUTE ON FUNCTION get_platform_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_platform_stats() TO anon;
