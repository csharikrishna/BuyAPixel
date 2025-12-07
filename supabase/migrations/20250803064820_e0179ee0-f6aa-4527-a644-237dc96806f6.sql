-- Update pixels table to include pricing tier (if not already exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pixels' AND column_name = 'price_tier') THEN
        ALTER TABLE public.pixels ADD COLUMN price_tier INTEGER DEFAULT 99;
    END IF;
END $$;

-- Function to calculate pixel price based on position
CREATE OR REPLACE FUNCTION public.calculate_pixel_price(pixel_x INTEGER, pixel_y INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  grid_size INTEGER := 224;
  center_x FLOAT := grid_size / 2.0;
  center_y FLOAT := grid_size / 2.0;
  distance_from_center FLOAT;
  corner_threshold FLOAT := grid_size * 0.3;
  middle_threshold FLOAT := grid_size * 0.15;
BEGIN
  -- Calculate distance from center
  distance_from_center := SQRT(POWER(pixel_x - center_x, 2) + POWER(pixel_y - center_y, 2));
  
  -- Determine price based on distance from center
  IF distance_from_center > corner_threshold THEN
    RETURN 99;  -- Corner pixels
  ELSIF distance_from_center > middle_threshold THEN
    RETURN 199; -- Middle-corner pixels
  ELSE
    RETURN 299; -- Center pixels
  END IF;
END;
$$;