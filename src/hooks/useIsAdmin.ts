import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

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

    try {
      // Primary check: profiles.is_admin column (most reliable)
      const profileResult = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('user_id', user.id)
        .maybeSingle();

      const dbIsAdmin = profileResult.data?.is_admin === true;
      
      // Secondary check: super admin email (optional)
      let dbIsSuperAdmin = false;
      try {
        const superAdminResult = await supabase.rpc('is_current_user_super_admin');
        dbIsSuperAdmin = superAdminResult.data === true;
      } catch (err) {
        // RPC might not be accessible; rely on profiles.is_admin
        dbIsSuperAdmin = false;
      }

      // Either condition grants admin access
      setIsAdmin(dbIsAdmin || dbIsSuperAdmin);
      setIsSuperAdmin(dbIsSuperAdmin);
    } catch {
      // Error — default to non-admin (safer)
      setIsAdmin(false);
      setIsSuperAdmin(false);
    } finally {
      setIsLoading(false);
    }
  };

  return { isAdmin, isLoading, isSuperAdmin };
};
