-- ============================================================================
-- COMPLETE DATABASE RESET SCRIPT
-- Respects Foreign Key constraints by deleting in the correct order
-- Run this DIRECTLY in Supabase SQL Editor
-- ============================================================================

-- IMPORTANT: Run each section one at a time if you encounter errors

-- ============================================================================
-- SECTION 1: Clear tables that reference other tables (children first)
-- ============================================================================

-- 1.1 Clear marketplace transactions (references listings, pixels, auth.users)
DELETE FROM public.marketplace_transactions;

-- 1.2 Clear marketplace listings (references pixels, profiles)
DELETE FROM public.marketplace_listings;

-- 1.3 Reset pixels to unowned (references profiles - set to NULL first!)
UPDATE public.pixels
SET 
  owner_id = NULL,
  image_url = NULL,
  link_url = NULL,
  alt_text = NULL,
  purchased_at = NULL,
  price_paid = NULL,
  times_resold = 0,
  last_sale_price = NULL,
  last_sale_date = NULL;

-- 1.4 Clear announcements (references auth.users)
DELETE FROM public.announcements;

-- 1.5 Clear blog post categories (references blog_posts)
DELETE FROM public.blog_post_categories;

-- 1.6 Clear blog posts (references auth.users)
DELETE FROM public.blog_posts;

-- 1.7 Clear admin audit log (references auth.users)
DELETE FROM public.admin_audit_log;

-- 1.8 Clear user status (references auth.users)
DELETE FROM public.user_status;

-- 1.9 Clear user notification preferences (references auth.users)
DELETE FROM public.user_notification_preferences;

-- ============================================================================
-- SECTION 2: Clear profiles (references auth.users)
-- ============================================================================

DELETE FROM public.profiles;

-- ============================================================================
-- SECTION 3: Clear auth.users (the root table)
-- NOTE: This requires elevated privileges. If it fails, delete users manually
-- from Supabase Dashboard > Authentication > Users
-- ============================================================================

DELETE FROM auth.users;

-- ============================================================================
-- VERIFICATION: Check that everything is cleared
-- ============================================================================

SELECT 
  (SELECT COUNT(*) FROM public.pixels WHERE owner_id IS NOT NULL) as owned_pixels,
  (SELECT COUNT(*) FROM public.marketplace_listings) as listings,
  (SELECT COUNT(*) FROM public.profiles) as profiles,
  (SELECT COUNT(*) FROM auth.users) as users;

-- If all values are 0, the database has been cleared successfully!
