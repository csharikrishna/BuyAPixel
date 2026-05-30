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
  const [users, setUsers] = useState<User[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [marketplaceListings, setMarketplaceListings] = useState<MarketplaceListing[]>([]);
  const [marketplaceAnalytics, setMarketplaceAnalytics] = useState<MarketplaceAnalytics | null>(null);
  const [pixels, setPixels] = useState<any[]>([]);

  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalPixelsSold: 0,
    totalRevenue: 0,
    blockedUsers: 0,
    activeUsers: 0,
    paidUsers: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Access management
  const [newAdminEmail, setNewAdminEmail] = useState('');

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

      // 1. Users (via safe admin RPC that checks permissions internally)
      let allUsers: User[] = [];
      try {
        const { data: usersData, error: usersError } = await supabase.rpc('get_admin_dashboard_users');
        if (usersError) {
          if (!silent) {
            console.warn('Failed to load admin users:', usersError.message);
          }
        } else {
          allUsers = (usersData as unknown as User[]) || [];
        }
      } catch (err) {
        if (!silent) {
          console.warn('Failed to fetch admin users:', err);
        }
      }
      setUsers(allUsers);

      // 1b. Admins
      const { data: adminProfiles } = await supabase.from('profiles').select('user_id').eq('is_admin', true);
      const adminIds = new Set(adminProfiles?.map(p => p.user_id));
      setAdmins(allUsers.filter(u => adminIds.has(u.user_id)).map(u => ({
        user_id: u.user_id, email: u.email, full_name: u.full_name, created_at: u.created_at,
      })));

      // Stats
      const totalUsers = allUsers?.length || 0;
      const totalPixelsSold = allUsers?.reduce((sum: number, u) => sum + (Number(u.pixel_count) || 0), 0) || 0;
      const totalRevenue = allUsers?.reduce((sum: number, u) => sum + (Number(u.total_spent) || 0), 0) || 0;
      const blockedUsers = allUsers?.filter((u) => u.is_blocked).length || 0;
      const activeUsers = allUsers?.filter((u) => !u.is_blocked).length || 0;
      const paidUsers = allUsers?.filter((u) => u.total_spent > 0).length || 0;
      setStats({ totalUsers, totalPixelsSold, totalRevenue, blockedUsers, activeUsers, paidUsers });

      // 2. Marketplace analytics
      const { data: analyticsData, error: analyticsError } = await supabase.rpc('admin_get_marketplace_analytics', { p_days: 30 });
      if (!analyticsError) setMarketplaceAnalytics(analyticsData as unknown as MarketplaceAnalytics);

      // 3. Marketplace listings
      const { data: listingsData, error: listingsError } = await supabase
        .from('marketplace_listings')
        .select('id, pixel_id, seller_id, asking_price, status, featured, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!listingsError) setMarketplaceListings(listingsData as unknown as MarketplaceListing[] || []);

      // 4. Pixels
      const { data: pixelsData, error: pixelsError } = await supabase
        .from('pixels')
        .select('id, x, y, price_paid, owner_id, image_url, link_url, alt_text, created_at')
        .not('owner_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!pixelsError) setPixels(pixelsData || []);

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

  // --- Loading skeleton ---
  if (checkingAdmin || loading) {
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
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <Card className="max-w-md mx-4 w-full">
            <CardContent className="pt-6 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
              <p className="text-muted-foreground mb-6">
                You do not have permission to access the admin dashboard
              </p>
              <Button onClick={() => navigate('/')} className="w-full">Return to Home</Button>
            </CardContent>
          </Card>
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
            <AdminUsersTab users={users} stats={stats} onRefresh={handleRefresh} />
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

          <TabsContent value="pixels" className="space-y-4">
            <AdminPixelsTab
              pixels={pixels}
              setPixels={setPixels}
              getUserEmail={getUserEmail}
              getUserName={getUserName}
            />
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
