-- Update is_current_user_super_admin to check for is_admin flag in profiles
-- Also allows both adsbuyaspot@gmail.com and notbot4444@gmail.com as super admins

CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND is_admin = true
  ) OR EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND email IN ('adsbuyaspot@gmail.com', 'notbot4444@gmail.com')
  );
END;
$$;
