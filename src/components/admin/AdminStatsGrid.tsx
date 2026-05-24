import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, UserX, DollarSign, TrendingUp, Image } from 'lucide-react';

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  paidUsers: number;
  totalPixelsSold: number;
  totalRevenue: number;
  blockedUsers: number;
}

interface AdminStatsGridProps {
  stats: AdminStats;
}

const statCards = [
  { key: 'totalUsers', label: 'Total Users', sub: 'All registered', icon: Users, color: 'blue', format: undefined },
  { key: 'activeUsers', label: 'Active Users', sub: 'Not blocked', icon: UserCheck, color: 'green', format: undefined },
  { key: 'paidUsers', label: 'Paid Users', sub: 'Made purchases', icon: DollarSign, color: 'purple', format: 'locale' },
  { key: 'totalPixelsSold', label: 'Pixels Sold', sub: 'Total owned', icon: Image, color: 'orange', format: 'locale' },
  { key: 'totalRevenue', label: 'Total Revenue', sub: 'All-time', icon: TrendingUp, color: 'emerald', format: 'currency' },
  { key: 'blockedUsers', label: 'Blocked Users', sub: 'Access denied', icon: UserX, color: 'destructive', format: undefined },
] as const;

const colorMap: Record<string, { border: string; bg: string; iconColor: string; textColor: string }> = {
  blue: { border: 'border-blue-500/20', bg: 'bg-blue-500/10', iconColor: 'text-blue-600', textColor: '' },
  green: { border: 'border-green-500/20', bg: 'bg-green-500/10', iconColor: 'text-green-600', textColor: 'text-green-700' },
  purple: { border: 'border-purple-500/20', bg: 'bg-purple-500/10', iconColor: 'text-purple-600', textColor: 'text-purple-700' },
  orange: { border: 'border-orange-500/20', bg: 'bg-orange-500/10', iconColor: 'text-orange-600', textColor: 'text-orange-700' },
  emerald: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/10', iconColor: 'text-emerald-600', textColor: 'text-emerald-700' },
  destructive: { border: 'border-destructive/30', bg: 'bg-destructive/10', iconColor: 'text-destructive', textColor: 'text-destructive' },
};

export function AdminStatsGrid({ stats }: AdminStatsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
      {statCards.map((card) => {
        const colors = colorMap[card.color];
        const Icon = card.icon;
        const rawValue = stats[card.key] || 0;
        let displayValue: string;

        if (card.format === 'currency') {
          displayValue = `₹${rawValue.toLocaleString()}`;
        } else if (card.format === 'locale') {
          displayValue = rawValue.toLocaleString();
        } else {
          displayValue = String(rawValue);
        }

        return (
          <Card key={card.key} className={`hover:shadow-lg transition-all duration-200 ${colors.border}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
              <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${colors.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${colors.textColor}`}>{displayValue}</div>
              <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
