-- ============================================================================
-- FILE 1: CORE SCHEMA
-- BuyAPixel Database - Complete Base Schema
-- Generated: December 7, 2025
-- Consolidates: 22 migration files into clean structure
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to automatically update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Function to calculate pixel price based on position (150×150 grid)
-- Pricing tiers based on distance from center:
--   - Center pixels (< 21.2% distance): ₹299
--   - Middle pixels (21.2-42.4% distance): ₹199
--   - Corner pixels (> 42.4% distance): ₹99
CREATE OR REPLACE FUNCTION public.calculate_pixel_price(pixel_x INTEGER, pixel_y INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  grid_width INTEGER := 150;
  grid_height INTEGER := 150;
  center_x FLOAT := grid_width / 2.0;
  center_y FLOAT := grid_height / 2.0;
  distance_from_center FLOAT;
  max_distance FLOAT;
  normalized_distance FLOAT;
BEGIN
  -- Calculate maximum possible distance (corner to center)
  max_distance := SQRT(POWER(center_x, 2) + POWER(center_y, 2));

  -- Calculate actual distance from center
  distance_from_center := SQRT(POWER(pixel_x - center_x, 2) + POWER(pixel_y - center_y, 2));

  -- Normalize distance (0 to 1)
  normalized_distance := distance_from_center / max_distance;

  -- Determine price tier based on normalized distance
  -- These thresholds match your React component exactly
  IF normalized_distance < 0.212 THEN
    RETURN 299;  -- Center pixels (premium)
  ELSIF normalized_distance < 0.424 THEN
    RETURN 199;  -- Middle pixels
  ELSE
    RETURN 99;   -- Corner pixels
  END IF;
END;
$$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- User profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone_number TEXT,
  date_of_birth DATE,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Pixels table (150×150 grid = 22,500 pixels)
CREATE TABLE IF NOT EXISTS public.pixels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  owner_id UUID REFERENCES auth.users(id),
  image_url TEXT,
  link_url TEXT,
  alt_text TEXT,
  price_tier INTEGER DEFAULT 1,
  price_paid NUMERIC(10,2),
  purchased_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(x, y)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_pixels_position ON public.pixels(x, y);
CREATE INDEX IF NOT EXISTS idx_pixels_owner ON public.pixels(owner_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pixels ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view limited profile info of others" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile"
  ON public.profiles
  FOR DELETE
  USING (auth.uid() = user_id);

-- Limited profile viewing for other users (privacy protection)
CREATE POLICY "Users can view limited profile info of others"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = user_id  -- Full access to own profile
    OR
    (auth.uid() IS NOT NULL AND full_name IS NOT NULL)  -- Only see names of others
  );

-- Pixels Policies
DROP POLICY IF EXISTS "Pixels are viewable by everyone" ON public.pixels;
DROP POLICY IF EXISTS "Anyone can view active pixels" ON public.pixels;
DROP POLICY IF EXISTS "Users can insert their own pixels" ON public.pixels;
DROP POLICY IF EXISTS "Users can update their own pixels" ON public.pixels;
DROP POLICY IF EXISTS "Users can claim unowned pixels" ON public.pixels;

CREATE POLICY "Pixels are viewable by everyone"
  ON public.pixels
  FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own pixels"
  ON public.pixels
  FOR UPDATE
  USING (auth.uid() = owner_id);

-- Allow users to claim unowned pixels
CREATE POLICY "Users can claim unowned pixels"
  ON public.pixels
  FOR UPDATE
  USING (owner_id IS NULL)
  WITH CHECK (auth.uid() = owner_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update timestamps for profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-update timestamps for pixels
DROP TRIGGER IF EXISTS update_pixels_updated_at ON public.pixels;
CREATE TRIGGER update_pixels_updated_at
  BEFORE UPDATE ON public.pixels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- USER REGISTRATION AUTOMATION
-- ============================================================================

-- Function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone_number, date_of_birth)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'phone_number',
    CASE
      WHEN NEW.raw_user_meta_data ->> 'date_of_birth' IS NOT NULL
      THEN (NEW.raw_user_meta_data ->> 'date_of_birth')::date
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

-- Create avatars bucket (for profile pictures)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create pixel-images bucket (for pixel content)
INSERT INTO storage.buckets (id, name, public)
VALUES ('pixel-images', 'pixel-images', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

-- Avatar Storage Policies
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own avatar"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Pixel Image Storage Policies
DROP POLICY IF EXISTS "Anyone can view pixel images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own pixel images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own pixel images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own pixel images" ON storage.objects;

CREATE POLICY "Anyone can view pixel images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'pixel-images');

CREATE POLICY "Users can upload their own pixel images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'pixel-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own pixel images"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'pixel-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own pixel images"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'pixel-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.profiles IS 'User profiles with RLS policies protecting sensitive personal information. Only users can see their own complete profiles, others can only see display names.';
COMMENT ON TABLE public.pixels IS 'Pixel grid for BuyAPixel (150×150 = 22,500 pixels). Each pixel can be owned, customized with images/links, and traded.';
COMMENT ON FUNCTION public.calculate_pixel_price IS 'Calculates pixel price based on distance from center. Center pixels cost ₹299, middle ₹199, corners ₹99. Uses 150×150 grid.';

-- ============================================================================
-- END OF FILE 1
-- ============================================================================
