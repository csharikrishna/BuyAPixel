-- ============================================================================
-- 004: BLOG SYSTEM
-- BuyAPixel - Blog Posts, Categories, and Content Management
-- ============================================================================

-- ============================================================================
-- BLOG CATEGORIES
-- ============================================================================

CREATE TABLE public.blog_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Content
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  
  -- Display
  color TEXT DEFAULT '#6366f1',
  icon TEXT,
  display_order INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_blog_categories_slug ON public.blog_categories(slug);
CREATE INDEX idx_blog_categories_active ON public.blog_categories(is_active, display_order);

-- ============================================================================
-- BLOG POSTS
-- ============================================================================

CREATE TABLE public.blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Content
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  featured_image TEXT,
  
  -- Author
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Publishing
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  
  -- SEO
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT[],
  
  -- Metadata
  reading_time INTEGER,  -- Estimated minutes
  tags TEXT[],
  
  -- Analytics
  view_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX idx_blog_posts_author ON public.blog_posts(author_id);
CREATE INDEX idx_blog_posts_status ON public.blog_posts(status, published_at DESC);
CREATE INDEX idx_blog_posts_published ON public.blog_posts(published_at DESC) 
  WHERE status = 'published';

-- ============================================================================
-- BLOG POST CATEGORIES (Junction Table)
-- ============================================================================

CREATE TABLE public.blog_post_categories (
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.blog_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, category_id)
);

-- Indexes
CREATE INDEX idx_post_categories_category ON public.blog_post_categories(category_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_categories ENABLE ROW LEVEL SECURITY;

-- Categories policies
CREATE POLICY "categories_select_all" ON public.blog_categories
  FOR SELECT USING (true);

-- Posts policies
CREATE POLICY "posts_select_published" ON public.blog_posts
  FOR SELECT USING (status = 'published' OR author_id = auth.uid());

CREATE POLICY "posts_insert_auth" ON public.blog_posts
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "posts_update_own" ON public.blog_posts
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid());

CREATE POLICY "posts_delete_own" ON public.blog_posts
  FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- Post categories policies
CREATE POLICY "post_categories_select_all" ON public.blog_post_categories
  FOR SELECT USING (true);

CREATE POLICY "post_categories_manage" ON public.blog_post_categories
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.blog_posts 
      WHERE id = post_id AND author_id = auth.uid()
    )
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER set_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- STORAGE POLICIES FOR BLOG IMAGES
-- ============================================================================

CREATE POLICY "blog_images_public_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'blog-images');

CREATE POLICY "blog_images_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'blog-images');

CREATE POLICY "blog_images_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'blog-images');

CREATE POLICY "blog_images_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'blog-images');

-- ============================================================================
-- END OF 004
-- ============================================================================
