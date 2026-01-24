-- ============================================================================
-- 011: ENHANCED FEATURES
-- BuyAPixel - Pixel History, Achievements, Moderation, Analytics
-- ============================================================================

-- ============================================================================
-- PIXEL HISTORY TABLE (Full Audit Trail)
-- ============================================================================

CREATE TABLE public.pixel_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pixel_id UUID NOT NULL REFERENCES public.pixels(id) ON DELETE CASCADE,
  
  -- What changed
  action TEXT NOT NULL CHECK (action IN ('purchase', 'resale', 'update', 'block_assign', 'admin_reset', 'admin_remove')),
  
  -- Who was involved
  from_owner_id UUID REFERENCES auth.users(id),
  to_owner_id UUID REFERENCES auth.users(id),
  changed_by UUID REFERENCES auth.users(id),
  
  -- Details
  price NUMERIC(12,2),
  block_id UUID,
  old_values JSONB DEFAULT '{}',
  new_values JSONB DEFAULT '{}',
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_pixel_history_pixel ON public.pixel_history(pixel_id, created_at DESC);
CREATE INDEX idx_pixel_history_user ON public.pixel_history(to_owner_id, created_at DESC);
CREATE INDEX idx_pixel_history_action ON public.pixel_history(action, created_at DESC);

COMMENT ON TABLE public.pixel_history IS 'Complete audit trail of all pixel ownership and content changes';

-- ============================================================================
-- ACHIEVEMENTS TABLE
-- ============================================================================

CREATE TABLE public.achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'collector', 'trader', 'social', 'special')),
  
  -- Requirements (JSONB for flexibility)
  requirements JSONB NOT NULL DEFAULT '{}',
  
  -- Rewards
  badge_color TEXT DEFAULT '#6366f1',
  points INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User achievements (earned)
CREATE TABLE public.user_achievements (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON public.user_achievements(user_id);

-- ============================================================================
-- CONTENT MODERATION QUEUE
-- ============================================================================

CREATE TABLE public.moderation_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- What's being moderated
  content_type TEXT NOT NULL CHECK (content_type IN ('pixel', 'block', 'profile', 'blog_post')),
  content_id UUID NOT NULL,
  
  -- Reporter
  reported_by UUID REFERENCES auth.users(id),
  report_reason TEXT NOT NULL,
  report_details TEXT,
  
  -- Content owner
  owner_id UUID REFERENCES auth.users(id),
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected', 'removed')),
  priority INTEGER DEFAULT 0,
  
  -- Resolution
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  resolution_notes TEXT,
  action_taken TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_moderation_status ON public.moderation_queue(status, priority DESC, created_at);
CREATE INDEX idx_moderation_content ON public.moderation_queue(content_type, content_id);

COMMENT ON TABLE public.moderation_queue IS 'Queue for reviewing flagged content';

-- ============================================================================
-- USER ACTIVITY FEED
-- ============================================================================

CREATE TABLE public.user_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Activity type
  activity_type TEXT NOT NULL,
  
  -- Target
  target_type TEXT,
  target_id UUID,
  
  -- Details
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Visibility
  is_public BOOLEAN DEFAULT true,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_user ON public.user_activity(user_id, created_at DESC);
CREATE INDEX idx_activity_public ON public.user_activity(created_at DESC) WHERE is_public = true;

COMMENT ON TABLE public.user_activity IS 'User activity feed for profile pages';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.pixel_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- Pixel history: public read, system write
CREATE POLICY "pixel_history_select" ON public.pixel_history
  FOR SELECT USING (true);

-- Achievements: public read
CREATE POLICY "achievements_select" ON public.achievements
  FOR SELECT USING (is_active = true);

CREATE POLICY "achievements_admin" ON public.achievements
  FOR ALL TO authenticated
  USING (is_current_user_super_admin());

-- User achievements: public read
CREATE POLICY "user_achievements_select" ON public.user_achievements
  FOR SELECT USING (true);

-- Moderation: admin only
CREATE POLICY "moderation_admin" ON public.moderation_queue
  FOR ALL TO authenticated
  USING (is_current_user_super_admin());

CREATE POLICY "moderation_report" ON public.moderation_queue
  FOR INSERT TO authenticated
  WITH CHECK (reported_by = auth.uid());

-- Activity: public can see public activities, users can see their own
CREATE POLICY "activity_select" ON public.user_activity
  FOR SELECT USING (is_public = true OR user_id = auth.uid());

-- ============================================================================
-- PIXEL HISTORY TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_pixel_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
BEGIN
  -- Determine action type
  IF TG_OP = 'UPDATE' THEN
    IF OLD.owner_id IS NULL AND NEW.owner_id IS NOT NULL THEN
      v_action := 'purchase';
    ELSIF OLD.owner_id IS NOT NULL AND NEW.owner_id IS NOT NULL AND OLD.owner_id != NEW.owner_id THEN
      v_action := 'resale';
    ELSIF OLD.block_id IS DISTINCT FROM NEW.block_id THEN
      v_action := 'block_assign';
    ELSE
      v_action := 'update';
    END IF;
    
    INSERT INTO pixel_history (pixel_id, action, from_owner_id, to_owner_id, price, block_id, old_values, new_values)
    VALUES (
      NEW.id,
      v_action,
      OLD.owner_id,
      NEW.owner_id,
      NEW.price_paid,
      NEW.block_id,
      jsonb_build_object('image_url', OLD.image_url, 'link_url', OLD.link_url),
      jsonb_build_object('image_url', NEW.image_url, 'link_url', NEW.link_url)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_pixel_history
  AFTER UPDATE ON public.pixels
  FOR EACH ROW
  WHEN (OLD.owner_id IS DISTINCT FROM NEW.owner_id OR OLD.image_url IS DISTINCT FROM NEW.image_url)
  EXECUTE FUNCTION public.log_pixel_change();

-- ============================================================================
-- ACTIVITY LOGGING HELPER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_activity(
  p_user_id UUID,
  p_activity_type TEXT,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_is_public BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO user_activity (user_id, activity_type, title, description, target_type, target_id, is_public)
  VALUES (p_user_id, p_activity_type, p_title, p_description, p_target_type, p_target_id, p_is_public)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- ============================================================================
-- REVENUE DASHBOARD FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_revenue_stats(
  p_days INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT is_current_user_super_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT jsonb_build_object(
    'total_revenue', COALESCE(SUM(price_paid), 0),
    'total_sales', COUNT(*),
    'avg_price', COALESCE(AVG(price_paid), 0),
    'unique_buyers', COUNT(DISTINCT owner_id),
    
    'daily', (
      SELECT jsonb_agg(day_stats ORDER BY day)
      FROM (
        SELECT 
          date_trunc('day', purchased_at)::DATE AS day,
          COUNT(*) AS sales,
          SUM(price_paid) AS revenue
        FROM pixels
        WHERE purchased_at >= NOW() - (p_days || ' days')::INTERVAL
          AND owner_id IS NOT NULL
        GROUP BY date_trunc('day', purchased_at)
      ) day_stats
    ),
    
    'weekly', (
      SELECT jsonb_agg(week_stats ORDER BY week)
      FROM (
        SELECT 
          date_trunc('week', purchased_at)::DATE AS week,
          COUNT(*) AS sales,
          SUM(price_paid) AS revenue
        FROM pixels
        WHERE purchased_at >= NOW() - (p_days || ' days')::INTERVAL
          AND owner_id IS NOT NULL
        GROUP BY date_trunc('week', purchased_at)
      ) week_stats
    ),
    
    'by_zone', (
      SELECT jsonb_object_agg(zone, stats)
      FROM (
        SELECT 
          CASE 
            WHEN GREATEST(ABS(x - 50), ABS(y - 50)) < 20 THEN 'gold'
            WHEN GREATEST(ABS(x - 50), ABS(y - 50)) < 40 THEN 'standard'
            ELSE 'economy'
          END AS zone,
          jsonb_build_object('count', COUNT(*), 'revenue', SUM(price_paid)) AS stats
        FROM pixels
        WHERE owner_id IS NOT NULL
        GROUP BY 1
      ) zone_stats
    )
  ) INTO v_result
  FROM pixels
  WHERE purchased_at >= NOW() - (p_days || ' days')::INTERVAL
    AND owner_id IS NOT NULL;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- HEATMAP DATA FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_heatmap_data()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'owned_pixels', (
        SELECT jsonb_agg(jsonb_build_object('x', x, 'y', y, 'price', price_paid))
        FROM pixels WHERE owner_id IS NOT NULL
      ),
      'zone_stats', (
        SELECT jsonb_object_agg(zone, cnt)
        FROM (
          SELECT 
            CASE 
              WHEN GREATEST(ABS(x - 50), ABS(y - 50)) < 20 THEN 'gold'
              WHEN GREATEST(ABS(x - 50), ABS(y - 50)) < 40 THEN 'standard'
              ELSE 'economy'
            END AS zone,
            COUNT(*) FILTER (WHERE owner_id IS NOT NULL) AS cnt
          FROM pixels
          GROUP BY 1
        ) z
      ),
      'recent_sales', (
        SELECT jsonb_agg(jsonb_build_object('x', x, 'y', y, 'price', price_paid, 'at', purchased_at))
        FROM (
          SELECT x, y, price_paid, purchased_at
          FROM pixels
          WHERE purchased_at IS NOT NULL
          ORDER BY purchased_at DESC
          LIMIT 50
        ) recent
      )
    )
  );
END;
$$;

-- ============================================================================
-- BULK OPERATIONS (Admin)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_bulk_reset_pixels(
  p_pixels JSONB  -- Array of {x, y}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pixel JSONB;
  v_count INTEGER := 0;
BEGIN
  IF NOT is_current_user_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  FOR v_pixel IN SELECT * FROM jsonb_array_elements(p_pixels)
  LOOP
    UPDATE pixels
    SET 
      owner_id = NULL,
      block_id = NULL,
      image_url = NULL,
      link_url = NULL,
      alt_text = NULL,
      price_paid = NULL,
      purchased_at = NULL,
      is_active = true
    WHERE x = (v_pixel->>'x')::INTEGER 
      AND y = (v_pixel->>'y')::INTEGER
      AND owner_id IS NOT NULL;
    
    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'reset_count', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_bulk_reset_area(
  p_min_x INTEGER,
  p_max_x INTEGER,
  p_min_y INTEGER,
  p_max_y INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT is_current_user_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  UPDATE pixels
  SET 
    owner_id = NULL,
    block_id = NULL,
    image_url = NULL,
    link_url = NULL,
    alt_text = NULL,
    price_paid = NULL,
    purchased_at = NULL,
    is_active = true
  WHERE x BETWEEN p_min_x AND p_max_x
    AND y BETWEEN p_min_y AND p_max_y
    AND owner_id IS NOT NULL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'reset_count', v_count);
END;
$$;

-- ============================================================================
-- MODERATION FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.report_content(
  p_content_type TEXT,
  p_content_id UUID,
  p_reason TEXT,
  p_details TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_owner_id UUID;
BEGIN
  -- Get content owner
  IF p_content_type = 'pixel' THEN
    SELECT owner_id INTO v_owner_id FROM pixels WHERE id = p_content_id;
  ELSIF p_content_type = 'block' THEN
    SELECT owner_id INTO v_owner_id FROM pixel_blocks WHERE id = p_content_id;
  END IF;

  INSERT INTO moderation_queue (content_type, content_id, reported_by, report_reason, report_details, owner_id)
  VALUES (p_content_type, p_content_id, auth.uid(), p_reason, p_details, v_owner_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_moderation(
  p_queue_id UUID,
  p_status TEXT,
  p_action TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_current_user_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  UPDATE moderation_queue
  SET 
    status = p_status,
    action_taken = p_action,
    resolution_notes = p_notes,
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_queue_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- ACHIEVEMENT CHECKING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_achievements(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pixel_count INTEGER;
  v_total_spent NUMERIC;
  v_new_achievements TEXT[] := '{}';
BEGIN
  -- Get user stats
  SELECT pixel_count, total_spent INTO v_pixel_count, v_total_spent
  FROM profiles WHERE user_id = p_user_id;

  -- First Pixel
  IF v_pixel_count >= 1 AND NOT EXISTS (
    SELECT 1 FROM user_achievements WHERE user_id = p_user_id AND achievement_id = 'first_pixel'
  ) THEN
    INSERT INTO user_achievements (user_id, achievement_id) VALUES (p_user_id, 'first_pixel');
    v_new_achievements := array_append(v_new_achievements, 'first_pixel');
  END IF;

  -- Collector (10 pixels)
  IF v_pixel_count >= 10 AND NOT EXISTS (
    SELECT 1 FROM user_achievements WHERE user_id = p_user_id AND achievement_id = 'collector'
  ) THEN
    INSERT INTO user_achievements (user_id, achievement_id) VALUES (p_user_id, 'collector');
    v_new_achievements := array_append(v_new_achievements, 'collector');
  END IF;

  -- Landlord (50 pixels)
  IF v_pixel_count >= 50 AND NOT EXISTS (
    SELECT 1 FROM user_achievements WHERE user_id = p_user_id AND achievement_id = 'landlord'
  ) THEN
    INSERT INTO user_achievements (user_id, achievement_id) VALUES (p_user_id, 'landlord');
    v_new_achievements := array_append(v_new_achievements, 'landlord');
  END IF;

  -- Big Spender (₹1000)
  IF v_total_spent >= 1000 AND NOT EXISTS (
    SELECT 1 FROM user_achievements WHERE user_id = p_user_id AND achievement_id = 'big_spender'
  ) THEN
    INSERT INTO user_achievements (user_id, achievement_id) VALUES (p_user_id, 'big_spender');
    v_new_achievements := array_append(v_new_achievements, 'big_spender');
  END IF;

  RETURN jsonb_build_object('new_achievements', v_new_achievements);
END;
$$;

-- ============================================================================
-- SEED DEFAULT ACHIEVEMENTS
-- ============================================================================

INSERT INTO achievements (id, name, description, icon, category, requirements, points, display_order) VALUES
  ('first_pixel', 'First Step', 'Purchase your first pixel', 'star', 'general', '{"pixels": 1}', 10, 1),
  ('collector', 'Collector', 'Own 10 pixels', 'grid', 'collector', '{"pixels": 10}', 25, 2),
  ('landlord', 'Landlord', 'Own 50 pixels', 'building', 'collector', '{"pixels": 50}', 100, 3),
  ('mogul', 'Pixel Mogul', 'Own 100 pixels', 'crown', 'collector', '{"pixels": 100}', 250, 4),
  ('big_spender', 'Big Spender', 'Spend over ₹1,000', 'dollar-sign', 'general', '{"spent": 1000}', 50, 5),
  ('whale', 'Whale', 'Spend over ₹10,000', 'anchor', 'general', '{"spent": 10000}', 200, 6),
  ('gold_rush', 'Gold Rush', 'Own a pixel in the Gold Zone', 'zap', 'special', '{"zone": "gold"}', 75, 7),
  ('block_builder', 'Block Builder', 'Create a pixel block', 'layers', 'collector', '{"blocks": 1}', 30, 8),
  ('trader', 'Trader', 'Complete a marketplace sale', 'repeat', 'trader', '{"sales": 1}', 40, 9),
  ('market_maker', 'Market Maker', 'Complete 10 marketplace sales', 'trending-up', 'trader', '{"sales": 10}', 150, 10)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.log_activity(UUID, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_revenue_stats(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_heatmap_data() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_bulk_reset_pixels(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_bulk_reset_area(INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_content(TEXT, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_moderation(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_achievements(UUID) TO authenticated;

-- ============================================================================
-- END OF 011
-- ============================================================================
