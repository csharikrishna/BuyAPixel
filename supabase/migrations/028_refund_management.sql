-- ============================================================================
-- 028: REFUND MANAGEMENT SYSTEM
-- BuyASpot - Admin functions for processing refunds
-- ============================================================================

-- ============================================================================
-- EXTENDED MARKETPLACE_TRANSACTIONS
-- Add refund tracking to transactions
-- ============================================================================

ALTER TABLE public.marketplace_transactions
ADD COLUMN IF NOT EXISTS refund_amount NUMERIC DEFAULT NULL;

ALTER TABLE public.marketplace_transactions
ADD COLUMN IF NOT EXISTS refund_reason TEXT DEFAULT NULL;

ALTER TABLE public.marketplace_transactions
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_refunded
  ON public.marketplace_transactions(buyer_id)
  WHERE refund_amount IS NOT NULL;

-- ============================================================================
-- FUNCTION: Process Pixel Sale Refund
-- Admin function to refund marketplace transactions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_refund_marketplace_transaction(
  p_transaction_id UUID,
  p_reason TEXT
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
BEGIN
  -- Authorization check
  IF NOT is_current_user_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin only');
  END IF;

  -- Get transaction
  SELECT * INTO v_transaction
  FROM marketplace_transactions
  WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction not found');
  END IF;

  -- Check if already refunded
  IF v_transaction.refund_amount IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction already refunded');
  END IF;

  -- Get listing
  SELECT * INTO v_listing
  FROM marketplace_listings
  WHERE id = v_transaction.listing_id;

  -- Get pixel
  SELECT * INTO v_pixel
  FROM pixels
  WHERE id = v_listing.pixel_id;

  -- Revert ownership back to seller
  UPDATE pixels
  SET 
    owner_id = v_listing.seller_id,
    price_paid = v_listing.original_price,
    block_id = v_listing.from_block_id, -- Restore to original block if applicable
    updated_at = NOW()
  WHERE id = v_listing.pixel_id;

  -- Reset listing status
  UPDATE marketplace_listings
  SET status = 'active'
  WHERE id = v_transaction.listing_id;

  -- Record refund in transaction
  UPDATE marketplace_transactions
  SET 
    refund_amount = amount,
    refund_reason = p_reason,
    refunded_at = NOW(),
    status = 'refunded'
  WHERE id = p_transaction_id;

  -- Update pixel counts
  UPDATE profiles
  SET pixel_count = pixel_count - 1
  WHERE user_id = v_transaction.buyer_id;

  UPDATE profiles
  SET pixel_count = pixel_count + 1
  WHERE user_id = v_listing.seller_id;

  -- Audit log
  PERFORM log_admin_action(
    'refund_marketplace_transaction',
    'marketplace_transaction',
    p_transaction_id::text,
    jsonb_build_object(
      'transaction_id', p_transaction_id,
      'reason', p_reason,
      'amount', v_transaction.amount,
      'seller_id', v_listing.seller_id,
      'buyer_id', v_transaction.buyer_id,
      'pixel_id', v_listing.pixel_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Refund processed successfully',
    'refund_amount', v_transaction.amount,
    'pixel_restored_to_seller', v_listing.seller_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_refund_marketplace_transaction(UUID, TEXT) TO authenticated;

-- ============================================================================
-- FUNCTION: Process Payment Refund
-- Admin function to refund direct pixel purchases
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_refund_payment_order(
  p_payment_order_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_order payment_orders%ROWTYPE;
  v_pixel_ids UUID[];
  v_builder_count INTEGER;
BEGIN
  -- Authorization check
  IF NOT is_current_user_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin only');
  END IF;

  -- Get payment order
  SELECT * INTO v_payment_order
  FROM payment_orders
  WHERE id = p_payment_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment order not found');
  END IF;

  -- Check if already refunded
  IF v_payment_order.status = 'refunded' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order already refunded');
  END IF;

  -- Get pixels for this order
  SELECT ARRAY_AGG(id) INTO v_pixel_ids
  FROM pixels
  WHERE payment_order_id = p_payment_order_id;

  -- Remove ownership from all pixels
  UPDATE pixels
  SET owner_id = NULL, block_id = NULL, updated_at = NOW()
  WHERE payment_order_id = p_payment_order_id;

  GET DIAGNOSTICS v_builder_count = ROW_COUNT;

  -- Remove associated block
  DELETE FROM pixel_blocks
  WHERE payment_order_id = p_payment_order_id;

  -- Mark payment order as refunded
  UPDATE payment_orders
  SET status = 'refunded', updated_at = NOW()
  WHERE id = p_payment_order_id;

  -- Update profile
  UPDATE profiles
  SET pixel_count = pixel_count - v_builder_count
  WHERE user_id = v_payment_order.user_id;

  -- Audit log
  PERFORM log_admin_action(
    'refund_payment_order',
    'payment_order',
    p_payment_order_id::text,
    jsonb_build_object(
      'reason', p_reason,
      'amount', v_payment_order.amount,
      'user_id', v_payment_order.user_id,
      'pixels_released', v_builder_count
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Refund processed successfully',
    'refund_amount', v_payment_order.amount,
    'pixels_released', v_builder_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_refund_payment_order(UUID, TEXT) TO authenticated;

-- ============================================================================
-- FUNCTION: Get Refund Status
-- Admin view of refund history
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_refund_history(
  p_days_back INTEGER DEFAULT 30,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  type TEXT,
  id UUID,
  user_email TEXT,
  amount NUMERIC,
  reason TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin only';
  END IF;

  RETURN QUERY
  -- Marketplace refunds
  SELECT
    'marketplace_refund'::text as type,
    mt.id,
    u.email,
    mt.refund_amount,
    mt.refund_reason,
    mt.refunded_at,
    'completed'::text as status
  FROM marketplace_transactions mt
  JOIN auth.users u ON u.id = mt.buyer_id
  WHERE mt.refund_amount IS NOT NULL
  AND mt.refunded_at >= NOW() - (p_days_back || ' days')::INTERVAL

  UNION ALL

  -- Payment order refunds
  SELECT
    'payment_refund'::text as type,
    po.id,
    u.email,
    po.amount,
    'Direct purchase refund'::text,
    po.updated_at,
    'completed'::text as status
  FROM payment_orders po
  JOIN auth.users u ON u.id = po.user_id
  WHERE po.status = 'refunded'
  AND po.updated_at >= NOW() - (p_days_back || ' days')::INTERVAL

  ORDER BY processed_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_refund_history(INTEGER, INTEGER, INTEGER) TO authenticated;

-- ============================================================================
-- END OF 028
-- ============================================================================
