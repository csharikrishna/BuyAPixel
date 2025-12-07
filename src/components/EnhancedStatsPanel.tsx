import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { 
  TrendingUp, 
  Users, 
  Eye, 
  Crown, 
  Target, 
  Sparkles,
  Timer,
  DollarSign,
  Award,
  Flame,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface EnhancedStatsPanelProps {
  selectedPixelsCount: number;
}

export const EnhancedStatsPanel = ({ selectedPixelsCount }: EnhancedStatsPanelProps) => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalPixels: 0,
    pixelsSold: 0,
    pixelsAvailable: 0,
    uniqueOwners: 0,
    userPixels: 0,
    averagePrice: 0,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const getStats = async () => {
    const [{ count: totalCount }, { count: soldCount }] = await Promise.all([
      supabase.from('pixels').select('id', { count: 'exact', head: true }),
      supabase.from('pixels').select('id', { count: 'exact', head: true }).not('owner_id', 'is', null),
    ]);

    let userPixels = 0;
    if (user?.id) {
      const { count: userCount } = await supabase
        .from('pixels')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id);
      userPixels = userCount || 0;
    }

    const { data: ownersData } = await supabase
      .from('pixels')
      .select('owner_id')
      .not('owner_id', 'is', null);
    const uniqueOwners = ownersData ? new Set(ownersData.map((r: any) => r.owner_id)).size : 0;

    const { data: pricesData } = await supabase
      .from('pixels')
      .select('price_paid')
      .not('owner_id', 'is', null);
    const paid = (pricesData || []).map((p: any) => Number(p.price_paid) || 0);
    const avg = paid.length ? Math.round(paid.reduce((a: number, b: number) => a + b, 0) / paid.length) : 0;

    setStats({
      totalPixels: totalCount || 0,
      pixelsSold: soldCount || 0,
      pixelsAvailable: Math.max(0, (totalCount || 0) - (soldCount || 0)),
      uniqueOwners,
      userPixels,
      averagePrice: avg,
    });
  };

  useEffect(() => {
    getStats();
  }, [user?.id]);

  const refreshStats = async () => {
    setIsRefreshing(true);
    await getStats();
    setIsRefreshing(false);
  };

  const soldPercentage = (stats.pixelsSold / stats.totalPixels) * 100;

  const getTierInfo = (tier: string) => {
    switch (tier) {
      case 'premium':
        return { icon: Crown, color: 'text-yellow-500', bgColor: 'bg-yellow-50 dark:bg-yellow-950/20' };
      case 'standard':
        return { icon: Target, color: 'text-gray-500', bgColor: 'bg-gray-50 dark:bg-gray-950/20' };
      default:
        return { icon: Sparkles, color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/20' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Stats */}
      <Card className="card-premium">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Live Stats
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshStats}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Canvas Progress</span>
              <span>{soldPercentage.toFixed(1)}% sold</span>
            </div>
            <Progress value={soldPercentage} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{stats.pixelsSold.toLocaleString()} sold</span>
              <span>{stats.pixelsAvailable.toLocaleString()} available</span>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary/10 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-primary">{stats.uniqueOwners}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Users className="w-3 h-3" />
                Owners
              </div>
            </div>
            <div className="bg-success/10 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-success">₹{stats.averagePrice}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <DollarSign className="w-3 h-3" />
                Avg Price
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Stats (if logged in) */}
      {user && (
        <Card className="card-premium border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Your Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pixels Owned</span>
              <Badge variant="default">{stats.userPixels}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current Selection</span>
              <Badge variant="outline">{selectedPixelsCount}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Portfolio Value</span>
              <span className="font-medium">₹{(stats.userPixels * stats.averagePrice).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
};