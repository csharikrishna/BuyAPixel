-- ============================================================================
-- ROBUST FIX for Database Relationships & Clear Function
-- 1. Cleans up "orphaned" data that blocks Foreign Keys
-- 2. Safely adds the missing Foreign Keys
-- 3. Re-creates the Clear Database function ensuring it exists
-- ============================================================================

BEGIN; -- Start transaction

-- ----------------------------------------------------------------------------
-- STEP 1: Fix "Pixels" Relationship (owner_id -> profiles.user_id)
-- ----------------------------------------------------------------------------

-- A. Remove orphaned pixels (owned by users who don't exist in profiles)
UPDATE public.pixels
SET owner_id = NULL
WHERE owner_id IS NOT NULL 
  AND owner_id NOT IN (SELECT user_id FROM public.profiles);

-- B. Safely drop existing constraint if it exists
ALTER TABLE public.pixels DROP CONSTRAINT IF EXISTS pixels_owner_id_fkey;
ALTER TABLE public.pixels DROP CONSTRAINT IF EXISTS pixels_owner_id_profiles_fkey;

-- C. Add the correct Foreign Key
ALTER TABLE public.pixels
  ADD CONSTRAINT pixels_owner_id_profiles_fkey
  FOREIGN KEY (owner_id) REFERENCES public.profiles(user_id)
  ON UPDATE CASCADE
  ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- STEP 2: Fix "Marketplace Listings" Relationship
-- ----------------------------------------------------------------------------

-- A. Delete orphaned listings (sellers who don't exist in profiles)
DELETE FROM public.marketplace_listings
WHERE seller_id NOT IN (SELECT user_id FROM public.profiles);

-- B. Safely drop existing constraint
ALTER TABLE public.marketplace_listings DROP CONSTRAINT IF EXISTS marketplace_listings_seller_id_fkey;
ALTER TABLE public.marketplace_listings DROP CONSTRAINT IF EXISTS marketplace_listings_seller_id_profiles_fkey;

-- C. Add the correct Foreign Key
ALTER TABLE public.marketplace_listings
  ADD CONSTRAINT marketplace_listings_seller_id_profiles_fkey
  FOREIGN KEY (seller_id) REFERENCES public.profiles(user_id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- STEP 3: Ensure Audit Log Table Exists
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- STEP 4: Force Re-create Clear Database Function
-- ----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.admin_clear_all_content();

CREATE OR REPLACE FUNCTION public.admin_clear_all_content()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_admin_email TEXT;
  v_pixels_reset INTEGER := 0;
  v_listings_deleted INTEGER := 0;
  v_announcements_deleted INTEGER := 0;
BEGIN
  -- Get authenticated user
  v_admin_id := auth.uid();
  
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get admin email
  SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_id;

  -- Verify admin email (CRITICAL: Must match your logged-in email)
  -- If you are testing with a different email, update this or remove the check temporarily
  IF v_admin_email != 'notbot4444@gmail.com' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: ' || v_admin_email || ' is not an admin');
  END IF;

  -- 1. Reset Pixels
  UPDATE public.pixels
  SET owner_id = NULL, image_url = NULL, link_url = NULL, alt_text = NULL, purchased_at = NULL, price_paid = NULL
  WHERE owner_id IS NOT NULL;
  
  GET DIAGNOSTICS v_pixels_reset = ROW_COUNT;

  -- 2. Clear Listings
  DELETE FROM public.marketplace_listings;
  GET DIAGNOSTICS v_listings_deleted = ROW_COUNT;

  -- 3. Clear Announcements (if table exists)
  BEGIN
    DELETE FROM public.announcements;
    GET DIAGNOSTICS v_announcements_deleted = ROW_COUNT;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- 4. Audit Log
  INSERT INTO public.admin_audit_log (admin_email, action, target_type, target_id, details)
  VALUES (v_admin_email, 'CLEAR_DATABASE', 'system', 'all', jsonb_build_object('pixels', v_pixels_reset));

  RETURN jsonb_build_object('success', true, 'pixels_reset', v_pixels_reset);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.admin_clear_all_content() TO authenticated;

COMMIT; -- Commit all changes
