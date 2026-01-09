import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trophy, Users, DollarSign, Clock, AlertCircle, TrendingUp,
  Award, Medal, Search, Filter, Download, ChevronUp, ChevronDown,
  Minus, Star, Crown, Sparkles, Target, Zap
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { cn, getErrorMessage } from "@/lib/utils";
import { RealtimeChannel } from "@supabase/supabase-js";

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

// Skeleton Components
const Skeleton = ({ className = "", circle = false }: { className?: string; circle?: boolean }) => (
  <div className={`animate-pulse bg-muted ${circle ? 'rounded-full' : 'rounded-md'} ${className}`} />
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

const Leaderboard = () => {
  const { user } = useAuth();
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
    recentGrowth: 0
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const [activeTab, setActiveTab] = useState("pixels");
  const [userRank, setUserRank] = useState<{ pixelRank: number | null; spendingRank: number | null }>({
    pixelRank: null,
    spendingRank: null
  });

  // Fetch leaderboard data
  const fetchLeaderboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Date filter based on time period
      let startDate = null;
      const now = new Date();
      if (timePeriod === 'today') {
        startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      } else if (timePeriod === 'week') {
        startDate = new Date(now.setDate(now.getDate() - 7)).toISOString();
      } else if (timePeriod === 'month') {
        startDate = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
      }

      // 1. Fetch Top Pixels & Spenders via RPC
      // Cast to any because types are not yet generated for these specific RPCs
      const [pixelsData, spendingData, statsData] = await Promise.all([
        (supabase as any).rpc("get_leaderboard_stats", {
          sort_by: "pixels",
          limit_count: 100,
          start_date: startDate
        }),
        (supabase as any).rpc("get_leaderboard_stats", {
          sort_by: "spending",
          limit_count: 100,
          start_date: startDate
        }),
        (supabase as any).rpc("get_general_stats")
      ]);

      if (pixelsData.error) throw pixelsData.error;
      if (spendingData.error) throw spendingData.error;
      if (statsData.error) throw statsData.error;

      // Transform RPC data to LeaderboardUser
      const transformUser = (data: any): LeaderboardUser => ({
        id: data.user_id,
        user_id: data.user_id,
        full_name: data.full_name,
        avatar_url: data.avatar_url,
        pixel_count: Number(data.pixel_count),
        total_spent: Number(data.total_spent)
      });

      const sortedByPixels = ((pixelsData.data as any[]) || []).map(transformUser);
      const sortedBySpending = ((spendingData.data as any[]) || []).map(transformUser);

      setTopByPixels(sortedByPixels);
      setTopBySpending(sortedBySpending);

      // Find current user's rank
      if (user) {
        const pixelRankIndex = sortedByPixels.findIndex(u => u.user_id === user.id);
        const spendingRankIndex = sortedBySpending.findIndex(u => u.user_id === user.id);

        setUserRank({
          pixelRank: pixelRankIndex >= 0 ? pixelRankIndex + 1 : null,
          spendingRank: spendingRankIndex >= 0 ? spendingRankIndex + 1 : null
        });
      }

      // 2. Fetch Helper Stats
      const statsArray = (statsData.data as any[]) || [];
      if (statsArray.length > 0) {
        setStats({
          totalPixelsSold: Number(statsArray[0].total_pixels_sold),
          totalRevenue: Number(statsArray[0].total_revenue),
          totalUsers: Number(statsArray[0].total_users),
          averagePrice: Number(statsArray[0].average_price),
          recentGrowth: 12.5 // Placeholder or calculate separately if needed
        });
      }

      // 3. Fetch Recent Purchases (Lightweight, last 50 only)
      // We still do a manual fetch here but limited to 50 rows
      const { data: recentPixels, error: recentError } = await supabase
        .from('pixels')
        .select('owner_id, price_paid, purchased_at, x, y, id, image_url, alt_text')
        .not('owner_id', 'is', null)
        .order('purchased_at', { ascending: false })
        .limit(50);

      if (recentError) throw recentError;

      // Fetch profiles just for these 50 recent purchases
      // Optimization: Extract unique user IDs from the 50 pixels
      const recentUserIds = Array.from(new Set(recentPixels?.map(p => p.owner_id) || []));

      let profileMap = new Map();
      if (recentUserIds.length > 0) {
        const { data: recentProfiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', recentUserIds);

        recentProfiles?.forEach(profile => {
          profileMap.set(profile.user_id, profile);
        });
      }

      const recentWithProfiles = (recentPixels || []).map((purchase: PixelData) => {
        const profile = profileMap.get(purchase.owner_id);
        return {
          ...purchase,
          full_name: profile?.full_name || null,
          avatar_url: profile?.avatar_url || null,
          user_id: purchase.owner_id!
        };
      });

      setRecentPurchases(recentWithProfiles);

    } catch (error: unknown) {
      console.error('Error fetching leaderboard data:', error);
      setError(getErrorMessage(error) || 'Failed to load leaderboard data');
    } finally {
      setLoading(false);
    }
  }, [user, timePeriod]);

  useEffect(() => {
    fetchLeaderboardData();
  }, [fetchLeaderboardData]);

  // Real-time subscription
  useEffect(() => {
    let channel: RealtimeChannel;

    const setupRealtimeSubscription = () => {
      channel = supabase
        .channel('leaderboard-updates')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'pixels'
        }, () => {
          fetchLeaderboardData();
        })
        .subscribe();
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchLeaderboardData]);

  // Filtered data
  const filteredPixelLeaders = useMemo(() => {
    if (!searchQuery) return topByPixels;
    return topByPixels.filter(user =>
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [topByPixels, searchQuery]);

  const filteredSpendingLeaders = useMemo(() => {
    if (!searchQuery) return topBySpending;
    return topBySpending.filter(user =>
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [topBySpending, searchQuery]);

  const filteredRecentPurchases = useMemo(() => {
    if (!searchQuery) return recentPurchases;
    return recentPurchases.filter(purchase =>
      purchase.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      purchase.alt_text?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [recentPurchases, searchQuery]);

  // Utility functions
  const getInitials = useCallback((name: string | null): string => {
    if (!name) return "?";
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, []);

  const formatDate = useCallback((dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  }, []);

  const getRankIcon = useCallback((index: number) => {
    switch (index) {
      case 0:
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 1:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 2:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return null;
    }
  }, []);

  const getRankBadgeVariant = (index: number): "default" | "secondary" => {
    return index < 3 ? "default" : "secondary";
  };

  const getRankChangeIcon = (rankChange?: 'up' | 'down' | 'same' | 'new') => {
    switch (rankChange) {
      case 'up':
        return <ChevronUp className="w-4 h-4 text-green-500" />;
      case 'down':
        return <ChevronDown className="w-4 h-4 text-red-500" />;
      case 'same':
        return <Minus className="w-4 h-4 text-muted-foreground" />;
      case 'new':
        return <Sparkles className="w-4 h-4 text-blue-500" />;
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
          user.full_name || 'Anonymous',
          activeTab === 'pixels' ? user.pixel_count : `₹${user.total_spent.toFixed(2)}`
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leaderboard-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }, [activeTab, topByPixels, topBySpending]);

  // Error State
  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-16">
          <Card className="max-w-md mx-auto border-destructive/20">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Unable to Load Leaderboard</h3>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button onClick={() => fetchLeaderboardData()} variant="default">
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/20">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-12 lg:py-16">
        {/* Header Section */}
        <div className="text-center mb-12">
          <Badge variant="outline" className="px-6 py-2.5 mb-6 font-semibold border-primary/20 animate-pulse">
            <Zap className="w-4 h-4 mr-2 inline-block" />
            Live Updates
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            <span className="bg-gradient-to-r from-primary via-accent to-success bg-clip-text text-transparent">
              Leaderboard
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Compete, track progress, and celebrate top performers
          </p>
        </div>

        {/* User's Personal Rank Card */}
        {user && (userRank.pixelRank || userRank.spendingRank) && (
          <Card className="max-w-5xl mx-auto mb-8 bg-gradient-to-r from-primary/5 via-accent/5 to-success/5 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <Target className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Your Ranking</h3>
                    <p className="text-sm text-muted-foreground">Keep climbing!</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  {userRank.pixelRank && (
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary">#{userRank.pixelRank}</div>
                      <div className="text-xs text-muted-foreground mt-1">Pixels</div>
                    </div>
                  )}
                  {userRank.spendingRank && (
                    <div className="text-center">
                      <div className="text-3xl font-bold text-success">#{userRank.spendingRank}</div>
                      <div className="text-xs text-muted-foreground mt-1">Spending</div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 max-w-6xl mx-auto">
          {loading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <Card className="border-primary/10 hover:border-primary/30 transition-all duration-300 hover:shadow-lg">
                <CardContent className="p-6 text-center">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mx-auto mb-3">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-3xl font-bold text-primary">
                    {stats.totalPixelsSold.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Pixels Sold
                  </div>
                </CardContent>
              </Card>

              <Card className="border-success/10 hover:border-success/30 transition-all duration-300 hover:shadow-lg">
                <CardContent className="p-6 text-center">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-success/10 mx-auto mb-3">
                    <DollarSign className="w-6 h-6 text-success" />
                  </div>
                  <div className="text-3xl font-bold text-success">
                    ₹{Math.round(stats.totalRevenue).toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Total Revenue
                  </div>
                </CardContent>
              </Card>

              <Card className="border-accent/10 hover:border-accent/30 transition-all duration-300 hover:shadow-lg">
                <CardContent className="p-6 text-center">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mx-auto mb-3">
                    <Trophy className="w-6 h-6 text-accent" />
                  </div>
                  <div className="text-3xl font-bold text-accent">
                    {stats.totalUsers.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Active Users
                  </div>
                </CardContent>
              </Card>

              <Card className="border-orange-500/10 hover:border-orange-500/30 transition-all duration-300 hover:shadow-lg">
                <CardContent className="p-6 text-center">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-orange-500/10 mx-auto mb-3">
                    <Star className="w-6 h-6 text-orange-500" />
                  </div>
                  <div className="text-3xl font-bold text-orange-500">
                    ₹{Math.round(stats.averagePrice)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Avg. Price
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Filters and Search */}
        <div className="max-w-5xl mx-auto mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            <div className="flex gap-2">
              <Select value={timePeriod} onValueChange={(value: TimePeriod) => setTimePeriod(value)}>
                <SelectTrigger className="w-[140px] h-11">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={handleExportData} title="Export data" className="h-11 w-11">
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="max-w-5xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto p-1">
              <TabsTrigger value="pixels" className="py-3">
                <Trophy className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Most Pixels</span>
                <span className="sm:hidden">Pixels</span>
              </TabsTrigger>
              <TabsTrigger value="spending" className="py-3">
                <DollarSign className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Top Spenders</span>
                <span className="sm:hidden">Spenders</span>
              </TabsTrigger>
              <TabsTrigger value="recent" className="py-3">
                <Clock className="w-4 h-4 mr-2" />
                <span>Recent</span>
              </TabsTrigger>
            </TabsList>

            {/* Most Pixels Tab */}
            <TabsContent value="pixels" className="space-y-4 mt-6">
              <Card className="border-primary/10">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Trophy className="w-6 h-6 text-primary" />
                      Top Pixel Owners
                    </CardTitle>
                    <Badge variant="outline">{filteredPixelLeaders.length} users</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {loading ? (
                      Array(10).fill(0).map((_, i) => <LeaderboardRowSkeleton key={i} />)
                    ) : filteredPixelLeaders.length > 0 ? (
                      filteredPixelLeaders.map((user, index) => (
                        <div
                          key={user.user_id}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-lg border transition-all duration-200 group",
                            index < 3
                              ? 'bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20 hover:border-primary/40 hover:shadow-md'
                              : 'bg-card hover:bg-accent/5',
                            user.user_id === user?.id && 'ring-2 ring-primary'
                          )}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="relative flex-shrink-0">
                              <Badge
                                variant={getRankBadgeVariant(index)}
                                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                              >
                                {index + 1}
                              </Badge>
                              {index < 3 && (
                                <div className="absolute -top-1 -right-1">
                                  {getRankIcon(index)}
                                </div>
                              )}
                            </div>
                            <Avatar className="w-12 h-12 flex-shrink-0 border-2 border-border group-hover:scale-105 transition-transform">
                              <AvatarImage src={user.avatar_url || undefined} alt={user.full_name || 'User'} />
                              <AvatarFallback className="text-sm font-semibold">{getInitials(user.full_name)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="font-semibold truncate">
                                  {user.full_name || 'Anonymous User'}
                                </div>
                                {user.user_id === user?.id && (
                                  <Badge variant="secondary" className="text-xs">You</Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground flex items-center gap-1">
                                {user.pixel_count.toLocaleString()} pixel{user.pixel_count !== 1 ? 's' : ''} owned
                                {user.rankChange && getRankChangeIcon(user.rankChange)}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className="ml-2 flex-shrink-0 font-bold">
                            {user.pixel_count.toLocaleString()}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                          <Trophy className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground">
                          {searchQuery ? 'No users found matching your search' : 'No data available yet'}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Top Spenders Tab */}
            <TabsContent value="spending" className="space-y-4 mt-6">
              <Card className="border-success/10">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <DollarSign className="w-6 h-6 text-success" />
                      Top Spenders
                    </CardTitle>
                    <Badge variant="outline">{filteredSpendingLeaders.length} users</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {loading ? (
                      Array(10).fill(0).map((_, i) => <LeaderboardRowSkeleton key={i} />)
                    ) : filteredSpendingLeaders.length > 0 ? (
                      filteredSpendingLeaders.map((user, index) => (
                        <div
                          key={user.user_id}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-lg border transition-all duration-200 group",
                            index < 3
                              ? 'bg-gradient-to-r from-success/5 to-primary/5 border-success/20 hover:border-success/40 hover:shadow-md'
                              : 'bg-card hover:bg-accent/5',
                            user.user_id === user?.id && 'ring-2 ring-success'
                          )}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="relative flex-shrink-0">
                              <Badge
                                variant={getRankBadgeVariant(index)}
                                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                              >
                                {index + 1}
                              </Badge>
                              {index < 3 && (
                                <div className="absolute -top-1 -right-1">
                                  {getRankIcon(index)}
                                </div>
                              )}
                            </div>
                            <Avatar className="w-12 h-12 flex-shrink-0 border-2 border-border group-hover:scale-105 transition-transform">
                              <AvatarImage src={user.avatar_url || undefined} alt={user.full_name || 'User'} />
                              <AvatarFallback className="text-sm font-semibold">{getInitials(user.full_name)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="font-semibold truncate">
                                  {user.full_name || 'Anonymous User'}
                                </div>
                                {user.user_id === user?.id && (
                                  <Badge variant="secondary" className="text-xs">You</Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Total spent: ₹{user.total_spent.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className="ml-2 flex-shrink-0 font-bold text-success">
                            ₹{Math.round(user.total_spent).toLocaleString()}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                          <DollarSign className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground">
                          {searchQuery ? 'No users found matching your search' : 'No data available yet'}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Recent Purchases Tab */}
            <TabsContent value="recent" className="space-y-4 mt-6">
              <Card className="border-accent/10">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Clock className="w-6 h-6 text-accent" />
                      Recent Purchases
                    </CardTitle>
                    <Badge variant="outline">{filteredRecentPurchases.length} purchases</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {loading ? (
                      Array(10).fill(0).map((_, i) => <LeaderboardRowSkeleton key={i} />)
                    ) : filteredRecentPurchases.length > 0 ? (
                      filteredRecentPurchases.map((purchase) => (
                        <div
                          key={purchase.id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-all duration-200 hover:shadow-sm group"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-12 h-12 rounded border-2 border-border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform">
                              {purchase.image_url ? (
                                <img
                                  src={purchase.image_url}
                                  alt={purchase.alt_text || `Pixel (${purchase.x}, ${purchase.y})`}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full bg-primary/20"></div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold">
                                Pixel ({purchase.x}, {purchase.y})
                              </div>
                              <div className="text-sm text-muted-foreground truncate">
                                by {purchase.full_name || 'Anonymous'} • {formatDate(purchase.purchased_at)}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className="ml-2 flex-shrink-0 font-semibold">
                            ₹{parseFloat(purchase.price_paid.toString()).toFixed(2)}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                          <Clock className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground">
                          {searchQuery ? 'No purchases found matching your search' : 'No recent purchases'}
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
  );
};

export default Leaderboard;
