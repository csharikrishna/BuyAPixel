-- ============================================================================
-- 037: PIXEL INFO MODAL & PERFORMANCE INDEXES
-- BuyASpot - Support for pixel info modal + query optimization
-- ============================================================================

-- ============================================================================
-- RPC: get_pixel_info
-- Fetches pixel/block data with owner profile in a single query
-- Used by the PixelInfoModal component
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_pixel_info(
  p_x INTEGER,
  p_y INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pixel RECORD;
  v_block RECORD;
  v_owner RECORD;
  v_result JSONB;
BEGIN
  -- Fetch the pixel at this coordinate
  SELECT p.id, p.x, p.y, p.owner_id, p.image_url, p.link_url, p.alt_text,
         p.block_id, p.price_paid, p.purchased_at, p.view_count
  INTO v_pixel
  FROM pixels p
  WHERE p.x = p_x AND p.y = p_y AND p.owner_id IS NOT NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Increment view count (fire-and-forget analytics)
  UPDATE pixels SET view_count = COALESCE(view_count, 0) + 1
  WHERE x = p_x AND y = p_y;

  -- Fetch block data if this pixel is part of a block
  IF v_pixel.block_id IS NOT NULL THEN
    SELECT b.id, b.owner_id, b.image_url, b.link_url, b.alt_text,
           b.min_x, b.max_x, b.min_y, b.max_y,
           b.pixel_count, b.total_price, b.created_at
    INTO v_block
    FROM pixel_blocks b
    WHERE b.id = v_pixel.block_id;
  END IF;

  -- Fetch owner profile
  SELECT pr.full_name, pr.avatar_url
  INTO v_owner
  FROM profiles pr
  WHERE pr.user_id = v_pixel.owner_id;

  -- Build result
  v_result := jsonb_build_object(
    'found', true,
    'pixel', jsonb_build_object(
      'id', v_pixel.id,
      'x', v_pixel.x,
      'y', v_pixel.y,
      'owner_id', v_pixel.owner_id,
      'image_url', v_pixel.image_url,
      'link_url', v_pixel.link_url,
      'alt_text', v_pixel.alt_text,
      'block_id', v_pixel.block_id,
      'price_paid', v_pixel.price_paid,
      'purchased_at', v_pixel.purchased_at,
      'view_count', v_pixel.view_count
    ),
    'owner', jsonb_build_object(
      'full_name', COALESCE(v_owner.full_name, 'Anonymous'),
      'avatar_url', v_owner.avatar_url
    )
  );

  -- Add block data if exists
  IF v_block.id IS NOT NULL THEN
    v_result := v_result || jsonb_build_object(
      'block', jsonb_build_object(
        'id', v_block.id,
        'owner_id', v_block.owner_id,
        'image_url', v_block.image_url,
        'link_url', v_block.link_url,
        'alt_text', v_block.alt_text,
        'min_x', v_block.min_x,
        'max_x', v_block.max_x,
        'min_y', v_block.min_y,
        'max_y', v_block.max_y,
        'pixel_count', v_block.pixel_count,
        'total_price', v_block.total_price,
        'created_at', v_block.created_at
      )
    );
  END IF;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_pixel_info IS 'Fetches pixel/block/owner data for the info modal in a single roundtrip';

-- Grant access to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.get_pixel_info(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pixel_info(INTEGER, INTEGER) TO service_role;

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Partial index for pixel blocks with images (used by grid rendering)
CREATE INDEX IF NOT EXISTS idx_pixel_blocks_bounds
  ON public.pixel_blocks(min_x, min_y, max_x, max_y)
  WHERE pixel_count > 1;

-- Composite index for pixel info lookups (owned pixels by coordinate)
CREATE INDEX IF NOT EXISTS idx_pixels_owned_position
  ON public.pixels(x, y)
  WHERE owner_id IS NOT NULL;

-- ============================================================================
-- END OF 037
-- ============================================================================
