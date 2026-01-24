-- ============================================================================
-- 010: SEED DATA
-- BuyAPixel - Grid Initialization and Default Data
-- ============================================================================

-- ============================================================================
-- INITIALIZE PIXEL GRID (100x100 = 10,000 pixels)
-- ============================================================================

DO $$
DECLARE
  v_x INTEGER;
  v_y INTEGER;
  v_count INTEGER := 0;
BEGIN
  -- Check if already initialized
  IF (SELECT COUNT(*) FROM public.pixels) >= 10000 THEN
    RAISE NOTICE 'Grid already initialized with % pixels', (SELECT COUNT(*) FROM public.pixels);
    RETURN;
  END IF;

  RAISE NOTICE 'Initializing 100x100 pixel grid...';
  
  FOR v_x IN 0..99 LOOP
    FOR v_y IN 0..99 LOOP
      INSERT INTO public.pixels (x, y)
      VALUES (v_x, v_y)
      ON CONFLICT (x, y) DO NOTHING;
      
      v_count := v_count + 1;
    END LOOP;
    
    -- Progress every 10 rows
    IF v_x % 10 = 0 THEN
      RAISE NOTICE 'Progress: %/100 rows', v_x;
    END IF;
  END LOOP;
  
  RAISE NOTICE '✓ Grid initialized with % pixels', v_count;
END $$;

-- ============================================================================
-- INITIAL MATERIALIZED VIEW REFRESH
-- ============================================================================

REFRESH MATERIALIZED VIEW public.mv_grid_stats;
REFRESH MATERIALIZED VIEW public.mv_leaderboard;

-- ============================================================================
-- SEED BLOG CATEGORIES
-- ============================================================================

INSERT INTO public.blog_categories (name, slug, description, display_order) VALUES
  ('Announcements', 'announcements', 'Platform news and updates', 1),
  ('Tutorials', 'tutorials', 'How-to guides and tips', 2),
  ('Community', 'community', 'Community highlights and stories', 3),
  ('Tech', 'tech', 'Technical articles and updates', 4)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- SEED ANNOUNCEMENT
-- ============================================================================

INSERT INTO public.announcements (title, message, type, is_active, priority) VALUES
  ('Welcome to BuyAPixel!', 'Start building your digital real estate today. Each pixel is a piece of history.', 'info', true, 10)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFY INITIALIZATION
-- ============================================================================

DO $$
DECLARE
  v_pixels INTEGER;
  v_stats RECORD;
BEGIN
  SELECT COUNT(*) INTO v_pixels FROM public.pixels;
  SELECT * INTO v_stats FROM public.mv_grid_stats;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== Database Initialization Complete ===';
  RAISE NOTICE 'Total pixels: %', v_pixels;
  RAISE NOTICE 'Available: %', v_stats.available_pixels;
  RAISE NOTICE 'Sold: %', v_stats.sold_pixels;
  RAISE NOTICE '';
  
  -- Verify pricing
  RAISE NOTICE '=== Pricing Zones ===';
  RAISE NOTICE 'Center (50,50): ₹%', calculate_pixel_price(50, 50);
  RAISE NOTICE 'Middle (30,50): ₹%', calculate_pixel_price(30, 50);
  RAISE NOTICE 'Corner (0,0):   ₹%', calculate_pixel_price(0, 0);
END $$;

-- ============================================================================
-- END OF 010
-- ============================================================================
