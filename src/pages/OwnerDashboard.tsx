import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
  PieChart, Pie, Cell,
  ResponsiveContainer,
} from 'recharts';
import {
  ArrowLeft, Eye, MousePointerClick, Users, TrendingUp,
  Monitor, Smartphone, Tablet, Globe, Chrome,
  Clock, Activity, Star, Trophy, BarChart3,
  RefreshCw, Loader2, ArrowUpRight, Shield,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import SEO from '@/components/SEO';
import Footer from '@/components/Footer';

// =============================================================
// TYPES
// =============================================================

interface DashboardData {
  total_views: number;
  unique_visitors: number;
  total_clicks: number;
  unique_clicks: number;
  daily_timeline: Array<{ date: string; views: number; clicks: number }>;
  device_breakdown: Array<{ device: string; count: number }>;
  browser_breakdown: Array<{ browser: string; count: number }>;
  os_breakdown: Array<{ os: string; count: number }>;
  referral_sources: Array<{ source: string; count: number }>;
  hourly_activity: Array<{ hour: number; count: number }>;
  geographic: Array<{ country: string; count: number }>;
  click_history: Array<{
    timestamp: string;
    source: string;
    device: string;
    browser: string;
    country: string;
    block_name: string | null;
  }>;
  top_blocks: Array<{
    block_id: string;
    name: string | null;
    image_url: string;
    pixel_count: number;
    clicks: number;
    link_url: string | null;
  }>;
  pixel_ranking: {
    user_rank: number;
    total_owners: number;
    percentile: number;
  };
  generated_at: string;
}

type TimePeriod = 'today' | 'yesterday' | '7d' | '30d' | 'all';

// =============================================================
// CHART CONFIG & COLORS
// =============================================================

const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#f97316', '#eab308',
  '#22c55e', '#06b6d4', '#3b82f6', '#64748b',
];

const timelineConfig: ChartConfig = {
  views: { label: 'Views', color: '#6366f1' },
  clicks: { label: 'Clicks', color: '#22c55e' },
};

const DEVICE_ICONS: Record<string, typeof Monitor> = {
  Desktop: Monitor,
  Mobile: Smartphone,
  Tablet: Tablet,
  Unknown: Monitor,
};

// =============================================================
// HELPERS
// =============================================================

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function getCTR(clicks: number, views: number): string {
  if (views === 0) return '0.00';
  return ((clicks / views) * 100).toFixed(2);
}

function getHealthScore(data: DashboardData): { stars: number; label: string; color: string } {
  let score = 0;
  if (data.total_views > 0) score += 1;
  if (data.total_clicks > 0) score += 1;
  if (data.unique_visitors > 10) score += 1;
  const ctr = data.total_views > 0 ? (data.total_clicks / data.total_views) * 100 : 0;
  if (ctr > 2) score += 1;
  if (ctr > 5) score += 1;

  if (score >= 5) return { stars: 5, label: 'Excellent', color: 'text-emerald-500' };
  if (score >= 4) return { stars: 4, label: 'Great', color: 'text-green-500' };
  if (score >= 3) return { stars: 3, label: 'Good', color: 'text-yellow-500' };
  if (score >= 2) return { stars: 2, label: 'Fair', color: 'text-orange-500' };
  return { stars: 1, label: 'Getting Started', color: 'text-red-500' };
}

function getPercentileLabel(pct: number): string {
  if (pct >= 99) return 'Top 1%';
  if (pct >= 90) return 'Top 10%';
  if (pct >= 75) return 'Top 25%';
  if (pct >= 50) return 'Top 50%';
  return 'Rising';
}

function getPercentileColor(pct: number): string {
  if (pct >= 99) return 'from-yellow-400 to-amber-600';
  if (pct >= 90) return 'from-purple-400 to-indigo-600';
  if (pct >= 75) return 'from-blue-400 to-cyan-600';
  if (pct >= 50) return 'from-emerald-400 to-green-600';
  return 'from-slate-400 to-gray-600';
}

// Fill in 24h for hourly activity
function fillHourlyData(hourly: Array<{ hour: number; count: number }>): Array<{ hour: string; count: number }> {
  const hourMap = new Map(hourly.map(h => [h.hour, h.count]));
  return Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2, '0')}:00`,
    count: hourMap.get(i) || 0,
  }));
}

// =============================================================
// SKELETON LOADERS
// =============================================================

const MetricSkeleton = () => (
  <Card>
    <CardContent className="p-6">
      <Skeleton className="h-4 w-20 mb-3" />
      <Skeleton className="h-8 w-28 mb-2" />
      <Skeleton className="h-3 w-16" />
    </CardContent>
  </Card>
);

const ChartSkeleton = () => (
  <Card>
    <CardContent className="p-6">
      <Skeleton className="h-5 w-40 mb-4" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </CardContent>
  </Card>
);

// =============================================================
// DONUT CHART COMPONENT
// =============================================================

const DonutChart = ({
  data,
  nameKey,
  dataKey,
  title,
  icon: Icon,
}: {
  data: Array<Record<string, unknown>>;
  nameKey: string;
  dataKey: string;
  title: string;
  icon: typeof Monitor;
}) => {
  const total = data.reduce((s, d) => s + ((d[dataKey] as number) || 0), 0);

  if (total === 0) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6 text-center">
          <Icon className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">No {title.toLowerCase()} data yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">{title}</h4>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-28 h-28 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={50}
                  paddingAngle={2}
                  dataKey={dataKey}
                  nameKey={nameKey}
                  strokeWidth={0}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-1.5 min-w-0">
            {data.slice(0, 5).map((item, i) => {
              const count = (item[dataKey] as number) || 0;
              const pct = total > 0 ? ((count / total) * 100).toFixed(0) : '0';
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="truncate flex-1 text-muted-foreground">{String(item[nameKey])}</span>
                  <span className="font-semibold tabular-nums">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// =============================================================
// MAIN COMPONENT
// =============================================================

const OwnerDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<TimePeriod>('all');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => { setIsVisible(true); }, []);

  const fetchData = useCallback(async (timePeriod: TimePeriod, showRefreshIndicator = false) => {
    if (!user) return;

    if (showRefreshIndicator) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const { data: result, error } = await supabase.rpc('get_owner_dashboard_analytics', {
        target_user_id: user.id,
        time_range: timePeriod,
      });

      if (error) throw error;
      setData(result as unknown as DashboardData);
    } catch (err) {
      console.error('Failed to load dashboard analytics:', err);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/signin');
      return;
    }
    if (user) fetchData(period);
  }, [user, authLoading, navigate, fetchData, period]);

  const handleRefresh = () => fetchData(period, true);

  const handlePeriodChange = (value: string) => {
    setPeriod(value as TimePeriod);
  };

  // Derived values
  const ctr = useMemo(() => {
    if (!data) return '0.00';
    return getCTR(data.total_clicks, data.total_views);
  }, [data]);

  const health = useMemo(() => {
    if (!data) return { stars: 0, label: 'Loading', color: 'text-muted-foreground' };
    return getHealthScore(data);
  }, [data]);

  const filledHourly = useMemo(() => {
    if (!data?.hourly_activity) return [];
    return fillHourlyData(data.hourly_activity);
  }, [data]);

  // Auth loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <SEO
        title="Owner Analytics Dashboard — BuyASpot"
        description="View detailed analytics for your purchased pixels — traffic, clicks, CTR, device breakdowns, and more."
      />

      <div className={`min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/20 transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>

        {/* Header */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/40">
          <div className="container mx-auto px-4 py-3 max-w-7xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/profile">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-lg font-bold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Owner Analytics
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Track your pixel performance
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select value={period} onValueChange={handlePeriodChange}>
                <SelectTrigger className="w-[130px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="all">Lifetime</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 max-w-7xl space-y-6 pb-24 lg:pb-8">

          {/* ===== METRIC CARDS ===== */}
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {Array(5).fill(0).map((_, i) => <MetricSkeleton key={i} />)}
            </div>
          ) : data ? (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Total Views */}
              <Card className="border-border/50 bg-gradient-to-br from-indigo-50/80 to-purple-50/50 dark:from-indigo-950/30 dark:to-purple-950/20 backdrop-blur-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                      <Eye className="w-4 h-4 text-indigo-500" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-indigo-700 dark:text-indigo-400 tabular-nums">
                    {formatNumber(data.total_views)}
                  </p>
                  <p className="text-xs font-semibold text-indigo-600/60 dark:text-indigo-400/50 uppercase tracking-wider mt-1">
                    Total Views
                  </p>
                </CardContent>
              </Card>

              {/* Unique Visitors */}
              <Card className="border-border/50 bg-gradient-to-br from-violet-50/80 to-fuchsia-50/50 dark:from-violet-950/30 dark:to-fuchsia-950/20 backdrop-blur-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                      <Users className="w-4 h-4 text-violet-500" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-violet-700 dark:text-violet-400 tabular-nums">
                    {formatNumber(data.unique_visitors)}
                  </p>
                  <p className="text-xs font-semibold text-violet-600/60 dark:text-violet-400/50 uppercase tracking-wider mt-1">
                    Unique Visitors
                  </p>
                </CardContent>
              </Card>

              {/* Total Clicks */}
              <Card className="border-border/50 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20 backdrop-blur-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <MousePointerClick className="w-4 h-4 text-emerald-500" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {formatNumber(data.total_clicks)}
                  </p>
                  <p className="text-xs font-semibold text-emerald-600/60 dark:text-emerald-400/50 uppercase tracking-wider mt-1">
                    Total Clicks
                  </p>
                </CardContent>
              </Card>

              {/* CTR */}
              <Card className="border-border/50 bg-gradient-to-br from-amber-50/80 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20 backdrop-blur-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-amber-500" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-amber-700 dark:text-amber-400 tabular-nums">
                    {ctr}%
                  </p>
                  <p className="text-xs font-semibold text-amber-600/60 dark:text-amber-400/50 uppercase tracking-wider mt-1">
                    Click Rate
                  </p>
                </CardContent>
              </Card>

              {/* Health Score */}
              <Card className="border-border/50 bg-gradient-to-br from-rose-50/80 to-pink-50/50 dark:from-rose-950/30 dark:to-pink-950/20 backdrop-blur-sm col-span-2 lg:col-span-1">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-rose-500" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    {Array(5).fill(0).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${i < health.stars ? health.color : 'text-muted-foreground/20'}`}
                        fill={i < health.stars ? 'currentColor' : 'none'}
                      />
                    ))}
                  </div>
                  <p className={`text-sm font-bold ${health.color}`}>{health.label}</p>
                  <p className="text-xs font-semibold text-rose-600/60 dark:text-rose-400/50 uppercase tracking-wider mt-0.5">
                    Health Score
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {/* ===== TRAFFIC TIMELINE ===== */}
          {loading ? (
            <ChartSkeleton />
          ) : data && data.daily_timeline.length > 0 ? (
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Traffic Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ChartContainer config={timelineConfig} className="h-[300px] w-full">
                  <AreaChart data={data.daily_timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="clicksGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="views"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fill="url(#viewsGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="clicks"
                      stroke="#22c55e"
                      strokeWidth={2}
                      fill="url(#clicksGrad)"
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          ) : null}

          {/* ===== DEVICE / BROWSER / OS BREAKDOWNS ===== */}
          {!loading && data && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DonutChart
                data={data.device_breakdown}
                nameKey="device"
                dataKey="count"
                title="Devices"
                icon={Smartphone}
              />
              <DonutChart
                data={data.browser_breakdown}
                nameKey="browser"
                dataKey="count"
                title="Browsers"
                icon={Chrome}
              />
              <DonutChart
                data={data.os_breakdown}
                nameKey="os"
                dataKey="count"
                title="Operating Systems"
                icon={Monitor}
              />
            </div>
          )}

          {/* ===== REFERRAL SOURCES + GEOGRAPHIC ===== */}
          {!loading && data && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Referral Sources */}
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4 text-primary" />
                    Referral Sources
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.referral_sources.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No referral data yet</p>
                  ) : (
                    <div className="space-y-3">
                      {data.referral_sources.map((ref, i) => {
                        const total = data.referral_sources.reduce((s, r) => s + r.count, 0);
                        const pct = total > 0 ? (ref.count / total) * 100 : 0;
                        return (
                          <div key={ref.source} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">{ref.source}</span>
                              <span className="text-muted-foreground tabular-nums">
                                {ref.count} ({pct.toFixed(0)}%)
                              </span>
                            </div>
                            <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${Math.min(pct, 100)}%`,
                                  backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Geographic Distribution */}
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    Geographic Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.geographic.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No geographic data yet</p>
                  ) : (
                    <div className="space-y-3">
                      {data.geographic.slice(0, 8).map((geo, i) => {
                        const total = data.geographic.reduce((s, g) => s + g.count, 0);
                        const pct = total > 0 ? (geo.count / total) * 100 : 0;
                        return (
                          <div key={geo.country} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">{geo.country}</span>
                              <span className="text-muted-foreground tabular-nums">
                                {geo.count} ({pct.toFixed(0)}%)
                              </span>
                            </div>
                            <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${Math.min(pct, 100)}%`,
                                  backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ===== HOURLY ACTIVITY ===== */}
          {!loading && data && filledHourly.length > 0 && (
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Popular Visiting Hours
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ChartContainer config={{ count: { label: 'Clicks', color: '#8b5cf6' } }} className="h-[200px] w-full">
                  <BarChart data={filledHourly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                    <XAxis
                      dataKey="hour"
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      interval={2}
                    />
                    <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* ===== PIXEL RANKING + TOP BLOCKS ===== */}
          {!loading && data && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Pixel Ranking */}
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getPercentileColor(data.pixel_ranking.percentile)} flex items-center justify-center shadow-lg`}>
                      <Trophy className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Pixel Ranking</h3>
                      <p className="text-xs text-muted-foreground">How you compare to other owners</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-lg bg-muted/30">
                      <p className="text-2xl font-black">#{data.pixel_ranking.user_rank}</p>
                      <p className="text-xs text-muted-foreground mt-1">Your Rank</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/30">
                      <p className="text-2xl font-black">{data.pixel_ranking.total_owners}</p>
                      <p className="text-xs text-muted-foreground mt-1">Total Owners</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/30">
                      <Badge className={`text-sm py-1 px-2 bg-gradient-to-r ${getPercentileColor(data.pixel_ranking.percentile)} text-white border-0`}>
                        {getPercentileLabel(data.pixel_ranking.percentile)}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1.5">Percentile</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Top Performing Blocks */}
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Top Performing Blocks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.top_blocks.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No block data yet</p>
                  ) : (
                    <div className="space-y-3">
                      {data.top_blocks.slice(0, 5).map((block, i) => (
                        <div key={block.block_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/20 transition-colors">
                          <div className="w-8 h-8 rounded-md bg-muted/50 flex items-center justify-center text-xs font-bold text-muted-foreground">
                            #{i + 1}
                          </div>
                          {block.image_url && (
                            <img
                              src={block.image_url}
                              alt={block.name || 'Block'}
                              className="w-8 h-8 rounded-md object-cover"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{block.name || 'Unnamed Block'}</p>
                            <p className="text-xs text-muted-foreground">{block.pixel_count} pixels</p>
                          </div>
                          <Badge variant="secondary" className="font-bold tabular-nums">
                            {block.clicks} clicks
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ===== CLICK HISTORY LOG ===== */}
          {!loading && data && data.click_history.length > 0 && (
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Recent Activity
                  <Badge variant="outline" className="text-xs ml-auto">
                    Anonymous — No PII stored
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase">Time</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase">Source</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase hidden sm:table-cell">Device</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase hidden md:table-cell">Browser</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase hidden lg:table-cell">Country</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase hidden lg:table-cell">Block</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.click_history.map((entry, i) => (
                        <tr key={i} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                          <td className="py-2.5 px-3 text-xs text-muted-foreground tabular-nums">
                            {new Date(entry.timestamp).toLocaleString('en', {
                              month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant="outline" className="text-xs capitalize">{entry.source}</Badge>
                          </td>
                          <td className="py-2.5 px-3 text-xs hidden sm:table-cell">{entry.device}</td>
                          <td className="py-2.5 px-3 text-xs hidden md:table-cell">{entry.browser}</td>
                          <td className="py-2.5 px-3 text-xs hidden lg:table-cell">{entry.country}</td>
                          <td className="py-2.5 px-3 text-xs hidden lg:table-cell truncate max-w-[120px]">
                            {entry.block_name || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ===== EMPTY STATE ===== */}
          {!loading && data && data.total_views === 0 && data.total_clicks === 0 && (
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-8 h-8 text-indigo-500" />
                </div>
                <h3 className="text-xl font-bold mb-2">No analytics data yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Once visitors start viewing and clicking your pixels, you'll see detailed analytics here —
                  including traffic trends, device breakdowns, geographic distribution, and more.
                </p>
                <Button className="mt-6" onClick={() => navigate('/canvas')}>
                  <Eye className="w-4 h-4 mr-2" />
                  View My Pixels
                </Button>
              </CardContent>
            </Card>
          )}

        </main>

        <Footer />
      </div>
    </>
  );
};

export default OwnerDashboard;
