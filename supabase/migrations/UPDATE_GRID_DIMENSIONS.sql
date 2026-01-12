-- ============================================================================
-- UPDATE GRID DIMENSIONS AND PRICING LOGIC
-- Changes grid from 150x150 to 100x100
-- Updates pricing logic to use Square Zones (Chebyshev distance) to match Frontend
-- ============================================================================

DROP FUNCTION IF EXISTS public.calculate_pixel_price(integer, integer);

CREATE OR REPLACE FUNCTION public.calculate_pixel_price(pixel_x INTEGER, pixel_y INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  grid_width INTEGER := 100;
  grid_height INTEGER := 100;
  center_x FLOAT := grid_width / 2.0;
  center_y FLOAT := grid_height / 2.0;
  dx FLOAT;
  dy FLOAT;
  max_dist FLOAT;
BEGIN
  -- Box-based pricing (Square zones) matching frontend logic
  dx := ABS(pixel_x - center_x);
  dy := ABS(pixel_y - center_y);
  
  -- Chebyshev distance (max of dx, dy) defines SQUARE zones
  IF dx > dy THEN
    max_dist := dx;
  ELSE
    max_dist := dy;
  END IF;

  -- Gold Zone (40x40 Square) -> Distance < 20 from center
  IF max_dist < 20 THEN
    RETURN 299;  -- Premium Center
  -- Standard Zone (80x80 Square) -> Distance < 40 from center
  ELSIF max_dist < 40 THEN
    RETURN 199;  -- Middle Ring
  ELSE
    RETURN 99;   -- Economy Outer Ring
  END IF;
END;
$$;

COMMENT ON FUNCTION public.calculate_pixel_price IS 'Calculates pixel price based on distance from center. Center pixels cost ₹299 (Radius < 20), middle ₹199 (Radius < 40), corners ₹99. Uses 100x100 grid with Square Zones.';

-- Verify the new function works as expected
-- Center (50, 50) -> dist 0 -> 299
-- Edge of Gold (70, 50) -> dist 20 -> 199 (since < 20 is exclusive, 20 is next tier)
-- Edge of Standard (90, 50) -> dist 40 -> 99
