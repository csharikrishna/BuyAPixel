-- ============================================================================
-- FILE 2: PIXEL GRID INITIALIZATION
-- BuyAPixel Database - Initialize 22,500 Pixel Coordinates
-- Generated: December 7, 2025
-- Grid Size: 150 pixels wide × 150 pixels tall = 22,500 total pixels
-- ============================================================================

-- This script populates the pixels table with all coordinate positions
-- Uses ON CONFLICT DO NOTHING for idempotency (safe to run multiple times)

DO $$
DECLARE
  x_coord INTEGER;
  y_coord INTEGER;
  inserted_count INTEGER := 0;
BEGIN
  -- Check if pixels table is already populated
  IF (SELECT COUNT(*) FROM public.pixels) > 0 THEN
    RAISE NOTICE 'Pixels table already contains % records. Skipping initialization.', 
                 (SELECT COUNT(*) FROM public.pixels);
  ELSE
    RAISE NOTICE 'Initializing pixel grid (150×150 = 22,500 pixels)...';

    -- Loop through all x coordinates (0 to 149)
    FOR x_coord IN 0..149 LOOP
      -- Loop through all y coordinates (0 to 149)
      FOR y_coord IN 0..149 LOOP
        -- Insert pixel coordinate with default values
        INSERT INTO public.pixels (x, y, owner_id, price_tier, is_active)
        VALUES (x_coord, y_coord, NULL, 1, true)
        ON CONFLICT (x, y) DO NOTHING;  -- Skip if already exists

        inserted_count := inserted_count + 1;
      END LOOP;

      -- Progress indicator every 25 columns
      IF x_coord % 25 = 0 THEN
        RAISE NOTICE 'Progress: %% complete (x=%)', 
                     ROUND((x_coord::NUMERIC / 150) * 100, 1), 
                     x_coord;
      END IF;
    END LOOP;

    RAISE NOTICE '✓ Successfully initialized % pixel coordinates!', inserted_count;
  END IF;

  -- Display final statistics
  RAISE NOTICE '';
  RAISE NOTICE '=== Pixel Grid Statistics ===';
  RAISE NOTICE 'Total pixels: %', (SELECT COUNT(*) FROM public.pixels);
  RAISE NOTICE 'Owned pixels: %', (SELECT COUNT(*) FROM public.pixels WHERE owner_id IS NOT NULL);
  RAISE NOTICE 'Available pixels: %', (SELECT COUNT(*) FROM public.pixels WHERE owner_id IS NULL);
  RAISE NOTICE 'Grid dimensions: 150×150';
  RAISE NOTICE '';

  -- Sample pricing distribution
  RAISE NOTICE '=== Pricing Distribution ===';
  RAISE NOTICE 'Center pixels (₹299): Approximately % pixels', 
               ROUND((SELECT COUNT(*) FROM public.pixels WHERE 
                 SQRT(POWER(x - 75, 2) + POWER(y - 75, 2)) / SQRT(POWER(75, 2) + POWER(75, 2)) < 0.212));
  RAISE NOTICE 'Middle pixels (₹199): Approximately % pixels',
               ROUND((SELECT COUNT(*) FROM public.pixels WHERE 
                 SQRT(POWER(x - 75, 2) + POWER(y - 75, 2)) / SQRT(POWER(75, 2) + POWER(75, 2)) BETWEEN 0.212 AND 0.424));
  RAISE NOTICE 'Corner pixels (₹99): Approximately % pixels',
               ROUND((SELECT COUNT(*) FROM public.pixels WHERE 
                 SQRT(POWER(x - 75, 2) + POWER(y - 75, 2)) / SQRT(POWER(75, 2) + POWER(75, 2)) > 0.424));
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (Uncomment to run manually)
-- ============================================================================

-- Check total pixel count
-- SELECT COUNT(*) as total_pixels FROM public.pixels;

-- Check coordinate ranges
-- SELECT 
--   MIN(x) as min_x, MAX(x) as max_x,
--   MIN(y) as min_y, MAX(y) as max_y
-- FROM public.pixels;

-- Check ownership distribution
-- SELECT 
--   COUNT(*) FILTER (WHERE owner_id IS NULL) as available,
--   COUNT(*) FILTER (WHERE owner_id IS NOT NULL) as owned
-- FROM public.pixels;

-- Sample 10 random pixels
-- SELECT * FROM public.pixels ORDER BY RANDOM() LIMIT 10;

-- Test pricing function on center pixel
-- SELECT calculate_pixel_price(75, 75); -- Should return 299

-- Test pricing function on corner pixel
-- SELECT calculate_pixel_price(0, 0); -- Should return 99

-- ============================================================================
-- END OF FILE 2
-- ============================================================================
