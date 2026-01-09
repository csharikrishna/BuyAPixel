import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Shield,
  Users,
  Image,
  FileText,
  Activity,
  Ban,
  Trash2,
  Unlock,
  AlertTriangle,
  Loader2,
  Search,
  Download,
  RefreshCw,
  Filter,
  TrendingUp,
  DollarSign,
  UserCheck,
  UserX,
  Eye,
  Calendar,
  MoreVertical,
  CheckCircle2,
  Store,
  Star,
  XCircle,
  LayoutGrid,
  List as ListIcon,
  Megaphone
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getErrorMessage } from '@/lib/utils';

// --- Interfaces ---

interface User {
  user_id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string;
  pixels_owned: number;
  total_spent: number;
  is_blocked: boolean;
  blocked_reason: string | null;
}

interface AuditLog {
  id: string;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string;
  details: any;
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
  pixels: {
    x: number;
    y: number;
  };
  profiles: {
    email: string;
    full_name: string;
  };
}

interface MarketplaceAnalytics {
  total_revenue: number;
  total_refunds: number;
  active_listings: number;
  featured_listings: number;
  top_sellers: Array<{
    seller_id: string;
    sales: number;
    earned: number;
  }>;
}

type UserFilter = 'all' | 'active' | 'blocked' | 'paid';
type SortField = 'created_at' | 'pixels_owned' | 'total_spent';
type SortOrder = 'asc' | 'desc';

const AdminDashboard = () => {
  const { user } = useAuth();
  const { isAdmin, isLoading: checkingAdmin } = useIsAdmin();
  const navigate = useNavigate();

  // --- State Management ---

  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [marketplaceListings, setMarketplaceListings] = useState<MarketplaceListing[]>([]);
  const [marketplaceAnalytics, setMarketplaceAnalytics] = useState<MarketplaceAnalytics | null>(null);

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPixelsSold: 0,
    totalRevenue: 0,
    blockedUsers: 0,
    activeUsers: 0,
    paidUsers: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState<UserFilter>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Dialog States
  const [blockDialog, setBlockDialog] = useState<{ open: boolean; userId: string; email: string } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; userId: string; email: string } | null>(null);
  const [resetUserPixelsDialog, setResetUserPixelsDialog] = useState<{ open: boolean; userId: string; email: string } | null>(null);
  const [cancelListingDialog, setCancelListingDialog] = useState<{ open: boolean; listingId: string } | null>(null);

  // Form States
  const [blockReason, setBlockReason] = useState('');
  const [blockNotes, setBlockNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [processing, setProcessing] = useState(false);

  // Pixel Management States
  const [pixels, setPixels] = useState<any[]>([]);
  const [pixelSearchTerm, setPixelSearchTerm] = useState('');
  const [loadingPixels, setLoadingPixels] = useState(false);
  const [pixelViewMode, setPixelViewMode] = useState<'list' | 'grid'>('grid');
  const [resetPixelDialog, setResetPixelDialog] = useState<{ open: boolean; pixelId: string } | null>(null);
  const [clearContentDialog, setClearContentDialog] = useState<{ open: boolean; pixelId: string } | null>(null);

  // Broadcast State
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcastActive, setIsBroadcastActive] = useState(false);
  const [broadcastId, setBroadcastId] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      loadDashboardData();
    }
  }, [isAdmin]);

  const loadDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      // 1. Load all users with stats
      const { data: usersData, error: usersError } = await supabase
        .rpc('get_all_users_admin' as any);

      if (usersError) throw usersError;
      setUsers((usersData as unknown as User[]) || []);

      // Calculate comprehensive stats
      const totalUsers = usersData?.length || 0;
      const totalPixelsSold = usersData?.reduce((sum, u) => sum + (Number(u.pixels_owned) || 0), 0) || 0;
      const totalRevenue = usersData?.reduce((sum, u) => sum + (Number(u.total_spent) || 0), 0) || 0;
      const blockedUsers = usersData?.filter(u => u.is_blocked).length || 0;
      const activeUsers = usersData?.filter(u => !u.is_blocked).length || 0;
      const paidUsers = usersData?.filter(u => u.total_spent > 0).length || 0;

      setStats({ totalUsers, totalPixelsSold, totalRevenue, blockedUsers, activeUsers, paidUsers });

      // 2. Load marketplace analytics
      const { data: analyticsData, error: analyticsError } = await supabase
        .rpc('admin_get_marketplace_analytics' as any, { p_days: 30 });

      if (!analyticsError) {
        setMarketplaceAnalytics(analyticsData as unknown as MarketplaceAnalytics);
      }

      // 3. Load marketplace listings
      const { data: listingsData, error: listingsError } = await supabase
        .from('marketplace_listings')
        .select(`
          id,
          pixel_id,
          seller_id,
          asking_price,
          status,
          featured,
          created_at,
          pixels (x, y),
          profiles:seller_id (email, full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!listingsError) {
        // Need to cast appropriately or map the data to ensure it fits the interface
        setMarketplaceListings(listingsData as unknown as MarketplaceListing[] || []);
      }

      // 4. Load (and default to) recent pixels for moderation
      const { data: pixelsData, error: pixelsError } = await supabase
        .from('pixels')
        .select(`
          id, x, y, price, owner_id, image_url, link_url, alt_text, created_at,
          profiles:owner_id (email, full_name)
        `)
        .not('owner_id', 'is', null) // Only show owned pixels
        .order('created_at', { ascending: false }) // Newest first
        .limit(20);

      if (!pixelsError) {
        setPixels(pixelsData || []);
      }

      // 5. Load audit logs
      const { data: logsData, error: logsError } = await supabase
        .from('admin_audit_log' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!logsError) {
        setAuditLogs((logsData as unknown as AuditLog[]) || []);
      }

      // 6. Load Active Announcement
      const { data: announcementData, error: announcementError } = await supabase
        .from('announcements' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!announcementError && announcementData) {
        setBroadcastMessage((announcementData as any).message);
        setIsBroadcastActive((announcementData as any).is_active);
        setBroadcastId((announcementData as any).id);
      } else {
        // No active announcement or table not ready yet
      }

      setRefreshing(false);

      if (silent) {
        toast.success('Dashboard refreshed', {
          icon: <CheckCircle2 className="w-4 h-4" />
        });
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Filtered and sorted users
  const filteredAndSortedUsers = useMemo(() => {
    let filtered = users.filter(u =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply filter
    switch (userFilter) {
      case 'active':
        filtered = filtered.filter(u => !u.is_blocked);
        break;
      case 'blocked':
        filtered = filtered.filter(u => u.is_blocked);
        break;
      case 'paid':
        filtered = filtered.filter(u => u.total_spent > 0);
        break;
    }

    // Apply sorting
    filtered.sort((a, b) => {
      // Type safe access
      const aVal = a[sortField];
      const bVal = b[sortField];

      // Handle potentially undefined values safely if needed, though types say required
      if (aVal === bVal) return 0;

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  }, [users, searchTerm, userFilter, sortField, sortOrder]);

  // --- Visual Analytics Data Preparation ---
  // Aggregate user joins by date (last 14 days)
  const userGrowthData = useMemo(() => {
    const last14Days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return format(d, 'MMM dd');
    }).reverse();

    const dataMap = new Map();
    last14Days.forEach(day => dataMap.set(day, 0));

    users.forEach(user => {
      const date = format(new Date(user.created_at), 'MMM dd');
      if (dataMap.has(date)) {
        dataMap.set(date, dataMap.get(date) + 1);
      }
    });

    return Array.from(dataMap.entries()).map(([date, count]) => ({ date, users: count }));
  }, [users]);

  // Aggregate pixel uploads by date (approximate from pixels array if available, or just mock structure for now)
  // Since we only load recent pixels, this might be sparse, so we'll just show what we have
  const pixelActivityData = useMemo(() => {
    if (pixels.length === 0) return [];

    const dataMap = new Map();

    pixels.forEach(p => {
      const date = format(new Date(p.created_at), 'MMM dd');
      if (!dataMap.has(date)) {
        dataMap.set(date, 0);
      }
      dataMap.set(date, dataMap.get(date) + 1);
    });

    // Fill user growth dates for consistency if pixel data is empty for those days
    const dates = userGrowthData.map(d => d.date);
    return dates.map(date => ({
      date,
      pixels: dataMap.get(date) || 0
    }));
  }, [pixels, userGrowthData]);

  // --- User Management Actions ---

  const handleBlockUser = useCallback(async () => {
    if (!blockDialog || !blockReason.trim()) {
      toast.error('Please provide a reason for blocking');
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase.rpc('block_user' as any, {
        target_user_id: blockDialog.userId,
        reason: blockReason,
        admin_notes: blockNotes || null,
      });

      if (error) throw error;

      toast.success('User blocked successfully', {
        description: `${blockDialog.email} can no longer access the platform`
      });

      setBlockDialog(null);
      setBlockReason('');
      setBlockNotes('');
      loadDashboardData(true);
    } catch (error: unknown) {
      console.error('Error blocking user:', error);
      toast.error('Failed to block user', {
        description: getErrorMessage(error)
      });
    } finally {
      setProcessing(false);
    }
  }, [blockDialog, blockReason, blockNotes]);

  const handleUnblockUser = useCallback(async (userId: string, email: string) => {
    setProcessing(true);
    try {
      const { error } = await supabase.rpc('unblock_user' as any, {
        target_user_id: userId,
      });

      if (error) throw error;

      toast.success('User unblocked', {
        description: `${email} can now access the platform`
      });

      loadDashboardData(true);
    } catch (error: unknown) {
      console.error('Error unblocking user:', error);
      toast.error('Failed to unblock user', {
        description: getErrorMessage(error)
      });
    } finally {
      setProcessing(false);
    }
  }, []);

  const handleDeleteUser = useCallback(async () => {
    if (!deleteDialog) return;

    setProcessing(true);
    try {
      const { error: cleanupError } = await supabase.rpc('delete_user_completely' as any, {
        target_user_id: deleteDialog.userId,
      });

      if (cleanupError) throw cleanupError;

      toast.success('User data deleted', {
        description: 'All associated data has been permanently removed',
        duration: 8000,
      });

      setDeleteDialog(null);
      loadDashboardData(true);
    } catch (error: unknown) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user', {
        description: getErrorMessage(error)
      });
    } finally {
      setProcessing(false);
    }
  }, [deleteDialog]);

  const handleResetUserPixels = useCallback(async () => {
    if (!resetUserPixelsDialog) return;

    setProcessing(true);
    try {
      // Logic: Update all pixels owned by this user to have no owner and no content
      const { error } = await supabase
        .from('pixels')
        .update({
          owner_id: null,
          image_url: null,
          link_url: null,
          alt_text: null,
          purchased_at: null,
          price_paid: null
        })
        .eq('owner_id', resetUserPixelsDialog.userId);

      if (error) throw error;

      toast.success('All user pixels reset', {
        description: `Pixels owned by ${resetUserPixelsDialog.email} are now available for purchase.`
      });

      setResetUserPixelsDialog(null);
      loadDashboardData(true);
    } catch (error: unknown) {
      console.error('Error resetting user pixels:', error);
      toast.error('Failed to reset user pixels', {
        description: getErrorMessage(error)
      });
    } finally {
      setProcessing(false);
    }
  }, [resetUserPixelsDialog]);

  // --- Broadcast Management ---

  const handleSaveBroadcast = async () => {
    setProcessing(true);
    try {
      const userAuth = await supabase.auth.getUser();
      const adminId = userAuth.data.user?.id;

      if (!adminId) {
        throw new Error("Admin user not authenticated.");
      }

      if (broadcastId) {
        // Update existing broadcast
        const { error } = await supabase
          .from('announcements' as any)
          .update({
            message: broadcastMessage,
            is_active: isBroadcastActive,
            updated_at: new Date().toISOString(),
            updated_by: adminId
          })
          .eq('id', broadcastId);

        if (error) throw error;

        toast.success('Broadcast updated', {
          description: isBroadcastActive ? 'Announcement is now live on homepage' : 'Announcement saved as inactive'
        });
      } else {
        // Insert new broadcast
        const { data, error } = await supabase
          .from('announcements' as any)
          .insert({
            message: broadcastMessage,
            is_active: isBroadcastActive,
            created_by: adminId
          })
          .select('id')
          .single();

        if (error) throw error;

        setBroadcastId((data as any).id); // Set the new ID
        toast.success('Broadcast published', {
          description: isBroadcastActive ? 'Announcement is now live on homepage' : 'Announcement saved as inactive'
        });
      }

      loadDashboardData(true); // Refresh to get new ID or updated status
    } catch (error: unknown) {
      console.error('Error saving broadcast:', error);
      toast.error('Failed to save broadcast', {
        description: getErrorMessage(error)
      });
    } finally {
      setProcessing(false);
    }
  };

  // --- Marketplace Management Actions ---

  const handleToggleFeatured = useCallback(async (listingId: string, currentFeatured: boolean) => {
    setProcessing(true);
    try {
      const { error } = await supabase.rpc('admin_toggle_featured_listing' as any, {
        p_listing_id: listingId,
        p_featured: !currentFeatured,
      });

      if (error) throw error;

      toast.success(currentFeatured ? 'Listing unfeatured' : 'Listing featured', {
        description: currentFeatured ? 'Removed from featured listings' : 'Added to featured listings'
      });

      loadDashboardData(true);
    } catch (error: unknown) {
      console.error('Error toggling featured:', error);
      toast.error(getErrorMessage(error) || 'Failed to update listing');
    } finally {
      setProcessing(false);
    }
  }, []);

  const handleCancelListing = useCallback(async () => {
    if (!cancelListingDialog || !cancelReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase.rpc('admin_cancel_marketplace_listing' as any, {
        p_listing_id: cancelListingDialog.listingId,
        p_reason: cancelReason,
      });

      if (error) throw error;

      toast.success('Listing cancelled', {
        description: 'Listing has been removed from marketplace'
      });

      setCancelListingDialog(null);
      setCancelReason('');
      loadDashboardData(true);
    } catch (error: unknown) {
      console.error('Error cancelling listing:', error);
      toast.error(getErrorMessage(error) || 'Failed to cancel listing');
    } finally {
      setProcessing(false);
    }
  }, [cancelListingDialog, cancelReason]);

  const exportUsers = useCallback(() => {
    try {
      const csv = [
        ['Email', 'Status', 'Joined', 'Last Sign In', 'Pixels Owned', 'Total Spent', 'Blocked Reason'].join(','),
        ...filteredAndSortedUsers.map(u => [
          `"${u.email}"`,
          u.is_blocked ? 'Blocked' : 'Active',
          format(new Date(u.created_at), 'yyyy-MM-dd HH:mm:ss'),
          u.last_sign_in_at ? format(new Date(u.last_sign_in_at), 'yyyy-MM-dd HH:mm:ss') : 'Never',
          u.pixels_owned,
          u.total_spent,
          `"${u.blocked_reason || '-'}"`
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_export_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Export successful', {
        description: `${filteredAndSortedUsers.length} users exported to CSV`
      });
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export users');
    }
  }, [filteredAndSortedUsers]);

  // --- Pixel Management Actions ---

  const searchPixels = useCallback(async () => {
    if (!pixelSearchTerm.trim()) {
      toast.error("Please enter a search term (Pixel ID, Owner ID, or coordinates like '10,20')");
      return;
    }

    setLoadingPixels(true);
    try {
      let query = supabase.from('pixels').select(`
        id, x, y, price, owner_id, image_url, link_url, alt_text, created_at,
        profiles:owner_id (email, full_name)
      `);

      // Simple heuristic for search
      if (pixelSearchTerm.includes(',')) {
        const [x, y] = pixelSearchTerm.split(',').map(s => parseInt(s.trim()));
        if (!isNaN(x) && !isNaN(y)) {
          query = query.eq('x', x).eq('y', y);
        }
      } else if (pixelSearchTerm.length > 20) {
        // Assume UUID
        query = query.or(`id.eq.${pixelSearchTerm},owner_id.eq.${pixelSearchTerm}`);
      } else {
        // Maybe coordinates or partial ID? defaulting to finding nothing for now unless strict format
        toast.info("Search by UUID (User/Pixel) or Coordinates (x,y)");
        setLoadingPixels(false);
        return;
      }

      const { data, error } = await query;
      if (error) throw error;
      setPixels(data || []);
      if (data?.length === 0) toast.info("No pixels found");
    } catch (error) {
      console.error('Error searching pixels:', error);
      toast.error('Failed to search pixels');
    } finally {
      setLoadingPixels(false);
    }
  }, [pixelSearchTerm]);

  const handleResetPixelOwnership = useCallback(async () => {
    if (!resetPixelDialog) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('pixels')
        .update({
          owner_id: null,
          image_url: null,
          link_url: null,
          alt_text: null,
          purchased_at: null,
          price_paid: null // Assuming this field exists or similar tracking
        })
        .eq('id', resetPixelDialog.pixelId);

      if (error) throw error;

      toast.success('Pixel ownership reset to system');
      setResetPixelDialog(null);
      searchPixels(); // Refresh list
    } catch (error: any) {
      console.error('Error resetting pixel:', error);
      toast.error('Failed to reset pixel: ' + error.message);
    } finally {
      setProcessing(false);
    }
  }, [resetPixelDialog, searchPixels]);

  const handleClearPixelContent = useCallback(async () => {
    if (!clearContentDialog) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('pixels')
        .update({
          image_url: null,
          link_url: null,
          alt_text: null
        })
        .eq('id', clearContentDialog.pixelId);

      if (error) throw error;

      toast.success('Pixel content cleared (Moderated)');
      setClearContentDialog(null);
      searchPixels(); // Refresh list
    } catch (error: any) {
      console.error('Error clearing pixel content:', error);
      toast.error('Failed to clear content: ' + error.message);
    } finally {
      setProcessing(false);
    }
  }, [clearContentDialog, searchPixels]);




  // Loading skeleton
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
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-20" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Access denied
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
              <Button onClick={() => navigate('/')} className="w-full">
                Return to Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header Section */}
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
                variant="outline"
                size="sm"
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

        {/* Enhanced Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <Card className="hover:shadow-lg transition-all duration-200 border-blue-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Users
              </CardTitle>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">
                All registered
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200 border-green-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Users
              </CardTitle>
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <UserCheck className="w-4 h-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">{stats.activeUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Not blocked
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200 border-purple-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Paid Users
              </CardTitle>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700">{stats.paidUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Made purchases
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200 border-orange-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pixels Sold
              </CardTitle>
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Image className="w-4 h-4 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">{stats.totalPixelsSold.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Total owned
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200 border-emerald-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </CardTitle>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-700">₹{stats.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                All-time
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200 border-destructive/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Blocked Users
              </CardTitle>
              <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <UserX className="w-4 h-4 text-destructive" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.blockedUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Access denied
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Visual Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">New User Growth (14 Days)</CardTitle>
            </CardHeader>
            <CardContent className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={userGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="users"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "hsl(var(--primary))" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Recent Pixel Activity</CardTitle>
            </CardHeader>
            <CardContent className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pixelActivityData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar
                    dataKey="pixels"
                    fill="#F59E0B"
                    radius={[4, 4, 0, 0]}
                    barSize={30}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Marketplace Stats Card */}
        {marketplaceAnalytics && (
          <Card className="mb-8 border-amber-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="w-5 h-5" />
                Marketplace Overview (Last 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Revenue</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    ₹{marketplaceAnalytics.total_revenue.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Listings</p>
                  <p className="text-2xl font-bold">{marketplaceAnalytics.active_listings}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Featured</p>
                  <p className="text-2xl font-bold text-amber-600">{marketplaceAnalytics.featured_listings}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Refunds</p>
                  <p className="text-2xl font-bold text-red-600">{marketplaceAnalytics.total_refunds}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
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
          </TabsList>

          {/* Pixels Tab Content */}
          <TabsContent value="pixels" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pixel Management</CardTitle>
                <CardDescription>Search and manage individual pixels</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search by Pixel ID, Owner ID, or 'x,y'..."
                    value={pixelSearchTerm}
                    onChange={(e) => setPixelSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchPixels()}
                  />
                  <Button onClick={searchPixels} disabled={loadingPixels}>
                    {loadingPixels ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                  <div className="flex bg-muted rounded-md p-1 border">
                    <Button
                      variant={pixelViewMode === 'list' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPixelViewMode('list')}
                    >
                      <ListIcon className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={pixelViewMode === 'grid' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPixelViewMode('grid')}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {pixelViewMode === 'list' ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Location</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Content</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pixels.map((pixel) => (
                        <TableRow key={pixel.id}>
                          <TableCell className="font-mono">({pixel.x}, {pixel.y})</TableCell>
                          <TableCell>
                            {pixel.owner_id ? (
                              <div className="flex flex-col">
                                <span className="font-medium">{pixel.profiles?.full_name || 'Unknown'}</span>
                                <span className="text-xs text-muted-foreground">{pixel.profiles?.email}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">{pixel.owner_id}</span>
                              </div>
                            ) : (
                              <Badge variant="outline">System / Available</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {pixel.image_url ? (
                                <div className="flex items-center gap-2 text-xs text-green-600">
                                  <Image className="w-3 h-3" /> Image Set
                                </div>
                              ) : <div className="text-xs text-muted-foreground">No Image</div>}
                              {pixel.link_url && (
                                <div className="flex items-center gap-2 text-xs text-blue-600 truncate max-w-[150px]">
                                  <TrendingUp className="w-3 h-3" /> {pixel.link_url}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => window.open(`/?x=${pixel.x}&y=${pixel.y}`, '_blank')}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View on Canvas
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-amber-600"
                                  onClick={() => setClearContentDialog({ open: true, pixelId: pixel.id })}
                                  disabled={!pixel.image_url && !pixel.link_url}
                                >
                                  <Ban className="mr-2 h-4 w-4" />
                                  Clear Content
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setResetPixelDialog({ open: true, pixelId: pixel.id })}
                                  disabled={!pixel.owner_id}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Reset Ownership
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!loadingPixels && pixels.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                            No pixels found. Try searching.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                ) : (
                  // Grid View
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {pixels.length === 0 && !loadingPixels && (
                      <div className="col-span-full text-center py-12 text-muted-foreground">
                        No pixels found.
                      </div>
                    )}
                    {pixels.map((pixel) => (
                      <Card key={pixel.id} className="overflow-hidden group relative hover:ring-2 hover:ring-primary/50 transition-all">
                        <div className="aspect-square bg-muted/20 relative">
                          {pixel.image_url ? (
                            <img
                              src={pixel.image_url}
                              alt={pixel.alt_text}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                              <Image className="w-8 h-8" />
                            </div>
                          )}

                          {/* Hover Overlay */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="w-full h-8 text-xs"
                              onClick={() => window.open(`/?x=${pixel.x}&y=${pixel.y}`, '_blank')}
                            >
                              <Eye className="w-3 h-3 mr-1" /> View
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="w-full h-8 text-xs"
                              onClick={() => setClearContentDialog({ open: true, pixelId: pixel.id })}
                              disabled={!pixel.image_url}
                            >
                              <Ban className="w-3 h-3 mr-1" /> Clear
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full h-8 text-xs bg-transparent text-white border-white/50 hover:bg-white/20"
                              onClick={() => setResetPixelDialog({ open: true, pixelId: pixel.id })}
                            >
                              <RefreshCw className="w-3 h-3 mr-1" /> Reset
                            </Button>
                          </div>
                        </div>
                        <div className="p-2 border-t">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-mono text-muted-foreground">({pixel.x}, {pixel.y})</span>
                            {pixel.owner_id ? (
                              <Badge variant="outline" className="h-4 px-1 text-[10px] border-green-500/30 text-green-600">Owned</Badge>
                            ) : (
                              <Badge variant="outline" className="h-4 px-1 text-[10px]">Free</Badge>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Broadcast Tab Content */}
          <TabsContent value="broadcast">
            <Card>
              <CardHeader>
                <CardTitle>Global Announcements</CardTitle>
                <CardDescription>Publish a message to all users on the home page.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-muted/30 p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-4">
                    <div className="space-y-0.5">
                      <Label className="text-base">Active Status</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable this to show the banner on the homepage
                      </p>
                    </div>
                    <Switch
                      checked={isBroadcastActive}
                      onCheckedChange={setIsBroadcastActive}
                      disabled={processing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Banner Message</Label>
                    <Textarea
                      placeholder="e.g., '🎉 50% Off All Pixels This Weekend!'"
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      rows={3}
                      className="resize-none font-medium"
                      disabled={processing}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {broadcastMessage.length} characters
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => loadDashboardData(true)} disabled={processing}>
                    Reset
                  </Button>
                  <Button onClick={handleSaveBroadcast} disabled={processing || !broadcastMessage.trim()}>
                    {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Megaphone className="w-4 h-4 mr-2" />}
                    {broadcastId ? 'Update Broadcast' : 'Publish Broadcast'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab Content */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>
                      Showing {filteredAndSortedUsers.length} of {users.length} users
                    </CardDescription>
                  </div>
                  <Button
                    onClick={exportUsers}
                    variant="outline"
                    size="sm"
                    className="gap-2 w-full lg:w-auto"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </Button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search by email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Select value={userFilter} onValueChange={(v) => setUserFilter(v as UserFilter)}>
                    <SelectTrigger>
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users ({users.length})</SelectItem>
                      <SelectItem value="active">Active Only ({stats.activeUsers})</SelectItem>
                      <SelectItem value="blocked">Blocked Only ({stats.blockedUsers})</SelectItem>
                      <SelectItem value="paid">Paid Users ({stats.paidUsers})</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={`${sortField}-${sortOrder}`} onValueChange={(v) => {
                    const [field, order] = v.split('-');
                    setSortField(field as SortField);
                    setSortOrder(order as SortOrder);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sort by..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at-desc">Newest First</SelectItem>
                      <SelectItem value="created_at-asc">Oldest First</SelectItem>
                      <SelectItem value="pixels_owned-desc">Most Pixels</SelectItem>
                      <SelectItem value="pixels_owned-asc">Least Pixels</SelectItem>
                      <SelectItem value="total_spent-desc">Highest Spend</SelectItem>
                      <SelectItem value="total_spent-asc">Lowest Spend</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>

              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[200px]">User</TableHead>
                          <TableHead className="hidden md:table-cell min-w-[120px]">Joined</TableHead>
                          <TableHead className="text-right min-w-[80px]">Pixels</TableHead>
                          <TableHead className="text-right hidden sm:table-cell min-w-[100px]">Spent</TableHead>
                          <TableHead className="min-w-[100px]">Status</TableHead>
                          <TableHead className="text-right min-w-[140px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndSortedUsers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="h-40">
                              <div className="flex flex-col items-center justify-center text-center">
                                <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
                                <p className="text-sm font-medium text-muted-foreground">No users found</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {searchTerm || userFilter !== 'all'
                                    ? 'Try adjusting your filters'
                                    : 'No users registered yet'}
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredAndSortedUsers.map((userData) => (
                            <TableRow key={userData.user_id} className="hover:bg-muted/50">
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium text-sm">{userData.email}</span>
                                  <span className="text-xs text-muted-foreground md:hidden">
                                    {format(new Date(userData.created_at), 'MMM dd, yyyy')}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5" />
                                  {format(new Date(userData.created_at), 'MMM dd, yyyy')}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {userData.pixels_owned}
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums hidden sm:table-cell">
                                ₹{userData.total_spent.toLocaleString()}
                              </TableCell>
                              <TableCell>
                                {userData.is_blocked ? (
                                  <Badge variant="destructive" className="gap-1.5 font-medium">
                                    <Ban className="w-3 h-3" />
                                    Blocked
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="gap-1.5 bg-green-500/10 text-green-700 border-green-500/20 font-medium">
                                    <UserCheck className="w-3 h-3" />
                                    Active
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {/* Desktop Actions */}
                                <div className="hidden sm:flex items-center justify-end gap-2">
                                  {userData.is_blocked ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleUnblockUser(userData.user_id, userData.email)}
                                      disabled={processing}
                                      className="h-8 gap-1.5"
                                    >
                                      <Unlock className="w-3.5 h-3.5" />
                                      <span className="hidden lg:inline">Unblock</span>
                                    </Button>
                                  ) : (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setResetUserPixelsDialog({ open: true, userId: userData.user_id, email: userData.email })}
                                        disabled={processing || userData.pixels_owned === 0}
                                        className="h-8 w-8 p-0"
                                        title="Reset all pixels"
                                      >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setBlockDialog({ open: true, userId: userData.user_id, email: userData.email })}
                                        disabled={processing}
                                        className="h-8 gap-1.5"
                                      >
                                        <Ban className="w-3.5 h-3.5" />
                                        <span className="hidden lg:inline">Block</span>
                                      </Button>
                                    </>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setDeleteDialog({ open: true, userId: userData.user_id, email: userData.email })}
                                    disabled={processing}
                                    className="h-8 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                    title="Delete user"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>

                                {/* Mobile Dropdown */}
                                <div className="sm:hidden flex justify-end">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                        <MoreVertical className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {userData.is_blocked ? (
                                        <DropdownMenuItem
                                          onClick={() => handleUnblockUser(userData.user_id, userData.email)}
                                          disabled={processing}
                                        >
                                          <Unlock className="w-4 h-4 mr-2" />
                                          Unblock User
                                        </DropdownMenuItem>
                                      ) : (
                                        <DropdownMenuItem
                                          onClick={() => setBlockDialog({ open: true, userId: userData.user_id, email: userData.email })}
                                          disabled={processing}
                                        >
                                          <Ban className="w-4 h-4 mr-2" />
                                          Block User
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem
                                        onClick={() => setResetUserPixelsDialog({ open: true, userId: userData.user_id, email: userData.email })}
                                        disabled={processing || userData.pixels_owned === 0}
                                      >
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        Reset All Pixels
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => setDeleteDialog({ open: true, userId: userData.user_id, email: userData.email })}
                                        disabled={processing}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete User
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Marketplace Tab Content */}
          <TabsContent value="marketplace">
            <Card>
              <CardHeader>
                <CardTitle>Marketplace Management</CardTitle>
                <CardDescription>
                  Manage listings, feature items, and moderate marketplace activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {marketplaceListings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <Store className="w-16 h-16 text-muted-foreground/30 mb-4" />
                      <p className="text-sm font-medium">No marketplace listings</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {marketplaceListings.map((listing) => (
                        <div
                          key={listing.id}
                          className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div className="font-semibold">
                                Pixel ({listing.pixels?.x}, {listing.pixels?.y})
                              </div>
                              <Badge variant={listing.status === 'active' ? 'default' : 'secondary'}>
                                {listing.status}
                              </Badge>
                              {listing.featured && (
                                <Badge variant="default" className="bg-amber-500">
                                  <Star className="w-3 h-3 mr-1" />
                                  Featured
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Seller: {listing.profiles?.email || 'Unknown'} ·
                              Price: ₹{listing.asking_price.toLocaleString()} ·
                              Listed: {format(new Date(listing.created_at), 'MMM dd, yyyy')}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {listing.status === 'active' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleToggleFeatured(listing.id, listing.featured)}
                                  disabled={processing}
                                >
                                  <Star className="w-4 h-4 mr-1" />
                                  {listing.featured ? 'Unfeature' : 'Feature'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setCancelListingDialog({ open: true, listingId: listing.id })}
                                  disabled={processing}
                                  className="text-destructive"
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Cancel
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Logs Tab Content */}
          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle>Admin Activity Logs</CardTitle>
                <CardDescription>
                  Track all administrative actions performed on the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                {auditLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Activity className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium">No audit logs yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Admin actions will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Activity className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="font-mono text-xs">
                              {log.action}
                            </Badge>
                            <span className="text-sm text-muted-foreground truncate">
                              by {log.admin_email}
                            </span>
                          </div>
                          <p className="text-sm">
                            <span className="text-muted-foreground">Target:</span> {log.target_type}{' '}
                            <span className="font-mono text-xs text-muted-foreground">
                              ({log.target_id.slice(0, 8)}...)
                            </span>
                          </p>
                          {log.details && Object.keys(log.details).length > 0 && (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                                View details
                              </summary>
                              <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </details>
                          )}
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Eye className="w-3 h-3" />
                            {format(new Date(log.created_at), 'MMM dd, yyyy · HH:mm:ss')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Blog Management Tab Content */}
          <TabsContent value="blog">
            <Card>
              <CardHeader>
                <CardTitle>Blog Management</CardTitle>
                <CardDescription>
                  Create and manage blog posts for your platform
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* --- Dialogs --- */}

      {/* Block User Dialog */}
      <Dialog open={blockDialog?.open || false} onOpenChange={(open) => !open && setBlockDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Ban className="w-5 h-5 text-destructive" />
              </div>
              Block User Account
            </DialogTitle>
            <DialogDescription asChild>
              <div>
                <p className="mb-2">
                  Blocking <strong>{blockDialog?.email}</strong> will prevent them from:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Signing in to their account</li>
                  <li>Accessing any platform features</li>
                  <li>Making new purchases</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="block-reason" className="text-sm font-medium">
                Reason for blocking <span className="text-destructive">*</span>
              </Label>
              <Input
                id="block-reason"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g., Violated terms of service"
                className="w-full"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-notes" className="text-sm font-medium">
                Additional notes (optional)
              </Label>
              <Textarea
                id="block-notes"
                value={blockNotes}
                onChange={(e) => setBlockNotes(e.target.value)}
                placeholder="Internal notes about this action..."
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setBlockDialog(null)}
              disabled={processing}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBlockUser}
              disabled={processing || !blockReason.trim()}
              className="gap-2 w-full sm:w-auto"
            >
              {processing && <Loader2 className="w-4 h-4 animate-spin" />}
              Block User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <AlertDialog open={deleteDialog?.open || false} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Permanent Account Deletion
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will permanently delete <strong className="text-foreground">{deleteDialog?.email}</strong> and all associated data:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>All owned pixels (will become available again)</li>
                  <li>User profile and preferences</li>
                  <li>Purchase and transaction history</li>
                  <li>Account status and blocks</li>
                </ul>
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="font-semibold text-destructive flex items-center gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    This action cannot be undone!
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={processing} className="w-full sm:w-auto">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive hover:bg-destructive/90 gap-2 w-full sm:w-auto"
              disabled={processing}
            >
              {processing && <Loader2 className="w-4 h-4 animate-spin" />}
              Yes, Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset User Pixels Dialog */}
      <AlertDialog open={!!resetUserPixelsDialog?.open} onOpenChange={(open) => !open && setResetUserPixelsDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All User Pixels?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove ownership of ALL pixels owned by <strong>{resetUserPixelsDialog?.email}</strong>.
              The pixels will become available for purchase again. The user account will remain active.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                handleResetUserPixels();
              }}
              disabled={processing}
            >
              {processing ? "Resetting..." : "Reset All Pixels"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Listing Dialog */}
      <AlertDialog open={!!cancelListingDialog} onOpenChange={(open) => !open && setCancelListingDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Listing</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this marketplace listing? The pixel will be returned to the owner.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="cancel-reason" className="mb-2 block">Reason for cancellation</Label>
            <Textarea
              id="cancel-reason"
              placeholder="Violation of terms..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                handleCancelListing();
              }}
              disabled={processing}
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cancel Listing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Pixel Dialog */}
      <AlertDialog open={!!resetPixelDialog?.open} onOpenChange={(open) => !open && setResetPixelDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Pixel Ownership?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the current owner and make the pixel available for purchase again.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                handleResetPixelOwnership();
              }}
              disabled={processing}
            >
              {processing ? "Resetting..." : "Reset Ownership"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Content Dialog */}
      <AlertDialog open={!!clearContentDialog?.open} onOpenChange={(open) => !open && setClearContentDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Pixel Content?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the image, link, and alt text from the pixel, but the user will retain ownership.
              Useful for moderation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={(e) => {
                e.preventDefault();
                handleClearPixelContent();
              }}
              disabled={processing}
            >
              {processing ? "Clearing..." : "Clear Content"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default AdminDashboard;