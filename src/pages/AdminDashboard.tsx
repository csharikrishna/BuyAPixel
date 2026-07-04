import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Shield, Users, Image, FileText, Activity,
  RefreshCw, CheckCircle2, Store,
  Megaphone, KeyRound, ShieldCheck, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getErrorMessage } from '@/lib/utils';

import {
  AdminStatsGrid,
  AdminAnalyticsCharts,
  AdminDangerZone,
  AdminMarketplaceOverview,
  AdminUsersTab,
  AdminPixelsTab,
  AdminMarketplaceTab,
  AdminAccessTab,
  AdminBroadcastTab,
  AdminAuditTab,
  AdminLiveViewersTab,
} from '@/components/admin';
import type { AdminStats } from '@/components/admin';
import { useAdminStats, useAdminUsers, useAdminPixels } from '@/hooks/useAdminData';

// --- Interfaces (shared / parent-only) ---

interface User {
  user_id: string;
  email: string;
  full_name: string | null;
  pixel_count: number;
  total_spent: number;
  is_blocked: boolean;
  created_at: string;
  last_active_at: string | null;
}

interface AuditLog {
  id: string;
  admin_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

interface MarketplaceListing {
  id: string;
  pixel_id: string;
  seller_id: string;
  asking_price: number;
  status: string;
  featured: boolean;
  created_at: string;
  pixels: { x: number; y: number };
  profiles: { email: string; full_name: string };
}

interface AdminUser {
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

interface MarketplaceAnalytics {
  total_revenue: number;
  total_refunds: number;
  active_listings: number;
  featured_listings: number;
  top_sellers: Array<{ seller_id: string; sales: number; earned: number }>;
}

const AdminDashboard = () => {
  const { user } = useAuth();
  const { isAdmin, isLoading: checkingAdmin } = useIsAdmin();
  const navigate = useNavigate();

  // --- Shared State ---
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [marketplaceListings, setMarketplaceListings] = useState<MarketplaceListing[]>([]);
  const [marketplaceAnalytics, setMarketplaceAnalytics] = useState<MarketplaceAnalytics | null>(null);

  const { data: stats = { totalUsers: 0, totalPixelsSold: 0, totalRevenue: 0, blockedUsers: 0, activeUsers: 0, paidUsers: 0 }, isLoading: loadingStats } = useAdminStats();
  const { data: users = [], isLoading: loadingUsers } = useAdminUsers();
  const { data: pixels = [], isLoading: loadingPixels } = useAdminPixels();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Access management
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [showLilBro, setShowLilBro] = useState(false);

  // Broadcast
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcastActive, setIsBroadcastActive] = useState(false);
  const [broadcastId, setBroadcastId] = useState<string | null>(null);

  // MFA
  const [mfaDialog, setMfaDialog] = useState<{
    open: boolean;
    action: 'delete' | 'clearDb' | 'block';
    callback: () => void;
  } | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  // Session timeout
  const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Security: Session Timeout ---
  useEffect(() => {
    const SESSION_TIMEOUT = 15 * 60 * 1000;
    const resetTimeout = () => {
      if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = setTimeout(() => {
        toast.error('Session expired for security', { description: 'Please sign in again' });
        supabase.auth.signOut();
        navigate('/signin');
      }, SESSION_TIMEOUT);
    };

    const activities = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activities.forEach(a => window.addEventListener(a, resetTimeout));
    resetTimeout();

    return () => {
      if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current);
      activities.forEach(a => window.removeEventListener(a, resetTimeout));
    };
  }, [navigate]);

  // --- Helper: Verify MFA ---
  const verifyMFA = async (code: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('verify_admin_mfa' as any, {
        code,
        user_id: user?.id,
      });
      if (error) {
        console.error('MFA verification RPC error:', error);
        return false;
      }
      return data?.valid === true;
    } catch {
      return false;
    }
  };

  // --- Data Loading ---
  useEffect(() => {
    if (isAdmin) loadDashboardData();
  }, [isAdmin]);

  // --- Real-time Updates ---
  useEffect(() => {
    if (!isAdmin) return;
    const userSub = supabase
      .channel('admin_users_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadDashboardData(true))
      .subscribe();
    const marketSub = supabase
      .channel('admin_marketplace_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_listings' }, () => loadDashboardData(true))
      .subscribe();
    return () => { supabase.removeChannel(userSub); supabase.removeChannel(marketSub); };
  }, [isAdmin]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('user-search')?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        loadDashboardData(true);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const loadDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      // 1b. Admins
      const { data: adminProfiles } = await supabase.from('profiles').select('user_id').eq('is_admin', true);
      const adminIds = new Set(adminProfiles?.map(p => p.user_id));
      
      // We still need allUsers for the admin filtering. 
      // We can fetch it just for admins, or rely on React Query's `users` when it loads. 
      // For now, let's just fetch admins specifically to avoid breaking.
      const { data: adminUsersData } = await supabase.rpc('get_admin_dashboard_users');
      const allUsersForAdmins = (adminUsersData as unknown as User[]) || [];
      setAdmins(allUsersForAdmins.filter(u => adminIds.has(u.user_id)).map(u => ({
        user_id: u.user_id, email: u.email, full_name: u.full_name, created_at: u.created_at,
      })));

      // 2. Marketplace analytics
      const { data: analyticsData, error: analyticsError } = await supabase.rpc('admin_get_marketplace_analytics', { p_days: 30 });
      if (!analyticsError) setMarketplaceAnalytics(analyticsData as unknown as MarketplaceAnalytics);

      // 3. Marketplace listings
      const { data: listingsData, error: listingsError } = await supabase
        .from('marketplace_listings')
        .select('id, pixel_id, seller_id, asking_price, status, featured, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (!listingsError) setMarketplaceListings(listingsData as unknown as MarketplaceListing[] || []);

      // 5. Audit logs
      const { data: logsData, error: logsError } = await supabase
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!logsError) setAuditLogs((logsData as unknown as AuditLog[]) || []);

      // 6. Announcement
      const { data: announcementData, error: announcementError } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!announcementError && announcementData) {
        setBroadcastMessage(announcementData.message);
        setIsBroadcastActive(announcementData.is_active);
        setBroadcastId(announcementData.id);
      } else {
        setBroadcastMessage('');
        setIsBroadcastActive(false);
      }

      setRefreshing(false);
      if (silent) toast.success('Dashboard refreshed', { icon: <CheckCircle2 className="w-4 h-4" /> });
    } catch (error: unknown) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // --- Helper functions shared across tabs ---
  const getUserEmail = useCallback((userId: string) => {
    const u = users.find(u => u.user_id === userId);
    return u ? u.email : 'Unknown';
  }, [users]);

  const getUserName = useCallback((userId: string) => {
    const u = users.find(u => u.user_id === userId);
    return u ? (u.full_name || 'User') : 'Unknown';
  }, [users]);

  const getPixelCoords = useCallback((pixelId: string) => {
    const p = pixels.find(p => p.id === pixelId);
    return p ? `(${p.x}, ${p.y})` : `ID: ${pixelId.slice(0, 8)}...`;
  }, [pixels]);

  // --- Analytics data ---
  const userGrowthData = useMemo(() => {
    const last14Days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return format(d, 'MMM dd');
    }).reverse();

    const dataMap = new Map<string, number>();
    last14Days.forEach(day => dataMap.set(day, 0));
    users.forEach(u => {
      const date = format(new Date(u.created_at), 'MMM dd');
      if (dataMap.has(date)) dataMap.set(date, dataMap.get(date)! + 1);
    });
    return Array.from(dataMap.entries()).map(([date, count]) => ({ date, users: count }));
  }, [users]);

  const pixelActivityData = useMemo(() => {
    if (pixels.length === 0) return [];
    const dataMap = new Map<string, number>();
    pixels.forEach(p => {
      const date = format(new Date(p.created_at), 'MMM dd');
      dataMap.set(date, (dataMap.get(date) || 0) + 1);
    });
    return userGrowthData.map(d => ({ date: d.date, pixels: dataMap.get(d.date) || 0 }));
  }, [pixels, userGrowthData]);

  // --- Access management handlers ---
  const handleGrantAccess = async () => {
    if (!newAdminEmail.trim()) { toast.error('Please enter an email address'); return; }
    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc('admin_promote_user', {
        target_email: newAdminEmail.trim(), make_admin: true,
      });
      if (error) throw error;
      const result = data as Record<string, unknown> | null;
      if (result && result.success === false) throw new Error((result.error as string) || 'Failed to grant access');
      toast.success('Admin access granted', { description: `${newAdminEmail} is now an admin` });
      setNewAdminEmail('');
      loadDashboardData(true);
    } catch (error: unknown) {
      console.error('Error granting admin access:', error);
      toast.error(getErrorMessage(error) || 'Failed to grant access');
    } finally {
      setProcessing(false);
    }
  };

  const handleRevokeAccess = async (email: string) => {
    if (!confirm(`Are you sure you want to revoke admin access for ${email}?`)) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc('admin_promote_user', {
        target_email: email, make_admin: false,
      });
      if (error) throw error;
      const result = data as Record<string, unknown> | null;
      if (result && result.success === false) throw new Error((result.error as string) || 'Failed to revoke access');
      toast.success('Admin access revoked', { description: `${email} is no longer an admin` });
      loadDashboardData(true);
    } catch (error: unknown) {
      console.error('Error revoking admin access:', error);
      toast.error(getErrorMessage(error) || 'Failed to revoke access');
    } finally {
      setProcessing(false);
    }
  };

  // --- Broadcast handler ---
  const handleSaveBroadcast = async () => {
    setProcessing(true);
    try {
      const userAuth = await supabase.auth.getUser();
      const adminId = userAuth.data.user?.id;
      if (!adminId) throw new Error('Admin user not authenticated.');

      if (broadcastId) {
        const { error } = await supabase
          .from('announcements')
          .update({ message: broadcastMessage, is_active: isBroadcastActive, updated_at: new Date().toISOString(), updated_by: adminId })
          .eq('id', broadcastId);
        if (error) throw error;
        toast.success('Broadcast updated', {
          description: isBroadcastActive ? 'Announcement is now live on homepage' : 'Announcement saved as inactive',
        });
      } else {
        const { data, error } = await supabase
          .from('announcements')
          .insert({ message: broadcastMessage, is_active: isBroadcastActive, created_by: adminId })
          .select('id')
          .single();
        if (error) throw error;
        setBroadcastId(data.id);
        toast.success('Broadcast published', {
          description: isBroadcastActive ? 'Announcement is now live on homepage' : 'Announcement saved as inactive',
        });
      }
      loadDashboardData(true);
    } catch (error: unknown) {
      console.error('Error saving broadcast:', error);
      toast.error('Failed to save broadcast', { description: getErrorMessage(error) });
    } finally {
      setProcessing(false);
    }
  };

  const handleRefresh = useCallback(() => loadDashboardData(true), []);

  // --- Access Check Loading ---
  if (checkingAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-8 w-32" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Card key={i}>
                  <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
                  <CardContent><Skeleton className="h-8 w-20" /></CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
              <CardContent><Skeleton className="h-64 w-full" /></CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // --- Access denied ---
  if (!user || !isAdmin) {
    if (!showLilBro) {
      return (
        <div className="min-h-screen bg-background">
          <Header />
          <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
            <Card className="max-w-md mx-4 w-full shadow-lg border-border">
              <CardHeader className="text-center space-y-2">
                <Shield className="w-12 h-12 text-destructive mx-auto" />
                <h2 className="text-2xl font-bold">Access Denied</h2>
              </CardHeader>
              <CardContent className="text-center space-y-6">
                <p className="text-muted-foreground">
                  You do not have permission to view this page. This area is restricted to administrators only.
                </p>
                <div className="pt-4 flex flex-col space-y-3 relative">
                  <Button onClick={() => navigate('/')} variant="default" className="w-full">
                    Return to Homepage
                  </Button>
                  <Button onClick={() => navigate('/signin')} variant="outline" className="w-full">
                    Sign In with Different Account
                  </Button>
                </div>
                {/* Stealthy button: Visible but blends in as a watermark */}
                <div className="pt-4 flex justify-center">
                  <button 
                    onClick={() => setShowLilBro(true)}
                    className="text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors uppercase tracking-widest font-mono"
                  >
                    // bypass_security_override
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <Card className="max-w-md mx-4 w-full border-destructive shadow-2xl shadow-destructive/50 overflow-hidden relative animate-in zoom-in duration-500 hover:rotate-1 transition-transform">
            {/* Funny animated background elements */}
            <div className="absolute top-[-20px] left-[-20px] text-7xl animate-pulse opacity-30 select-none">🤡</div>
            <div className="absolute bottom-[-20px] right-[-20px] text-7xl animate-bounce opacity-30 select-none" style={{ animationDuration: '3s' }}>🤣</div>
            <div className="absolute top-[40%] right-[-10px] text-6xl animate-spin opacity-20 select-none" style={{ animationDuration: '4s' }}>🚔</div>
            
            <CardContent className="pt-10 pb-8 text-center relative z-10 space-y-6">
              <div className="flex justify-center space-x-2 text-7xl mb-6 select-none">
                <span className="animate-bounce" style={{ animationDelay: '0s' }}>😂</span>
                <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>🛑</span>
                <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>💀</span>
              </div>
              
              <h2 className="text-4xl font-black bg-gradient-to-r from-red-600 via-orange-500 to-red-600 bg-clip-text text-transparent animate-pulse uppercase tracking-widest drop-shadow-sm">
                NICE TRY, LIL BRO!
              </h2>
              
              <div className="bg-black/95 text-green-500 p-4 rounded-md font-mono text-xs sm:text-sm text-left shadow-inner border border-green-500/30 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-green-500/20 animate-pulse"></div>
                <p className="opacity-0 animate-[fadeIn_0.1s_ease-in_forwards]">{'>'} INITIALIZING SECURITY PROTOCOL...</p>
                <p className="opacity-0 animate-[fadeIn_0.1s_ease-in_forwards]" style={{ animationDelay: '0.8s' }}>{'>'} TRACING IP... [192.168.0.69]</p>
                <p className="opacity-0 animate-[fadeIn_0.1s_ease-in_forwards]" style={{ animationDelay: '1.6s' }}>{'>'} DETECTING SKILL ISSUE... CRITICAL ERROR</p>
                <p className="opacity-0 animate-[fadeIn_0.1s_ease-in_forwards]" style={{ animationDelay: '2.4s' }}>{'>'} CONTACTING YOUR MOM... DONE</p>
                <p className="opacity-0 animate-[fadeIn_0.1s_ease-in_forwards] text-red-500 font-bold mt-3 text-center text-lg bg-red-500/10 p-1 rounded" style={{ animationDelay: '3.2s' }}>
                  &gt; ACCESS: ABSOLUTELY DENIED 🛑 &lt;
                </p>
              </div>
              
              <p className="text-xl font-bold text-foreground leading-relaxed mt-2 bg-muted/50 p-2 rounded-lg border border-border">
                fk you lil bro it aint work that way 🤣
              </p>
              
              <div className="pt-6 space-y-3">
                <Button onClick={() => navigate('/')} variant="destructive" size="lg" className="w-full font-bold shadow-lg hover:scale-105 transition-transform text-lg h-14 bg-gradient-to-r from-red-600 to-red-700">
                  🚶‍♂️ Walk of Shame (Return Home)
                </Button>
                <Button 
                  onClick={() => toast.error('Nice try, hackerman. The FBI has been dispatched to your mom\'s basement! 🤓🚔', { duration: 5000 })} 
                  variant="outline" 
                  className="w-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors border-dashed"
                >
                  I'm actually a hacker 🥷
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // --- Dashboard Data Loading ---
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-8 w-32" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Card key={i}>
                  <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
                  <CardContent><Skeleton className="h-8 w-20" /></CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
              <CardContent><Skeleton className="h-64 w-full" /></CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // --- Main Render ---
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
                <Shield className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Full system access · {user.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline" size="sm"
                onClick={() => loadDashboardData(true)}
                disabled={refreshing}
                className="flex-1 sm:flex-none"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Badge variant="destructive" className="text-xs px-3 py-1.5 whitespace-nowrap">
                <Shield className="w-3 h-3 mr-1" />
                SUPER ADMIN
              </Badge>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <AdminStatsGrid stats={stats} />

        {/* Charts */}
        <AdminAnalyticsCharts userGrowthData={userGrowthData} pixelActivityData={pixelActivityData} />

        {/* Marketplace Overview */}
        <AdminMarketplaceOverview analytics={marketplaceAnalytics} />

        {/* Danger Zone */}
        <AdminDangerZone userEmail={user.email || ''} onRefresh={handleRefresh} />

        {/* Tabs */}
        <Tabs defaultValue="live" className="space-y-6">
          <TabsList className="grid w-full max-w-4xl grid-cols-8">
            <TabsTrigger value="live" className="gap-2">
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Live</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="marketplace" className="gap-2">
              <Store className="w-4 h-4" />
              <span className="hidden sm:inline">Marketplace</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Audit</span>
            </TabsTrigger>
            <TabsTrigger value="pixels" className="gap-2">
              <Image className="w-4 h-4" />
              <span className="hidden sm:inline">Pixels</span>
            </TabsTrigger>
            <TabsTrigger value="broadcast" className="gap-2">
              <Megaphone className="w-4 h-4" />
              <span className="hidden sm:inline">Broadcast</span>
            </TabsTrigger>
            <TabsTrigger value="blog" className="gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Blog</span>
            </TabsTrigger>
            <TabsTrigger value="access" className="gap-2">
              <KeyRound className="w-4 h-4" />
              <span className="hidden sm:inline">Access</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="space-y-4">
            <AdminLiveViewersTab users={users} />
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <AdminUsersTab onRefresh={handleRefresh} />
          </TabsContent>

          <TabsContent value="marketplace">
            <AdminMarketplaceTab
              listings={marketplaceListings}
              getUserEmail={getUserEmail}
              getPixelCoords={getPixelCoords}
              onRefresh={handleRefresh}
            />
          </TabsContent>

          <TabsContent value="audit">
            <AdminAuditTab auditLogs={auditLogs} />
          </TabsContent>

          <TabsContent value="pixels">
            <AdminPixelsTab />
          </TabsContent>

          <TabsContent value="broadcast">
            <AdminBroadcastTab
              broadcastMessage={broadcastMessage}
              isBroadcastActive={isBroadcastActive}
              broadcastId={broadcastId}
              processing={processing}
              onMessageChange={setBroadcastMessage}
              onActiveChange={setIsBroadcastActive}
              onSave={handleSaveBroadcast}
              onReset={handleRefresh}
            />
          </TabsContent>

          <TabsContent value="blog">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4 p-6 rounded-lg border bg-gradient-to-br from-muted/50 to-muted/30 hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">Create Blog Posts</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Share updates, announcements, and stories with your users
                    </p>
                  </div>
                  <Button onClick={() => navigate('/blog/admin')} className="gap-2 shrink-0">
                    <FileText className="w-4 h-4" />
                    Manage Blog
                  </Button>
                </div>
              </CardHeader>
            </Card>
          </TabsContent>

          <TabsContent value="access" className="space-y-6">
            <AdminAccessTab
              admins={admins}
              newAdminEmail={newAdminEmail}
              onNewAdminEmailChange={setNewAdminEmail}
              onGrantAccess={handleGrantAccess}
              onRevokeAccess={handleRevokeAccess}
              processing={processing}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* MFA Verification Dialog */}
      <Dialog open={mfaDialog?.open || false} onOpenChange={(open) => !open && setMfaDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Confirmation Required
            </DialogTitle>
            <DialogDescription>
              This is a sensitive action. Please enter your confirmation code to proceed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              type="text"
              placeholder="000000"
              maxLength={6}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-widest font-mono"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMfaDialog(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!mfaDialog) return;
                const isValid = await verifyMFA(mfaCode);
                if (isValid) {
                  mfaDialog.callback();
                  setMfaDialog(null);
                  setMfaCode('');
                } else {
                  toast.error('Invalid code');
                }
              }}
              disabled={mfaCode.length === 0}
            >
              Verify & Proceed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Wrapped Export
export default function AdminDashboardWrapper() {
  return (
    <ErrorBoundary pageName="Admin Dashboard">
      <AdminDashboard />
    </ErrorBoundary>
  );
}
