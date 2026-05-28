-- =============================================================
-- Migration: Add Collector Badges to Achievements System
-- =============================================================
-- Adds new badge definitions that are dynamically evaluated.
-- Uses the existing achievements + user_achievements infrastructure.
-- =============================================================

-- Insert new collector badge definitions
INSERT INTO achievements (id, name, description, icon, category, badge_color, points, display_order, is_active, requirements)
VALUES
  ('badge_whale', 'Whale', 'Own 100+ pixels on the grid', 'diamond', 'collector', '#3b82f6', 500, 10, true, '{"min_pixels": 100}'::jsonb),
  ('badge_early_adopter', 'Early Adopter', 'Among the first 1,000 pixel purchases', 'rocket', 'collector', '#f59e0b', 300, 11, true, '{"max_purchase_rank": 1000}'::jsonb),
  ('badge_flipper', 'Flipper', 'Successfully sold a pixel on the marketplace', 'dollar-sign', 'collector', '#10b981', 200, 12, true, '{"min_marketplace_sales": 1}'::jsonb),
  ('badge_premium_buyer', 'Gold Member', 'Purchased a Gold-tier pixel (₹499)', 'building', 'collector', '#eab308', 250, 13, true, '{"min_gold_pixels": 1}'::jsonb),
  ('badge_bulk_buyer', 'Land Baron', 'Own 50+ pixels in a single purchase', 'building', 'collector', '#8b5cf6', 400, 14, true, '{"min_block_size": 50}'::jsonb),
  ('badge_centurion', 'Centurion', 'Own pixels in all three pricing tiers', 'trophy', 'collector', '#ef4444', 350, 15, true, '{"all_tiers": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  badge_color = EXCLUDED.badge_color,
  points = EXCLUDED.points,
  display_order = EXCLUDED.display_order,
  requirements = EXCLUDED.requirements;

-- =============================================================
-- Update get_user_badges RPC to evaluate new collector badges
-- =============================================================

DROP FUNCTION IF EXISTS get_user_badges(UUID);

CREATE OR REPLACE FUNCTION get_user_badges(target_user_id UUID)
RETURNS TABLE (
  badge_id TEXT,
  name TEXT,
  description TEXT,
  icon TEXT,
  earned BOOLEAN,
  earned_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_pixel_count INT;
  user_gold_count INT;
  user_premium_count INT;
  user_economy_count INT;
  user_marketplace_sales INT;
  user_max_block_size INT;
  user_purchase_rank BIGINT;
BEGIN
  -- Pre-compute user stats for badge evaluation
  SELECT COUNT(*) INTO user_pixel_count
  FROM public.pixels WHERE owner_id = target_user_id;

  SELECT
    COALESCE(SUM(CASE WHEN price_paid >= 499 THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN price_paid >= 299 AND price_paid < 499 THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN price_paid < 299 THEN 1 ELSE 0 END), 0)
  INTO user_gold_count, user_premium_count, user_economy_count
  FROM public.pixels WHERE owner_id = target_user_id;

  SELECT COUNT(*) INTO user_marketplace_sales
  FROM public.marketplace_transactions
  WHERE seller_id = target_user_id AND status = 'completed';

  SELECT COALESCE(MAX(pixel_count), 0) INTO user_max_block_size
  FROM public.pixel_blocks WHERE owner_id = target_user_id;

  -- Purchase rank: how early this user was among all pixel buyers
  SELECT rank INTO user_purchase_rank
  FROM (
    SELECT owner_id, ROW_NUMBER() OVER (ORDER BY MIN(purchased_at) ASC) as rank
    FROM public.pixels
    GROUP BY owner_id
  ) ranked
  WHERE ranked.owner_id = target_user_id;

  -- Return all badges with their earned status
  RETURN QUERY
  SELECT
    a.id AS badge_id,
    a.name,
    a.description,
    a.icon,
    CASE
      -- Whale: 100+ pixels
      WHEN a.id = 'badge_whale' THEN user_pixel_count >= 100
      -- Early Adopter: among first 1000 purchase ranks
      WHEN a.id = 'badge_early_adopter' THEN COALESCE(user_purchase_rank, 999999) <= 1000
      -- Flipper: at least 1 marketplace sale
      WHEN a.id = 'badge_flipper' THEN user_marketplace_sales >= 1
      -- Gold Member: at least 1 gold-tier pixel
      WHEN a.id = 'badge_premium_buyer' THEN user_gold_count >= 1
      -- Land Baron: 50+ pixels in a single block
      WHEN a.id = 'badge_bulk_buyer' THEN user_max_block_size >= 50
      -- Centurion: owns all three tiers
      WHEN a.id = 'badge_centurion' THEN (user_gold_count > 0 AND user_premium_count > 0 AND user_economy_count > 0)
      -- Fallback: check user_achievements table for manually granted badges
      ELSE EXISTS (
        SELECT 1 FROM public.user_achievements ua
        WHERE ua.user_id = target_user_id AND ua.achievement_id = a.id
      )
    END AS earned,
    (
      SELECT ua.earned_at FROM public.user_achievements ua
      WHERE ua.user_id = target_user_id AND ua.achievement_id = a.id
      LIMIT 1
    ) AS earned_at
  FROM public.achievements a
  WHERE a.is_active = true
  ORDER BY a.display_order ASC;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_user_badges(UUID) TO authenticated;
