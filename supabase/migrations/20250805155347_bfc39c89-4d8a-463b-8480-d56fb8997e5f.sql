-- Add new columns to profiles table for enhanced user information
ALTER TABLE public.profiles 
ADD COLUMN full_name TEXT,
ADD COLUMN phone_number TEXT,
ADD COLUMN date_of_birth DATE;

-- Update the profiles table to remove email column since it's redundant with auth.users
ALTER TABLE public.profiles DROP COLUMN email;

-- Create or replace the handle_new_user function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    new.id, 
    new.raw_user_meta_data ->> 'full_name'
  );
  RETURN new;
END;
$$;

-- Create trigger to automatically create profile when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();