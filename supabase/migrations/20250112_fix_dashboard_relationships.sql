-- ============================================================================
-- Fix Dashboard Relationships & Tables
-- Resolves 400 Bad Request errors by adding explicit Foreign Keys to public.profiles
-- Creates admin_audit_log if missing
-- ============================================================================

-- 1. Fix Pixels Relationship
-- Currently references auth.users, but we need to join with public.profiles
ALTER TABLE public.pixels
  DROP CONSTRAINT IF EXISTS pixels_owner_id_fkey, -- Drop old auth.users FK if it conflicts or replace it
  ADD CONSTRAINT pixels_owner_id_profiles_fkey
  FOREIGN KEY (owner_id) REFERENCES public.profiles(user_id)
  ON UPDATE CASCADE
  ON DELETE SET NULL; -- If user is deleted, pixel becomes system owned

-- 2. Fix Marketplace Listings Relationship
-- Missing FK entirely or references auth.users
ALTER TABLE public.marketplace_listings
  ADD CONSTRAINT marketplace_listings_seller_id_profiles_fkey
  FOREIGN KEY (seller_id) REFERENCES public.profiles(user_id)
  ON UPDATE CASCADE
  ON DELETE CASCADE; -- If seller is deleted, listing is removed

-- 3. Create Admin Audit Log Table (used by Dashboard)
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for faster log queries
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);

-- Enable RLS for Audit Log
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins (super admin email) can view logs
-- Note: Simplified policy, ideally use a robust is_admin() function check
CREATE POLICY "Admins can view audit logs"
  ON public.admin_audit_log
  FOR SELECT
  USING (
    auth.jwt() ->> 'email' = 'notbot4444@gmail.com'
  );

CREATE POLICY "Admins can insert audit logs"
  ON public.admin_audit_log
  FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'email' = 'notbot4444@gmail.com'
  );

COMMENT ON TABLE public.admin_audit_log IS 'Logs of sensitive administrative actions';
