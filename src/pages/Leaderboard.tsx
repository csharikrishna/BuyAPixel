import { useState, useEffect, useMemo, useCallback, useRef, useTransition } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Trophy,
  Users,
  DollarSign,
  Clock,
  AlertCircle,
  TrendingUp,
  Award,
  Medal,
  Search,
  Filter,
  Download,
  ChevronUp,
  ChevronDown,
  Minus,
  Star,
  Crown,
  Sparkles,
  Target,
  Zap,
  RefreshCw,
  ChevronRight,
  Info,
  ArrowUpRight,
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { cn, getErrorMessage } from '@/lib/utils';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';

// ======================
// TYPES & INTERFACES
// ======================

interface LeaderboardUser {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  pixel_count: number;
  total_spent: number;
  previousRank?: number;
  rankChange?: 'up' | 'down' | 'same' | 'new';
}

interface RecentPurchase {
  id: string;
  x: number;
  y: number;
  price_paid: number;
  purchased_at: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  image_url: string | null;
  alt_text: string | null;
}

interface Stats {
  totalPixelsSold: number;
  totalRevenue: number;
  totalUsers: number;
  averagePrice: number;
  recentGrowth: number;
}

type TimePeriod = 'all' | 'month' | 'week' | 'today';
type SortBy = 'pixels' | 'spending';

interface PixelData {
  owner_id: string | null;
  price_paid: number;
  purchased_at: string | null;
  x: number;
  y: number;
  id: string;
  image_url: string | null;
  alt_text: string | null;
}

// ======================
// CONSTANTS
// ======================

const LEADERBOARD_LIMIT = 100;
const RECENT_PURCHASES_LIMIT = 50;
const REFRESH_INTERVAL = 30000; // 30 seconds
const TOP_RANK_COUNT = 3;

const STAT_CARDS = [
  {
    key: 'pixels',
    icon: Users,
    color: 'primary',
    label: 'Pixels Sold',
    getValue: (stats: Stats) => stats.totalPixelsSold.toLocaleString(),
  },
  {
    key: 'revenue',
    icon: DollarSign,
    color: 'success',
    label: 'Total Revenue',
    getValue: (stats: Stats) => `₹${Math.round(stats.totalRevenue).toLocaleString()}`,
  },
  {
    key: 'users',
    icon: Trophy,
    color: 'accent',
    label: 'Active Users',
    getValue: (stats: Stats) => stats.totalUsers.toLocaleString(),
  },
  {
    key: 'average',
    icon: Star,
    color: 'orange',
    label: 'Avg. Price',
    getValue: (stats: Stats) => `₹${Math.round(stats.averagePrice)}`,
  },
] as const;

// ======================
// SKELETON COMPONENTS
// ======================

const Skeleton = ({ className = '', circle = false }: { className?: string; circle?: boolean }) => (
  <div
    className={cn('animate-pulse bg-muted', circle ? 'rounded-full' : 'rounded-md', className)}
    aria-hidden="true"
  />
);

const StatCardSkeleton = () => (
  <Card>
    <CardContent className="p-6 text-center space-y-3">
      <Skeleton circle className="w-12 h-12 mx-auto" />
      <Skeleton className="h-8 w-20 mx-auto" />
      <Skeleton className="h-4 w-24 mx-auto" />
    </CardContent>
  </Card>
);

const LeaderboardRowSkeleton = () => (
  <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
    <div className="flex items-center gap-3 flex-1">
      <Skeleton circle className="w-8 h-8" />
      <Skeleton circle className="w-12 h-12" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
    <Skeleton className="h-6 w-16" />
  </div>
);

// ======================
// MAIN COMPONENT
// ======================

const Leaderboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Refs
  const channelRef = useRef<RealtimeChannel | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout>();
  const isMountedRef = useRef(true);

  // React 19 hooks
  const [isPending, startTransition] = useTransition();

  // State
  const [topByPixels, setTopByPixels] = useState<LeaderboardUser[]>([]);
  const [topBySpending, setTopBySpending] = useState<LeaderboardUser[]>([]);
  const [recentPurchases, setRecentPurchases] = useState<RecentPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalPixelsSold: 0,
    totalRevenue: 0,
    totalUsers: 0,
    averagePrice: 0,
    recentGrowth: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const [activeTab, setActiveTab] = useState('pixels');
  const [userRank, setUserRank] = useState<{
    pixelRank: number | null;
    spendingRank: number | null;
  }>({
    pixelRank: null,
    spendingRank: null,
  });
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  // Trigger entrance animation
  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Fetch leaderboard data
  const fetchLeaderboardData = useCallback(
    async (showRefreshIndicator = false) => {
      try {
        if (showRefreshIndicator) {
          setIsRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        // Date filter based on time period
        let startDate: string | null = null;
        const now = new Date();
        if (timePeriod === 'today') {
          startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        } else if (timePeriod === 'week') {
          startDate = new Date(now.setDate(now.getDate() - 7)).toISOString();
        } else if (timePeriod === 'month') {
          startDate = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
        }

        // Fetch profiles with pixel stats
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url, pixel_count, total_spent')
          .gt('pixel_count', 0)
          .order('pixel_count', { ascending: false })
          .limit(LEADERBOARD_LIMIT);

        if (profilesError) throw profilesError;

        // Transform to LeaderboardUser format
        const allUsers: LeaderboardUser[] = (profilesData || []).map((profile) => ({
          id: profile.user_id,
          user_id: profile.user_id,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          pixel_count: profile.pixel_count || 0,
          total_spent: profile.total_spent || 0,
        }));

        // Sort by pixels and spending
        const sortedByPixels = [...allUsers].sort((a, b) => b.pixel_count - a.pixel_count);
        const sortedBySpending = [...allUsers].sort((a, b) => b.total_spent - a.total_spent);

        setTopByPixels(sortedByPixels);
        setTopBySpending(sortedBySpending);

        // Find current user's rank
        if (user) {
          const pixelRankIndex = sortedByPixels.findIndex((u) => u.user_id === user.id);
          const spendingRankIndex = sortedBySpending.findIndex((u) => u.user_id === user.id);

          setUserRank({
            pixelRank: pixelRankIndex >= 0 ? pixelRankIndex + 1 : null,
            spendingRank: spendingRankIndex >= 0 ? spendingRankIndex + 1 : null,
          });
        }

        // Calculate stats
        const totalPixelsSold = allUsers.reduce((sum, u) => sum + u.pixel_count, 0);
        const totalRevenue = allUsers.reduce((sum, u) => sum + u.total_spent, 0);
        const totalUsers = allUsers.length;
        const averagePrice = totalPixelsSold > 0 ? totalRevenue / totalPixelsSold : 0;

        setStats({
          totalPixelsSold,
          totalRevenue,
          totalUsers,
          averagePrice,
          recentGrowth: 0,
        });

        // Fetch Recent Purchases
        const { data: recentPixels, error: recentError } = await supabase
          .from('pixels')
          .select('owner_id, price_paid, purchased_at, x, y, id, image_url, alt_text')
          .not('owner_id', 'is', null)
          .order('purchased_at', { ascending: false })
          .limit(RECENT_PURCHASES_LIMIT);

        if (recentError) throw recentError;

        // Fetch profiles for recent purchases
        const recentUserIds = Array.from(new Set(recentPixels?.map((p) => p.owner_id) || []));

        let profileMap = new Map();
        if (recentUserIds.length > 0) {
          const { data: recentProfiles } = await supabase
            .from('profiles')
            .select('user_id, full_name, avatar_url')
            .in('user_id', recentUserIds);

          recentProfiles?.forEach((profile) => {
            profileMap.set(profile.user_id, profile);
          });
        }

        const recentWithProfiles = (recentPixels || []).map((purchase: PixelData) => {
          const profile = profileMap.get(purchase.owner_id);
          return {
            ...purchase,
            full_name: profile?.full_name || null,
            avatar_url: profile?.avatar_url || null,
            user_id: purchase.owner_id!,
          };
        });

        setRecentPurchases(recentWithProfiles);
        setLastUpdated(new Date());
      } catch (error: unknown) {
        console.error('Error fetching leaderboard data:', error);
        const errorMsg = getErrorMessage(error) || 'Failed to load leaderboard data';
        setError(errorMsg);

        if (!showRefreshIndicator) {
          toast({
            title: 'Error',
            description: errorMsg,
            variant: 'destructive',
          });
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [user, timePeriod, toast]
  );

  // Initial fetch
  useEffect(() => {
    fetchLeaderboardData();
  }, [fetchLeaderboardData]);

  // Real-time subscription
  useEffect(() => {
    const setupRealtimeSubscription = () => {
      // Clean up existing subscription
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      channelRef.current = supabase
        .channel('leaderboard-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pixels',
          },
          () => {
            // Use debounced refresh
            if (refreshTimerRef.current) {
              clearTimeout(refreshTimerRef.current);
            }
            refreshTimerRef.current = setTimeout(() => {
              fetchLeaderboardData(true);
            }, 2000);
          }
        )
        .subscribe();
    };

    setupRealtimeSubscription();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [fetchLeaderboardData]);

  // Filtered data with React 19 useTransition
  const filteredPixelLeaders = useMemo(() => {
    if (!searchQuery) return topByPixels;
    return topByPixels.filter((user) =>
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [topByPixels, searchQuery]);

  const filteredSpendingLeaders = useMemo(() => {
    if (!searchQuery) return topBySpending;
    return topBySpending.filter((user) =>
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [topBySpending, searchQuery]);

  const filteredRecentPurchases = useMemo(() => {
    if (!searchQuery) return recentPurchases;
    return recentPurchases.filter(
      (purchase) =>
        purchase.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        purchase.alt_text?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [recentPurchases, searchQuery]);

  // Utility functions
  const getInitials = useCallback((name: string | null): string => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, []);

  const formatDate = useCallback((dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid date';
    }
  }, []);

  const getRelativeTime = useCallback((date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }, []);

  const getRankIcon = useCallback((index: number) => {
    switch (index) {
      case 0:
        return <Crown className="w-5 h-5 text-yellow-500" aria-hidden="true" />;
      case 1:
        return <Medal className="w-5 h-5 text-gray-400" aria-hidden="true" />;
      case 2:
        return <Award className="w-5 h-5 text-amber-600" aria-hidden="true" />;
      default:
        return null;
    }
  }, []);

  const getRankBadgeVariant = (index: number): 'default' | 'secondary' => {
    return index < TOP_RANK_COUNT ? 'default' : 'secondary';
  };

  const getRankChangeIcon = (rankChange?: 'up' | 'down' | 'same' | 'new') => {
    switch (rankChange) {
      case 'up':
        return <ChevronUp className="w-4 h-4 text-green-500" aria-label="Rank increased" />;
      case 'down':
        return <ChevronDown className="w-4 h-4 text-red-500" aria-label="Rank decreased" />;
      case 'same':
        return <Minus className="w-4 h-4 text-muted-foreground" aria-label="Rank unchanged" />;
      case 'new':
        return <Sparkles className="w-4 h-4 text-blue-500" aria-label="New entry" />;
      default:
        return null;
    }
  };

  // Export data
  const handleExportData = useCallback(() => {
    const dataToExport = activeTab === 'pixels' ? topByPixels : topBySpending;
    const csvContent = [
      ['Rank', 'Name', activeTab === 'pixels' ? 'Pixels' : 'Total Spent'].join(','),
      ...dataToExport.map((user, index) =>
        [
          index + 1,
          `"${user.full_name || 'Anonymous'}"`,
          activeTab === 'pixels' ? user.pixel_count : user.total_spent.toFixed(2),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `buyapixel-leaderboard-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Export Successful',
      description: 'Leaderboard data has been downloaded.',
    });
  }, [activeTab, topByPixels, topBySpending, toast]);

  // Manual refresh
  const handleManualRefresh = useCallback(() => {
    fetchLeaderboardData(true);
  }, [fetchLeaderboardData]);

  // Handle search with transition
  const handleSearchChange = useCallback(
    (value: string) => {
      startTransition(() => {
        setSearchQuery(value);
      });
    },
    [startTransition]
  );

  // Schema.org structured data
  const structuredData = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'BuyAPixel Leaderboard',
      description: 'Top pixel owners and spenders on BuyAPixel',
      numberOfItems: topByPixels.length,
      itemListElement: topByPixels.slice(0, 10).map((user, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'Person',
          name: user.full_name || 'Anonymous',
        },
      })),
    }),
    [topByPixels]
  );

  // Error State
  if (error && !loading) {
    return (
      <>
        <Helmet>
          <title>Error - Leaderboard | BuyAPixel</title>
        </Helmet>
        <div className="min-h-screen flex flex-col bg-background">
          <Header />
          <main className="flex-1 container mx-auto px-4 py-16">
            <Card className="max-w-md mx-auto border-destructive/20">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-destructive" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Unable to Load Leaderboard</h3>
                  <p className="text-sm text-muted-foreground mb-4">{error}</p>
                  <div className="flex gap-3 justify-center">
                    <Button onClick={() => fetchLeaderboardData()} variant="default">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Try Again
                    </Button>
                    <Button onClick={() => navigate('/')} variant="outline">
                      <ArrowUpRight className="w-4 h-4 mr-2" />
                      Go Home
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </main>
          <Footer />
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Leaderboard - Top Pixel Owners | BuyAPixel</title>
        <meta
          name="description"
          content="View the BuyAPixel leaderboard featuring top pixel owners, highest spenders, and recent purchases. Compete for the top spot!"
        />
        <meta property="og:title" content="Leaderboard - BuyAPixel" />
        <meta property="og:type" content="website" />
        <meta property="og:description" content="Top pixel owners and spenders on BuyAPixel" />
        <link rel="canonical" href="https://buyapixel.in/leaderboard" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/20">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-12 lg:py-16">
          {/* Breadcrumbs */}
          <nav
            className="flex items-center gap-2 text-sm text-muted-foreground mb-6"
            aria-label="Breadcrumb"
          >
            <Link to="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
            <span className="text-foreground font-medium">Leaderboard</span>
          </nav>

          {/* Header Section */}
          <div
            className={cn(
              'text-center mb-12 transition-all duration-700',
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
          >
            <div className="flex items-center justify-center gap-2 mb-6">
              <Badge
                variant="outline"
                className="px-6 py-2.5 font-semibold border-primary/20 animate-pulse"
              >
                <Zap className="w-4 h-4 mr-2 inline-block" aria-hidden="true" />
                Live Updates
              </Badge>
              {isRefreshing && (
                <Badge variant="secondary" className="px-4 py-2">
                  <RefreshCw className="w-3 h-3 mr-2 animate-spin" aria-hidden="true" />
                  Updating...
                </Badge>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              <span className="bg-gradient-to-r from-primary via-accent to-success bg-clip-text text-transparent">
                Leaderboard
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Compete, track progress, and celebrate top performers
            </p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="mt-2">
                    <Info className="w-4 h-4 mr-2" />
                    Last updated {getRelativeTime(lastUpdated)}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Data refreshes automatically every 30 seconds</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* User's Personal Rank Card */}
          {user && (userRank.pixelRank || userRank.spendingRank) && (
            <Card
              className={cn(
                'max-w-5xl mx-auto mb-8 bg-gradient-to-r from-primary/5 via-accent/5 to-success/5 border-primary/20 transition-all duration-700 delay-200',
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              )}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Target className="w-6 h-6 text-primary" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-lg">Your Ranking</h2>
                      <p className="text-sm text-muted-foreground">Keep climbing!</p>
                    </div>
                  </div>
                  <div className="flex gap-6" role="list" aria-label="Your rankings">
                    {userRank.pixelRank && (
                      <div className="text-center" role="listitem">
                        <div className="text-3xl font-bold text-primary" aria-label={`Rank ${userRank.pixelRank} in pixels`}>
                          #{userRank.pixelRank}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Pixels</div>
                      </div>
                    )}
                    {userRank.spendingRank && (
                      <div className="text-center" role="listitem">
                        <div className="text-3xl font-bold text-success" aria-label={`Rank ${userRank.spendingRank} in spending`}>
                          #{userRank.spendingRank}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Spending</div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats Cards */}
          <div
            className={cn(
              'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 max-w-6xl mx-auto transition-all duration-700 delay-300',
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
            role="list"
            aria-label="Platform statistics"
          >
            {loading ? (
              <>
                {Array(4)
                  .fill(0)
                  .map((_, i) => (
                    <StatCardSkeleton key={i} />
                  ))}
              </>
            ) : (
              <>
                {STAT_CARDS.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <Card
                      key={stat.key}
                      className={cn(
                        `border-${stat.color}/10 hover:border-${stat.color}/30 transition-all duration-300 hover:shadow-lg`
                      )}
                      role="listitem"
                    >
                      <CardContent className="p-6 text-center">
                        <div
                          className={cn(
                            `flex items-center justify-center w-12 h-12 rounded-full bg-${stat.color}/10 mx-auto mb-3`
                          )}
                        >
                          <Icon className={`w-6 h-6 text-${stat.color}`} aria-hidden="true" />
                        </div>
                        <div className={`text-3xl font-bold text-${stat.color}`}>
                          {stat.getValue(stats)}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            )}
          </div>

          {/* Filters and Search */}
          <div
            className={cn(
              'max-w-5xl mx-auto mb-6 transition-all duration-700 delay-400',
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10 h-11"
                  aria-label="Search leaderboard"
                  disabled={isPending}
                />
                {isPending && (
                  <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <div className="flex gap-2">
                <Select
                  value={timePeriod}
                  onValueChange={(value: TimePeriod) => setTimePeriod(value)}
                  disabled={loading}
                >
                  <SelectTrigger className="w-[140px] h-11" aria-label="Filter by time period">
                    <Filter className="w-4 h-4 mr-2" aria-hidden="true" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                  </SelectContent>
                </Select>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleManualRefresh}
                        disabled={isRefreshing || loading}
                        className="h-11 w-11"
                        aria-label="Refresh leaderboard"
                      >
                        <RefreshCw
                          className={cn('w-4 h-4', isRefreshing && 'animate-spin')}
                          aria-hidden="true"
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Refresh leaderboard</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleExportData}
                        disabled={loading}
                        className="h-11 w-11"
                        aria-label="Export leaderboard data"
                      >
                        <Download className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Export to CSV</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>

          {/* Tabs Section */}
          <div
            className={cn(
              'max-w-5xl mx-auto transition-all duration-700 delay-500',
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
          >
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-auto p-1" role="tablist">
                <TabsTrigger value="pixels" className="py-3" role="tab" aria-controls="pixels-panel">
                  <Trophy className="w-4 h-4 mr-2" aria-hidden="true" />
                  <span className="hidden sm:inline">Most Pixels</span>
                  <span className="sm:hidden">Pixels</span>
                </TabsTrigger>
                <TabsTrigger value="spending" className="py-3" role="tab" aria-controls="spending-panel">
                  <DollarSign className="w-4 h-4 mr-2" aria-hidden="true" />
                  <span className="hidden sm:inline">Top Spenders</span>
                  <span className="sm:hidden">Spenders</span>
                </TabsTrigger>
                <TabsTrigger value="recent" className="py-3" role="tab" aria-controls="recent-panel">
                  <Clock className="w-4 h-4 mr-2" aria-hidden="true" />
                  <span>Recent</span>
                </TabsTrigger>
              </TabsList>

              {/* Most Pixels Tab */}
              <TabsContent value="pixels" className="space-y-4 mt-6" id="pixels-panel" role="tabpanel">
                <Card className="border-primary/10">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <Trophy className="w-6 h-6 text-primary" aria-hidden="true" />
                        Top Pixel Owners
                      </CardTitle>
                      <Badge variant="outline" aria-label={`${filteredPixelLeaders.length} users in list`}>
                        {filteredPixelLeaders.length} users
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar"
                      role="list"
                      aria-label="Top pixel owners"
                    >
                      {loading ? (
                        Array(10)
                          .fill(0)
                          .map((_, i) => <LeaderboardRowSkeleton key={i} />)
                      ) : filteredPixelLeaders.length > 0 ? (
                        filteredPixelLeaders.map((leaderUser, index) => (
                          <div
                            key={leaderUser.user_id}
                            className={cn(
                              'flex items-center justify-between p-4 rounded-lg border transition-all duration-200 group',
                              index < TOP_RANK_COUNT
                                ? 'bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20 hover:border-primary/40 hover:shadow-md'
                                : 'bg-card hover:bg-accent/5',
                              leaderUser.user_id === user?.id && 'ring-2 ring-primary'
                            )}
                            role="listitem"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="relative flex-shrink-0">
                                <Badge
                                  variant={getRankBadgeVariant(index)}
                                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                                  aria-label={`Rank ${index + 1}`}
                                >
                                  {index + 1}
                                </Badge>
                                {index < TOP_RANK_COUNT && (
                                  <div className="absolute -top-1 -right-1">
                                    {getRankIcon(index)}
                                  </div>
                                )}
                              </div>
                              <Avatar className="w-12 h-12 flex-shrink-0 border-2 border-border group-hover:scale-105 transition-transform">
                                <AvatarImage
                                  src={leaderUser.avatar_url || undefined}
                                  alt={leaderUser.full_name || 'User avatar'}
                                />
                                <AvatarFallback className="text-sm font-semibold">
                                  {getInitials(leaderUser.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="font-semibold truncate">
                                    {leaderUser.full_name || 'Anonymous User'}
                                  </div>
                                  {leaderUser.user_id === user?.id && (
                                    <Badge variant="secondary" className="text-xs">
                                      You
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                  {leaderUser.pixel_count.toLocaleString()} pixel
                                  {leaderUser.pixel_count !== 1 ? 's' : ''} owned
                                  {leaderUser.rankChange && getRankChangeIcon(leaderUser.rankChange)}
                                </div>
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className="ml-2 flex-shrink-0 font-bold"
                              aria-label={`${leaderUser.pixel_count} pixels`}
                            >
                              {leaderUser.pixel_count.toLocaleString()}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                            <Trophy className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
                          </div>
                          <p className="text-muted-foreground">
                            {searchQuery
                              ? 'No users found matching your search'
                              : 'No data available yet'}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Top Spenders Tab */}
              <TabsContent value="spending" className="space-y-4 mt-6" id="spending-panel" role="tabpanel">
                <Card className="border-success/10">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <DollarSign className="w-6 h-6 text-success" aria-hidden="true" />
                        Top Spenders
                      </CardTitle>
                      <Badge variant="outline" aria-label={`${filteredSpendingLeaders.length} users in list`}>
                        {filteredSpendingLeaders.length} users
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar"
                      role="list"
                      aria-label="Top spenders"
                    >
                      {loading ? (
                        Array(10)
                          .fill(0)
                          .map((_, i) => <LeaderboardRowSkeleton key={i} />)
                      ) : filteredSpendingLeaders.length > 0 ? (
                        filteredSpendingLeaders.map((leaderUser, index) => (
                          <div
                            key={leaderUser.user_id}
                            className={cn(
                              'flex items-center justify-between p-4 rounded-lg border transition-all duration-200 group',
                              index < TOP_RANK_COUNT
                                ? 'bg-gradient-to-r from-success/5 to-primary/5 border-success/20 hover:border-success/40 hover:shadow-md'
                                : 'bg-card hover:bg-accent/5',
                              leaderUser.user_id === user?.id && 'ring-2 ring-success'
                            )}
                            role="listitem"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="relative flex-shrink-0">
                                <Badge
                                  variant={getRankBadgeVariant(index)}
                                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                                  aria-label={`Rank ${index + 1}`}
                                >
                                  {index + 1}
                                </Badge>
                                {index < TOP_RANK_COUNT && (
                                  <div className="absolute -top-1 -right-1">
                                    {getRankIcon(index)}
                                  </div>
                                )}
                              </div>
                              <Avatar className="w-12 h-12 flex-shrink-0 border-2 border-border group-hover:scale-105 transition-transform">
                                <AvatarImage
                                  src={leaderUser.avatar_url || undefined}
                                  alt={leaderUser.full_name || 'User avatar'}
                                />
                                <AvatarFallback className="text-sm font-semibold">
                                  {getInitials(leaderUser.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="font-semibold truncate">
                                    {leaderUser.full_name || 'Anonymous User'}
                                  </div>
                                  {leaderUser.user_id === user?.id && (
                                    <Badge variant="secondary" className="text-xs">
                                      You
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Total spent: ₹
                                  {leaderUser.total_spent.toLocaleString('en-IN', {
                                    maximumFractionDigits: 2,
                                  })}
                                </div>
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className="ml-2 flex-shrink-0 font-bold text-success"
                              aria-label={`Spent ${Math.round(leaderUser.total_spent)} rupees`}
                            >
                              ₹{Math.round(leaderUser.total_spent).toLocaleString()}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                            <DollarSign className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
                          </div>
                          <p className="text-muted-foreground">
                            {searchQuery
                              ? 'No users found matching your search'
                              : 'No data available yet'}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Recent Purchases Tab */}
              <TabsContent value="recent" className="space-y-4 mt-6" id="recent-panel" role="tabpanel">
                <Card className="border-accent/10">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <Clock className="w-6 h-6 text-accent" aria-hidden="true" />
                        Recent Purchases
                      </CardTitle>
                      <Badge variant="outline" aria-label={`${filteredRecentPurchases.length} purchases in list`}>
                        {filteredRecentPurchases.length} purchases
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar"
                      role="list"
                      aria-label="Recent purchases"
                    >
                      {loading ? (
                        Array(10)
                          .fill(0)
                          .map((_, i) => <LeaderboardRowSkeleton key={i} />)
                      ) : filteredRecentPurchases.length > 0 ? (
                        filteredRecentPurchases.map((purchase) => (
                          <div
                            key={purchase.id}
                            className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-all duration-200 hover:shadow-sm group"
                            role="listitem"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-12 h-12 rounded border-2 border-border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform">
                                {purchase.image_url ? (
                                  <img
                                    src={purchase.image_url}
                                    alt={purchase.alt_text || `Pixel at (${purchase.x}, ${purchase.y})`}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-primary/20" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold">
                                  Pixel ({purchase.x}, {purchase.y})
                                </div>
                                <div className="text-sm text-muted-foreground truncate">
                                  by {purchase.full_name || 'Anonymous'} •{' '}
                                  {formatDate(purchase.purchased_at)}
                                </div>
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className="ml-2 flex-shrink-0 font-semibold"
                              aria-label={`Price ${parseFloat(purchase.price_paid.toString()).toFixed(2)} rupees`}
                            >
                              ₹{parseFloat(purchase.price_paid.toString()).toFixed(2)}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                            <Clock className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
                          </div>
                          <p className="text-muted-foreground">
                            {searchQuery
                              ? 'No purchases found matching your search'
                              : 'No recent purchases'}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>

        <Footer />

        {/* Custom Scrollbar Styles */}
        <style>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: hsl(var(--muted-foreground) / 0.3);
            border-radius: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: hsl(var(--muted-foreground) / 0.5);
          }
        `}</style>
      </div>
    </>
  );
};

export default Leaderboard;
