-- ============================================================================
-- 026: UNLOCK BLOCK PIXEL MARKETPLACE LISTINGS
-- BuyASpot - Allow selling individual pixels from blocks on marketplace
-- ============================================================================

-- ============================================================================
-- ENHANCED LIST_PIXEL_FOR_SALE
-- Remove block pixel restriction, allow individual sales from blocks
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
  
  SELECT * INTO v_pixel FROM pixels WHERE id = p_pixel_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pixel not found');
  END IF;
  
  IF v_pixel.owner_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not your pixel');
  END IF;

  -- Check if pixel is part of a block
  v_is_block_pixel := v_pixel.block_id IS NOT NULL;
  v_block_id := v_pixel.block_id;
  
  -- Allow listing even if part of a block (new behavior)
  -- Note: When a block pixel is sold individually, it transfers ownership
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

-- ============================================================================
-- ADD from_block_id COLUMN TO MARKETPLACE_LISTINGS
-- Track individual pixel sales from blocks
-- ============================================================================

ALTER TABLE public.marketplace_listings
ADD COLUMN IF NOT EXISTS from_block_id UUID DEFAULT NULL
REFERENCES public.pixel_blocks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_marketplace_from_block 
  ON public.marketplace_listings(from_block_id) 
  WHERE from_block_id IS NOT NULL;

-- ============================================================================
-- ENHANCED PURCHASE_FROM_MARKETPLACE_VERIFIED
-- When a block pixel is purchased individually, unlink it from the block
-- ============================================================================

DROP FUNCTION IF EXISTS public.purchase_from_marketplace_verified(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.purchase_from_marketplace_verified(
  p_marketplace_transaction_id UUID,
  p_razorpay_payment_id TEXT,
  p_razorpay_signature TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction marketplace_transactions%ROWTYPE;
  v_listing marketplace_listings%ROWTYPE;
  v_pixel pixels%ROWTYPE;
  v_block_id UUID;
  v_is_from_block BOOLEAN;
BEGIN
  -- Get transaction details
  SELECT * INTO v_transaction
  FROM marketplace_transactions
  WHERE id = p_marketplace_transaction_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction not found or already processed');
  END IF;

  -- Get listing details
  SELECT * INTO v_listing
  FROM marketplace_listings
  WHERE id = v_transaction.listing_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing not found');
  END IF;

  -- Get pixel details
  SELECT * INTO v_pixel
  FROM pixels
  WHERE id = v_listing.pixel_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pixel not found');
  END IF;

  v_is_from_block := v_listing.from_block_id IS NOT NULL;
  v_block_id := v_pixel.block_id;

  -- Update pixel ownership and unlink from block if it was part of one
  UPDATE pixels
  SET 
    owner_id = v_transaction.buyer_id,
    block_id = NULL, -- Unlink from block when sold individually
    price_paid = v_transaction.sale_price,
    purchased_at = NOW(),
    updated_at = NOW()
  WHERE id = v_listing.pixel_id
  AND owner_id = v_listing.seller_id; -- Verify seller still owns it

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pixel ownership changed (race condition)');
  END IF;

  -- Mark transaction as completed
  UPDATE marketplace_transactions
  SET 
    status = 'completed',
    razorpay_payment_id = p_razorpay_payment_id,
    razorpay_signature = p_razorpay_signature,
    completed_at = NOW()
  WHERE id = p_marketplace_transaction_id;

  -- Mark listing as sold
  UPDATE marketplace_listings
  SET status = 'sold'
  WHERE id = v_transaction.listing_id;

  -- Log the transaction
  PERFORM log_event('marketplace_sale', 'pixel', v_pixel.id::text,
    jsonb_build_object(
      'seller_id', v_listing.seller_id,
      'buyer_id', v_transaction.buyer_id,
      'amount', v_transaction.sale_price,
      'was_from_block', v_is_from_block,
      'block_id', v_block_id
    ));

  -- Update profiles
  UPDATE profiles
  SET pixel_count = pixel_count + 1
  WHERE user_id = v_transaction.buyer_id;

  UPDATE profiles
  SET pixel_count = pixel_count - 1
  WHERE user_id = v_listing.seller_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Pixel purchased successfully',
    'was_from_block', v_is_from_block,
    'buyer_pixel_count_increased', 1
  );
END;
$$;

-- ============================================================================
-- FUNCTION: Get Block Pixel Status
-- Shows which pixels in a block can be sold individually
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_block_pixel_status(p_block_id UUID)
RETURNS TABLE (
  pixel_id UUID,
  x INTEGER,
  y INTEGER,
  owner_id UUID,
  is_listed BOOLEAN,
  listing_price NUMERIC,
  can_list BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.x,
    p.y,
    p.owner_id,
    (ml.id IS NOT NULL)::BOOLEAN as is_listed,
    ml.asking_price,
    true::BOOLEAN as can_list -- Now all block pixels can be listed
  FROM pixels p
  LEFT JOIN marketplace_listings ml ON ml.pixel_id = p.id AND ml.status = 'active'
  WHERE p.block_id = p_block_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_block_pixel_status(UUID) TO authenticated;

-- ============================================================================
-- END OF 026
-- ============================================================================
