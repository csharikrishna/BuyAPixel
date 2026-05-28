import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Clock, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MysteryPixel {
  id: string;
  x: number;
  y: number;
  original_price: number;
  mystery_price: number;
  expires_at: string;
}

interface MysteryPixelBannerProps {
  /** Callback to navigate/highlight the mystery pixel on the grid */
  onNavigateToPixel?: (x: number, y: number) => void;
}

export const MysteryPixelBanner = ({ onNavigateToPixel }: MysteryPixelBannerProps) => {
  const [mystery, setMystery] = useState<MysteryPixel | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const fetchMystery = async () => {
      try {
        const { data, error } = await supabase.rpc('get_active_mystery_pixel');
        if (error) throw error;
        if (data) {
          setMystery(data as unknown as MysteryPixel);
        }
      } catch (err) {
        console.error('Mystery pixel fetch failed:', err);
      }
    };

    // Check if user dismissed this session
    const dismissedId = sessionStorage.getItem('mystery_dismissed');
    fetchMystery();

    // Refresh every 5 minutes
    const interval = setInterval(fetchMystery, 300000);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!mystery) return;

    const updateTimer = () => {
      const now = Date.now();
      const expires = new Date(mystery.expires_at).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft('EXPIRED');
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);

      if (hours > 0) {
        setTimeLeft(`${hours}h ${mins}m ${secs}s`);
      } else {
        setTimeLeft(`${mins}m ${secs}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [mystery]);

  if (!mystery || dismissed || timeLeft === 'EXPIRED') return null;

  return (
    <div className="relative overflow-hidden">
      {/* Animated gradient background */}
      <div
        className="relative rounded-2xl border border-purple-500/20 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(236, 72, 153, 0.08) 50%, rgba(234, 179, 8, 0.08) 100%)',
        }}
      >
        {/* Animated shimmer */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(139, 92, 246, 0.15) 25%, rgba(236, 72, 153, 0.15) 50%, rgba(234, 179, 8, 0.15) 75%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'mysteryShimmer 3s ease-in-out infinite',
          }}
        />

        <div className="relative flex flex-col sm:flex-row items-center gap-3 sm:gap-5 px-5 py-4">
          {/* Icon */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0 animate-bounce">
            <Sparkles className="w-6 h-6 text-white" />
          </div>

          {/* Content */}
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-sm font-black text-foreground tracking-tight">
              🎰 Mystery Pixel Drop is LIVE!
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Find the glowing pixel at <span className="font-bold text-purple-600 dark:text-purple-400">({mystery.x}, {mystery.y})</span> — 
              yours for just <span className="font-black text-emerald-600 dark:text-emerald-400">₹{mystery.mystery_price}</span>{' '}
              <span className="text-muted-foreground/60">(was ₹{mystery.original_price})</span>
            </p>
          </div>

          {/* Timer + Action */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background/60 backdrop-blur-sm border border-border/50">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-bold font-mono text-foreground">{timeLeft}</span>
            </div>

            {onNavigateToPixel && (
              <Button
                size="sm"
                className="gap-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 rounded-lg shadow-md shadow-purple-500/20"
                onClick={() => onNavigateToPixel(mystery.x, mystery.y)}
              >
                <MapPin className="w-3.5 h-3.5" />
                Find It
              </Button>
            )}

            <button
              onClick={() => {
                setDismissed(true);
                sessionStorage.setItem('mystery_dismissed', mystery.id);
              }}
              className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Shimmer animation */}
      <style>{`
        @keyframes mysteryShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
};
