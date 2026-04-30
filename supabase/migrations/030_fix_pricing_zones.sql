-- ============================================================================
-- 030: FIX PRICING ZONES
-- BuyASpot - Align database pricing with frontend edge-distance algorithm
-- ============================================================================
--
-- PROBLEM: The database `calculate_pixel_price` function still uses center-based
-- Chebyshev distance with the OLD prices (₹299/₹199/₹99), while the frontend
-- now uses edge-distance with the CORRECT prices (₹499/₹299/₹99).
--
-- The `admin_get_revenue_stats` and `get_heatmap_data` functions also have
-- hardcoded center-distance zone classification.
--
-- This migration:
--   1. Rewrites `calculate_pixel_price` → edge-distance (3+5 rows spec)
--   2. Fixes `admin_get_revenue_stats` zone classification
--   3. Fixes `get_heatmap_data` zone classification
--   4. Does NOT re-price already-purchased pixels (price_paid is historical)
-- ============================================================================

-- ============================================================================
-- 1. FIX calculate_pixel_price
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_pixel_price(p_x INTEGER, p_y INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dist_from_edge INTEGER;
BEGIN
  -- Distance from the nearest edge (minimum of all 4 sides)
  dist_from_edge := LEAST(p_x, p_y, 99 - p_x, 99 - p_y);

  IF dist_from_edge < 3 THEN
    RETURN 99;   -- Economy: outermost 3 rows (depth 0–2)
  ELSIF dist_from_edge < 8 THEN
    RETURN 299;  -- Premium: next 5 rows (depth 3–7)
  ELSE
    RETURN 499;  -- Gold: inner core (depth ≥ 8)
  END IF;
END;
$$;

COMMENT ON FUNCTION public.calculate_pixel_price IS
  'Calculates pixel price using distance from nearest edge. '
  'Outer 3 rows = ₹99 (Economy), next 5 rows = ₹299 (Premium), inner core = ₹499 (Gold)';

-- ============================================================================
-- 2. FIX admin_get_revenue_stats zone classification
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_revenue_stats(
  p_days INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT is_current_user_super_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT jsonb_build_object(
    'total_revenue', COALESCE(SUM(price_paid), 0),
    'total_sales', COUNT(*),
    'avg_price', COALESCE(AVG(price_paid), 0),
    'unique_buyers', COUNT(DISTINCT owner_id),

    'daily', (
      SELECT jsonb_agg(day_stats ORDER BY day)
      FROM (
        SELECT
          date_trunc('day', purchased_at)::DATE AS day,
          COUNT(*) AS sales,
          SUM(price_paid) AS revenue
        FROM pixels
        WHERE purchased_at >= NOW() - (p_days || ' days')::INTERVAL
          AND owner_id IS NOT NULL
        GROUP BY date_trunc('day', purchased_at)
      ) day_stats
    ),

    'weekly', (
      SELECT jsonb_agg(week_stats ORDER BY week)
      FROM (
        SELECT
          date_trunc('week', purchased_at)::DATE AS week,
          COUNT(*) AS sales,
          SUM(price_paid) AS revenue
        FROM pixels
        WHERE purchased_at >= NOW() - (p_days || ' days')::INTERVAL
          AND owner_id IS NOT NULL
        GROUP BY date_trunc('week', purchased_at)
      ) week_stats
    ),

    'by_zone', (
      SELECT jsonb_object_agg(zone, stats)
      FROM (
        SELECT
          CASE
            WHEN LEAST(x, y, 99 - x, 99 - y) < 3  THEN 'economy'
            WHEN LEAST(x, y, 99 - x, 99 - y) < 8  THEN 'premium'
            ELSE 'gold'
          END AS zone,
          jsonb_build_object('count', COUNT(*), 'revenue', SUM(price_paid)) AS stats
        FROM pixels
        WHERE owner_id IS NOT NULL
        GROUP BY 1
      ) zone_stats
    )
  ) INTO v_result
  FROM pixels
  WHERE purchased_at >= NOW() - (p_days || ' days')::INTERVAL
    AND owner_id IS NOT NULL;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- 3. FIX get_heatmap_data zone classification
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_heatmap_data()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'owned_pixels', (
        SELECT jsonb_agg(jsonb_build_object('x', x, 'y', y, 'price', price_paid))
        FROM pixels WHERE owner_id IS NOT NULL
      ),
      'zone_stats', (
        SELECT jsonb_object_agg(zone, cnt)
        FROM (
          SELECT
            CASE
              WHEN LEAST(x, y, 99 - x, 99 - y) < 3  THEN 'economy'
              WHEN LEAST(x, y, 99 - x, 99 - y) < 8  THEN 'premium'
              ELSE 'gold'
            END AS zone,
            COUNT(*) FILTER (WHERE owner_id IS NOT NULL) AS cnt
          FROM pixels
          GROUP BY 1
        ) z
      ),
      'recent_sales', (
        SELECT jsonb_agg(jsonb_build_object('x', x, 'y', y, 'price', price_paid, 'at', purchased_at))
        FROM (
          SELECT x, y, price_paid, purchased_at
          FROM pixels
          WHERE purchased_at IS NOT NULL
          ORDER BY purchased_at DESC
          LIMIT 50
        ) recent
      )
    )
  );
END;
$$;

-- ============================================================================
-- 4. VERIFICATION (run on apply to confirm pricing is correct)
-- ============================================================================

DO $$
BEGIN
  -- Verify edge pricing
  RAISE NOTICE '=== Pricing Verification (Migration 030) ===';
  RAISE NOTICE 'Corner (0,0):   ₹% (expected ₹99)',  calculate_pixel_price(0, 0);
  RAISE NOTICE 'Edge (2,50):    ₹% (expected ₹99)',  calculate_pixel_price(2, 50);
  RAISE NOTICE 'Border (3,50):  ₹% (expected ₹299)', calculate_pixel_price(3, 50);
  RAISE NOTICE 'Mid (7,50):     ₹% (expected ₹299)', calculate_pixel_price(7, 50);
  RAISE NOTICE 'Inner (8,50):   ₹% (expected ₹499)', calculate_pixel_price(8, 50);
  RAISE NOTICE 'Center (50,50): ₹% (expected ₹499)', calculate_pixel_price(50, 50);

  -- Verify boundaries
  IF calculate_pixel_price(0, 0) != 99 THEN
    RAISE EXCEPTION 'PRICING ERROR: Corner pixel (0,0) should be ₹99';
  END IF;
  IF calculate_pixel_price(2, 50) != 99 THEN
    RAISE EXCEPTION 'PRICING ERROR: Edge pixel (2,50) should be ₹99';
  END IF;
  IF calculate_pixel_price(3, 50) != 299 THEN
    RAISE EXCEPTION 'PRICING ERROR: Premium pixel (3,50) should be ₹299';
  END IF;
  IF calculate_pixel_price(7, 50) != 299 THEN
    RAISE EXCEPTION 'PRICING ERROR: Premium pixel (7,50) should be ₹299';
  END IF;
  IF calculate_pixel_price(8, 50) != 499 THEN
    RAISE EXCEPTION 'PRICING ERROR: Gold pixel (8,50) should be ₹499';
  END IF;
  IF calculate_pixel_price(50, 50) != 499 THEN
    RAISE EXCEPTION 'PRICING ERROR: Center pixel (50,50) should be ₹499';
  END IF;

  RAISE NOTICE '✓ All pricing checks passed!';
END $$;

-- ============================================================================
-- END OF 030
-- ============================================================================
