import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
  useMemo,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import { PixelTooltip } from "./PixelTooltip";
import { MiniMap } from "./MiniMap";
import { toast } from "sonner";
import { Star, ExternalLink, Loader2 } from "lucide-react";

import { usePixelGridData } from "@/hooks/usePixelGridData";
import { useGridInteraction } from "@/hooks/useGridInteraction";
import { GRID_CONFIG } from "@/utils/gridConstants";
import { SelectedPixel, PurchasedPixel } from "@/types/grid";

// ============================================
// 📦 PROPS
// ============================================

interface VirtualizedPixelGridProps {
  selectedPixels: SelectedPixel[];
  onSelectionChange: (pixels: SelectedPixel[]) => void;
  isSelecting: boolean;
  gridWidth: number;
  gridHeight: number;
  pixelSize: number;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  showGrid?: boolean;
  showMyPixels?: boolean;
  enableInteraction?: boolean;
}

// ============================================
// 🚀 COMPONENT
// ============================================

export const VirtualizedPixelGrid = ({
  selectedPixels,
  onSelectionChange,
  isSelecting,
  gridWidth = 150,
  gridHeight = 150,
  pixelSize = 4,
  zoom,
  onZoomChange,
  showGrid = true,
  showMyPixels = false,
  enableInteraction = true,
}: VirtualizedPixelGridProps) => {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  // -- Hooks --
  const {
    purchasedPixels,
    isLoading,
    error,
    spatialIndex
  } = usePixelGridData();

  const {
    viewportOffset,
    setViewportOffset,
    containerSize,
    isDragging,
    dragDistance,
    hoveredPixel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  } = useGridInteraction({
    gridWidth,
    gridHeight,
    pixelSize,
    containerRef,
    zoom,
    onZoomChange,
    enableInteraction,
  });

  // -- Component Local State (specific to rendering/billing) --
  const [isMobile, setIsMobile] = useState(false);
  const [currentFeaturedIndex, setCurrentFeaturedIndex] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [rangeStart, setRangeStart] = useState<{ x: number; y: number } | null>(null);

  // ---------------------------------------------------------------------------
  // 📏 Memoized Calculations
  // ---------------------------------------------------------------------------

  const scaledPixelSize = useMemo(() => pixelSize * zoom, [pixelSize, zoom]);

  const billboardConfig = useMemo(() => {
    const width = GRID_CONFIG.BILLBOARD_WIDTH;
    const height = GRID_CONFIG.BILLBOARD_HEIGHT;
    const x = Math.floor((gridWidth - width) / 2);
    const y = Math.floor((gridHeight - height) / 2);
    return { x, y, width, height };
  }, [gridWidth, gridHeight]);

  const selectedPixelsSet = useMemo(() => {
    const set = new Set<string>();
    selectedPixels.forEach((pixel) => set.add(pixel.id));
    return set;
  }, [selectedPixels]);

  const featuredPixelsList = useMemo(
    () => purchasedPixels.filter((p) => p.image_url && p.image_url.length > 0),
    [purchasedPixels]
  );

  const currentFeaturedPixel = featuredPixelsList[currentFeaturedIndex] ?? null;

  // ---------------------------------------------------------------------------
  // 🔄 Pixel Logic
  // ---------------------------------------------------------------------------

  const calculatePixelPrice = useCallback(
    (x: number, y: number) => {
      const centerX = gridWidth / 2.0;
      const centerY = gridHeight / 2.0;

      // Box-based pricing (Square zones)
      const dx = Math.abs(x - centerX);
      const dy = Math.abs(y - centerY);
      const maxDist = Math.max(dx, dy);

      // Gold Zone (60x60) -> Radius 30
      if (maxDist < 30) return 299;

      // Premium Zone (120x120) -> Radius 60
      if (maxDist < 60) return 199;

      return 99;
    },
    [gridWidth, gridHeight]
  );

  const getPixelStatus = useCallback(
    (x: number, y: number) => {
      // Check billboard area first (most common check)
      if (
        x >= billboardConfig.x &&
        x < billboardConfig.x + billboardConfig.width &&
        y >= billboardConfig.y &&
        y < billboardConfig.y + billboardConfig.height
      ) {
        return "restricted";
      }

      // Use spatial index for O(1) lookup
      const purchased = spatialIndex.get(x, y);
      if (purchased) {
        return purchased.owner_id === user?.id ? "yours" : "sold";
      }

      return selectedPixelsSet.has(`${x}-${y}`) ? "selected" : "available";
    },
    [billboardConfig, selectedPixelsSet, user?.id, spatialIndex]
  );

  const handlePixelClick = useCallback(
    (x: number, y: number, event: React.MouseEvent | React.TouchEvent) => {
      if (!isSelecting) return;

      const status = getPixelStatus(x, y);

      if (status === "restricted") {
        toast.info("Featured Billboard Area", {
          description: "Reserved for featured community pixels.",
          icon: <Star className="w-4 h-4 text-yellow-500" />,
        });
        return;
      }
      if (status === "sold") {
        toast.error("This pixel is already owned!");
        return;
      }

      const price = calculatePixelPrice(x, y);
      const pixelId = `${x}-${y}`;

      // Range Selection (Shift + Click)
      if ("shiftKey" in event && (event as React.MouseEvent).shiftKey && rangeStart) {
        const startX = Math.min(rangeStart.x, x);
        const endX = Math.max(rangeStart.x, x);
        const startY = Math.min(rangeStart.y, y);
        const endY = Math.max(rangeStart.y, y);
        const area = (endX - startX + 1) * (endY - startY + 1);

        if (area > GRID_CONFIG.MAX_SELECTION_AREA) {
          toast.error(`Selection too large! Max ${GRID_CONFIG.MAX_SELECTION_AREA} pixels.`);
          return;
        }

        const newPixels: SelectedPixel[] = [];
        for (let px = startX; px <= endX; px++) {
          for (let py = startY; py <= endY; py++) {
            const s = getPixelStatus(px, py);
            if (s === "available") {
              newPixels.push({
                x: px,
                y: py,
                price: calculatePixelPrice(px, py),
                id: `${px}-${py}`,
              });
            }
          }
        }

        const existingPixelIds = new Set(selectedPixels.map((p) => p.id));
        const uniqueNewPixels = newPixels.filter((p) => !existingPixelIds.has(p.id));

        onSelectionChange([...selectedPixels, ...uniqueNewPixels]);
        toast.success(`Selected ${uniqueNewPixels.length} pixels`);
        setRangeStart(null);
      } else {
        const existingIndex = selectedPixels.findIndex((p) => p.id === pixelId);
        if (existingIndex >= 0) {
          onSelectionChange(selectedPixels.filter((_, index) => index !== existingIndex));
        } else {
          onSelectionChange([...selectedPixels, { x, y, price, id: pixelId }]);
        }
        setRangeStart({ x, y });
      }
    },
    [
      isSelecting,
      getPixelStatus,
      calculatePixelPrice,
      selectedPixels,
      onSelectionChange,
      rangeStart,
    ]
  );

  const handleContainerClick = useCallback(
    (event: React.MouseEvent) => {
      // If we dragged significantly, don't treat it as a click
      if (dragDistance > GRID_CONFIG.DRAG_THRESHOLD) return;
      if (!isSelecting) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const relativeX = event.clientX - rect.left - viewportOffset.x;
      const relativeY = event.clientY - rect.top - viewportOffset.y;
      const pixelX = Math.floor(relativeX / scaledPixelSize);
      const pixelY = Math.floor(relativeY / scaledPixelSize);

      if (pixelX >= 0 && pixelX < gridWidth && pixelY >= 0 && pixelY < gridHeight) {
        handlePixelClick(pixelX, pixelY, event);
      }
    },
    [
      isSelecting,
      dragDistance,
      scaledPixelSize,
      viewportOffset,
      gridWidth,
      gridHeight,
      handlePixelClick,
    ]
  );


  // ---------------------------------------------------------------------------
  // 🔄 Effects
  // ---------------------------------------------------------------------------

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Initial Centering Logic
  useLayoutEffect(() => {
    if (!containerRef.current || hasInitialized) return;

    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;

    const fullGridW = gridWidth * pixelSize;
    const fullGridH = gridHeight * pixelSize;

    const fitScaleX = (clientWidth - 40) / fullGridW;
    const fitScaleY = (clientHeight - 40) / fullGridH;
    const fitScale = Math.min(fitScaleX, fitScaleY);

    const initialScale = Math.min(
      Math.max(GRID_CONFIG.INITIAL_ZOOM, fitScale),
      GRID_CONFIG.MAX_INITIAL_ZOOM
    );

    onZoomChange(initialScale);

    const initialX = (clientWidth - fullGridW * initialScale) / 2;
    const initialY = (clientHeight - fullGridH * initialScale) / 2;
    setViewportOffset({ x: initialX, y: initialY });
    setHasInitialized(true);
  }, [gridWidth, gridHeight, pixelSize, onZoomChange, hasInitialized, setViewportOffset]);

  // Billboard rotation
  useEffect(() => {
    if (featuredPixelsList.length === 0) return;
    const interval = setInterval(() => {
      setCurrentFeaturedIndex((prev) => (prev + 1) % featuredPixelsList.length);
    }, GRID_CONFIG.BILLBOARD_ROTATION_MS);
    return () => clearInterval(interval);
  }, [featuredPixelsList.length]);


  // ---------------------------------------------------------------------------
  // 🎨 OPTIMIZED RENDER PRE-CALCULATIONS
  // ---------------------------------------------------------------------------

  // Calculate visible range in PIXEL COORDINATES (not screen pixels)
  // This uses the RENDER_BUFFER from config which is much larger, allowing "Chunking"
  const visibleRange = useMemo(() => {
    if (!containerSize.width) return null;

    const buffer = GRID_CONFIG.RENDER_BUFFER; // e.g. 500px

    // Calculate the viewport bounding box in Grid Pixel Coordinates
    const minX = Math.floor((-viewportOffset.x - buffer) / scaledPixelSize);
    const maxX = Math.ceil((containerSize.width - viewportOffset.x + buffer) / scaledPixelSize);
    const minY = Math.floor((-viewportOffset.y - buffer) / scaledPixelSize);
    const maxY = Math.ceil((containerSize.height - viewportOffset.y + buffer) / scaledPixelSize);

    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }, [viewportOffset, containerSize, scaledPixelSize]);

  // Query the spatial index for pixels in this massive chunk
  const visiblePurchasedPixels = useMemo(() => {
    if (!visibleRange) return [];
    // SpatialIndex query allows efficient retrieval
    return spatialIndex.query(visibleRange.x, visibleRange.y, visibleRange.w, visibleRange.h);
  }, [spatialIndex, visibleRange, purchasedPixels]); // dependent on purchasedPixels reference change

  // For selected pixels, we just list them all if they are small, or filter similarly
  const visibleSelectedPixels = useMemo(() => {
    if (!visibleRange) return selectedPixels;
    return selectedPixels.filter((pixel) =>
      pixel.x >= visibleRange.x && pixel.x <= visibleRange.x + visibleRange.w &&
      pixel.y >= visibleRange.y && pixel.y <= visibleRange.y + visibleRange.h
    );
  }, [selectedPixels, visibleRange]);


  // ---------------------------------------------------------------------------
  // 🖼️ RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="relative w-full max-w-full">
      <div className="relative p-0 sm:p-2 md:p-6 rounded-none sm:rounded-2xl bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div
          ref={containerRef}
          className="relative overflow-hidden sm:rounded-xl bg-white select-none shadow-2xl mx-auto sm:!border-4 sm:!border-indigo-500"
          style={{
            width: "100%",
            height: "calc(100vh - 200px)",
            maxHeight: "800px",
            minHeight: "400px",
            touchAction: enableInteraction ? "none" : "auto", // Prevent browser zoom/scrolling if interactive
            WebkitUserSelect: "none",
            cursor: !enableInteraction ? "default" : isDragging ? "grabbing" : isSelecting ? "crosshair" : "grab",
            backgroundColor: "#f8fafc",
            borderTop: "4px solid #6366f1",
            borderBottom: "4px solid #6366f1",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleContainerClick}
          role="application"
          aria-label="Pixel grid canvas"
        >
          {isLoading && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-50">
              <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
            </div>
          )}

          {error && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm z-50">
              {error}
            </div>
          )}

          <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none bg-indigo-600 text-white px-5 py-1.5 rounded-full text-xs font-bold shadow-lg z-20">
            CANVAS
          </div>

          <div
            style={{
              transform: `translate3d(${viewportOffset.x}px, ${viewportOffset.y}px, 0)`,
              willChange: isDragging ? "transform" : "auto",
              transformOrigin: "0 0",
            }}
          >
            {/* 1. Grid Background */}
            <div
              className="absolute pointer-events-none shadow-[0_0_50px_rgba(0,0,0,0.15)]"
              style={{
                width: gridWidth * scaledPixelSize,
                height: gridHeight * scaledPixelSize,
                backgroundColor: "white",
              }}
            />

            {/* 2. Grid Lines */}
            {showGrid && zoom > 0.5 && (
              <div
                className="absolute pointer-events-none"
                style={{
                  width: gridWidth * scaledPixelSize,
                  height: gridHeight * scaledPixelSize,
                  backgroundImage:
                    "linear-gradient(to right, rgba(100,116,139,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(100,116,139,0.4) 1px, transparent 1px)",
                  backgroundSize: `${scaledPixelSize}px ${scaledPixelSize}px`,
                }}
              />
            )}

            {/* 3. Price Zones */}
            <div className="absolute pointer-events-none">
              <div
                className="absolute rounded-sm"
                style={{
                  left: (gridWidth / 2 - GRID_CONFIG.PREMIUM_ZONE_SIZE / 2) * scaledPixelSize,
                  top: (gridHeight / 2 - GRID_CONFIG.PREMIUM_ZONE_SIZE / 2) * scaledPixelSize,
                  width: GRID_CONFIG.PREMIUM_ZONE_SIZE * scaledPixelSize,
                  height: GRID_CONFIG.PREMIUM_ZONE_SIZE * scaledPixelSize,
                  border: "3px solid rgba(96, 165, 250, 0.6)",
                  boxShadow: "0 0 20px rgba(59,130,246,0.2)",
                }}
              />
              <div
                className="absolute rounded-sm shadow-lg"
                style={{
                  left: (gridWidth / 2 - GRID_CONFIG.GOLD_ZONE_SIZE / 2) * scaledPixelSize,
                  top: (gridHeight / 2 - GRID_CONFIG.GOLD_ZONE_SIZE / 2) * scaledPixelSize,
                  width: GRID_CONFIG.GOLD_ZONE_SIZE * scaledPixelSize,
                  height: GRID_CONFIG.GOLD_ZONE_SIZE * scaledPixelSize,
                  border: "3px solid rgba(251, 191, 36, 0.8)",
                  boxShadow: "0 0 25px rgba(251,191,36,0.3)",
                }}
              />
            </div>

            {/* 4. Billboard */}
            <div
              className="absolute z-30 shadow-2xl bg-black overflow-hidden flex flex-col items-center justify-center group"
              style={{
                left: billboardConfig.x * scaledPixelSize,
                top: billboardConfig.y * scaledPixelSize,
                width: billboardConfig.width * scaledPixelSize,
                height: billboardConfig.height * scaledPixelSize,
                pointerEvents: "auto",
                border: "5px solid #eab308",
              }}
            >
              {!currentFeaturedPixel ? (
                <div className="flex flex-col items-center justify-center h-full w-full bg-neutral-900 text-center p-3">
                  <Star className="w-16 h-16 text-yellow-500 mb-2 animate-pulse" />
                  <p className="text-yellow-500 font-bold text-sm md:text-base uppercase">
                    Premium Spot
                  </p>
                  <p className="text-white/60 text-xs md:text-sm">Your Ad Here</p>
                </div>
              ) : (
                <>
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out"
                    style={{
                      backgroundImage: `url(${currentFeaturedPixel.image_url})`,
                      opacity: 0.95,
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30 flex flex-col items-center justify-between p-4 md:p-5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="bg-yellow-500 text-black text-sm md:text-base font-black uppercase px-4 py-1.5 rounded shadow-lg flex items-center gap-2">
                      <Star className="w-5 h-5 fill-black" /> Featured
                    </div>
                    {/* Only Render Button if link exists */}
                    {currentFeaturedPixel.link_url && (
                      <button
                        className="bg-white/95 hover:bg-white text-black text-sm md:text-base font-bold px-5 py-2.5 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = currentFeaturedPixel.link_url || "#";
                          const validUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
                          window.open(validUrl, "_blank");
                        }}
                      >
                        Visit Partner <ExternalLink className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* 5. Selected Pixels */}
            {visibleSelectedPixels.map(({ x, y, id }) => (
              <div
                key={`sel-${id}`}
                className="absolute pointer-events-none"
                style={{
                  left: x * scaledPixelSize,
                  top: y * scaledPixelSize,
                  width: scaledPixelSize,
                  height: scaledPixelSize,
                  backgroundColor: "rgba(168,85,247,0.5)",
                  border: "1px solid #a855f7",
                }}
              />
            ))}

            {/* 6. Purchased Pixels (Optimized) */}
            {visiblePurchasedPixels.map((pixel) => {
              // Quick check for "My Pixels" filter
              if (showMyPixels && pixel.owner_id !== user?.id) return null;

              const { x, y, id, owner_id, image_url, link_url, alt_text } = pixel;
              const isOwner = owner_id === user?.id;

              return (
                <div
                  key={`sold-${id}`}
                  role={link_url ? "button" : undefined}
                  tabIndex={link_url ? 0 : -1}
                  className={link_url ? "cursor-pointer" : ""}
                  style={{
                    position: "absolute",
                    left: x * scaledPixelSize,
                    top: y * scaledPixelSize,
                    width: scaledPixelSize,
                    height: scaledPixelSize,
                    backgroundColor: image_url ? "transparent" : isOwner ? "#10b981" : "#ef4444",
                    backgroundImage: image_url ? `url(${image_url})` : "none",
                    backgroundSize: "cover",
                    opacity: isOwner ? 1 : 0.85,
                    boxShadow: isOwner ? "0 0 6px rgba(16,185,129,0.6)" : "none",
                    border: isOwner ? "1px solid #10b981" : "1px solid #cbd5e1",
                    zIndex: isOwner ? 10 : 0,
                  }}
                  onClick={(e) => {
                    if (link_url) {
                      e.stopPropagation();
                      const validUrl = link_url.startsWith('http://') || link_url.startsWith('https://') ? link_url : `https://${link_url}`;
                      window.open(validUrl, "_blank");
                      toast.success(`Opening ${alt_text || "pixel link"}...`);
                    }
                  }}
                  aria-label={alt_text || `Pixel at ${x}, ${y}`}
                />
              );
            })}

            {/* 7. Hover Indicator */}
            {hoveredPixel && isSelecting && !isDragging && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: hoveredPixel.x * scaledPixelSize,
                  top: hoveredPixel.y * scaledPixelSize,
                  width: scaledPixelSize,
                  height: scaledPixelSize,
                  backgroundColor:
                    getPixelStatus(hoveredPixel.x, hoveredPixel.y) === "restricted"
                      ? "rgba(239, 68, 68, 0.3)"
                      : "rgba(99, 102, 241, 0.2)",
                  borderStyle:
                    getPixelStatus(hoveredPixel.x, hoveredPixel.y) === "restricted"
                      ? "solid"
                      : "dashed",
                  borderWidth: "1px",
                  borderColor:
                    getPixelStatus(hoveredPixel.x, hoveredPixel.y) === "restricted"
                      ? "#ef4444"
                      : "#818cf8",
                }}
              />
            )}
          </div>

          {/* 8. HUD Elements */}
          <div className="absolute top-3 left-3 pointer-events-none bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg border border-slate-200">
            <span className="text-slate-700">{Math.round(zoom * 100)}%</span>
          </div>

          {selectedPixels.length > 0 && (
            <div className="absolute top-3 right-3 pointer-events-none bg-purple-500/90 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg">
              {selectedPixels.length} selected
            </div>
          )}
        </div>
      </div>

      {/* 9. Tooltip (Desktop Only) */}
      {hoveredPixel && !isMobile && !isDragging && (
        <PixelTooltip
          x={hoveredPixel.x}
          y={hoveredPixel.y}
          price={calculatePixelPrice(hoveredPixel.x, hoveredPixel.y)}
          status={(() => {
            const pixelStatus = getPixelStatus(hoveredPixel.x, hoveredPixel.y);
            return pixelStatus === "restricted" ? "available" : pixelStatus;
          })()}
        />
      )}

      {/* 10. Minimap (Desktop Only) */}
      {!isMobile && (
        <MiniMap
          gridWidth={gridWidth}
          gridHeight={gridHeight}
          viewportOffset={viewportOffset}
          zoom={zoom}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
          onViewportChange={setViewportOffset}
          pixelSize={pixelSize}
        />
      )}
    </div>
  );
};
