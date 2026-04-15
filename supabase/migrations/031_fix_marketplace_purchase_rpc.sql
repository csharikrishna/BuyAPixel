-- ============================================================================
-- 031: FIX MARKETPLACE PURCHASE RPC
-- BuyAPixel — Reconcile the parameter mismatch between edge function and DB.
--
-- Problem:
--   Migration 026 changed `purchase_from_marketplace_verified` to accept
--   `p_marketplace_transaction_id`, but the edge function
--   `verify-marketplace-payment` passes a `payment_orders.id` via the
--   parameter name `p_payment_order_id`.
--
-- Solution:
--   Create a wrapper function `complete_marketplace_purchase` that accepts
--   the payment_order_id, looks up the associated listing/transaction data
--   from payment_orders.purchase_metadata, performs the ownership transfer,
--   and handles platform fees — all atomically inside the DB.
--
--   The edge function will call THIS function instead.
-- ============================================================================

-- ============================================================================
-- NEW RPC: complete_marketplace_purchase
-- Called by verify-marketplace-payment edge function after Razorpay signature
-- verification succeeds.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_marketplace_purchase(
  p_payment_order_id UUID,
  p_razorpay_payment_id TEXT,
  p_razorpay_signature TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order payment_orders%ROWTYPE;
  v_listing marketplace_listings%ROWTYPE;
  v_pixel pixels%ROWTYPE;
  v_listing_id UUID;
  v_buyer_id UUID;
  v_transaction_id UUID;
  v_platform_fee_percent NUMERIC := 0.05; -- 5% platform fee
  v_platform_fee NUMERIC;
  v_seller_net NUMERIC;
  v_is_from_block BOOLEAN;
  v_block_id UUID;
BEGIN
  -- 1. Get & validate the payment order
  SELECT * INTO v_order FROM payment_orders WHERE id = p_payment_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment order not found');
  END IF;

  IF v_order.status != 'created' THEN
    -- Idempotency: if already paid, return success with existing data
    IF v_order.status = 'paid' THEN
      RETURN jsonb_build_object('success', true, 'message', 'Already processed (idempotent)');
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'Payment order already processed with status: ' || v_order.status);
  END IF;

  IF v_order.purchase_type != 'marketplace_purchase' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid purchase type for marketplace');
  END IF;

  v_buyer_id := v_order.user_id;
  v_listing_id := (v_order.purchase_metadata->>'listing_id')::UUID;

  IF v_listing_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No listing ID in payment order metadata');
  END IF;

  -- 2. Lock and get the listing
  SELECT * INTO v_listing
  FROM marketplace_listings
  WHERE id = v_listing_id AND status = 'active'
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    -- Mark payment order as failed since listing unavailable
    UPDATE payment_orders SET status = 'failed', updated_at = NOW()
    WHERE id = p_payment_order_id;

    RETURN jsonb_build_object('success', false, 'error', 'Listing no longer available. Payment will be refunded.');
  END IF;

  IF v_listing.seller_id = v_buyer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot buy your own listing');
  END IF;

  -- 3. Get the pixel
  SELECT * INTO v_pixel FROM pixels WHERE id = v_listing.pixel_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pixel not found');
  END IF;

  v_is_from_block := v_listing.from_block_id IS NOT NULL;
  v_block_id := v_pixel.block_id;

  -- 4. Calculate platform fee
  v_platform_fee := ROUND(v_listing.asking_price * v_platform_fee_percent, 2);
  v_seller_net := v_listing.asking_price - v_platform_fee;

  -- 5. Update payment order status
  UPDATE payment_orders SET
    status = 'paid',
    razorpay_payment_id = p_razorpay_payment_id,
    razorpay_signature = p_razorpay_signature,
    paid_at = NOW(),
    updated_at = NOW()
  WHERE id = p_payment_order_id;

  -- 6. Transfer pixel ownership (unlink from block if applicable)
  UPDATE pixels SET
    owner_id = v_buyer_id,
    block_id = CASE WHEN v_is_from_block THEN NULL ELSE block_id END,
    price_paid = v_listing.asking_price,
    purchased_at = NOW(),
    times_resold = COALESCE(times_resold, 0) + 1,
    last_sale_price = v_listing.asking_price,
    last_sale_date = NOW(),
    updated_at = NOW()
  WHERE id = v_listing.pixel_id
  AND owner_id = v_listing.seller_id; -- Verify seller still owns it

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pixel ownership changed during transaction (race condition)');
  END IF;

  -- 7. Mark listing as sold
  UPDATE marketplace_listings
  SET status = 'sold', sold_at = NOW(), updated_at = NOW()
  WHERE id = v_listing_id;

  -- 8. Create transaction record with platform fee
  INSERT INTO marketplace_transactions (
    listing_id, buyer_id, seller_id, pixel_id,
    sale_price, platform_fee, seller_net,
    payment_method, payment_id, payment_status, status,
    razorpay_payment_id, razorpay_signature, completed_at
  ) VALUES (
    v_listing_id, v_buyer_id, v_listing.seller_id, v_listing.pixel_id,
    v_listing.asking_price, v_platform_fee, v_seller_net,
    'razorpay', p_razorpay_payment_id, 'completed', 'completed',
    p_razorpay_payment_id, p_razorpay_signature, NOW()
  ) RETURNING id INTO v_transaction_id;

  -- 9. Update buyer profile
  UPDATE profiles SET
    pixel_count = pixel_count + 1,
    total_spent = total_spent + v_listing.asking_price,
    last_active_at = NOW()
  WHERE user_id = v_buyer_id;

  -- 10. Update seller profile
  UPDATE profiles SET
    pixel_count = GREATEST(0, pixel_count - 1),
    last_active_at = NOW()
  WHERE user_id = v_listing.seller_id;

  -- 11. Log event
  PERFORM log_event('marketplace_sale', 'marketplace_transaction', v_transaction_id,
    jsonb_build_object(
      'buyer_id', v_buyer_id,
      'seller_id', v_listing.seller_id,
      'sale_price', v_listing.asking_price,
      'platform_fee', v_platform_fee,
      'seller_net', v_seller_net,
      'razorpay_payment_id', p_razorpay_payment_id,
      'was_from_block', v_is_from_block,
      'block_id', v_block_id
    ));

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'pixel_id', v_listing.pixel_id,
    'sale_price', v_listing.asking_price,
    'platform_fee', v_platform_fee,
    'seller_net', v_seller_net,
    'seller_id', v_listing.seller_id
  );

EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing is being purchased by another user');
END;
$$;

-- Grant to authenticated users (called via edge function with service role,
-- but grant for completeness)
GRANT EXECUTE ON FUNCTION public.complete_marketplace_purchase(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
  -- Verify function exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'complete_marketplace_purchase'
  ) THEN
    RAISE EXCEPTION '❌ complete_marketplace_purchase function not created!';
  END IF;

  RAISE NOTICE '✓ Migration 031 applied successfully — complete_marketplace_purchase created';
END $$;
