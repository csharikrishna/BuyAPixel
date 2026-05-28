-- =============================================================
-- Migration: Referral System
-- =============================================================
-- Each user gets a unique referral code. When a referred user
-- makes their first purchase, the referrer earns ₹50 credit.
-- =============================================================

-- Add referral_code column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS referral_credits INTEGER DEFAULT 0;

-- Referrals tracking table
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, converted, expired
  reward_amount INTEGER DEFAULT 50,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT referral_status_check CHECK (status IN ('pending', 'converted', 'expired')),
  CONSTRAINT no_self_referral CHECK (referrer_id != referred_id)
);

-- Enable RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Users can view their own referrals (as referrer)
CREATE POLICY "Users can view their referrals"
  ON referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);

-- =============================================================
-- RPC: Generate or get referral code for a user
-- =============================================================
CREATE OR REPLACE FUNCTION get_or_create_referral_code()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid UUID;
  code TEXT;
  stats JSON;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  -- Check if user already has a code
  SELECT referral_code INTO code
  FROM public.profiles
  WHERE user_id = uid;

  -- Generate one if missing
  IF code IS NULL THEN
    -- Generate a short unique code
    code := upper(substr(md5(uid::text || now()::text), 1, 8));

    UPDATE public.profiles
    SET referral_code = code
    WHERE user_id = uid;
  END IF;

  -- Get referral stats
  SELECT json_build_object(
    'referral_code', code,
    'referral_url', 'https://buyaspot.in/?ref=' || code,
    'total_referrals', (
      SELECT COUNT(*) FROM public.referrals WHERE referrer_id = uid
    ),
    'converted_referrals', (
      SELECT COUNT(*) FROM public.referrals WHERE referrer_id = uid AND status = 'converted'
    ),
    'total_credits', COALESCE((
      SELECT referral_credits FROM public.profiles WHERE user_id = uid
    ), 0),
    'pending_referrals', (
      SELECT COUNT(*) FROM public.referrals WHERE referrer_id = uid AND status = 'pending'
    )
  ) INTO stats;

  RETURN stats;
END;
$$;

GRANT EXECUTE ON FUNCTION get_or_create_referral_code() TO authenticated;
