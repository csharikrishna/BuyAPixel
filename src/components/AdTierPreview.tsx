import React, { useEffect, useMemo, useRef, useState } from "react";
import { Crown, Sparkles, Zap } from "lucide-react";

import {
  AD_TIER_CONFIG,
  getAdTierByPrice,
} from "@/utils/gridConstants";

import { Card, CardContent } from "@/components/ui/card";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface AdTierPreviewProps {
  totalPrice: number;
  pixelCount: number;
  perPixelPrice?: number;
  showAnimation?: boolean;
  imageUrl?: string | null;
}

type PreviewPhase = "countdown" | "playing";

// ─── Constants ──────────────────────────────────────────────────────────────────

const PREVIEW_DELAY = 2;

const TIER_COLORS = {
  emerald: "from-emerald-500 to-emerald-600 ring-emerald-500/20",
  violet: "from-violet-500 to-violet-600 ring-violet-500/20",
  amber: "from-amber-500 to-amber-600 ring-amber-500/20",
} as const;

// ─── Custom Hook ────────────────────────────────────────────────────────────────

function useAdPreview(enabled: boolean, duration: number) {
  const [phase, setPhase] = useState<PreviewPhase>("countdown");
  const [counter, setCounter] = useState(PREVIEW_DELAY);
  const phaseRef = useRef<PreviewPhase>("countdown");

  // Keep phaseRef in sync
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (!enabled) return;

    // Reset on mount / dependency change
    setPhase("countdown");
    setCounter(PREVIEW_DELAY);
    phaseRef.current = "countdown";

    const interval = setInterval(() => {
      setCounter((prev) => {
        if (phaseRef.current === "countdown") {
          if (prev <= 1) {
            setPhase("playing");
            phaseRef.current = "playing";
            return duration;
          }
          return prev - 1;
        }

        // playing phase
        if (prev <= 1) {
          setPhase("countdown");
          phaseRef.current = "countdown";
          return PREVIEW_DELAY;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled, duration]);

  return { phase, counter, isPlaying: phase === "playing" };
}

// ─── Preview Content Sub-Component ──────────────────────────────────────────────

function PreviewContent({
  imageUrl,
  isPlaying,
  counter,
}: {
  imageUrl?: string | null;
  isPlaying: boolean;
  counter: number;
}) {
  const overlay = !isPlaying ? (
    <div className="absolute inset-0 bg-black/70 transition-all duration-500 flex items-center justify-center">
       <p className="text-white/70 font-medium text-sm">Standby</p>
    </div>
  ) : null;

  if (!imageUrl) {
    return (
      <div className="relative h-full w-full bg-black/80 flex flex-col items-center justify-center text-muted-foreground text-sm">
         <div className="opacity-50 mb-2">
            <svg className="w-8 h-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
         </div>
         No Image Uploaded
         {overlay}
      </div>
    );
  }

  return (
    <>
      <img
        src={imageUrl}
        alt="Advertisement preview"
        className="h-full w-full object-contain"
      />
      {overlay}
    </>
  );
}

// ─── Info Sub-Component ─────────────────────────────────────────────────────────

function InfoItem({
  label,
  value,
  large,
}: {
  label: string;
  value: React.ReactNode;
  large?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className={large ? "text-2xl font-bold" : "text-sm font-medium"}>
        {value}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function AdTierPreview({
  totalPrice,
  pixelCount,
  perPixelPrice,
  showAnimation = true,
  imageUrl,
}: AdTierPreviewProps) {
  const effectivePrice = useMemo(() => {
    if (perPixelPrice) return perPixelPrice;
    return pixelCount > 0 ? Math.round(totalPrice / pixelCount) : 99;
  }, [perPixelPrice, totalPrice, pixelCount]);

  const tier = useMemo(
    () => getAdTierByPrice(effectivePrice),
    [effectivePrice]
  );

  const config = AD_TIER_CONFIG[tier];

  const { counter, isPlaying } = useAdPreview(showAnimation, config.adDuration);

  const Icon =
    tier === "GOLD" ? Crown : tier === "PREMIUM" ? Sparkles : Zap;

  const color =
    TIER_COLORS[config.color as keyof typeof TIER_COLORS];

  return (
    <Card className="overflow-hidden border border-border/50 bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm">
      <CardContent className="p-0">
        {/* Tier Header */}
        <header className={`bg-gradient-to-r ${color} px-6 py-4 text-white`}>
          <div className="flex items-center gap-3">
            <Icon className="h-6 w-6" />
            <div>
              <h3 className="text-lg font-bold">{tier} Tier</h3>
              <p className="text-sm opacity-90">
                ₹{config.price.toLocaleString()} per pixel
              </p>
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="space-y-5 p-6">
          <div className="grid grid-cols-2 gap-4">
            <InfoItem
              label="Coverage"
              value={
                config.depthRows === 0
                  ? "Inner Core"
                  : `${config.depthRows} Rows from Edge`
              }
            />
            <InfoItem
              label="Ad Duration"
              value={`${config.adDuration}s per cycle`}
            />
          </div>

          <InfoItem
            label="Pixels Selected"
            value={pixelCount.toLocaleString()}
            large
          />

          {/* Ad Preview Animation — mirrors the billboard (40×24 = 5:3) */}
          {showAnimation && (
            <section className="pt-4 border-t border-border/40">
              <div className="flex items-center justify-between mb-3">
                 <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                   Ad Preview
                 </p>
                 <div className="text-sm font-medium tabular-nums flex items-center gap-2">
                   {isPlaying ? (
                      <>
                         <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                         </span>
                         <span className="text-green-600 dark:text-green-400">Running: {counter}s</span>
                      </>
                   ) : (
                      <span className="text-muted-foreground">Playing in {counter}s…</span>
                   )}
                 </div>
              </div>
              {/* Billboard replica: 5:3 aspect ratio, dark bg, gold border */}
              <div
                className={`
                  relative overflow-hidden rounded-md
                  transition-all duration-300
                  ${isPlaying ? "ring-4 ring-primary ring-offset-2" : "ring-0"}
                `}
                style={{
                  aspectRatio: "40 / 24",
                  backgroundColor: "#18181b",
                  border: "3px solid #eab308",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                }}
              >
                <PreviewContent
                  imageUrl={imageUrl}
                  isPlaying={isPlaying}
                  counter={counter}
                />
              </div>
            </section>
          )}

          {/* Tier Description */}
          <p className="text-xs italic text-muted-foreground">
            {config.description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Keep backward-compatible named export
export { AdTierPreview as default };
