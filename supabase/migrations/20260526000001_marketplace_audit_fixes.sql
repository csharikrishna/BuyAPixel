-- ============================================================================
-- MARKETPLACE AUDIT FIXES
-- BuyASpot — Fix issues #1-#5, #7-#8, #12-#13 from marketplace audit
-- ============================================================================

-- ============================================================================
-- FIX #5 + #7 + #8: Enhanced list_pixel_for_sale with duplicate check + price limits
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_pixel_for_sale(
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
  v_block_id UUID;
  v_is_block_pixel BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Price validation (#7, #8)
  IF p_asking_price < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum listing price is ₹10');
  END IF;

  IF p_asking_price > 99999 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Maximum listing price is ₹99,999');
  END IF;

  SELECT * INTO v_pixel FROM pixels WHERE id = p_pixel_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pixel not found');
  END IF;

  IF v_pixel.owner_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not your pixel');
  END IF;

  -- Duplicate active listing check (#5)
  IF EXISTS (
    SELECT 1 FROM marketplace_listings
    WHERE pixel_id = p_pixel_id AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This pixel is already listed on the marketplace');
  END IF;

  -- Check if pixel is part of a block
  v_is_block_pixel := v_pixel.block_id IS NOT NULL;
  v_block_id := v_pixel.block_id;

  -- Allow listing even if part of a block
  -- When a block pixel is sold individually, it transfers ownership
  -- and is unlinked from the block

  INSERT INTO marketplace_listings (
    pixel_id,
    seller_id,
    asking_price,
    original_price,
    from_block_id
  ) VALUES (
    p_pixel_id,
    auth.uid(),
    p_asking_price,
    v_pixel.price_paid,
    v_block_id
  )
  RETURNING id INTO v_listing_id;

  PERFORM log_event('listing_created', 'marketplace_listing', v_listing_id,
    jsonb_build_object(
      'pixel_id', p_pixel_id,
      'asking_price', p_asking_price,
      'original_price', v_pixel.price_paid,
      'is_from_block', v_is_block_pixel,
      'block_id', v_block_id
    ));

  RETURN jsonb_build_object(
    'success', true,
    'listing_id', v_listing_id,
    'is_from_block', v_is_block_pixel
  );
END;
$$;

-- Ensure permissions
GRANT EXECUTE ON FUNCTION public.list_pixel_for_sale(UUID, NUMERIC) TO authenticated;

-- ============================================================================
-- FIX #2 + #12: Drop dead/superseded RPCs
-- ============================================================================

-- purchase_from_marketplace (008) — superseded by complete_marketplace_purchase (031)
DROP FUNCTION IF EXISTS public.purchase_from_marketplace(UUID);

-- create_listing (008) — superseded by list_pixel_for_sale (026)
DROP FUNCTION IF EXISTS public.create_listing(UUID, NUMERIC);

-- ============================================================================
-- FIX #13: Drop unused platform_config type
-- ============================================================================

DROP TYPE IF EXISTS platform_config;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
  -- Verify list_pixel_for_sale exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'list_pixel_for_sale'
  ) THEN
    RAISE EXCEPTION '❌ list_pixel_for_sale not found!';
  END IF;

  -- Verify dead functions are gone
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'purchase_from_marketplace'
    AND pronargs = 1
  ) THEN
    RAISE EXCEPTION '❌ purchase_from_marketplace still exists!';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'create_listing'
  ) THEN
    RAISE EXCEPTION '❌ create_listing still exists!';
  END IF;

  RAISE NOTICE '✓ Marketplace audit fixes applied successfully';
END $$;
