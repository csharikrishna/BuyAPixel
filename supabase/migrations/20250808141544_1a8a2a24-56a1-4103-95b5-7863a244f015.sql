-- Allow users to claim unowned pixels by updating owner_id from NULL to their user id
-- and set purchase metadata safely via RLS

-- Enable Row Level Security is already enabled. We add an extra policy for UPDATE.
CREATE POLICY IF NOT EXISTS "Users can claim unowned pixels"
ON public.pixels
FOR UPDATE
USING (owner_id IS NULL)
WITH CHECK (owner_id = auth.uid());