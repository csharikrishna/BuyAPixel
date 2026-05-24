-- ============================================================================
-- 041: GRANT ADMIN TO adsbuyaspot@gmail.com
-- Sets is_admin = true in the profiles table for the admin email
-- ============================================================================

UPDATE public.profiles
SET is_admin = true
FROM auth.users
WHERE auth.users.id = profiles.user_id
  AND auth.users.email = 'adsbuyaspot@gmail.com';
