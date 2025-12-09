import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
  useMemo,
} from "react";
import { useAuth } from "@/hooks/useAuth"; // Ensure this path is correct
import { PixelTooltip } from "./PixelTooltip";
import { MiniMap } from "./MiniMap";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client"; // Ensure this path is correct
import { Star, ExternalLink, Loader2 } from "lucide-react";

// ============================================
// 🎯 CONFIGURATION CONSTANTS
// ============================================

const GRID_CONFIG = {
  // Initial Zoom Settings
  INITIAL_ZOOM: 1.5,
  MAX_INITIAL_ZOOM: 3.5,
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 8,

  // Featured Billboard Size
  BILLBOARD_WIDTH: 60,
  BILLBOARD_HEIGHT: 34,

  // Price Zone Sizes (Radius from center)
  PREMIUM_ZONE_SIZE: 120,
  GOLD_ZONE_SIZE: 60,

  // Interaction Settings
  ZOOM_FACTOR: 1.05,
  PAN_CLAMP_BUFFER: 100,
} as const;

// ============================================
// 📦 TYPES
// ============================================

interface SelectedPixel {
  x: number;
  y: number;
  price: number;
  id: string;
}

interface PurchasedPixel {
  x: number;
  y: number;
  id: string;
  image_url: string | null;
  link_url: string | null;
  alt_text: string | null;
  owner_id: string;
}

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
}: VirtualizedPixelGridProps) => {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  // -- State: Viewport & Interaction --
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [isMobile, setIsMobile] = useState(false); // Hydration safe

  // -- State: Dragging & Gestures --
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragDistance, setDragDistance] = useState(0);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; dist: number } | null>(null);
  const [initialZoom, setInitialZoom] = useState(zoom);

  // -- State: Data & Selection --
  const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number } | null>(null);
  const [rangeStart, setRangeStart] = useState<{ x: number; y: number } | null>(null);
  const [purchasedPixels, setPurchasedPixels] = useState<PurchasedPixel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);

  // -- State: Billboard Rotation --
  const [currentFeaturedIndex, setCurrentFeaturedIndex] = useState(0);

  // -- Refs --
  const hoverTimeoutRef = useRef<NodeJS.Timeout>();

  // ---------------------------------------------------------------------------
  // 📏 Helpers & Calculations
  // ---------------------------------------------------------------------------

  const scaledPixelSize = pixelSize * zoom;

  // Clamp panning so user doesn't lose the grid
  const clampOffset = useCallback(
    (x: number, y: number, currentScale: number) => {
      const totalGridWidth = gridWidth * pixelSize * currentScale;
      const totalGridHeight = gridHeight * pixelSize * currentScale;
      const buffer = GRID_CONFIG.PAN_CLAMP_BUFFER;

      const max_X = containerSize.width - buffer;
      const min_X = -totalGridWidth + buffer;
      const max_Y = containerSize.height - buffer;
      const min_Y = -totalGridHeight + buffer;

      return {
        x: Math.min(Math.max(x, min_X), max_X),
        y: Math.min(Math.max(y, min_Y), max_Y),
      };
    },
    [containerSize, gridWidth, gridHeight, pixelSize]
  );

  // Determine Billboard Position
  const billboardConfig = useMemo(() => {
    const width = GRID_CONFIG.BILLBOARD_WIDTH;
    const height = GRID_CONFIG.BILLBOARD_HEIGHT;
    const x = Math.floor((gridWidth - width) / 2);
    const y = Math.floor((gridHeight - height) / 2);
    return { x, y, width, height };
  }, [gridWidth, gridHeight]);

  // Pricing Logic (Radial)
  const calculatePixelPrice = useCallback(
    (x: number, y: number) => {
      const centerX = gridWidth / 2.0;
      const centerY = gridHeight / 2.0;
      const distanceFromCenter = Math.sqrt(
        Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
      );
      const maxDistance = Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2));
      const normalizedDistance = distanceFromCenter / maxDistance;

      if (normalizedDistance < 0.212) return 299; // Gold
      if (normalizedDistance < 0.424) return 199; // Premium
      return 99; // Standard
    },
    [gridWidth, gridHeight]
  );

  // Culling: Check if a pixel is currently inside the viewport
  const isVisible = useCallback(
    (px: number, py: number) => {
      const xPos = px * scaledPixelSize + viewportOffset.x;
      const yPos = py * scaledPixelSize + viewportOffset.y;
      // Add a small buffer of 1 pixel size to prevent pop-in
      const buffer = scaledPixelSize * 2;
      
      return (
        xPos > -buffer &&
        xPos < containerSize.width + buffer &&
        yPos > -buffer &&
        yPos < containerSize.height + buffer
      );
    },
    [scaledPixelSize, viewportOffset, containerSize]
  );

  // ---------------------------------------------------------------------------
  // 🔄 Effects: Initialization & Data
  // ---------------------------------------------------------------------------

  // Handle Hydration / Resize
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Container Resize Observer
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (!containerRef.current) return;
      setContainerSize({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    };
    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Initial Zoom Fit
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
  }, [gridWidth, gridHeight, pixelSize, onZoomChange, hasInitialized]);

  // Load Data from Supabase
  useEffect(() => {
    const loadPurchased = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("pixels")
        .select("id, x, y, owner_id, image_url, link_url, alt_text")
        .not("owner_id", "is", null);

      if (error) {
        console.error("Failed to load purchased pixels", error);
        toast.error("Failed to load map data");
        setIsLoading(false);
        return;
      }

      const formattedPixels: PurchasedPixel[] = (data || []).map((row) => ({
        id: row.id,
        x: row.x,
        y: row.y,
        owner_id: row.owner_id,
        image_url: row.image_url,
        link_url: row.link_url,
        alt_text: row.alt_text,
      }));

      setPurchasedPixels(formattedPixels);
      setIsLoading(false);
    };

    loadPurchased();

    const channel = supabase
      .channel("pixels-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "pixels" }, () => {
        loadPurchased();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 💾 Memos & Derived State
  // ---------------------------------------------------------------------------

  const purchasedPixelsMap = useMemo(() => {
    const map = new Map<string, PurchasedPixel>();
    purchasedPixels.forEach((pixel) => map.set(`${pixel.x}-${pixel.y}`, pixel));
    return map;
  }, [purchasedPixels]);

  const selectedPixelsSet = useMemo(() => {
    const set = new Set<string>();
    selectedPixels.forEach((pixel) => set.add(pixel.id));
    return set;
  }, [selectedPixels]);

  const featuredPixelsList = useMemo(
    () => purchasedPixels.filter((p) => p.image_url && p.image_url.length > 0),
    [purchasedPixels]
  );

  const currentFeaturedPixel =
    featuredPixelsList.length > 0 ? featuredPixelsList[currentFeaturedIndex] : null;

  // Cycle Billboard Images
  useEffect(() => {
    if (featuredPixelsList.length === 0) return;
    const interval = setInterval(() => {
      setCurrentFeaturedIndex((prev) => (prev + 1) % featuredPixelsList.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [featuredPixelsList.length]);

  const getPixelStatus = useCallback(
    (x: number, y: number) => {
      if (
        x >= billboardConfig.x &&
        x < billboardConfig.x + billboardConfig.width &&
        y >= billboardConfig.y &&
        y < billboardConfig.y + billboardConfig.height
      ) {
        return "restricted";
      }

      const purchased = purchasedPixelsMap.get(`${x}-${y}`);
      if (purchased) {
        return purchased.owner_id === user?.id ? "yours" : "sold";
      }

      return selectedPixelsSet.has(`${x}-${y}`) ? "selected" : "available";
    },
    [purchasedPixelsMap, selectedPixelsSet, user?.id, billboardConfig]
  );

  // ---------------------------------------------------------------------------
  // 🎮 Event Handlers (Click, Drag, Touch)
  // ---------------------------------------------------------------------------

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

        if (area > 2500) {
          toast.error("Selection too large! Max 2500 pixels.");
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

        // Merge keeping uniqueness
        const existingPixelIds = new Set(selectedPixels.map((p) => p.id));
        const uniqueNewPixels = newPixels.filter((p) => !existingPixelIds.has(p.id));

        onSelectionChange([...selectedPixels, ...uniqueNewPixels]);
        toast.success(`Selected ${uniqueNewPixels.length} pixels`);
        setRangeStart(null);
      } 
      // Single Selection
      else {
        const existingIndex = selectedPixels.findIndex((p) => p.id === pixelId);
        if (existingIndex >= 0) {
          onSelectionChange(selectedPixels.filter((_, index) => index !== existingIndex));
        } else {
          onSelectionChange([...selectedPixels, { x, y, price, id: pixelId }]);
        }
        setRangeStart({ x, y });
      }
    },
    [isSelecting, getPixelStatus, calculatePixelPrice, selectedPixels, onSelectionChange, rangeStart]
  );

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0 && event.button !== 1) return;
      setIsDragging(true);
      setDragDistance(0);
      setHoveredPixel(null); // Clear tooltip immediately
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      
      setDragStart({
        x: event.clientX - viewportOffset.x,
        y: event.clientY - viewportOffset.y,
      });
    },
    [viewportOffset]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isDragging) {
        // --- Hover Logic ---
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const relativeX = event.clientX - rect.left - viewportOffset.x;
          const relativeY = event.clientY - rect.top - viewportOffset.y;
          const pixelX = Math.floor(relativeX / scaledPixelSize);
          const pixelY = Math.floor(relativeY / scaledPixelSize);

          if (pixelX >= 0 && pixelX < gridWidth && pixelY >= 0 && pixelY < gridHeight) {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = setTimeout(() => {
              setHoveredPixel({ x: pixelX, y: pixelY });
            }, 5);
          } else {
            setHoveredPixel(null);
          }
        }
        return;
      }

      // --- Drag Logic ---
      if (dragStart) {
        const newX = event.clientX - dragStart.x;
        const newY = event.clientY - dragStart.y;
        
        // Calculate distance for click rejection
        const dist = Math.sqrt(
          Math.pow(newX - viewportOffset.x, 2) + Math.pow(newY - viewportOffset.y, 2)
        );
        setDragDistance((prev) => prev + dist);

        const clamped = clampOffset(newX, newY, zoom);
        setViewportOffset(clamped);
      }
    },
    [isDragging, dragStart, scaledPixelSize, viewportOffset, gridWidth, gridHeight, clampOffset, zoom]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleContainerClick = useCallback(
    (event: React.MouseEvent) => {
      if (dragDistance > 5) return; // Ignore if user dragged
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
    [isSelecting, dragDistance, scaledPixelSize, viewportOffset, gridWidth, gridHeight, handlePixelClick]
  );

  // --- Wheel & Touch Event Listeners ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault(); // Stop page scroll
      const zoomFactor = GRID_CONFIG.ZOOM_FACTOR;
      const newZoom = event.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
      const safeZoom = Math.max(GRID_CONFIG.MIN_ZOOM, Math.min(GRID_CONFIG.MAX_ZOOM, newZoom));
      onZoomChange(safeZoom);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Pinch start
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        setTouchStart({ x: 0, y: 0, dist });
        setInitialZoom(zoom);
      } else if (e.touches.length === 1) {
        // Drag start
        setIsDragging(true);
        setDragDistance(0);
        setHoveredPixel(null);
        setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchStart) {
        // Pinch Move
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0 && touchStart.dist > 0) {
          const scale = dist / touchStart.dist;
          const newZoom = Math.min(
            GRID_CONFIG.MAX_ZOOM,
            Math.max(GRID_CONFIG.MIN_ZOOM, initialZoom * scale)
          );
          onZoomChange(newZoom);
        }
      } else if (e.touches.length === 1 && isDragging && dragStart) {
        // Drag Move
        e.preventDefault();
        const deltaX = e.touches[0].clientX - dragStart.x;
        const deltaY = e.touches[0].clientY - dragStart.y;

        setDragDistance((prev) => prev + Math.abs(deltaX) + Math.abs(deltaY));

        const rawNewX = viewportOffset.x + deltaX;
        const rawNewY = viewportOffset.y + deltaY;
        const clamped = clampOffset(rawNewX, rawNewY, zoom);

        setViewportOffset(clamped);
        setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      setTouchStart(null);
    };

    // Use { passive: false } to allow preventDefault()
    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("touchstart", handleTouchStart, { passive: false });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd);
    container.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [zoom, onZoomChange, touchStart, initialZoom, isDragging, dragStart, clampOffset, viewportOffset]);

  // ============================================
  // 🎨 RENDER
  // ============================================

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
            touchAction: "none",
            WebkitUserSelect: "none",
            cursor: isDragging ? "grabbing" : isSelecting ? "crosshair" : "grab",
            backgroundColor: "#f8fafc",
            borderTop: "4px solid #6366f1",
            borderBottom: "4px solid #6366f1",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleContainerClick}
        >
          {isLoading && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-50">
              <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
            </div>
          )}

          <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none bg-indigo-600 text-white px-5 py-1.5 rounded-full text-xs font-bold shadow-lg z-20">
            CANVAS
          </div>

          <div
            style={{
              transform: `translate3d(${viewportOffset.x}px, ${viewportOffset.y}px, 0)`,
              willChange: "transform",
              transformOrigin: "0 0",
            }}
          >
            {/* 1. Grid Background Layer */}
            <div
              className="absolute pointer-events-none shadow-[0_0_50px_rgba(0,0,0,0.15)]"
              style={{
                width: gridWidth * scaledPixelSize,
                height: gridHeight * scaledPixelSize,
                backgroundColor: "white",
              }}
            />

            {/* 2. Grid Lines (Only when zoomed in) */}
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
              {/* Premium Zone */}
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
              {/* Gold Zone */}
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
                    {currentFeaturedPixel.link_url && (
                      <button
                        className="bg-white/95 hover:bg-white text-black text-sm md:text-base font-bold px-5 py-2.5 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(currentFeaturedPixel.link_url || "#", "_blank");
                        }}
                      >
                        Visit Partner <ExternalLink className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* 5. Selected Pixels (Rendering Layer) */}
            {selectedPixels.map(({ x, y, id }) => {
              if (!isVisible(x, y)) return null;
              return (
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
              );
            })}

            {/* 6. Purchased Pixels (Rendering Layer) */}
            {purchasedPixels.map((pixel) => {
              const { x, y, id, owner_id, image_url, link_url, alt_text } = pixel;
              if (!isVisible(x, y)) return null;
              if (showMyPixels && owner_id !== user?.id) return null;

              const isOwner = owner_id === user?.id;

              return (
                <div
                  key={`sold-${id}`}
                  role="button"
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
                      window.open(link_url, "_blank");
                      toast.success(`Opening ${alt_text || "pixel link"}...`);
                    }
                  }}
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
      {hoveredPixel && !isMobile && (
        <PixelTooltip
          x={hoveredPixel.x}
          y={hoveredPixel.y}
          price={calculatePixelPrice(hoveredPixel.x, hoveredPixel.y)}
          status={(() => {
            const pixelStatus = getPixelStatus(hoveredPixel.x, hoveredPixel.y);
            return pixelStatus === 'restricted' ? 'available' : pixelStatus;
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
        />
      )}
    </div>
  );
};