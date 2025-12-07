-- Create marketplace listings table
CREATE TABLE public.marketplace_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pixel_id UUID NOT NULL REFERENCES public.pixels(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL,
  asking_price NUMERIC NOT NULL CHECK (asking_price > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(pixel_id)
);

-- Add index for faster queries
CREATE INDEX idx_marketplace_listings_status ON public.marketplace_listings(status);
CREATE INDEX idx_marketplace_listings_seller ON public.marketplace_listings(seller_id);

-- Enable RLS
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

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

-- Trigger for updated_at
CREATE TRIGGER update_marketplace_listings_updated_at
BEFORE UPDATE ON public.marketplace_listings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to purchase from marketplace
CREATE OR REPLACE FUNCTION public.purchase_from_marketplace(
  listing_id UUID
)
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
  v_buyer_id := auth.uid();
  
  IF v_buyer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get listing
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
  
  -- Get pixel
  SELECT * INTO v_pixel
  FROM pixels
  WHERE id = v_listing.pixel_id
  FOR UPDATE;
  
  IF v_pixel.owner_id != v_listing.seller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seller no longer owns this pixel');
  END IF;
  
  -- Transfer ownership
  UPDATE pixels
  SET 
    owner_id = v_buyer_id,
    updated_at = now()
  WHERE id = v_listing.pixel_id;
  
  -- Mark listing as sold
  UPDATE marketplace_listings
  SET 
    status = 'sold',
    updated_at = now()
  WHERE id = listing_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'pixel_id', v_listing.pixel_id,
    'price', v_listing.asking_price
  );
END;
$$;