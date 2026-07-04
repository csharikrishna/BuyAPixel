import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@/components/admin/AdminUsersTab';
import type { AdminStats } from '@/components/admin/AdminStatsGrid';

export const useAdminStats = () => {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      // Calculate stats using multiple optimized queries instead of fetching all users
      const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      const { count: totalPixelsSold } = await supabase.from('pixels').select('*', { count: 'exact', head: true }).not('owner_id', 'is', null);
      
      const { data: revenueData } = await supabase.from('payment_orders').select('amount, user_id').eq('status', 'completed');
      const totalRevenue = revenueData?.reduce((sum, order) => sum + Number(order.amount), 0) || 0;
      const paidUsers = new Set(revenueData?.map(order => order.user_id)).size;

      const { count: blockedUsers } = await supabase.from('user_status').select('*', { count: 'exact', head: true }).eq('is_blocked', true);
      const activeUsers = (totalUsers || 0) - (blockedUsers || 0);

      return {
        totalUsers: totalUsers || 0,
        totalPixelsSold: totalPixelsSold || 0,
        totalRevenue,
        blockedUsers: blockedUsers || 0,
        activeUsers,
        paidUsers
      } as AdminStats;
    },
    staleTime: 60000, // 1 minute
  });
};

export const useAdminUsers = () => {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_dashboard_users');
      if (error) throw error;
      return (data as unknown as User[]) || [];
    },
    staleTime: 60000,
  });
};

export const useAdminPixels = () => {
  return useQuery({
    queryKey: ['admin-pixels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pixels')
        .select('id, x, y, price_paid, owner_id, image_url, link_url, alt_text, created_at')
        .not('owner_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });
};
