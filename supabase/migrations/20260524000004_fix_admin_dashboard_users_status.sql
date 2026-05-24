-- Fix admin dashboard RPC to correctly use user_status table for is_blocked flag
-- instead of looking at the profiles table.

DROP FUNCTION IF EXISTS public.get_admin_dashboard_users();

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  total_spent numeric,
  pixel_count bigint,
  is_blocked boolean,
  created_at timestamptz,
  last_active_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id uuid;
  v_is_admin boolean;
  v_is_super_admin boolean;
BEGIN
  -- Get current user
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Check if user is admin (primary check)
  SELECT p.is_admin INTO v_is_admin
  FROM profiles p
  WHERE p.user_id = v_current_user_id;
  
  -- Check super admin email (secondary check)
  v_is_super_admin := (SELECT u.email FROM auth.users u WHERE u.id = v_current_user_id) IN ('adsbuyaspot@gmail.com', 'notbot4444@gmail.com');
  
  -- Require admin status
  IF NOT (COALESCE(v_is_admin, false) OR v_is_super_admin) THEN
    RAISE EXCEPTION 'Forbidden: Admin access required';
  END IF;
  
  -- If authorized, return all users with their data
  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::text AS email,
    p.full_name::text AS full_name,
    COALESCE(SUM(po.amount), 0)::numeric AS total_spent,
    COALESCE(COUNT(DISTINCT px.id), 0)::bigint AS pixel_count,
    COALESCE(us.is_blocked, false)::boolean AS is_blocked,
    u.created_at AS created_at,
    p.last_active_at AS last_active_at
  FROM auth.users u
  LEFT JOIN profiles p ON u.id = p.user_id
  LEFT JOIN user_status us ON u.id = us.user_id
  LEFT JOIN payment_orders po ON u.id = po.user_id AND po.status = 'completed'
  LEFT JOIN pixels px ON u.id = px.owner_id
  GROUP BY u.id, u.email, p.full_name, us.is_blocked, u.created_at, p.last_active_at
  ORDER BY u.created_at DESC;
END;
$$;

-- Ensure permissions are correct
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_users() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_users() FROM anon, public;
