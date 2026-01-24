-- ============================================================================
-- 002: CORE TABLES
-- BuyAPixel - Profiles, Pixels, and Pixel Blocks
-- Grid: 100x100 = 10,000 pixels
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Timestamp update trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Calculate pixel price based on Chebyshev distance (square zones)
-- Gold (center 40x40): ₹299, Standard (80x80): ₹199, Economy: ₹99
CREATE OR REPLACE FUNCTION public.calculate_pixel_price(p_x INTEGER, p_y INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  center FLOAT := 50.0;
  dist FLOAT;
BEGIN
  dist := GREATEST(ABS(p_x - center), ABS(p_y - center));
  
  IF dist < 20 THEN
    RETURN 299;  -- Gold Zone
  ELSIF dist < 40 THEN
    RETURN 199;  -- Standard Zone
  ELSE
    RETURN 99;   -- Economy Zone
  END IF;
END;
$$;

COMMENT ON FUNCTION public.calculate_pixel_price IS 'Calculates pixel price using Chebyshev distance. Center(40x40)=₹299, Middle(80x80)=₹199, Outer=₹99';

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================

CREATE TABLE public.profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- User info
  full_name TEXT,
  phone_number TEXT,
  date_of_birth DATE,
  avatar_url TEXT,
  bio TEXT,
  website_url TEXT,
  
  -- Permissions
  is_admin BOOLEAN DEFAULT false,
  
  -- Denormalized counters (updated by triggers)
  pixel_count INTEGER DEFAULT 0,
  total_spent NUMERIC(12,2) DEFAULT 0,
  
  -- Activity tracking
  last_active_at TIMESTAMPTZ,
  
  -- Soft delete support
  deleted_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_deleted ON public.profiles(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_admin ON public.profiles(is_admin) WHERE is_admin = true;

-- Comments
COMMENT ON TABLE public.profiles IS 'User profiles with soft delete support and denormalized counters';
COMMENT ON COLUMN public.profiles.pixel_count IS 'Denormalized count of owned pixels, updated by trigger';
COMMENT ON COLUMN public.profiles.total_spent IS 'Denormalized total spending, updated by trigger';
COMMENT ON COLUMN public.profiles.deleted_at IS 'Soft delete timestamp - NULL means active';

-- ============================================================================
-- PIXEL BLOCKS TABLE (for grouped purchases)
-- ============================================================================

CREATE TABLE public.pixel_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  
  -- Block content
  image_url TEXT NOT NULL,
  link_url TEXT,
  alt_text TEXT,
  
  -- Block dimensions (bounding box)
  min_x INTEGER NOT NULL CHECK (min_x >= 0 AND min_x < 100),
  max_x INTEGER NOT NULL CHECK (max_x >= 0 AND max_x < 100),
  min_y INTEGER NOT NULL CHECK (min_y >= 0 AND min_y < 100),
  max_y INTEGER NOT NULL CHECK (max_y >= 0 AND max_y < 100),
  
  -- Computed values
  pixel_count INTEGER NOT NULL CHECK (pixel_count > 0),
  total_price NUMERIC(12,2) NOT NULL CHECK (total_price > 0),
  
  -- Timestamps
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_bounds CHECK (min_x <= max_x AND min_y <= max_y)
);

-- Indexes
CREATE INDEX idx_pixel_blocks_owner ON public.pixel_blocks(owner_id);
CREATE INDEX idx_pixel_blocks_purchased ON public.pixel_blocks(purchased_at DESC);

-- Comments
COMMENT ON TABLE public.pixel_blocks IS 'Groups of pixels purchased together as a single block with shared image';
COMMENT ON COLUMN public.pixel_blocks.min_x IS 'Left edge of block bounding box (0-99)';
COMMENT ON COLUMN public.pixel_blocks.max_x IS 'Right edge of block bounding box (0-99)';

-- ============================================================================
-- PIXELS TABLE
-- ============================================================================

CREATE TABLE public.pixels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Grid position (unique)
  x INTEGER NOT NULL CHECK (x >= 0 AND x < 100),
  y INTEGER NOT NULL CHECK (y >= 0 AND y < 100),
  
  -- Ownership
  owner_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  block_id UUID REFERENCES public.pixel_blocks(id) ON DELETE SET NULL,
  
  -- Content (for single-pixel purchases, blocks use pixel_blocks.image_url)
  image_url TEXT,
  link_url TEXT,
  alt_text TEXT,
  
  -- Purchase info
  price_paid NUMERIC(10,2),
  purchased_at TIMESTAMPTZ,
  
  -- Resale tracking
  times_resold INTEGER DEFAULT 0,
  last_sale_price NUMERIC(10,2),
  last_sale_date TIMESTAMPTZ,
  
  -- Analytics
  view_count INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint on coordinates
  UNIQUE(x, y)
);

-- Indexes
CREATE INDEX idx_pixels_owner ON public.pixels(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX idx_pixels_block ON public.pixels(block_id) WHERE block_id IS NOT NULL;
CREATE INDEX idx_pixels_available ON public.pixels(x, y) WHERE owner_id IS NULL;
CREATE INDEX idx_pixels_position ON public.pixels(x, y);
CREATE INDEX idx_pixels_purchased ON public.pixels(purchased_at DESC) WHERE purchased_at IS NOT NULL;

-- Comments
COMMENT ON TABLE public.pixels IS 'Individual pixels in the 100x100 grid. Can be owned individually or as part of a block';
COMMENT ON COLUMN public.pixels.block_id IS 'If part of a block purchase, references the pixel_blocks table';
COMMENT ON COLUMN public.pixels.view_count IS 'Number of times this pixel has been viewed (for analytics)';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pixel_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pixels ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR deleted_at IS NULL);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Pixel blocks policies
CREATE POLICY "blocks_select_all" ON public.pixel_blocks
  FOR SELECT USING (true);

CREATE POLICY "blocks_insert_own" ON public.pixel_blocks
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "blocks_update_own" ON public.pixel_blocks
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

-- Pixels policies
CREATE POLICY "pixels_select_all" ON public.pixels
  FOR SELECT USING (true);

CREATE POLICY "pixels_update_own" ON public.pixels
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR owner_id IS NULL);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_pixels_updated_at
  BEFORE UPDATE ON public.pixels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- AUTO PROFILE CREATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      'https://api.dicebear.com/7.x/initials/svg?seed=' || COALESCE(NEW.email, 'User')
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true),
  ('pixel-images', 'pixel-images', true),
  ('blog-images', 'blog-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
CREATE POLICY "avatars_public_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for pixel-images
CREATE POLICY "pixel_images_public_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'pixel-images');

CREATE POLICY "pixel_images_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pixel-images');

CREATE POLICY "pixel_images_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'pixel-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "pixel_images_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'pixel-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================================
-- REALTIME
-- ============================================================================

ALTER TABLE public.pixels REPLICA IDENTITY FULL;
ALTER TABLE public.pixel_blocks REPLICA IDENTITY FULL;

-- ============================================================================
-- END OF 002
-- ============================================================================
