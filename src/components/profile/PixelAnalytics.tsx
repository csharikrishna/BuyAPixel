import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MousePointerClick,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Eye,
  ArrowUpRight,
  Monitor,
  Smartphone,
  Globe,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AnalyticsData {
  total_clicks: number;
  clicks_last_7_days: number;
  clicks_last_30_days: number;
  daily_clicks: Array<{ date: string; clicks: number }>;
  clicks_by_source: Array<{ source: string; clicks: number }>;
  top_blocks: Array<{
    block_id: string;
    name: string | null;
    pixel_count: number;
    clicks: number;
  }>;
}

// SVG Sparkline
const MiniSparkline = ({
  data,
  width = 200,
  height = 40,
  color = '#6366f1',
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) => {
  if (data.length < 2) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map(
    (v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`
  );

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-10" preserveAspectRatio="none">
      <defs>
        <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`M ${points.join(' L ')} L ${width},${height} L 0,${height} Z`}
        fill="url(#analyticsGrad)"
      />
      <path
        d={`M ${points.join(' L ')}`}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const SOURCE_LABELS: Record<string, { label: string; icon: typeof Globe }> = {
  grid: { label: 'Pixel Grid', icon: Monitor },
  billboard: { label: 'Billboard', icon: Eye },
  pixel_info: { label: 'Pixel Info', icon: MousePointerClick },
  directory: { label: 'Directory', icon: Globe },
  unknown: { label: 'Other', icon: Globe },
};

interface PixelAnalyticsProps {
  userId: string;
}

export const PixelAnalytics = ({ userId }: PixelAnalyticsProps) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data: result, error } = await supabase.rpc('get_pixel_analytics', {
          target_user_id: userId,
        });
        if (error) throw error;
        setData(result as unknown as AnalyticsData);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) fetch();
  }, [userId]);

  const sparklineData = useMemo(() => {
    if (!data?.daily_clicks) return [];
    // Fill missing days with 0
    const last30 = Array(30).fill(0);
    const now = new Date();
    data.daily_clicks.forEach((d) => {
      const daysAgo = Math.floor((now.getTime() - new Date(d.date).getTime()) / 86400000);
      if (daysAgo >= 0 && daysAgo < 30) {
        last30[29 - daysAgo] = d.clicks;
      }
    });
    return last30;
  }, [data]);

  const weekTrend = useMemo(() => {
    if (!data) return 0;
    // Very rough: compare last 7 to previous 7
    const last7 = data.clicks_last_7_days;
    const prev7 = data.clicks_last_30_days - last7; // approximate
    if (prev7 === 0) return last7 > 0 ? 100 : 0;
    return Math.round(((last7 - prev7 / 3.28) / (prev7 / 3.28)) * 100);
  }, [data]);

  if (loading) {
    return (
      <Card className="shadow-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700/50">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.total_clicks === 0) {
    return (
      <Card className="shadow-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-indigo-500" />
            </div>
            <h3 className="font-bold text-lg">Analytics</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            No click data yet. Once visitors start clicking your pixel links, you'll see analytics here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700/50 overflow-hidden">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Click Analytics</h3>
              <p className="text-xs text-muted-foreground">Track your pixel performance</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs font-semibold">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse inline-block" />
            Live
          </Badge>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-100 dark:border-indigo-900/30">
            <p className="text-2xl font-black text-indigo-700 dark:text-indigo-400">
              {data.total_clicks}
            </p>
            <p className="text-xs font-bold text-indigo-600/60 dark:text-indigo-400/60 uppercase tracking-wider mt-1">
              Total Clicks
            </p>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-100 dark:border-emerald-900/30">
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                {data.clicks_last_7_days}
              </span>
              {weekTrend !== 0 && (
                <span className={`text-xs font-bold flex items-center ${weekTrend > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {weekTrend > 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                  {Math.abs(weekTrend)}%
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-emerald-600/60 dark:text-emerald-400/60 uppercase tracking-wider mt-1">
              Last 7 Days
            </p>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-100 dark:border-amber-900/30">
            <p className="text-2xl font-black text-amber-700 dark:text-amber-400">
              {data.clicks_last_30_days}
            </p>
            <p className="text-xs font-bold text-amber-600/60 dark:text-amber-400/60 uppercase tracking-wider mt-1">
              Last 30 Days
            </p>
          </div>
        </div>

        {/* Sparkline Chart */}
        {sparklineData.some((v) => v > 0) && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground">30-Day Trend</p>
              <p className="text-xs text-muted-foreground">
                Avg: {(data.clicks_last_30_days / 30).toFixed(1)}/day
              </p>
            </div>
            <div className="bg-muted/10 rounded-lg p-2 border border-muted/20">
              <MiniSparkline data={sparklineData} color="#6366f1" />
            </div>
          </div>
        )}

        {/* Source Breakdown */}
        {data.clicks_by_source.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
              Traffic Sources
            </p>
            <div className="space-y-2">
              {data.clicks_by_source.map((src) => {
                const info = SOURCE_LABELS[src.source] || SOURCE_LABELS.unknown;
                const Icon = info.icon;
                const pct = data.total_clicks > 0 ? (src.clicks / data.total_clicks) * 100 : 0;
                return (
                  <div key={src.source} className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{info.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {src.clicks} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
