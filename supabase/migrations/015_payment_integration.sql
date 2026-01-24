-- ============================================================================
-- 015: RAZORPAY PAYMENT INTEGRATION
-- BuyAPixel - Payment Orders, Verification, and Transaction Tracking
-- ============================================================================

-- ============================================================================
-- PAYMENT ORDERS TABLE
-- Tracks Razorpay orders before payment completion
-- ============================================================================

CREATE TABLE public.payment_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- User making the payment
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Razorpay order details
  razorpay_order_id TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  
  -- Order details
  amount INTEGER NOT NULL CHECK (amount > 0), -- Amount in paise (INR * 100)
  currency TEXT NOT NULL DEFAULT 'INR',
  
  -- What's being purchased
  purchase_type TEXT NOT NULL CHECK (purchase_type IN ('pixel_purchase', 'marketplace_purchase')),
  purchase_metadata JSONB NOT NULL DEFAULT '{}', -- Stores pixel coords, listing_id, etc.
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed', 'expired', 'refunded')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 minutes')
);

-- Indexes
CREATE INDEX idx_payment_orders_user ON public.payment_orders(user_id);
CREATE INDEX idx_payment_orders_razorpay ON public.payment_orders(razorpay_order_id);
CREATE INDEX idx_payment_orders_status ON public.payment_orders(status, created_at DESC);
CREATE INDEX idx_payment_orders_expires ON public.payment_orders(expires_at) 
  WHERE status = 'created';

-- Comments
COMMENT ON TABLE public.payment_orders IS 'Tracks Razorpay payment orders for pixel purchases';
COMMENT ON COLUMN public.payment_orders.amount IS 'Amount in paise (INR × 100)';
COMMENT ON COLUMN public.payment_orders.purchase_metadata IS 'JSON containing pixel coordinates or marketplace listing details';

-- ============================================================================
-- ADD PAYMENT TRACKING TO PIXELS TABLE
-- ============================================================================

ALTER TABLE public.pixels 
  ADD COLUMN IF NOT EXISTS payment_order_id UUID REFERENCES public.payment_orders(id);

CREATE INDEX IF NOT EXISTS idx_pixels_payment ON public.pixels(payment_order_id) 
  WHERE payment_order_id IS NOT NULL;

-- ============================================================================
-- ADD PAYMENT TRACKING TO PIXEL BLOCKS TABLE
-- ============================================================================

ALTER TABLE public.pixel_blocks 
  ADD COLUMN IF NOT EXISTS payment_order_id UUID REFERENCES public.payment_orders(id);

CREATE INDEX IF NOT EXISTS idx_pixel_blocks_payment ON public.pixel_blocks(payment_order_id) 
  WHERE payment_order_id IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

-- Users can view their own payment orders
CREATE POLICY "payment_orders_select_own" ON public.payment_orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own payment orders (via edge function)
CREATE POLICY "payment_orders_insert_own" ON public.payment_orders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Only allow updates via service role (edge functions)
-- No direct user updates to prevent manipulation

-- ============================================================================
-- RPC FUNCTION: Create Payment Order Record
-- Called by edge function after Razorpay order creation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_payment_order(
  p_razorpay_order_id TEXT,
  p_amount INTEGER,
  p_purchase_type TEXT,
  p_purchase_metadata JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_order_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  INSERT INTO payment_orders (
    user_id, razorpay_order_id, amount, purchase_type, purchase_metadata
  ) VALUES (
    v_user_id, p_razorpay_order_id, p_amount, p_purchase_type, p_purchase_metadata
  )
  RETURNING id INTO v_order_id;
  
  RETURN v_order_id;
END;
$$;

-- ============================================================================
-- RPC FUNCTION: Complete Payment and Purchase
-- Called after successful payment verification
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_pixel_purchase(
  p_payment_order_id UUID,
  p_razorpay_payment_id TEXT,
  p_razorpay_signature TEXT,
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
  v_pixels JSONB;
BEGIN
  -- Get the payment order
  SELECT * INTO v_order FROM payment_orders WHERE id = p_payment_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment order not found');
  END IF;
  
  IF v_order.status != 'created' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment order already processed');
  END IF;
  
  v_user_id := v_order.user_id;
  v_pixels := v_order.purchase_metadata->'pixels';
  
  IF v_pixels IS NULL OR jsonb_array_length(v_pixels) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No pixels in order');
  END IF;
  
  -- Update payment order status
  UPDATE payment_orders SET
    status = 'paid',
    razorpay_payment_id = p_razorpay_payment_id,
    razorpay_signature = p_razorpay_signature,
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
    v_pixel_count := v_pixel_count + 1;
  END LOOP;
  
  -- Create block if multiple pixels
  IF v_pixel_count > 1 AND p_image_url IS NOT NULL THEN
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
  END IF;
  
  -- Update all pixels
  FOR v_pixel IN SELECT * FROM jsonb_array_elements(v_pixels)
  LOOP
    v_x := (v_pixel->>'x')::INTEGER;
    v_y := (v_pixel->>'y')::INTEGER;
    
    UPDATE pixels SET
      owner_id = v_user_id,
      block_id = v_block_id,
      image_url = CASE WHEN v_block_id IS NULL THEN p_image_url ELSE NULL END,
      link_url = CASE WHEN v_block_id IS NULL THEN p_link_url ELSE NULL END,
      alt_text = CASE WHEN v_block_id IS NULL THEN p_alt_text ELSE NULL END,
      price_paid = calculate_pixel_price(v_x, v_y),
      purchased_at = NOW(),
      payment_order_id = p_payment_order_id,
      updated_at = NOW()
    WHERE x = v_x AND y = v_y AND owner_id IS NULL;
  END LOOP;
  
  -- Update profile counters
  UPDATE profiles SET
    pixel_count = pixel_count + v_pixel_count,
    total_spent = total_spent + v_total_price,
    last_active_at = NOW()
  WHERE user_id = v_user_id;
  
  -- Log event
  PERFORM log_event('payment_completed', 'payment_order', p_payment_order_id,
    jsonb_build_object(
      'pixel_count', v_pixel_count,
      'total_price', v_total_price,
      'razorpay_payment_id', p_razorpay_payment_id
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
-- RPC FUNCTION: Mark Payment as Failed
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_payment_failed(p_payment_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE payment_orders SET
    status = 'failed',
    updated_at = NOW()
  WHERE id = p_payment_order_id AND status = 'created';
  
  RETURN FOUND;
END;
$$;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.create_payment_order(TEXT, INTEGER, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_pixel_purchase(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_payment_failed(UUID) TO authenticated;

-- ============================================================================
-- TRIGGER: Auto-expire old payment orders
-- ============================================================================

CREATE OR REPLACE FUNCTION public.expire_old_payment_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE payment_orders SET
    status = 'expired',
    updated_at = NOW()
  WHERE status = 'created' AND expires_at < NOW();
END;
$$;

-- ============================================================================
-- END OF 015
-- ============================================================================
