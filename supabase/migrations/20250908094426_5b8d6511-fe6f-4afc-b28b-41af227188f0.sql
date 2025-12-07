-- Create a trigger to automatically create profiles when users sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone_number, date_of_birth)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'phone_number', 
    CASE 
      WHEN NEW.raw_user_meta_data ->> 'date_of_birth' IS NOT NULL 
      THEN (NEW.raw_user_meta_data ->> 'date_of_birth')::date
      ELSE NULL 
    END
  );
  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert profile for existing user (from the network requests we can see the user_id)
INSERT INTO public.profiles (user_id, full_name, phone_number, date_of_birth)
VALUES (
  '589149aa-1745-4a74-a275-7094ab4ef4c8',
  'CHINNAPATTU S HARI KRISHNA',
  '9398345393',
  '2005-06-18'::date
)
ON CONFLICT (user_id) DO NOTHING;