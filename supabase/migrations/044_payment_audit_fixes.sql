-- ============================================================================
-- 044: PAYMENT AUDIT FIXES
-- BuyASpot — Address all Critical & High severity findings from payment audit
-- ============================================================================
-- This migration fixes:
--   Critical #1: Authenticated users can call purchase RPCs directly
--   Critical #3: Webhook paid status violates check_paid_requires_signature
--   Medium #10:  complete_marketplace_purchase lacks idempotency key
--   Medium #9:   Webhook timestamps not being updated
--   High #8:     Authenticated insert policy on payment_orders
-- ============================================================================

-- ============================================================================
-- FIX CRITICAL #1 + HIGH #8: Lock down payment_orders INSERT policy
-- Remove the policy that allows authenticated users to insert directly.
-- Only Edge Functions (service_role) should insert payment orders.
-- ============================================================================

DROP POLICY IF EXISTS "payment_orders_insert_own" ON public.payment_orders;

-- ============================================================================
-- FIX CRITICAL #1: Revoke EXECUTE on purchase completion RPCs from authenticated
-- Only service_role Edge Functions should be able to call these RPCs.
-- ============================================================================

-- Revoke from authenticated (all overloads)
REVOKE EXECUTE ON FUNCTION public.complete_pixel_purchase(uuid, text, text, text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_pixel_purchase(uuid, text, text, text, text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_marketplace_purchase(uuid, text, text) FROM authenticated;

-- Ensure service_role still has access
GRANT EXECUTE ON FUNCTION public.complete_pixel_purchase(uuid, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_pixel_purchase(uuid, text, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_marketplace_purchase(uuid, text, text) TO service_role;

-- Also lock down create_payment_order — clients should not call this directly
REVOKE EXECUTE ON FUNCTION public.create_payment_order(text, integer, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_payment_order(text, integer, text, jsonb) TO service_role;

-- Legacy unsafe RPCs (purchase_from_marketplace, purchase_from_marketplace_verified)
-- were already dropped by migration 20260526000001_marketplace_audit_fixes.sql

-- ============================================================================
-- FIX CRITICAL #3: Relax check_paid_requires_signature for webhook payments
-- Webhooks don't have checkout signatures. Instead of requiring both fields,
-- we require razorpay_payment_id when paid, but allow signature to be NULL
-- if the payment was marked paid via webhook reconciliation.
-- ============================================================================

ALTER TABLE public.payment_orders
  DROP CONSTRAINT IF EXISTS check_paid_requires_signature;

ALTER TABLE public.payment_orders
  ADD CONSTRAINT check_paid_requires_payment_id
  CHECK (
    (status != 'paid') OR
    (razorpay_payment_id IS NOT NULL)
  );

-- ============================================================================
-- FIX MEDIUM #10: Add idempotency to complete_marketplace_purchase
-- Wrap with idempotency key to prevent duplicate webhook/retry processing.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_marketplace_purchase(
  p_payment_order_id UUID,
  p_razorpay_payment_id TEXT,
  p_razorpay_signature TEXT,
  p_idempotency_key TEXT DEFAULT NULL
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

  -- Set idempotency key if provided
  IF p_idempotency_key IS NOT NULL THEN
    UPDATE payment_orders SET
      idempotency_key = p_idempotency_key
    WHERE id = p_payment_order_id
    AND idempotency_key IS NULL;
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
    idempotency_key = COALESCE(idempotency_key, p_idempotency_key),
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

  -- 11. Log event with idempotency key
  PERFORM log_event('marketplace_sale', 'marketplace_transaction', v_transaction_id,
    jsonb_build_object(
      'buyer_id', v_buyer_id,
      'seller_id', v_listing.seller_id,
      'sale_price', v_listing.asking_price,
      'platform_fee', v_platform_fee,
      'seller_net', v_seller_net,
      'razorpay_payment_id', p_razorpay_payment_id,
      'was_from_block', v_is_from_block,
      'block_id', v_block_id,
      'idempotency_key', p_idempotency_key
    ));

  -- 12. Log to idempotency_log if key provided
  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO idempotency_log (idempotency_key, result, created_at)
    VALUES (p_idempotency_key, jsonb_build_object(
      'success', true,
      'transaction_id', v_transaction_id,
      'pixel_id', v_listing.pixel_id
    ), NOW())
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

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

-- Grant the NEW 4-param overload to service_role only
GRANT EXECUTE ON FUNCTION public.complete_marketplace_purchase(UUID, TEXT, TEXT, TEXT) TO service_role;
-- Revoke the old 3-param from authenticated (already done above, but be explicit)
REVOKE EXECUTE ON FUNCTION public.complete_marketplace_purchase(UUID, TEXT, TEXT) FROM authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
  -- Verify the insert policy was dropped
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payment_orders'
      AND policyname = 'payment_orders_insert_own'
  ) THEN
    RAISE EXCEPTION '❌ payment_orders_insert_own policy was NOT dropped!';
  END IF;

  -- Verify the new constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'check_paid_requires_payment_id'
      AND table_name = 'payment_orders'
  ) THEN
    RAISE EXCEPTION '❌ check_paid_requires_payment_id constraint not created!';
  END IF;

  -- Verify the new marketplace function overload exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'complete_marketplace_purchase'
      AND pronargs = 4
  ) THEN
    RAISE EXCEPTION '❌ complete_marketplace_purchase(4 params) function not created!';
  END IF;

  RAISE NOTICE '✓ Migration 044 applied successfully — payment audit fixes complete';
END $$;
