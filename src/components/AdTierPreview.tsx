import React, { useState, useEffect } from 'react';
import { AD_TIER_CONFIG, AdTierType, getAdTierByPrice } from '@/utils/gridConstants';
import { Crown, Sparkles, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface AdTierPreviewProps {
  totalPrice: number;
  pixelCount: number;
  perPixelPrice?: number;
  showAnimation?: boolean;
  imageUrl?: string | null;
}

export const AdTierPreview: React.FC<AdTierPreviewProps> = ({ 
  totalPrice, 
  pixelCount,
  perPixelPrice,
  showAnimation = true,
  imageUrl
}) => {
  // Use per-pixel price if provided, otherwise determine from average
  const effectivePrice = perPixelPrice ?? (pixelCount > 0 ? Math.round(totalPrice / pixelCount) : 99);
  const tier = getAdTierByPrice(effectivePrice);
  const tierConfig = AD_TIER_CONFIG[tier];
  const [adCountdown, setAdCountdown] = useState(tierConfig.adDuration);
  const [isPlayingAd, setIsPlayingAd] = useState(false);
  const [prePlayCountdown, setPrePlayCountdown] = useState(2);

  useEffect(() => {
    if (!showAnimation) return;

    // Reset states
    setPrePlayCountdown(2);
    setIsPlayingAd(false);
    setAdCountdown(tierConfig.adDuration);

    // Pre-play countdown (ticks every 1s for 2 seconds)
    const prePlayInterval = setInterval(() => {
      setPrePlayCountdown(prev => {
        if (prev <= 1) {
          clearInterval(prePlayInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Start ad after 2s delay
    const timer = setTimeout(() => {
      setIsPlayingAd(true);
      const interval = setInterval(() => {
        setAdCountdown((prev) => {
          if (prev <= 1) {
            setIsPlayingAd(false);
            setAdCountdown(tierConfig.adDuration);
            setPrePlayCountdown(2);
            clearInterval(interval);
            return tierConfig.adDuration;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }, 2000);

    return () => {
      clearTimeout(timer);
      clearInterval(prePlayInterval);
    };
  }, [showAnimation, tierConfig.adDuration]);

  const iconProps = { className: 'w-5 h-5' };
  const IconComponent = 
    tier === 'GOLD' ? Crown : tier === 'PREMIUM' ? Sparkles : Zap;

  const colorClasses = {
    emerald: 'from-emerald-500 to-emerald-600 ring-emerald-500/20',
    violet: 'from-violet-500 to-violet-600 ring-violet-500/20',
    amber: 'from-amber-500 to-amber-600 ring-amber-500/20',
  };

  const colorClass = colorClasses[tierConfig.color as keyof typeof colorClasses];

  return (
    <Card className="border border-border/50 overflow-hidden bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm">
      <CardContent className="p-0">
        {/* Tier Header */}
        <div className={`bg-gradient-to-r ${colorClass} px-6 py-4 text-white`}>
          <div className="flex items-center gap-3 mb-2">
            <IconComponent className="w-6 h-6" />
            <div>
              <h3 className="font-bold text-lg">{tier} Tier</h3>
              <p className="text-sm opacity-90">₹{tierConfig.price.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Tier Details */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Coverage
              </p>
              <p className="text-sm font-medium">
                {tierConfig.depthRows === 0 ? (
                  <span className="text-primary">Inner Core</span>
                ) : (
                  <span>{tierConfig.depthRows} Rows from Edge</span>
                )}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Ad Duration
              </p>
              <p className="text-sm font-medium text-primary">
                {tierConfig.adDuration}s per cycle
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Pixels Selected
            </p>
            <p className="text-2xl font-bold text-foreground">{pixelCount}</p>
          </div>

          {/* Ad Preview Animation */}
          {showAnimation && (
            <div className="mt-4 pt-4 border-t border-border/40">
              <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                Ad Preview
              </p>
              <div className={`relative rounded-lg overflow-hidden h-32 flex items-center justify-center transition-all duration-300 ${
                isPlayingAd ? 'ring-4 ring-offset-2 ring-primary' : 'ring-0'
              } ${imageUrl ? 'bg-black' : `bg-gradient-to-br ${colorClass}`}`}>
                {imageUrl && isPlayingAd ? (
                  <div className="relative w-full h-full">
                    <img 
                      src={imageUrl} 
                      alt="Ad Preview" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="text-white text-center">
                        <div className="text-3xl font-bold tabular-nums">
                          {adCountdown}s
                        </div>
                        <p className="text-xs opacity-90 font-medium">Ad Running</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-white text-center">
                    {isPlayingAd && !imageUrl ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="text-3xl font-bold tabular-nums">
                          {adCountdown}s
                        </div>
                        <p className="text-xs opacity-75 font-medium">Ad Running</p>
                      </div>
                    ) : (
                      <p className="text-sm font-medium opacity-75">
                        Playing in {prePlayCountdown}s...
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tier Description */}
          <p className="text-xs text-muted-foreground pt-2 italic">
            {tierConfig.description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
