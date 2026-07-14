import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SEO from '@/components/SEO';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  Users,
  DollarSign,
  Grid3X3,
  Zap,
  Crown,
  Sparkles,
  BarChart3,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ShoppingCart,
  Trophy,
  MapPin,
} from 'lucide-react';
import { Link } from 'react-router-dom';

// ── Types ─────────────────────────────────────────────────
interface PlatformStats {
  total_pixels_sold: number;
  total_pixels: number;
  fill_rate_percent: number;
  total_revenue: number;
  active_advertisers: number;
  total_blocks: number;
  pixels_sold_today: number;
  pixels_sold_this_week: number;
  pixels_sold_this_month: number;
  tier_breakdown: { economy: number; premium: number; gold: number };
  daily_velocity: Array<{ date: string; count: number; revenue: number }>;
  top_advertisers: Array<{
    name: string | null;
    avatar_url: string | null;
    pixel_count: number;
    total_spent: number;
  }>;
  recent_purchases: Array<{
    pixel_count: number;
    total_price: number;
    created_at: string;
    buyer_name: string | null;
    buyer_avatar: string | null;
  }>;
  zone_activity: {
    top_left: number;
    top_right: number;
    bottom_left: number;
    bottom_right: number;
  };
  marketplace: {
    active_listings: number;
    total_transactions: number;
    total_volume: number;
  };
  generated_at: string;
}

// ── SVG Sparkline Chart ───────────────────────────────────
const Sparkline = ({
  data,
  width = 400,
  height = 80,
  color = '#6366f1',
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) => {
  if (!data.length) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * width : width / 2;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  });
  const pathD = `M ${points.join(' L ')}`;
  const areaD = `${pathD} L ${data.length > 1 ? width : width/2},${height} L ${data.length > 1 ? 0 : width/2},${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#sparkGrad)" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Last point dot */}
      {data.length > 0 && (
        <circle
          cx={data.length > 1 ? width : width / 2}
          cy={height - ((data[data.length - 1] - min) / range) * (height - 8) - 4}
          r="3"
          fill={color}
        />
      )}
    </svg>
  );
};

// ── Progress Ring ─────────────────────────────────────────
const ProgressRing = ({
  percent,
  size = 120,
  strokeWidth = 8,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/20"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="url(#ringGrad)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-1000 ease-out"
      />
      <defs>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
    </svg>
  );
};

// ── Zone Heatmap ──────────────────────────────────────────
const ZoneHeatmap = ({ zones }: { zones: PlatformStats['zone_activity'] }) => {
  const max = Math.max(zones.top_left, zones.top_right, zones.bottom_left, zones.bottom_right, 1);
  const getOpacity = (val: number) => 0.15 + (val / max) * 0.85;

  const quadrants = [
    { key: 'top_left', label: 'NW', value: zones.top_left },
    { key: 'top_right', label: 'NE', value: zones.top_right },
    { key: 'bottom_left', label: 'SW', value: zones.bottom_left },
    { key: 'bottom_right', label: 'SE', value: zones.bottom_right },
  ];

  return (
    <div className="grid grid-cols-2 gap-1.5 w-full max-w-[200px] mx-auto">
      {quadrants.map((q) => (
        <div
          key={q.key}
          className="aspect-square rounded-lg flex flex-col items-center justify-center text-white font-bold transition-all hover:scale-105"
          style={{
            backgroundColor: `rgba(99, 102, 241, ${getOpacity(q.value)})`,
          }}
        >
          <span className="text-lg font-black">{q.value}</span>
          <span className="text-[10px] opacity-70 font-medium">{q.label}</span>
        </div>
      ))}
    </div>
  );
};

// ── Format helpers ────────────────────────────────────────
const formatCurrency = (n: number) =>
  `₹${n.toLocaleString('en-IN')}`;

const formatTimeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

// ── Main Component ────────────────────────────────────────
const StatsPage = () => {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('get_platform_stats');
        if (rpcError) throw rpcError;
        setStats(data as unknown as PlatformStats);
      } catch (err) {
        console.error('Failed to load stats:', err);
        setError('Failed to load platform statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  // Derived chart data
  const velocityData = useMemo(() => {
    if (!stats?.daily_velocity) return [];
    return stats.daily_velocity.map((d) => d.count);
  }, [stats]);

  const revenueData = useMemo(() => {
    if (!stats?.daily_velocity) return [];
    return stats.daily_velocity.map((d) => d.revenue);
  }, [stats]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 pb-20 lg:pb-0">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 pb-20 lg:pb-0">
        <Header />
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-red-500">{error || 'Failed to load stats'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 pb-20 lg:pb-0">
      <SEO
        title="Live Stats — BuyASpot Index"
        description="Real-time metrics and analytics for India's pixel marketplace. See total pixels sold, revenue, and advertiser activity."
        canonical="https://buyaspot.in/stats"
        image="https://buyaspot.in/og-image.jpg"
        imageAlt="BuyASpot Live Stats"
      />
      <Header />

      <div className="container mx-auto px-4 py-6 md:py-10 max-w-6xl">
        {/* Hero Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                BuyASpot Index
              </h1>
            </div>
            <p className="text-muted-foreground text-sm md:text-base">
              Real-time platform metrics · Auto-refreshes every 60s
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-muted-foreground font-medium">
              Live · Updated {formatTimeAgo(stats.generated_at)}
            </span>
          </div>
        </div>

        {/* ── Key Metrics Grid ─────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Fill Rate */}
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-white to-indigo-50/50 dark:from-gray-900 dark:to-indigo-950/20 shadow-lg shadow-indigo-500/5">
            <CardContent className="p-5 flex flex-col items-center text-center">
              <div className="relative mb-3">
                <ProgressRing percent={stats.fill_rate_percent} size={90} strokeWidth={6} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-black text-foreground">{stats.fill_rate_percent}%</span>
                </div>
              </div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Canvas Filled</p>
              <p className="text-sm text-muted-foreground mt-1">
                {stats.total_pixels_sold.toLocaleString()} / {stats.total_pixels.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          {/* Advertisers */}
          <Card className="border-0 bg-gradient-to-br from-white to-purple-50/50 dark:from-gray-900 dark:to-purple-950/20 shadow-lg shadow-purple-500/5">
            <CardContent className="p-5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-2xl font-black text-foreground">
                {stats.active_advertisers}
              </p>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Advertisers</p>
              <p className="text-xs text-muted-foreground mt-2">
                {stats.total_blocks} total blocks
              </p>
            </CardContent>
          </Card>

          {/* Today's Activity */}
          <Card className="border-0 bg-gradient-to-br from-white to-amber-50/50 dark:from-gray-900 dark:to-amber-950/20 shadow-lg shadow-amber-500/5">
            <CardContent className="p-5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3">
                <Zap className="w-5 h-5 text-amber-600" />
              </div>
              <p className="text-2xl font-black text-foreground">
                {stats.pixels_sold_today}
              </p>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Sold Today</p>
              <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                <span>{stats.pixels_sold_this_week} this week</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Charts Row ───────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          {/* Purchase Velocity Chart */}
          <Card className="border-0 shadow-lg bg-white dark:bg-gray-900">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-500" />
                  <h3 className="font-bold text-sm">Purchase Velocity</h3>
                </div>
                <Badge variant="outline" className="text-[10px] font-semibold">Last 30 Days</Badge>
              </div>
              <div className="h-24">
                <Sparkline data={velocityData} color="#6366f1" />
              </div>
              <div className="flex justify-between mt-3 text-xs text-muted-foreground">
                <span>30 days ago</span>
                <span>Today</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Bottom Grid ──────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Tier Breakdown */}
          <Card className="border-0 shadow-lg bg-white dark:bg-gray-900">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <Grid3X3 className="w-4 h-4 text-purple-500" />
                <h3 className="font-bold text-sm">Tier Breakdown</h3>
              </div>
              <div className="space-y-4">
                {[
                  { name: 'Gold', icon: Crown, count: stats.tier_breakdown.gold, color: 'amber', price: '₹499' },
                  { name: 'Premium', icon: Sparkles, count: stats.tier_breakdown.premium, color: 'violet', price: '₹299' },
                  { name: 'Economy', icon: Zap, count: stats.tier_breakdown.economy, color: 'emerald', price: '₹99' },
                ].map((tier) => {
                  const percent = stats.total_pixels_sold > 0 ? (tier.count / stats.total_pixels_sold) * 100 : 0;
                  return (
                    <div key={tier.name} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg bg-${tier.color}-500/10 flex items-center justify-center`}>
                        <tier.icon className={`w-4 h-4 text-${tier.color}-500`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-semibold">{tier.name}</span>
                          <span className="text-xs text-muted-foreground">{tier.count} ({percent.toFixed(0)}%)</span>
                        </div>
                        <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-${tier.color}-500 rounded-full transition-all duration-1000`}
                            style={{ width: `${Math.min(percent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Zone Activity Heatmap */}
          <Card className="border-0 shadow-lg bg-white dark:bg-gray-900">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <MapPin className="w-4 h-4 text-blue-500" />
                <h3 className="font-bold text-sm">Canvas Zones</h3>
              </div>
              <ZoneHeatmap zones={stats.zone_activity} />
              <p className="text-xs text-muted-foreground text-center mt-4">
                Pixel density by grid quadrant
              </p>
            </CardContent>
          </Card>

          {/* Marketplace Stats */}
          <Card className="border-0 shadow-lg bg-white dark:bg-gray-900">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <ShoppingCart className="w-4 h-4 text-pink-500" />
                <h3 className="font-bold text-sm">Marketplace</h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/20">
                  <span className="text-sm text-muted-foreground">Active Listings</span>
                  <span className="font-bold">{stats.marketplace.active_listings}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/20">
                  <span className="text-sm text-muted-foreground">Completed Sales</span>
                  <span className="font-bold">{stats.marketplace.total_transactions}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/20">
                  <span className="text-sm text-muted-foreground">Total Volume</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(stats.marketplace.total_volume)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Top Advertisers & Recent Activity ─────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Advertisers */}
          <Card className="border-0 shadow-lg bg-white dark:bg-gray-900">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-sm">Top Advertisers</h3>
              </div>
              <div className="space-y-3">
                {stats.top_advertisers.slice(0, 5).map((adv, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/20 transition-colors">
                    <span className="text-sm font-bold text-muted-foreground w-5 text-center">
                      {i + 1}
                    </span>
                    {adv.avatar_url ? (
                      <img src={adv.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{adv.name || 'Anonymous'}</p>
                      <p className="text-xs text-muted-foreground">{adv.pixel_count} pixels</p>
                    </div>
                    <Badge variant="secondary" className="text-xs font-semibold">
                      {formatCurrency(adv.total_spent)}
                    </Badge>
                  </div>
                ))}
              </div>
              <Link
                to="/leaderboard"
                className="flex items-center justify-center gap-1 mt-4 text-sm text-primary font-semibold hover:underline"
              >
                View Full Leaderboard <ArrowUpRight className="w-3 h-3" />
              </Link>
            </CardContent>
          </Card>

          {/* Recent Purchases */}
          <Card className="border-0 shadow-lg bg-white dark:bg-gray-900">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <Clock className="w-4 h-4 text-blue-500" />
                <h3 className="font-bold text-sm">Recent Activity</h3>
              </div>
              <div className="space-y-3">
                {stats.recent_purchases.slice(0, 6).map((purchase, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/20 transition-colors">
                    {purchase.buyer_avatar ? (
                      <img src={purchase.buyer_avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <ShoppingCart className="w-4 h-4 text-emerald-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">
                        {purchase.buyer_name || 'Someone'} bought {purchase.pixel_count} pixel{purchase.pixel_count > 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTimeAgo(purchase.created_at)}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">
                      {formatCurrency(purchase.total_price)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CTA */}
        <Card className="border-0 shadow-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl md:text-3xl font-black mb-2">
              Join {stats.active_advertisers}+ Advertisers
            </h2>
            <p className="text-white/80 mb-6 max-w-md mx-auto">
              Own a piece of internet history. Pixels start at just ₹99 with permanent placement.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-8 py-3 bg-white text-indigo-700 font-bold rounded-xl hover:bg-gray-50 transition-all hover:shadow-lg hover:scale-105 active:scale-95"
            >
              Buy Pixels Now <ArrowUpRight className="w-4 h-4" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
};

export default StatsPage;
