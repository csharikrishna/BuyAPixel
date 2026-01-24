/**
 * useProfile Hook
 * Fetches and manages user profile data using React Query
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/profile';

const PROFILE_QUERY_KEY = 'profile';

/**
 * Fetches the profile for a given user ID
 */
const fetchProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
};

interface UseProfileReturn {
  profile: Profile | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage the current user's profile
 * Uses React Query for caching and automatic refetching
 */
export const useProfile = (): UseProfileReturn => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: profile,
    isLoading: loading,
    error,
    refetch: queryRefetch,
  } = useQuery({
    queryKey: [PROFILE_QUERY_KEY, user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });

  const refetch = async (): Promise<void> => {
    await queryRefetch();
  };

  return {
    profile: profile ?? null,
    loading,
    error: error as Error | null,
    refetch,
  };
};

/**
 * Invalidates the profile cache, forcing a refetch on next access
 * Useful after profile updates
 */
export const useInvalidateProfile = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return () => {
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: [PROFILE_QUERY_KEY, user.id] });
    }
  };
};