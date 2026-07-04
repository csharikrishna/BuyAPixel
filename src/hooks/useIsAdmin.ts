import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useIsAdmin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [checkedUserId, setCheckedUserId] = useState<string | null | undefined>(undefined); // undefined means hasn't checked

  const isLoading = isLoadingState || checkedUserId !== (user?.id || null);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    setIsLoadingState(true);
    
    if (!user) {
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setCheckedUserId(null);
      setIsLoadingState(false);
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
      setCheckedUserId(user.id);
    } catch {
      // Error — default to non-admin (safer)
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setCheckedUserId(user.id);
    } finally {
      setIsLoadingState(false);
    }
  };

  return { isAdmin, isLoading, isSuperAdmin };
};
