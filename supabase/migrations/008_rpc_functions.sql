-- ============================================================================
-- 008: RPC FUNCTIONS
-- BuyAPixel - All Frontend-Callable Functions
-- ============================================================================

-- ============================================================================
-- PIXEL PURCHASE FUNCTIONS
-- ============================================================================

-- Get pixel info for purchase
CREATE OR REPLACE FUNCTION public.get_pixel_info(p_x INTEGER, p_y INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pixel pixels%ROWTYPE;
  v_block pixel_blocks%ROWTYPE;
BEGIN
  IF p_x < 0 OR p_x >= 100 OR p_y < 0 OR p_y >= 100 THEN
    RETURN jsonb_build_object('error', 'Invalid coordinates');
  END IF;

  SELECT * INTO v_pixel FROM pixels WHERE x = p_x AND y = p_y;
  
  IF v_pixel.block_id IS NOT NULL THEN
    SELECT * INTO v_block FROM pixel_blocks WHERE id = v_pixel.block_id;
  END IF;

  RETURN jsonb_build_object(
    'pixel_id', v_pixel.id,
    'x', p_x,
    'y', p_y,
    'available', v_pixel.owner_id IS NULL,
    'price', calculate_pixel_price(p_x, p_y),
    'owner_id', v_pixel.owner_id,
    'block_id', v_pixel.block_id,
    'image_url', COALESCE(v_block.image_url, v_pixel.image_url),
    'link_url', COALESCE(v_block.link_url, v_pixel.link_url),
    'alt_text', COALESCE(v_block.alt_text, v_pixel.alt_text)
  );
END;
$$;

-- Purchase single pixel
CREATE OR REPLACE FUNCTION public.purchase_pixel(
  p_x INTEGER,
  p_y INTEGER,
  p_image_url TEXT DEFAULT NULL,
  p_link_url TEXT DEFAULT NULL,
  p_alt_text TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_pixel_id UUID;
  v_price INTEGER;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  IF p_x < 0 OR p_x >= 100 OR p_y < 0 OR p_y >= 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid coordinates');
  END IF;
  
  v_price := calculate_pixel_price(p_x, p_y);
  
  UPDATE pixels
  SET 
    owner_id = v_user_id,
    image_url = p_image_url,
    link_url = p_link_url,
    alt_text = p_alt_text,
    price_paid = v_price,
    purchased_at = NOW(),
    updated_at = NOW()
  WHERE x = p_x AND y = p_y AND owner_id IS NULL
  RETURNING id INTO v_pixel_id;
  
  IF v_pixel_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pixel not available');
  END IF;
  
  -- Update profile counters
  UPDATE profiles
  SET 
    pixel_count = pixel_count + 1,
    total_spent = total_spent + v_price,
    last_active_at = NOW()
  WHERE user_id = v_user_id;
  
  -- Log event
  PERFORM log_event('pixel_purchase', 'pixel', v_pixel_id, 
    jsonb_build_object('x', p_x, 'y', p_y, 'price', v_price));
  
  RETURN jsonb_build_object(
    'success', true,
    'pixel_id', v_pixel_id,
    'x', p_x,
    'y', p_y,
    'price', v_price
  );
END;
$$;

-- Purchase multiple pixels as a block
CREATE OR REPLACE FUNCTION public.purchase_pixels_block(
  p_pixels JSONB,  -- Array of {x, y} objects
  p_image_url TEXT,
  p_link_url TEXT DEFAULT NULL,
  p_alt_text TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_block_id UUID;
  v_pixel JSONB;
  v_x INTEGER;
  v_y INTEGER;
  v_min_x INTEGER := 100;
  v_max_x INTEGER := 0;
  v_min_y INTEGER := 100;
  v_max_y INTEGER := 0;
  v_total_price NUMERIC := 0;
  v_pixel_count INTEGER := 0;
  v_unavailable JSONB := '[]'::JSONB;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  IF p_image_url IS NULL OR p_image_url = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Image URL required for block purchase');
  END IF;
  
  -- Validate and check availability of all pixels
  FOR v_pixel IN SELECT * FROM jsonb_array_elements(p_pixels)
  LOOP
    v_x := (v_pixel->>'x')::INTEGER;
    v_y := (v_pixel->>'y')::INTEGER;
    
    IF v_x < 0 OR v_x >= 100 OR v_y < 0 OR v_y >= 100 THEN
      RETURN jsonb_build_object('success', false, 'error', format('Invalid coordinates (%s, %s)', v_x, v_y));
    END IF;
    
    -- Check if available
    IF EXISTS (SELECT 1 FROM pixels WHERE x = v_x AND y = v_y AND owner_id IS NOT NULL) THEN
      v_unavailable := v_unavailable || jsonb_build_object('x', v_x, 'y', v_y);
    ELSE
      -- Update bounds
      v_min_x := LEAST(v_min_x, v_x);
      v_max_x := GREATEST(v_max_x, v_x);
      v_min_y := LEAST(v_min_y, v_y);
      v_max_y := GREATEST(v_max_y, v_y);
      v_total_price := v_total_price + calculate_pixel_price(v_x, v_y);
      v_pixel_count := v_pixel_count + 1;
    END IF;
  END LOOP;
  
  IF jsonb_array_length(v_unavailable) > 0 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Some pixels are not available',
      'unavailable', v_unavailable
    );
  END IF;
  
  IF v_pixel_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No valid pixels');
  END IF;
  
  -- Create block
  INSERT INTO pixel_blocks (owner_id, image_url, link_url, alt_text, min_x, max_x, min_y, max_y, pixel_count, total_price)
  VALUES (v_user_id, p_image_url, p_link_url, p_alt_text, v_min_x, v_max_x, v_min_y, v_max_y, v_pixel_count, v_total_price)
  RETURNING id INTO v_block_id;
  
  -- Update all pixels
  FOR v_pixel IN SELECT * FROM jsonb_array_elements(p_pixels)
  LOOP
    v_x := (v_pixel->>'x')::INTEGER;
    v_y := (v_pixel->>'y')::INTEGER;
    
    UPDATE pixels
    SET 
      owner_id = v_user_id,
      block_id = v_block_id,
      price_paid = calculate_pixel_price(v_x, v_y),
      purchased_at = NOW(),
      updated_at = NOW()
    WHERE x = v_x AND y = v_y AND owner_id IS NULL;
  END LOOP;
  
  -- Update profile counters
  UPDATE profiles
  SET 
    pixel_count = pixel_count + v_pixel_count,
    total_spent = total_spent + v_total_price,
    last_active_at = NOW()
  WHERE user_id = v_user_id;
  
  -- Log event
  PERFORM log_event('block_purchase', 'pixel_block', v_block_id,
    jsonb_build_object(
      'pixel_count', v_pixel_count,
      'total_price', v_total_price,
      'bounds', jsonb_build_object('min_x', v_min_x, 'max_x', v_max_x, 'min_y', v_min_y, 'max_y', v_max_y)
    ));
  
  RETURN jsonb_build_object(
    'success', true,
    'block_id', v_block_id,
    'pixel_count', v_pixel_count,
    'total_price', v_total_price
  );
END;
$$;

-- ============================================================================
-- MARKETPLACE FUNCTIONS
-- ============================================================================

-- Create listing
CREATE OR REPLACE FUNCTION public.create_listing(
  p_pixel_id UUID,
  p_asking_price NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pixel pixels%ROWTYPE;
  v_listing_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  SELECT * INTO v_pixel FROM pixels WHERE id = p_pixel_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pixel not found');
  END IF;
  
  IF v_pixel.owner_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not your pixel');
  END IF;
  
  IF v_pixel.block_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot list block pixels individually');
  END IF;
  
  INSERT INTO marketplace_listings (pixel_id, seller_id, asking_price, original_price)
  VALUES (p_pixel_id, auth.uid(), p_asking_price, v_pixel.price_paid)
  RETURNING id INTO v_listing_id;
  
  PERFORM log_event('listing_created', 'marketplace_listing', v_listing_id,
    jsonb_build_object('pixel_id', p_pixel_id, 'asking_price', p_asking_price));
  
  RETURN jsonb_build_object('success', true, 'listing_id', v_listing_id);
END;
$$;

-- Purchase from marketplace
CREATE OR REPLACE FUNCTION public.purchase_from_marketplace(p_listing_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing marketplace_listings%ROWTYPE;
  v_buyer_id UUID;
  v_transaction_id UUID;
BEGIN
  v_buyer_id := auth.uid();
  
  IF v_buyer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  SELECT * INTO v_listing
  FROM marketplace_listings
  WHERE id = p_listing_id AND status = 'active'
  FOR UPDATE NOWAIT;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing not available');
  END IF;
  
  IF v_listing.seller_id = v_buyer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot buy your own listing');
  END IF;
  
  -- Transfer ownership
  UPDATE pixels SET
    owner_id = v_buyer_id,
    price_paid = v_listing.asking_price,
    purchased_at = NOW(),
    times_resold = times_resold + 1,
    last_sale_price = v_listing.asking_price,
    last_sale_date = NOW(),
    updated_at = NOW()
  WHERE id = v_listing.pixel_id;
  
  -- Mark listing as sold
  UPDATE marketplace_listings
  SET status = 'sold', sold_at = NOW(), updated_at = NOW()
  WHERE id = p_listing_id;
  
  -- Create transaction record
  INSERT INTO marketplace_transactions (
    listing_id, buyer_id, seller_id, pixel_id, 
    sale_price, seller_net, status
  ) VALUES (
    p_listing_id, v_buyer_id, v_listing.seller_id, v_listing.pixel_id,
    v_listing.asking_price, v_listing.asking_price, 'completed'
  ) RETURNING id INTO v_transaction_id;
  
  -- Update buyer profile
  UPDATE profiles SET
    pixel_count = pixel_count + 1,
    total_spent = total_spent + v_listing.asking_price,
    last_active_at = NOW()
  WHERE user_id = v_buyer_id;
  
  -- Update seller profile
  UPDATE profiles SET
    pixel_count = pixel_count - 1,
    last_active_at = NOW()
  WHERE user_id = v_listing.seller_id;
  
  PERFORM log_event('listing_sold', 'marketplace_listing', p_listing_id,
    jsonb_build_object('buyer_id', v_buyer_id, 'sale_price', v_listing.asking_price));
  
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'pixel_id', v_listing.pixel_id
  );

EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing is being purchased');
END;
$$;

-- ============================================================================
-- STATS FUNCTIONS
-- ============================================================================

-- Get grid stats (uses materialized view)
CREATE OR REPLACE FUNCTION public.get_grid_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT to_jsonb(mv.*) FROM mv_grid_stats mv LIMIT 1
  );
END;
$$;

-- Get leaderboard
CREATE OR REPLACE FUNCTION public.get_leaderboard(p_limit INTEGER DEFAULT 10)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(row_to_json(mv.*))
    FROM (SELECT * FROM mv_leaderboard LIMIT p_limit) mv
  );
END;
$$;

-- Get user stats
CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_profile profiles%ROWTYPE;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  SELECT * INTO v_profile FROM profiles WHERE user_id = v_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;
  
  RETURN jsonb_build_object(
    'user_id', v_user_id,
    'pixel_count', v_profile.pixel_count,
    'total_spent', v_profile.total_spent,
    'block_count', (SELECT COUNT(*) FROM pixel_blocks WHERE owner_id = v_user_id),
    'listing_count', (SELECT COUNT(*) FROM marketplace_listings WHERE seller_id = v_user_id AND status = 'active'),
    'sale_count', (SELECT COUNT(*) FROM marketplace_transactions WHERE seller_id = v_user_id AND status = 'completed')
  );
END;
$$;

-- Get marketplace stats
CREATE OR REPLACE FUNCTION public.get_marketplace_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'active_listings', COUNT(*) FILTER (WHERE status = 'active'),
      'total_sold', COUNT(*) FILTER (WHERE status = 'sold'),
      'avg_price', COALESCE(ROUND(AVG(asking_price) FILTER (WHERE status = 'active')), 0),
      'min_price', COALESCE(MIN(asking_price) FILTER (WHERE status = 'active'), 0),
      'max_price', COALESCE(MAX(asking_price) FILTER (WHERE status = 'active'), 0)
    )
    FROM marketplace_listings
  );
END;
$$;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_pixel_info(INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_pixel(INTEGER, INTEGER, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_pixels_block(JSONB, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_listing(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_from_marketplace(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_grid_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_stats(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_marketplace_stats() TO anon, authenticated;

-- ============================================================================
-- END OF 008
-- ============================================================================
