-- Update is_super_admin(text) to check profiles.is_admin
-- Ensures consistent admin access across all RLS policies (announcements, blog, etc)

CREATE OR REPLACE FUNCTION public.is_super_admin(p_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users u
    JOIN public.profiles p ON u.id = p.user_id
    WHERE u.email = p_email AND p.is_admin = true
  ) OR p_email IN ('adsbuyaspot@gmail.com', 'notbot4444@gmail.com');
END;
$$;
