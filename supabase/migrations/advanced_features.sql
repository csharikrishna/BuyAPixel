-- ============================================================================
-- FILE 3: ADVANCED FEATURES
-- BuyAPixel Database - Marketplace, Contact Forms, and Realtime
-- Generated: December 7, 2025
-- Features: Pixel marketplace trading, contact submissions, realtime updates
-- ============================================================================

-- ============================================================================
-- REALTIME FUNCTIONALITY
-- ============================================================================

-- Enable full row replication for realtime pixel updates
ALTER TABLE public.pixels REPLICA IDENTITY FULL;

-- Note: Realtime publication will be automatically configured by Supabase
-- The pixels table will broadcast INSERT, UPDATE, DELETE events to subscribers

-- ============================================================================
-- MARKETPLACE LISTINGS TABLE
-- ============================================================================

-- Table for users to list their pixels for resale
CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pixel_id UUID NOT NULL REFERENCES public.pixels(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL,
  asking_price NUMERIC NOT NULL CHECK (asking_price > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(pixel_id)  -- One listing per pixel at a time
);

-- Indexes for marketplace queries
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status 
  ON public.marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller 
  ON public.marketplace_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_pixel 
  ON public.marketplace_listings(pixel_id);

-- ============================================================================
-- MARKETPLACE RLS POLICIES
-- ============================================================================

ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active listings" ON public.marketplace_listings;
DROP POLICY IF EXISTS "Users can list their own pixels" ON public.marketplace_listings;
DROP POLICY IF EXISTS "Users can update their own listings" ON public.marketplace_listings;
DROP POLICY IF EXISTS "Users can delete their own listings" ON public.marketplace_listings;

-- Anyone can view active listings
CREATE POLICY "Anyone can view active listings"
  ON public.marketplace_listings
  FOR SELECT
  USING (status = 'active');

-- Users can create listings for their own pixels
CREATE POLICY "Users can list their own pixels"
  ON public.marketplace_listings
  FOR INSERT
  WITH CHECK (
    auth.uid() = seller_id AND
    EXISTS (
      SELECT 1 FROM public.pixels
      WHERE pixels.id = pixel_id
        AND pixels.owner_id = auth.uid()
        AND pixels.is_active = true
    )
  );

-- Users can update their own listings
CREATE POLICY "Users can update their own listings"
  ON public.marketplace_listings
  FOR UPDATE
  USING (auth.uid() = seller_id);

-- Users can delete their own listings
CREATE POLICY "Users can delete their own listings"
  ON public.marketplace_listings
  FOR DELETE
  USING (auth.uid() = seller_id);

-- ============================================================================
-- MARKETPLACE TRIGGERS
-- ============================================================================

-- Auto-update timestamp for marketplace listings
DROP TRIGGER IF EXISTS update_marketplace_listings_updated_at ON public.marketplace_listings;
CREATE TRIGGER update_marketplace_listings_updated_at
  BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- MARKETPLACE PURCHASE FUNCTION
-- ============================================================================

-- Function to handle marketplace purchases (atomic transaction)
CREATE OR REPLACE FUNCTION public.purchase_from_marketplace(listing_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing marketplace_listings;
  v_pixel pixels;
  v_buyer_id UUID;
BEGIN
  -- Get authenticated user
  v_buyer_id := auth.uid();

  IF v_buyer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Lock and get listing
  SELECT * INTO v_listing
  FROM marketplace_listings
  WHERE id = listing_id
    AND status = 'active'
  FOR UPDATE;

  IF v_listing IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing not found or already sold');
  END IF;

  -- Check buyer is not seller
  IF v_listing.seller_id = v_buyer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot buy your own listing');
  END IF;

  -- Lock and get pixel
  SELECT * INTO v_pixel
  FROM pixels
  WHERE id = v_listing.pixel_id
  FOR UPDATE;

  -- Verify seller still owns pixel
  IF v_pixel.owner_id != v_listing.seller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seller no longer owns this pixel');
  END IF;

  -- Transfer pixel ownership
  UPDATE pixels
  SET
    owner_id = v_buyer_id,
    price_paid = v_listing.asking_price,
    purchased_at = now(),
    updated_at = now()
  WHERE id = v_listing.pixel_id;

  -- Mark listing as sold
  UPDATE marketplace_listings
  SET
    status = 'sold',
    updated_at = now()
  WHERE id = listing_id;

  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'pixel_id', v_listing.pixel_id,
    'price', v_listing.asking_price,
    'seller_id', v_listing.seller_id,
    'buyer_id', v_buyer_id
  );

EXCEPTION WHEN OTHERS THEN
  -- Return error details
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- ============================================================================
-- CONTACT SUBMISSIONS TABLE
-- ============================================================================

-- Table to log contact form submissions (spam prevention & tracking)
CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for contact submissions
CREATE INDEX IF NOT EXISTS idx_contact_submissions_email 
  ON public.contact_submissions(email);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_submitted_at 
  ON public.contact_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_ip 
  ON public.contact_submissions(ip_address);

-- ============================================================================
-- CONTACT SUBMISSIONS RLS
-- ============================================================================

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Only service role (admin) can access contact submissions
DROP POLICY IF EXISTS "Service role can manage contact submissions" ON public.contact_submissions;
CREATE POLICY "Service role can manage contact submissions"
  ON public.contact_submissions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.marketplace_listings IS 
  'Marketplace for users to list and sell their owned pixels to other users.';

COMMENT ON FUNCTION public.purchase_from_marketplace IS 
  'Handles atomic marketplace purchase transactions: transfers pixel ownership and marks listing as sold.';

COMMENT ON TABLE public.contact_submissions IS 
  'Logs all contact form submissions for tracking and spam prevention. Only accessible by service role.';

-- ============================================================================
-- USAGE EXAMPLES (FOR REFERENCE)
-- ============================================================================

/*
-- List a pixel for sale
INSERT INTO marketplace_listings (pixel_id, seller_id, asking_price)
VALUES (
  'pixel-uuid-here',
  auth.uid(),
  500.00
);

-- Purchase from marketplace
SELECT purchase_from_marketplace('listing-uuid-here');

-- Cancel a listing
UPDATE marketplace_listings
SET status = 'cancelled'
WHERE id = 'listing-uuid-here'
  AND seller_id = auth.uid();

-- View active marketplace listings
SELECT 
  ml.*,
  p.x, p.y, p.image_url, p.link_url
FROM marketplace_listings ml
JOIN pixels p ON p.id = ml.pixel_id
WHERE ml.status = 'active'
ORDER BY ml.created_at DESC;
*/

-- ============================================================================
-- END OF FILE 3
-- ============================================================================
