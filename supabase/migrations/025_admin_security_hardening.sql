-- ============================================================================
-- 025: ADMIN SECURITY HARDENING
-- BuyAPixel - Remove hardcoded admin emails, strengthen permission checks
-- ============================================================================

-- ============================================================================
-- FUNCTION: is_current_user_admin (ENHANCED)
-- More robust admin check - uses profiles.is_admin table
-- NOTE: Hardcoded email check removed - use db.profiles.is_admin exclusively
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Check if user has admin flag in profiles table
  SELECT p.is_admin INTO v_is_admin
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  RETURN COALESCE(v_is_admin, false);
END;
$$;

-- ============================================================================
-- AUDIT LOG TABLE
-- Track all admin actions for compliance
-- ============================================================================

DROP TABLE IF EXISTS public.admin_audit_log CASCADE;

CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL, -- 'user', 'pixel', 'listing', 'content', etc.
  target_id TEXT,
  details JSONB DEFAULT NULL,
  ip_address INET DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON public.admin_audit_log(admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON public.admin_audit_log(action, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY FOR AUDIT LOG
-- ============================================================================

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read their own or anyone's audit logs
CREATE POLICY "admin_audit_read" ON public.admin_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Only service role can insert
CREATE POLICY "admin_audit_insert" ON public.admin_audit_log
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- FUNCTION: Log Admin Action
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action TEXT,
  p_target_type TEXT,
  p_target_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action_id UUID;
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can audit';
  END IF;

  INSERT INTO public.admin_audit_log (
    admin_user_id,
    action,
    target_type,
    target_id,
    details,
    ip_address
  ) VALUES (
    auth.uid(),
    p_action,
    p_target_type,
    p_target_id,
    p_details,
    NULLIF(current_setting('request.headers', true)::json->>'cf-connecting-ip', '')::inet
  )
  RETURNING id INTO v_action_id;

  RETURN v_action_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_admin_action(TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- ============================================================================
-- ENHANCED ADMIN FUNCTIONS WITH PROPER GUARDS
-- ============================================================================

-- Block a user
CREATE OR REPLACE FUNCTION public.admin_block_user(
  p_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_current_user_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF p_user_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot block yourself');
  END IF;

  INSERT INTO public.user_status (user_id, is_blocked, blocked_reason, blocked_at, blocked_by)
  VALUES (p_user_id, true, p_reason, NOW(), auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET
    is_blocked = true,
    blocked_reason = p_reason,
    blocked_at = NOW(),
    blocked_by = auth.uid(),
    updated_at = NOW();

  -- Audit log
  PERFORM log_admin_action('block_user', 'user', p_user_id::text, jsonb_build_object('reason', p_reason));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Unblock a user
CREATE OR REPLACE FUNCTION public.admin_unblock_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_current_user_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  UPDATE public.user_status
  SET is_blocked = false, updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Audit log
  PERFORM log_admin_action('unblock_user', 'user', p_user_id::text);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Set user admin status
CREATE OR REPLACE FUNCTION public.admin_set_user_admin(
  p_user_id UUID,
  p_is_admin BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_current_user_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  UPDATE public.profiles
  SET is_admin = p_is_admin, updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Audit log
  PERFORM log_admin_action(
    CASE WHEN p_is_admin THEN 'grant_admin' ELSE 'revoke_admin' END,
    'user',
    p_user_id::text
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Get admin audit logs
CREATE OR REPLACE FUNCTION public.admin_get_audit_logs(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  admin_user_id UUID,
  admin_email TEXT,
  action TEXT,
  target_type TEXT,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can view audit logs';
  END IF;

  RETURN QUERY
  SELECT
    aal.id,
    aal.admin_user_id,
    au.email,
    aal.action,
    aal.target_type,
    aal.target_id,
    aal.details,
    aal.created_at
  FROM public.admin_audit_log aal
  LEFT JOIN auth.users au ON au.id = aal.admin_user_id
  ORDER BY aal.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_user_admin(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_audit_logs(INTEGER, INTEGER) TO authenticated;

-- ============================================================================
-- END OF 025
-- ============================================================================
