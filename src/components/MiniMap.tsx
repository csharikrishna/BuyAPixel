import { useCallback, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Maximize2, Navigation, Crosshair } from "lucide-react";

interface MiniMapProps {
  gridWidth: number;
  gridHeight: number;
  viewportOffset: { x: number; y: number };
  zoom: number;
  containerWidth: number;
  containerHeight: number;
  onViewportChange: (offset: { x: number; y: number }) => void;
}

export const MiniMap = ({
  gridWidth,
  gridHeight,
  viewportOffset,
  zoom,
  containerWidth,
  containerHeight,
  onViewportChange
}: MiniMapProps) => {
  const isMobile = useIsMobile();
  
  // Optimized sizing - smaller on mobile for performance
  const miniMapSize = isMobile ? 80 : 160;
  
  // Memoize scale calculations for performance
  const { scale, scaledWidth, scaledHeight } = useMemo(() => {
    const scaleX = miniMapSize / gridWidth;
    const scaleY = miniMapSize / gridHeight;
    const scale = Math.min(scaleX, scaleY);
    
    return {
      scale,
      scaledWidth: Math.floor(gridWidth * scale),  // Integer coordinates to avoid sub-pixel rendering
      scaledHeight: Math.floor(gridHeight * scale)
    };
  }, [miniMapSize, gridWidth, gridHeight]);

  // Calculate pricing zones based on actual grid pricing logic (from PixelGrid.tsx)
  // gridSize = 224, center pricing zones:
  // Premium (₹299): radius < 15% of gridSize = 33.6px
  // Standard (₹199): radius < 30% of gridSize = 67.2px  
  // Economy (₹99): radius >= 30%
  const pricingZones = useMemo(() => {
    const centerX = Math.floor(gridWidth / 2);
    const centerY = Math.floor(gridHeight / 2);
    const premiumRadius = Math.floor(gridWidth * 0.15);  // 33.6px for 224 grid
    const standardRadius = Math.floor(gridWidth * 0.30);  // 67.2px for 224 grid
    
    return {
      premium: {
        left: Math.floor((centerX - premiumRadius) * scale),
        top: Math.floor((centerY - premiumRadius) * scale),
        size: Math.floor(premiumRadius * 2 * scale)
      },
      standard: {
        left: Math.floor((centerX - standardRadius) * scale),
        top: Math.floor((centerY - standardRadius) * scale),
        size: Math.floor(standardRadius * 2 * scale)
      }
    };
  }, [gridWidth, gridHeight, scale]);

  // Memoize viewport indicator calculations
  const viewportIndicator = useMemo(() => {
    const viewportWidth = containerWidth / zoom;
    const viewportHeight = containerHeight / zoom;
    const viewportX = -viewportOffset.x / zoom;
    const viewportY = -viewportOffset.y / zoom;

    const width = Math.max(3, Math.min(scaledWidth, Math.floor(viewportWidth * scale)));
    const height = Math.max(3, Math.min(scaledHeight, Math.floor(viewportHeight * scale)));
    const x = Math.max(0, Math.min(scaledWidth - width, Math.floor(viewportX * scale)));
    const y = Math.max(0, Math.min(scaledHeight - height, Math.floor(viewportY * scale)));

    return { x, y, width, height };
  }, [scale, zoom, containerWidth, containerHeight, viewportOffset, scaledWidth, scaledHeight]);

  const handleMiniMapClick = useCallback((event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = Math.floor(event.clientX - rect.left);
    const clickY = Math.floor(event.clientY - rect.top);

    // Convert mini-map coordinates to grid coordinates (using integers)
    const gridX = Math.floor(clickX / scale);
    const gridY = Math.floor(clickY / scale);

    // Calculate new viewport offset to center the clicked point
    const newOffsetX = Math.floor(-(gridX * zoom) + containerWidth / 2);
    const newOffsetY = Math.floor(-(gridY * zoom) + containerHeight / 2);

    onViewportChange({ x: newOffsetX, y: newOffsetY });
  }, [scale, zoom, containerWidth, containerHeight, onViewportChange]);

  return (
    <div 
      className={cn(
        "absolute bg-background/95 border border-border/80 rounded-lg shadow-xl z-30 transition-all hover:shadow-2xl hover:border-primary/40",
        isMobile 
          ? "bottom-20 right-2 p-1.5" 
          : "bottom-6 right-6 p-3"
      )}
      style={{
        // Optimize rendering on mobile - avoid backdrop-filter for better performance
        ...(isMobile ? {} : { backdropFilter: 'blur(8px)' })
      }}
    >
      {/* Header - desktop only */}
      {!isMobile && (
        <div className="flex items-center justify-center gap-1.5 mb-2 text-xs">
          <Navigation className="w-3 h-3 text-primary" />
          <span className="font-semibold text-foreground">Mini Map</span>
        </div>
      )}
      
      {/* Map Container */}
      <div 
        className="relative border-2 border-border/60 rounded cursor-pointer hover:border-primary/60 transition-colors shadow-inner overflow-hidden group"
        style={{ 
          width: scaledWidth, 
          height: scaledHeight,
          backgroundColor: 'hsl(var(--muted))',
          // Force GPU acceleration for smoother interactions
          willChange: 'transform'
        }}
        onClick={handleMiniMapClick}
      >
        {/* Subtle grid pattern - desktop only for performance */}
        {!isMobile && (
          <div 
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
                linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
              `,
              backgroundSize: `${Math.max(10, scale * 20)}px ${Math.max(10, scale * 20)}px`
            }}
          />
        )}

        {/* Standard Pricing Zone (₹199) - Blue */}
        <div 
          className="absolute rounded-sm border-2 border-blue-500/40 pointer-events-none"
          style={{
            left: pricingZones.standard.left,
            top: pricingZones.standard.top,
            width: pricingZones.standard.size,
            height: pricingZones.standard.size,
            backgroundColor: 'hsl(var(--primary) / 0.08)',
            ...(isMobile ? {} : { boxShadow: '0 0 12px hsl(217 91% 60% / 0.2)' })
          }}
        />

        {/* Premium Pricing Zone (₹299) - Yellow/Gold */}
        <div 
          className="absolute rounded-sm border-2 border-yellow-500/50 pointer-events-none"
          style={{
            left: pricingZones.premium.left,
            top: pricingZones.premium.top,
            width: pricingZones.premium.size,
            height: pricingZones.premium.size,
            backgroundColor: 'hsl(48 96% 53% / 0.12)',
            ...(isMobile ? {} : { boxShadow: '0 0 16px hsl(48 96% 53% / 0.25)' })
          }}
        />

        {/* Viewport Indicator - Shows current view */}
        <div 
          className="absolute border-2 border-primary bg-primary/20 pointer-events-none rounded-sm transition-all duration-200"
          style={{
            left: viewportIndicator.x,
            top: viewportIndicator.y,
            width: viewportIndicator.width,
            height: viewportIndicator.height,
            boxShadow: '0 0 12px hsl(var(--primary) / 0.6), inset 0 0 8px hsl(var(--primary) / 0.3)'
          }}
        >
          {/* Crosshair indicator - desktop only */}
          {!isMobile && viewportIndicator.width > 20 && viewportIndicator.height > 20 && (
            <div className="absolute inset-0 flex items-center justify-center opacity-70">
              <Crosshair className="w-3 h-3 text-primary" strokeWidth={2.5} />
            </div>
          )}
        </div>

        {/* Hover overlay effect */}
        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
      </div>

      {/* Footer with zoom info */}
      <div className={cn(
        "flex items-center border-t border-border/50",
        isMobile 
          ? "text-[10px] mt-1 pt-1 justify-center gap-1" 
          : "text-xs mt-2 pt-2 justify-between gap-2"
      )}>
        {!isMobile && <span className="text-muted-foreground font-medium">Zoom</span>}
        <span className="text-primary font-bold tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
      </div>
      
      {/* Instruction text - desktop only */}
      {!isMobile && (
        <div className="text-[10px] text-center text-muted-foreground/70 mt-1 font-medium">
          Click to navigate
        </div>
      )}
    </div>
  );
};
