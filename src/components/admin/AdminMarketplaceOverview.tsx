import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Store } from 'lucide-react';

interface MarketplaceAnalytics {
  total_revenue: number;
  total_refunds: number;
  active_listings: number;
  featured_listings: number;
}

interface AdminMarketplaceOverviewProps {
  analytics: MarketplaceAnalytics | null;
}

export function AdminMarketplaceOverview({ analytics }: AdminMarketplaceOverviewProps) {
  if (!analytics) return null;

  return (
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
              ₹{analytics.total_revenue.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Active Listings</p>
            <p className="text-2xl font-bold">{analytics.active_listings}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Featured</p>
            <p className="text-2xl font-bold text-amber-600">{analytics.featured_listings}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Refunds</p>
            <p className="text-2xl font-bold text-red-600">{analytics.total_refunds}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
