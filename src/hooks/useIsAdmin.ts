import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Module-level cache to avoid redundant network calls across hook instances.
// All components sharing the same user will get the cached result within the TTL.
const CACHE_TTL_MS = 60_000; // 60 seconds
let cachedResult: { userId: string; isAdmin: boolean; isSuperAdmin: boolean; timestamp: number } | null = null;

export const useIsAdmin = () => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [checkedUserId, setCheckedUserId] = useState<string | null | undefined>(undefined); // undefined means hasn't checked

  const isLoading = authLoading || isLoadingState || checkedUserId !== (user?.id || null);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) {
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setCheckedUserId(null);
      setIsLoadingState(false);
      return;
    }

    // Check module-level cache first
    if (
      cachedResult &&
      cachedResult.userId === user.id &&
      Date.now() - cachedResult.timestamp < CACHE_TTL_MS
    ) {
      setIsAdmin(cachedResult.isAdmin);
      setIsSuperAdmin(cachedResult.isSuperAdmin);
      setCheckedUserId(user.id);
      setIsLoadingState(false);
      return;
    }

    setIsLoadingState(true);

    try {
      // Primary check: profiles.is_admin column (most reliable)
      const profileResult = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileResult.error) {
        console.error('[useIsAdmin] ❌ Profile query FAILED:', profileResult.error.message, profileResult.error.code);
      }

      const dbIsAdmin = profileResult.data?.is_admin === true;
      
      // Secondary check: super admin email (optional)
      let dbIsSuperAdmin = false;
      try {
        const superAdminResult = await supabase.rpc('is_current_user_super_admin');
        dbIsSuperAdmin = superAdminResult.data === true;
      } catch (err) {
        console.warn('[useIsAdmin] Super admin RPC failed:', err);
        dbIsSuperAdmin = false;
      }

      const finalIsAdmin = dbIsAdmin || dbIsSuperAdmin;

      // Update module-level cache
      cachedResult = {
        userId: user.id,
        isAdmin: finalIsAdmin,
        isSuperAdmin: dbIsSuperAdmin,
        timestamp: Date.now(),
      };

      // Either condition grants admin access
      setIsAdmin(finalIsAdmin);
      setIsSuperAdmin(dbIsSuperAdmin);
      setCheckedUserId(user.id);
    } catch (err) {
      // Error — default to non-admin (safer)
      console.error('[useIsAdmin] ❌ Unexpected error in admin check:', err);
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setCheckedUserId(user.id);
    } finally {
      setIsLoadingState(false);
    }
  };

  return { isAdmin, isLoading, isSuperAdmin };
};
