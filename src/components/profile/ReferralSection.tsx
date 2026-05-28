import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Gift,
  Copy,
  Check,
  Users,
  DollarSign,
  ArrowUpRight,
  Share2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ReferralData {
  referral_code: string;
  referral_url: string;
  total_referrals: number;
  converted_referrals: number;
  total_credits: number;
  pending_referrals: number;
}

export const ReferralSection = () => {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchReferral = async () => {
      try {
        const { data: result, error } = await supabase.rpc('get_or_create_referral_code');
        if (error) throw error;
        setData(result as unknown as ReferralData);
      } catch (err) {
        console.error('Referral data fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReferral();
  }, []);

  const handleCopy = useCallback(() => {
    if (!data) return;
    navigator.clipboard.writeText(data.referral_url);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  }, [data]);

  const handleShare = useCallback(() => {
    if (!data) return;

    if (navigator.share) {
      navigator.share({
        title: 'Join BuyASpot',
        text: 'Own a piece of internet history! Buy pixels on India\'s pixel marketplace.',
        url: data.referral_url,
      }).catch(() => {});
    } else {
      handleCopy();
    }
  }, [data, handleCopy]);

  if (loading) {
    return (
      <Card className="shadow-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700/50">
        <CardContent className="p-6">
          <Skeleton className="h-6 w-40 mb-4" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="shadow-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700/50 overflow-hidden">
      {/* Gradient accent */}
      <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500" />

      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-sm">
            <Gift className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Invite & Earn</h3>
            <p className="text-xs text-muted-foreground">
              Earn ₹50 credit for every friend who buys pixels
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="p-3 rounded-xl bg-muted/20 text-center">
            <Users className="w-4 h-4 mx-auto text-purple-500 mb-1" />
            <p className="text-xl font-black">{data.total_referrals}</p>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
              Invited
            </p>
          </div>
          <div className="p-3 rounded-xl bg-muted/20 text-center">
            <ArrowUpRight className="w-4 h-4 mx-auto text-emerald-500 mb-1" />
            <p className="text-xl font-black">{data.converted_referrals}</p>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
              Converted
            </p>
          </div>
          <div className="p-3 rounded-xl bg-muted/20 text-center">
            <DollarSign className="w-4 h-4 mx-auto text-amber-500 mb-1" />
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              ₹{data.total_credits}
            </p>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
              Credits
            </p>
          </div>
        </div>

        {/* Referral Link */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Your Referral Link
          </label>
          <div className="flex items-center gap-2 p-1.5 bg-muted/30 border rounded-xl">
            <Input
              value={data.referral_url}
              readOnly
              className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0 font-mono text-xs px-3 text-muted-foreground"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button
              size="sm"
              className="shrink-0 h-9 px-3 rounded-lg gap-1.5"
              onClick={handleCopy}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 h-9 px-3 rounded-lg gap-1.5"
              onClick={handleShare}
            >
              <Share2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Referral Code Badge */}
        <div className="flex items-center justify-center mt-4">
          <Badge variant="secondary" className="text-xs font-mono tracking-wider px-4 py-1.5">
            Code: {data.referral_code}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};
