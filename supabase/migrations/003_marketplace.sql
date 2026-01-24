-- ============================================================================
-- 003: MARKETPLACE SYSTEM
-- BuyAPixel - Listings, Transactions, and Trading
-- ============================================================================

-- ============================================================================
-- MARKETPLACE LISTINGS
-- ============================================================================

CREATE TABLE public.marketplace_listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- What's being sold
  pixel_id UUID NOT NULL UNIQUE REFERENCES public.pixels(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  
  -- Pricing
  asking_price NUMERIC(12,2) NOT NULL CHECK (asking_price > 0),
  original_price NUMERIC(12,2),  -- What seller paid
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled', 'expired')),
  
  -- Features
  featured BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  
  -- Expiration (optional)
  expires_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sold_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_listings_status ON public.marketplace_listings(status);
CREATE INDEX idx_listings_seller ON public.marketplace_listings(seller_id);
CREATE INDEX idx_listings_active ON public.marketplace_listings(status, asking_price) 
  WHERE status = 'active';
CREATE INDEX idx_listings_featured ON public.marketplace_listings(featured, created_at DESC) 
  WHERE status = 'active' AND featured = true;
CREATE INDEX idx_listings_expires ON public.marketplace_listings(expires_at) 
  WHERE status = 'active' AND expires_at IS NOT NULL;

-- Comments
COMMENT ON TABLE public.marketplace_listings IS 'Pixels listed for resale on the marketplace';
COMMENT ON COLUMN public.marketplace_listings.original_price IS 'Price the seller originally paid, for profit calculation';

-- ============================================================================
-- MARKETPLACE TRANSACTIONS
-- ============================================================================

CREATE TABLE public.marketplace_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Parties
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id),
  buyer_id UUID NOT NULL REFERENCES auth.users(id),
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  pixel_id UUID NOT NULL REFERENCES public.pixels(id),
  
  -- Financial
  sale_price NUMERIC(12,2) NOT NULL CHECK (sale_price > 0),
  platform_fee NUMERIC(12,2) DEFAULT 0,
  seller_net NUMERIC(12,2) NOT NULL,
  
  -- Payment info
  payment_method TEXT,
  payment_id TEXT,
  payment_status TEXT DEFAULT 'completed' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  
  -- Refund tracking
  refund_reason TEXT,
  refunded_at TIMESTAMPTZ,
  refunded_by UUID REFERENCES auth.users(id),
  
  -- Status
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'disputed')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_transactions_buyer ON public.marketplace_transactions(buyer_id);
CREATE INDEX idx_transactions_seller ON public.marketplace_transactions(seller_id);
CREATE INDEX idx_transactions_status ON public.marketplace_transactions(status, created_at DESC);
CREATE INDEX idx_transactions_created ON public.marketplace_transactions(created_at DESC);

-- Comments
COMMENT ON TABLE public.marketplace_transactions IS 'Completed marketplace sales with payment tracking';
COMMENT ON COLUMN public.marketplace_transactions.seller_net IS 'Amount seller receives after platform fee';

-- ============================================================================
-- USER NOTIFICATION PREFERENCES
-- ============================================================================

CREATE TABLE public.user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Email preferences
  email_on_sale BOOLEAN DEFAULT true,
  email_on_purchase BOOLEAN DEFAULT true,
  email_on_outbid BOOLEAN DEFAULT true,
  email_marketing BOOLEAN DEFAULT false,
  
  -- Push preferences (future)
  push_enabled BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comments
COMMENT ON TABLE public.user_notification_preferences IS 'User preferences for email and push notifications';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Listings policies
CREATE POLICY "listings_select_active" ON public.marketplace_listings
  FOR SELECT USING (status = 'active' OR seller_id = auth.uid());

CREATE POLICY "listings_insert_own" ON public.marketplace_listings
  FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "listings_update_own" ON public.marketplace_listings
  FOR UPDATE TO authenticated
  USING (seller_id = auth.uid());

CREATE POLICY "listings_delete_own" ON public.marketplace_listings
  FOR DELETE TO authenticated
  USING (seller_id = auth.uid() AND status = 'active');

-- Transactions policies
CREATE POLICY "transactions_select_own" ON public.marketplace_transactions
  FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

-- Notification preferences policies
CREATE POLICY "prefs_all_own" ON public.user_notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER set_listings_updated_at
  BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_transactions_updated_at
  BEFORE UPDATE ON public.marketplace_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- REALTIME
-- ============================================================================

ALTER TABLE public.marketplace_listings REPLICA IDENTITY FULL;

-- ============================================================================
-- END OF 003
-- ============================================================================
