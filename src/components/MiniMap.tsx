import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Navigation, Crosshair, Star } from "lucide-react";

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
  onViewportChange,
}: MiniMapProps) => {
  const isMobile = useIsMobile();
  const mapRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Optimized sizing - smaller on mobile for performance
  const miniMapSize = isMobile ? 80 : 160;

  // Memoize scale calculations
  const { scale, scaledWidth, scaledHeight } = useMemo(() => {
    const scaleX = miniMapSize / gridWidth;
    const scaleY = miniMapSize / gridHeight;
    const scale = Math.min(scaleX, scaleY);

    return {
      scale,
      scaledWidth: Math.floor(gridWidth * scale),
      scaledHeight: Math.floor(gridHeight * scale),
    };
  }, [miniMapSize, gridWidth, gridHeight]);

  // Calculate Zones & Billboard
  const mapOverlayData = useMemo(() => {
    const centerX = Math.floor(gridWidth / 2);
    const centerY = Math.floor(gridHeight / 2);
    
    // Radii matching the main grid logic
    const premiumRadius = Math.floor(gridWidth * 0.15);
    const standardRadius = Math.floor(gridWidth * 0.30);
    
    // Billboard Dimensions (60x34 from config)
    const billboardW = 60;
    const billboardH = 34;

    return {
      premium: {
        left: Math.floor((centerX - premiumRadius) * scale),
        top: Math.floor((centerY - premiumRadius) * scale),
        size: Math.floor(premiumRadius * 2 * scale),
      },
      standard: {
        left: Math.floor((centerX - standardRadius) * scale),
        top: Math.floor((centerY - standardRadius) * scale),
        size: Math.floor(standardRadius * 2 * scale),
      },
      billboard: {
        left: Math.floor((centerX - billboardW / 2) * scale),
        top: Math.floor((centerY - billboardH / 2) * scale),
        width: Math.floor(billboardW * scale),
        height: Math.floor(billboardH * scale),
      }
    };
  }, [gridWidth, gridHeight, scale]);

  // Memoize viewport indicator
  const viewportIndicator = useMemo(() => {
    // Invert the offset because viewportOffset moves the content, not the camera
    const viewportX = -viewportOffset.x / zoom;
    const viewportY = -viewportOffset.y / zoom;
    const viewportW = containerWidth / zoom;
    const viewportH = containerHeight / zoom;

    const width = Math.max(4, Math.min(scaledWidth, Math.floor(viewportW * scale)));
    const height = Math.max(4, Math.min(scaledHeight, Math.floor(viewportH * scale)));
    const x = Math.max(0, Math.min(scaledWidth - width, Math.floor(viewportX * scale)));
    const y = Math.max(0, Math.min(scaledHeight - height, Math.floor(viewportY * scale)));

    return { x, y, width, height };
  }, [scale, zoom, containerWidth, containerHeight, viewportOffset, scaledWidth, scaledHeight]);

  // --- Interaction Logic (Click & Drag) ---

  const handleMoveTo = useCallback(
    (clientX: number, clientY: number) => {
      if (!mapRef.current) return;
      const rect = mapRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;

      // Convert mini-map coordinates to grid coordinates
      const gridX = clickX / scale;
      const gridY = clickY / scale;

      // Center the viewport on this point
      // Formula: -1 * (TargetGridX * Zoom) + (ScreenHalfWidth)
      const newOffsetX = -(gridX * zoom) + containerWidth / 2;
      const newOffsetY = -(gridY * zoom) + containerHeight / 2;

      onViewportChange({ x: newOffsetX, y: newOffsetY });
    },
    [scale, zoom, containerWidth, containerHeight, onViewportChange]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleMoveTo(e.clientX, e.clientY);
  };

  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        handleMoveTo(e.clientX, e.clientY);
      }
    };

    const handleGlobalUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleGlobalMove);
      window.addEventListener("mouseup", handleGlobalUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleGlobalMove);
      window.removeEventListener("mouseup", handleGlobalUp);
    };
  }, [isDragging, handleMoveTo]);

  return (
    <div
      className={cn(
        "absolute bg-background/95 border border-border/80 rounded-xl shadow-2xl z-40 transition-all duration-300 hover:shadow-primary/10 hover:border-primary/40",
        isMobile ? "bottom-20 right-2 p-1.5" : "bottom-6 right-6 p-3"
      )}
      style={{
        ...(isMobile ? {} : { backdropFilter: "blur(12px)" }),
      }}
    >
      {/* Header - desktop only */}
      {!isMobile && (
        <div className="flex items-center justify-between gap-2 mb-2 px-1">
          <div className="flex items-center gap-1.5">
            <Navigation className="w-3 h-3 text-primary" />
            <span className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">
              Map
            </span>
          </div>
          <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 rounded">
            {gridWidth}x{gridHeight}
          </span>
        </div>
      )}

      {/* Map Container */}
      <div
        ref={mapRef}
        className={cn(
            "relative border border-border/60 rounded bg-muted overflow-hidden cursor-crosshair",
            isDragging ? "cursor-grabbing" : "cursor-crosshair"
        )}
        style={{
          width: scaledWidth,
          height: scaledHeight,
          willChange: "transform",
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Grid Pattern */}
        {!isMobile && (
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px),
                linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)
              `,
              backgroundSize: `${Math.max(10, scale * 20)}px ${Math.max(10, scale * 20)}px`,
            }}
          />
        )}

        {/* --- ZONES --- */}

        {/* Standard Zone (Blue Ring) */}
        <div
          className="absolute rounded-full border border-blue-500/30 pointer-events-none"
          style={{
            left: mapOverlayData.standard.left,
            top: mapOverlayData.standard.top,
            width: mapOverlayData.standard.size,
            height: mapOverlayData.standard.size,
            backgroundColor: "hsl(var(--primary) / 0.05)",
          }}
        />

        {/* Premium Zone (Gold Ring) */}
        <div
          className="absolute rounded-full border border-yellow-500/40 pointer-events-none"
          style={{
            left: mapOverlayData.premium.left,
            top: mapOverlayData.premium.top,
            width: mapOverlayData.premium.size,
            height: mapOverlayData.premium.size,
            backgroundColor: "hsl(48 96% 53% / 0.1)",
          }}
        />

        {/* Billboard (Center Rect) */}
        <div 
            className="absolute bg-black border border-yellow-500/60 pointer-events-none flex items-center justify-center"
            style={{
                left: mapOverlayData.billboard.left,
                top: mapOverlayData.billboard.top,
                width: mapOverlayData.billboard.width,
                height: mapOverlayData.billboard.height,
            }}
        >
            {!isMobile && <div className="w-1 h-1 bg-yellow-500 rounded-full" />}
        </div>


        {/* --- VIEWPORT INDICATOR --- */}
        <div
          className={cn(
            "absolute border-2 border-primary bg-primary/10 pointer-events-none rounded-sm transition-opacity",
            isDragging ? "opacity-100 bg-primary/20" : "opacity-80"
          )}
          style={{
            left: viewportIndicator.x,
            top: viewportIndicator.y,
            width: viewportIndicator.width,
            height: viewportIndicator.height,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.4)", // Dim everything outside viewport
          }}
        >
            {/* Center Crosshair */}
            {!isMobile && viewportIndicator.width > 15 && (
                 <div className="absolute inset-0 flex items-center justify-center opacity-50">
                    <Crosshair className="w-3 h-3 text-primary" />
                 </div>
            )}
        </div>
      </div>

      {/* Footer Info */}
      <div
        className={cn(
          "flex items-center justify-between border-t border-border/50",
          isMobile ? "text-[9px] mt-1 pt-1" : "text-[10px] mt-2 pt-2"
        )}
      >
        <div className="flex items-center gap-1 text-muted-foreground">
            {!isMobile && <span>ZOOM</span>}
        </div>
        <span className="text-foreground font-bold tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
      </div>
    </div>
  );
};