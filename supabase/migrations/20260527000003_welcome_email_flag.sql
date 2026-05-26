-- ============================================================================
-- Add welcome_email_sent flag to profiles for server-side deduplication
-- Prevents multiple welcome emails from being sent to the same user
-- ============================================================================

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS welcome_email_sent BOOLEAN DEFAULT false;

-- Index for quick lookup during welcome email check
CREATE INDEX IF NOT EXISTS idx_profiles_welcome_email 
  ON public.profiles (user_id) 
  WHERE welcome_email_sent = false;
