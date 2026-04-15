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
      // ✅ FIXED C9: Check admin status ONLY from database
      // Never use client-side email-based checks
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        const dbIsAdmin = data.is_admin === true;
        setIsAdmin(dbIsAdmin);
        // Note: Super admin distinction requires backend-only verification
        // Do NOT use environment variables for privilege elevation
        setIsSuperAdmin(false); // Client cannot verify super admin status
      } else {
        // Database query failed - default to non-admin
        // This is safer than falling back to email check
        setIsAdmin(false);
        setIsSuperAdmin(false);
      }
    } catch {
      // Error on exception - default to non-admin
      setIsAdmin(false);
      setIsSuperAdmin(false);
    } finally {
      setIsLoading(false);
    }
  };

  return { isAdmin, isLoading, isSuperAdmin };
};
