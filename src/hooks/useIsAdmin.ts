import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const SUPER_ADMIN_EMAIL = 'notbot4444@gmail.com';

export const useIsAdmin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = () => {
    if (!user) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    // Hardcoded super admin check
    const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;
    setIsAdmin(isSuperAdmin);
    setIsLoading(false);
  };

  return { isAdmin, isLoading, isSuperAdmin: isAdmin };
};
