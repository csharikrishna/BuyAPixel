-- Update is_current_user_admin to fallback to is_current_user_super_admin
-- Ensures the main owner emails never lose admin access even if their profile flag is toggled

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- First check if they are a super admin
  IF is_current_user_super_admin() THEN
    RETURN true;
  END IF;

  -- Otherwise check the profiles table
  SELECT p.is_admin INTO v_is_admin
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  RETURN COALESCE(v_is_admin, false);
END;
$$;
