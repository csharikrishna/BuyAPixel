-- =============================================================
-- Migration: Startup Directory (Paid Listings)
-- =============================================================
-- A paid startup/project showcase. Users pay to list their
-- startup, creating a ProductHunt-style directory.
-- =============================================================

CREATE TABLE IF NOT EXISTS directory_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Content
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  cover_image_url TEXT,
  website_url TEXT,

  -- Social links
  twitter_url TEXT,
  linkedin_url TEXT,
  github_url TEXT,

  -- Categorization
  category TEXT NOT NULL DEFAULT 'startup',
  tags TEXT[] DEFAULT '{}',

  -- Tier & Payment
  listing_tier TEXT NOT NULL DEFAULT 'basic',
  payment_order_id UUID,
  amount_paid INTEGER NOT NULL DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',
  is_featured BOOLEAN DEFAULT FALSE,
  featured_until TIMESTAMPTZ,

  -- Metrics
  views_count INTEGER DEFAULT 0,
  clicks_count INTEGER DEFAULT 0,

  -- Meta
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT listing_tier_check CHECK (listing_tier IN ('basic', 'featured', 'premium')),
  CONSTRAINT listing_status_check CHECK (status IN ('pending', 'active', 'rejected', 'expired'))
);

-- Enable RLS
ALTER TABLE directory_listings ENABLE ROW LEVEL SECURITY;

-- Anyone can view active listings
CREATE POLICY "Anyone can view active directory listings"
  ON directory_listings FOR SELECT
  USING (status = 'active');

-- Users can insert their own listings
CREATE POLICY "Users can create their own listings"
  ON directory_listings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own listings
CREATE POLICY "Users can update their own listings"
  ON directory_listings FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_directory_listings_status ON directory_listings(status);
CREATE INDEX IF NOT EXISTS idx_directory_listings_category ON directory_listings(category);
CREATE INDEX IF NOT EXISTS idx_directory_listings_tier ON directory_listings(listing_tier);
CREATE INDEX IF NOT EXISTS idx_directory_listings_featured ON directory_listings(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_directory_listings_user ON directory_listings(user_id);

-- =============================================================
-- RPC: Get directory listings with filtering
-- =============================================================
CREATE OR REPLACE FUNCTION get_directory_listings(
  category_filter TEXT DEFAULT NULL,
  search_query TEXT DEFAULT NULL,
  page_num INT DEFAULT 1,
  page_size INT DEFAULT 20
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSON;
  offset_val INT;
BEGIN
  offset_val := (page_num - 1) * page_size;

  SELECT json_build_object(
    'listings', COALESCE((
      SELECT json_agg(row_to_json(l))
      FROM (
        SELECT
          dl.id, dl.name, dl.tagline, dl.description,
          dl.logo_url, dl.cover_image_url, dl.website_url,
          dl.twitter_url, dl.linkedin_url, dl.github_url,
          dl.category, dl.tags, dl.listing_tier,
          dl.is_featured, dl.views_count, dl.clicks_count,
          dl.created_at,
          p.full_name as author_name,
          p.avatar_url as author_avatar
        FROM public.directory_listings dl
        LEFT JOIN public.profiles p ON p.user_id = dl.user_id
        WHERE dl.status = 'active'
          AND (category_filter IS NULL OR dl.category = category_filter)
          AND (search_query IS NULL OR (
            dl.name ILIKE '%' || search_query || '%'
            OR dl.tagline ILIKE '%' || search_query || '%'
            OR dl.description ILIKE '%' || search_query || '%'
          ))
        ORDER BY
          dl.is_featured DESC,
          dl.listing_tier = 'premium' DESC,
          dl.listing_tier = 'featured' DESC,
          dl.created_at DESC
        LIMIT page_size
        OFFSET offset_val
      ) l
    ), '[]'::json),
    'total_count', (
      SELECT COUNT(*)
      FROM public.directory_listings dl
      WHERE dl.status = 'active'
        AND (category_filter IS NULL OR dl.category = category_filter)
        AND (search_query IS NULL OR (
          dl.name ILIKE '%' || search_query || '%'
          OR dl.tagline ILIKE '%' || search_query || '%'
        ))
    ),
    'categories', COALESCE((
      SELECT json_agg(DISTINCT dl.category)
      FROM public.directory_listings dl
      WHERE dl.status = 'active'
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_directory_listings(TEXT, TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_directory_listings(TEXT, TEXT, INT, INT) TO anon;

-- Increment view count
CREATE OR REPLACE FUNCTION increment_listing_views(listing_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.directory_listings
  SET views_count = views_count + 1, updated_at = now()
  WHERE id = listing_id AND status = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION increment_listing_views(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_listing_views(UUID) TO anon;
