-- =======================================================================
-- FIX: Contiguous Block Detection in complete_pixel_purchase
-- =======================================================================
-- PROBLEM: When a user selects non-contiguous, scattered pixels (e.g., 3
-- random pixels at (5,5), (50,50), (90,90)), the function creates a
-- pixel_block with bounding box min_x=5, max_x=90, min_y=5, max_y=90.
-- The frontend then renders a single image spanning this 86×86 = 7396
-- pixel area. This is a massive visual/inventory exploit.
--
-- FIX: Add a contiguity check. A block is only created when the selected
-- pixels form a perfect, unbroken rectangle — meaning every cell inside
-- the bounding box is selected:
--   (max_x - min_x + 1) * (max_y - min_y + 1) == pixel_count
--
-- If pixels are scattered, each pixel gets image_url/link_url/alt_text
-- stored individually, but no pixel_block is created.
-- =======================================================================

BEGIN;

CREATE OR REPLACE FUNCTION complete_pixel_purchase(
  p_payment_order_id UUID,
  p_razorpay_payment_id TEXT,
  p_razorpay_signature TEXT,
  p_image_url TEXT DEFAULT NULL,
  p_link_url TEXT DEFAULT NULL,
  p_alt_text TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order payment_orders%ROWTYPE;
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
  v_available_count INTEGER := 0;
  v_pixels JSONB;
  v_updated_count INTEGER := 0;
  v_bounding_box_area INTEGER;
  v_is_contiguous BOOLEAN;
BEGIN
  -- Get the payment order
  SELECT * INTO v_order FROM payment_orders WHERE id = p_payment_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment order not found');
  END IF;

  v_user_id := v_order.user_id;

  -- Check for duplicate processing via idempotency key
  IF p_idempotency_key IS NOT NULL THEN
    UPDATE payment_orders SET
      idempotency_key = p_idempotency_key
    WHERE id = p_payment_order_id
    AND idempotency_key IS NULL;
  END IF;
  
  IF v_order.status != 'created' THEN
    -- Already processed - return the previous result for idempotency
    RETURN jsonb_build_object(
      'success', v_order.status = 'paid',
      'message', 'Payment already processed',
      'data', jsonb_build_object(
        'pixel_count', v_order.purchase_metadata->'pixels' -> 0,
        'block_id', (SELECT id FROM pixel_blocks WHERE payment_order_id = p_payment_order_id)
      )
    );
  END IF;
  
  v_pixels := v_order.purchase_metadata->'pixels';
  
  IF v_pixels IS NULL OR jsonb_array_length(v_pixels) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No pixels in order');
  END IF;
  
  v_pixel_count := jsonb_array_length(v_pixels);
  
  -- PRE-VALIDATION: Check all pixels are still available
  SELECT COUNT(*) INTO v_available_count
  FROM pixels p
  WHERE EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_pixels) elem
    WHERE (elem->>'x')::INTEGER = p.x 
      AND (elem->>'y')::INTEGER = p.y
  )
  AND p.owner_id IS NULL;
  
  IF v_available_count != v_pixel_count THEN
    -- Some pixels are no longer available - mark as failed
    UPDATE payment_orders SET
      status = 'failed',
      updated_at = NOW()
    WHERE id = p_payment_order_id;
    
    PERFORM log_event('payment_failed', 'payment_order', p_payment_order_id,
      jsonb_build_object(
        'reason', 'pixels_unavailable',
        'requested', v_pixel_count,
        'available', v_available_count,
        'razorpay_payment_id', p_razorpay_payment_id,
        'idempotency_key', p_idempotency_key
      ));
    
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Some pixels are no longer available. Payment not processed. Please contact support for refund.',
      'requested_count', v_pixel_count,
      'available_count', v_available_count
    );
  END IF;
  
  -- All pixels available - proceed with purchase
  
  -- Update payment order status FIRST
  UPDATE payment_orders SET
    status = 'paid',
    razorpay_payment_id = p_razorpay_payment_id,
    razorpay_signature = p_razorpay_signature,
    idempotency_key = COALESCE(idempotency_key, p_idempotency_key),
    paid_at = NOW(),
    updated_at = NOW()
  WHERE id = p_payment_order_id;
  
  -- Calculate bounds and total
  FOR v_pixel IN SELECT * FROM jsonb_array_elements(v_pixels)
  LOOP
    v_x := (v_pixel->>'x')::INTEGER;
    v_y := (v_pixel->>'y')::INTEGER;
    
    v_min_x := LEAST(v_min_x, v_x);
    v_max_x := GREATEST(v_max_x, v_x);
    v_min_y := LEAST(v_min_y, v_y);
    v_max_y := GREATEST(v_max_y, v_y);
    v_total_price := v_total_price + calculate_pixel_price(v_x, v_y);
  END LOOP;
  
  -- ═══════════════════════════════════════════════════════════
  -- CONTIGUITY CHECK: Only create a pixel_block if the selected
  -- pixels form a PERFECT rectangle (every cell in the bounding
  -- box is selected). This prevents the N×N exploit where 3
  -- scattered pixels could visually claim thousands of pixels.
  -- ═══════════════════════════════════════════════════════════
  v_bounding_box_area := (v_max_x - v_min_x + 1) * (v_max_y - v_min_y + 1);
  v_is_contiguous := (v_bounding_box_area = v_pixel_count);
  
  -- Create block ONLY if:
  -- 1. Multiple pixels selected
  -- 2. An image was uploaded
  -- 3. Pixels form a contiguous rectangle
  IF v_pixel_count > 1 AND p_image_url IS NOT NULL AND v_is_contiguous THEN
    INSERT INTO pixel_blocks (
      owner_id, image_url, link_url, alt_text, 
      min_x, max_x, min_y, max_y, 
      pixel_count, total_price, payment_order_id
    ) VALUES (
      v_user_id, p_image_url, p_link_url, p_alt_text,
      v_min_x, v_max_x, v_min_y, v_max_y,
      v_pixel_count, v_total_price, p_payment_order_id
    )
    RETURNING id INTO v_block_id;
  ELSE
    -- Non-contiguous selection: no block created.
    -- Each pixel will still get image_url/link_url/alt_text individually.
    v_block_id := NULL;
    
    -- Log non-contiguous selection for monitoring
    IF v_pixel_count > 1 AND p_image_url IS NOT NULL AND NOT v_is_contiguous THEN
      PERFORM log_event('non_contiguous_purchase', 'payment_order', p_payment_order_id,
        jsonb_build_object(
          'pixel_count', v_pixel_count,
          'bounding_box_area', v_bounding_box_area,
          'min_x', v_min_x, 'max_x', v_max_x,
          'min_y', v_min_y, 'max_y', v_max_y
        ));
    END IF;
  END IF;
  
  -- Update all pixels — ALWAYS store image_url on every pixel
  -- This ensures the frontend can render images without querying pixel_blocks
  WITH updated AS (
    UPDATE pixels SET
      owner_id = v_user_id,
      block_id = v_block_id,
      image_url = p_image_url,
      link_url = p_link_url,
      alt_text = p_alt_text,
      price_paid = calculate_pixel_price(x, y),
      purchased_at = NOW(),
      payment_order_id = p_payment_order_id,
      updated_at = NOW()
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_pixels) elem
      WHERE (elem->>'x')::INTEGER = pixels.x 
        AND (elem->>'y')::INTEGER = pixels.y
    )
    AND owner_id IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;
  
  -- Verify all pixels were updated
  IF v_updated_count != v_pixel_count THEN
    PERFORM log_event('payment_partial', 'payment_order', p_payment_order_id,
      jsonb_build_object(
        'expected', v_pixel_count,
        'updated', v_updated_count,
        'razorpay_payment_id', p_razorpay_payment_id,
        'idempotency_key', p_idempotency_key
      ));
  END IF;
  
  -- Update profile counters
  UPDATE profiles SET
    pixel_count = pixel_count + v_updated_count,
    total_spent = total_spent + v_total_price,
    last_active_at = NOW()
  WHERE user_id = v_user_id;
  
  -- Log successful event
  PERFORM log_event('payment_completed', 'payment_order', p_payment_order_id,
    jsonb_build_object(
      'pixel_count', v_updated_count,
      'total_price', v_total_price,
      'razorpay_payment_id', p_razorpay_payment_id,
      'razorpay_order_id', v_order.razorpay_order_id,
      'block_id', v_block_id,
      'is_contiguous', v_is_contiguous,
      'idempotency_key', p_idempotency_key
    ));
  
  RETURN jsonb_build_object(
    'success', true,
    'block_id', v_block_id,
    'pixel_count', v_updated_count,
    'total_price', v_total_price,
    'payment_order_id', p_payment_order_id,
    'razorpay_payment_id', p_razorpay_payment_id,
    'is_contiguous', v_is_contiguous
  );
END;
$$;

COMMIT;
