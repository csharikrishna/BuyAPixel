-- ============================================================================
-- 009: TRIGGERS
-- BuyAPixel - Profile Counter Triggers and Automation
-- ============================================================================

-- ============================================================================
-- PROFILE COUNTER UPDATE TRIGGER
-- ============================================================================

-- Function to update profile counters when pixel ownership changes
CREATE OR REPLACE FUNCTION public.update_profile_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If owner changed
  IF TG_OP = 'UPDATE' AND OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    
    -- Decrement old owner's count
    IF OLD.owner_id IS NOT NULL THEN
      UPDATE profiles SET
        pixel_count = GREATEST(0, pixel_count - 1)
      WHERE user_id = OLD.owner_id;
    END IF;
    
    -- Increment new owner's count and add spent amount
    IF NEW.owner_id IS NOT NULL AND NEW.price_paid IS NOT NULL THEN
      UPDATE profiles SET
        pixel_count = pixel_count + 1,
        total_spent = total_spent + COALESCE(NEW.price_paid, 0)
      WHERE user_id = NEW.owner_id;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Note: This trigger is disabled by default as the RPC functions handle counter updates
-- Enable if you want automatic counter sync:
-- CREATE TRIGGER trigger_update_profile_counters
--   AFTER UPDATE ON public.pixels
--   FOR EACH ROW EXECUTE FUNCTION public.update_profile_counters();

-- ============================================================================
-- LISTING STATUS UPDATE
-- ============================================================================

-- Auto-expire listings past their expiration date
CREATE OR REPLACE FUNCTION public.expire_old_listings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE marketplace_listings
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active' 
    AND expires_at IS NOT NULL 
    AND expires_at < NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================================
-- BLOG POST SLUG GENERATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_slug(p_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(
        trim(p_text),
        '[^a-zA-Z0-9\s-]', '', 'g'
      ),
      '[\s-]+', '-', 'g'
    )
  );
END;
$$;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.expire_old_listings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_slug(TEXT) TO authenticated;

-- ============================================================================
-- END OF 009
-- ============================================================================
