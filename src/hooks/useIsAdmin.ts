import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const SUPER_ADMIN_EMAIL = import.meta.env.VITE_SUPER_ADMIN_EMAIL || 'notbot4444@gmail.com';

export const useIsAdmin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) {
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setIsLoading(false);
      return;
    }

    // Super admin is always an admin (env-based fallback for bootstrapping)
    const emailIsSuperAdmin = user.email === SUPER_ADMIN_EMAIL;

    try {
      // Check database for admin status via profile
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        const dbIsAdmin = data.is_admin === true;
        setIsAdmin(dbIsAdmin || emailIsSuperAdmin);
        setIsSuperAdmin(emailIsSuperAdmin);
      } else {
        // Fallback to email-only check if DB query fails
        setIsAdmin(emailIsSuperAdmin);
        setIsSuperAdmin(emailIsSuperAdmin);
      }
    } catch {
      // Fallback to email check on error
      setIsAdmin(emailIsSuperAdmin);
      setIsSuperAdmin(emailIsSuperAdmin);
    } finally {
      setIsLoading(false);
    }
  };

  return { isAdmin, isLoading, isSuperAdmin };
};
