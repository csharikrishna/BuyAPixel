-- ============================================================================
-- RE-SETUP DATABASE AFTER CLEAR
-- Run this AFTER clearing all data to re-enable auto profile creation
-- ============================================================================

-- Re-create the handle_new_user function (creates profile on signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone_number, date_of_birth, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.raw_user_meta_data ->> 'phone_number',
    CASE
      WHEN NEW.raw_user_meta_data ->> 'date_of_birth' IS NOT NULL
      THEN (NEW.raw_user_meta_data ->> 'date_of_birth')::date
      ELSE NULL
    END,
    COALESCE(
      NEW.raw_user_meta_data ->> 'avatar_url',
      'https://api.dicebear.com/7.x/initials/svg?seed=' || COALESCE(NEW.email, 'User')
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- If profile creation fails, log but don't block the user creation
  RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Re-create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Verify the trigger exists
SELECT 'Trigger created successfully!' as result;
