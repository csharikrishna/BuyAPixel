-- ============================================================================
-- 018: MARKETPLACE PAYMENT INTEGRATION
-- BuyAPixel - Razorpay integration for marketplace purchases with platform fee
-- ============================================================================

-- ============================================================================
-- PLATFORM CONFIGURATION
-- ============================================================================

-- Platform fee percentage (5% default)
-- This can be adjusted as needed
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_config') THEN
    CREATE TYPE platform_config AS (
      platform_fee_percent NUMERIC(5,2)
    );
  END IF;
END$$;

-- ============================================================================
-- UPDATE MARKETPLACE_TRANSACTIONS TABLE
-- Ensure platform_fee column is properly used
-- ============================================================================

-- Add comments for clarity
COMMENT ON COLUMN public.marketplace_transactions.platform_fee IS 'Platform service fee (5% of sale_price)';
COMMENT ON COLUMN public.marketplace_transactions.seller_net IS 'Amount seller receives (sale_price - platform_fee)';

-- ============================================================================
-- RPC FUNCTION: Purchase from Marketplace with Payment Verification
-- Called after successful Razorpay payment verification
-- ============================================================================

CREATE OR REPLACE FUNCTION public.purchase_from_marketplace_verified(
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
  v_listing_id UUID;
  v_buyer_id UUID;
  v_transaction_id UUID;
  v_platform_fee_percent NUMERIC := 0.05; -- 5% platform fee
  v_platform_fee NUMERIC;
  v_seller_net NUMERIC;
BEGIN
  -- Get the payment order
  SELECT * INTO v_order FROM payment_orders WHERE id = p_payment_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment order not found');
  END IF;
  
  IF v_order.status != 'created' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment order already processed');
  END IF;
  
  IF v_order.purchase_type != 'marketplace_purchase' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid purchase type');
  END IF;
  
  v_buyer_id := v_order.user_id;
  v_listing_id := (v_order.purchase_metadata->>'listing_id')::UUID;
  
  IF v_listing_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No listing ID in order');
  END IF;
  
  -- Lock and get the listing
  SELECT * INTO v_listing
  FROM marketplace_listings
  WHERE id = v_listing_id AND status = 'active'
  FOR UPDATE NOWAIT;
  
  IF NOT FOUND THEN
    -- Mark payment as failed since listing is no longer available
    UPDATE payment_orders SET
      status = 'failed',
      updated_at = NOW()
    WHERE id = p_payment_order_id;
    
    RETURN jsonb_build_object('success', false, 'error', 'Listing no longer available. Payment will be refunded.');
  END IF;
  
  IF v_listing.seller_id = v_buyer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot buy your own listing');
  END IF;
  
  -- Calculate platform fee
  v_platform_fee := ROUND(v_listing.asking_price * v_platform_fee_percent, 2);
  v_seller_net := v_listing.asking_price - v_platform_fee;
  
  -- Update payment order status
  UPDATE payment_orders SET
    status = 'paid',
    razorpay_payment_id = p_razorpay_payment_id,
    razorpay_signature = p_razorpay_signature,
    paid_at = NOW(),
    updated_at = NOW()
  WHERE id = p_payment_order_id;
  
  -- Transfer ownership
  UPDATE pixels SET
    owner_id = v_buyer_id,
    price_paid = v_listing.asking_price,
    purchased_at = NOW(),
    times_resold = COALESCE(times_resold, 0) + 1,
    last_sale_price = v_listing.asking_price,
    last_sale_date = NOW(),
    updated_at = NOW()
  WHERE id = v_listing.pixel_id;
  
  -- Mark listing as sold
  UPDATE marketplace_listings
  SET status = 'sold', sold_at = NOW(), updated_at = NOW()
  WHERE id = v_listing_id;
  
  -- Create transaction record with platform fee
  INSERT INTO marketplace_transactions (
    listing_id, buyer_id, seller_id, pixel_id, 
    sale_price, platform_fee, seller_net, 
    payment_method, payment_id, payment_status, status
  ) VALUES (
    v_listing_id, v_buyer_id, v_listing.seller_id, v_listing.pixel_id,
    v_listing.asking_price, v_platform_fee, v_seller_net,
    'razorpay', p_razorpay_payment_id, 'completed', 'completed'
  ) RETURNING id INTO v_transaction_id;
  
  -- Update buyer profile
  UPDATE profiles SET
    pixel_count = pixel_count + 1,
    total_spent = total_spent + v_listing.asking_price,
    last_active_at = NOW()
  WHERE user_id = v_buyer_id;
  
  -- Update seller profile (decrement pixel count, add earnings info)
  UPDATE profiles SET
    pixel_count = GREATEST(0, pixel_count - 1),
    last_active_at = NOW()
  WHERE user_id = v_listing.seller_id;
  
  -- Log event
  PERFORM log_event('marketplace_sale', 'marketplace_transaction', v_transaction_id,
    jsonb_build_object(
      'buyer_id', v_buyer_id,
      'seller_id', v_listing.seller_id,
      'sale_price', v_listing.asking_price,
      'platform_fee', v_platform_fee,
      'seller_net', v_seller_net,
      'razorpay_payment_id', p_razorpay_payment_id
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

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.purchase_from_marketplace_verified(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- END OF 018
-- ============================================================================
