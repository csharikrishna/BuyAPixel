-- Migration: Add click_count to pixels and pixel_blocks
-- =============================================================

ALTER TABLE public.pixels ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0;
ALTER TABLE public.pixel_blocks ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0;

-- Optionally backfill the counts from existing pixel_clicks
UPDATE public.pixels p
SET click_count = (
  SELECT COUNT(*) FROM public.pixel_clicks pc WHERE pc.pixel_id = p.id
)
WHERE click_count = 0;

UPDATE public.pixel_blocks pb
SET click_count = (
  SELECT COUNT(*) FROM public.pixel_clicks pc WHERE pc.block_id = pb.id
)
WHERE click_count = 0;

-- Update log_pixel_click to increment the counters
CREATE OR REPLACE FUNCTION public.log_pixel_click(
  p_pixel_id UUID,
  p_block_id UUID DEFAULT NULL,
  p_source TEXT DEFAULT 'grid',
  p_referrer TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_device_type TEXT DEFAULT NULL,
  p_browser TEXT DEFAULT NULL,
  p_os TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.pixel_clicks (
    pixel_id, block_id, source, referrer, user_agent,
    device_type, browser, os, country
  )
  VALUES (
    p_pixel_id, p_block_id, p_source, p_referrer, p_user_agent,
    p_device_type, p_browser, p_os, p_country
  )
  RETURNING id INTO v_id;

  -- Increment counters
  UPDATE public.pixels SET click_count = COALESCE(click_count, 0) + 1 WHERE id = p_pixel_id;
  
  IF p_block_id IS NOT NULL THEN
    UPDATE public.pixel_blocks SET click_count = COALESCE(click_count, 0) + 1 WHERE id = p_block_id;
  END IF;

  RETURN v_id;
END;
$$;
