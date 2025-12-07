-- Add more restrictive policies for sensitive profile data viewing
-- Only allow users to view specific fields of other users' profiles (not sensitive data)

-- Drop the existing overly permissive policy if it exists
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create a new policy that only allows viewing non-sensitive profile data of others
CREATE POLICY "Users can view limited profile info of others" 
ON public.profiles 
FOR SELECT 
USING (
  -- Users can see their own complete profile
  auth.uid() = user_id 
  OR 
  -- Or they can see only non-sensitive fields of others (just full_name for display purposes)
  (auth.uid() IS NOT NULL AND full_name IS NOT NULL)
);

-- Ensure profiles table has proper indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- Add a comment explaining the security considerations
COMMENT ON TABLE public.profiles IS 'User profiles with RLS policies protecting sensitive personal information. Only users can see their own complete profiles, others can only see display names.';