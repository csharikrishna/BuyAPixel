import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

export const DynamicAdShowcase = () => {
  const [currentAdIndex, setCurrentAdIndex] = useState(0);

  const { data: adsData } = useQuery({
    queryKey: ["pixel-ads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pixels")
        .select("image_url, link_url, alt_text, x, y")
        .not("image_url", "is", null)
        .not("owner_id", "is", null)
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!adsData || adsData.length === 0) return;

    const interval = setInterval(() => {
      setCurrentAdIndex((prev) => (prev + 1) % adsData.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [adsData]);

  const currentAd = adsData?.[currentAdIndex];

  return (
    <div className="relative w-full bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 rounded-2xl overflow-hidden border border-primary/20 shadow-xl">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(var(--primary-rgb),0.1),transparent_70%)] animate-pulse" />
      
      {/* Content Container */}
      <div className="relative min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] flex flex-col items-center justify-center p-6 sm:p-8 lg:p-12">
        {/* Header */}
        <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-2 bg-background/80 backdrop-blur-sm px-4 py-2 rounded-full border border-primary/20">
          <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-xs sm:text-sm font-medium text-foreground">Live Showcase</span>
        </div>

        {/* Ad Display */}
        {currentAd && currentAd.image_url ? (
          <div className="w-full max-w-4xl animate-fade-in">
            <a
              href={currentAd.link_url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <div className="relative overflow-hidden rounded-xl border-2 border-primary/30 shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:border-primary/60 hover:shadow-primary/20">
                <img
                  src={currentAd.image_url}
                  alt={currentAd.alt_text || "Pixel advertisement"}
                  className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              {currentAd.alt_text && (
                <p className="mt-4 text-center text-sm sm:text-base text-muted-foreground font-medium">
                  {currentAd.alt_text}
                </p>
              )}
            </a>
          </div>
        ) : (
          <div className="w-full max-w-4xl text-center space-y-4">
            <div className="w-full aspect-video bg-gradient-to-br from-muted/50 to-muted/20 rounded-xl border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
              <div className="space-y-2">
                <Sparkles className="w-16 h-16 mx-auto text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm sm:text-base">
                  Your ad could be here!
                </p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Purchase pixels and upload your image to showcase your brand
            </p>
          </div>
        )}

        {/* Ad Indicators */}
        {adsData && adsData.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {adsData.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentAdIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  idx === currentAdIndex
                    ? "bg-primary w-6"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
                aria-label={`View ad ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
