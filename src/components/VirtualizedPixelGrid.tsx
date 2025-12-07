import { useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { PixelTooltip } from "./PixelTooltip";
import { MiniMap } from "./MiniMap";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Star, ExternalLink, Move } from "lucide-react";

// --- Interfaces ---
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

// --- Component ---
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

  // --- State ---
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  
  // Interaction State
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragDistance, setDragDistance] = useState(0);
  
  const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number } | null>(null);
  const [rangeStart, setRangeStart] = useState<{ x: number; y: number } | null>(null);
  const [purchasedPixels, setPurchasedPixels] = useState<PurchasedPixel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Featured Billboard State
  const [currentFeaturedIndex, setCurrentFeaturedIndex] = useState(0);

  // Touch State
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; dist: number } | null>(null);
  const [initialZoom, setInitialZoom] = useState(zoom);

  // Refs
  const hoverTimeoutRef = useRef<NodeJS.Timeout>();

  // --- 1. BOUNDING LOGIC (Prevents getting lost) ---
  const clampOffset = useCallback((x: number, y: number, currentScale: number) => {
    // Calculate total size of the grid at current zoom
    const totalGridWidth = gridWidth * pixelSize * currentScale;
    const totalGridHeight = gridHeight * pixelSize * currentScale;

    // Buffer: How many pixels must remain on screen?
    const buffer = 100; 

    // Calculate bounds
    // The left edge (x) cannot be greater than the container width minus buffer
    const max_X = containerSize.width - buffer;
    // The right edge (x + totalWidth) cannot be less than buffer
    const min_X = -totalGridWidth + buffer;

    // Same for Y
    const max_Y = containerSize.height - buffer;
    const min_Y = -totalGridHeight + buffer;

    return {
      x: Math.min(Math.max(x, min_X), max_X),
      y: Math.min(Math.max(y, min_Y), max_Y)
    };
  }, [containerSize, gridWidth, gridHeight, pixelSize]);

  // --- BILLBOARD CONFIGURATION ---
  const billboardConfig = useMemo(() => {
    const width = 32; 
    const height = 18; 
    const x = Math.floor((gridWidth - width) / 2);
    const y = Math.floor((gridHeight - height) / 2);
    return { x, y, width, height };
  }, [gridWidth, gridHeight]);

  // --- LOGIC: Filter Real Images ---
  const featuredPixelsList = useMemo(() => {
    return purchasedPixels.filter(p => p.image_url && p.image_url.length > 0);
  }, [purchasedPixels]);

  const currentFeaturedPixel = featuredPixelsList.length > 0 
    ? featuredPixelsList[currentFeaturedIndex] 
    : null;

  // --- Effect: Cycle Images ---
  useEffect(() => {
    if (featuredPixelsList.length === 0) return;
    const interval = setInterval(() => {
      setCurrentFeaturedIndex((prev) => (prev + 1) % featuredPixelsList.length);
    }, 3000); 
    return () => clearInterval(interval);
  }, [featuredPixelsList.length]);

  // --- Optimization: Resize Observer ---
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // --- Memos ---
  const purchasedPixelsMap = useMemo(() => {
    const map = new Map<string, PurchasedPixel>();
    purchasedPixels.forEach(pixel => map.set(`${pixel.x}-${pixel.y}`, pixel));
    return map;
  }, [purchasedPixels]);

  const selectedPixelsSet = useMemo(() => {
    const set = new Set<string>();
    selectedPixels.forEach(pixel => set.add(pixel.id));
    return set;
  }, [selectedPixels]);

  // --- 2. Load Data ---
  useEffect(() => {
    const loadPurchased = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('pixels')
        .select('id, x, y, owner_id, image_url, link_url, alt_text')
        .not('owner_id', 'is', null);
      
      if (error) {
        console.error('Failed to load purchased pixels', error);
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
      .channel('pixels-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pixels' }, () => {
        loadPurchased();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  // --- 3. Auto-Fit Logic (Initial) ---
  useLayoutEffect(() => {
    if (!containerRef.current || hasInitialized) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;

    const fullGridW = gridWidth * pixelSize;
    const fullGridH = gridHeight * pixelSize;
    const scaleX = (clientWidth - 40) / fullGridW;
    const scaleY = (clientHeight - 40) / fullGridH;
    const initialScale = Math.min(scaleX, scaleY, 1.5);
    
    onZoomChange(initialScale);
    
    // Center initially
    const initialX = (clientWidth - (fullGridW * initialScale)) / 2;
    const initialY = (clientHeight - (fullGridH * initialScale)) / 2;

    setViewportOffset({ x: initialX, y: initialY });
    setHasInitialized(true);
  }, [gridWidth, gridHeight, pixelSize, onZoomChange, hasInitialized]);

  // --- 4. Helper Functions ---
  const scaledPixelSize = pixelSize * zoom;

  const isVisible = useCallback((px: number, py: number) => {
    const xPos = px * scaledPixelSize + viewportOffset.x;
    const yPos = py * scaledPixelSize + viewportOffset.y;
    return (
      xPos > -scaledPixelSize * 2 && 
      xPos < containerSize.width + scaledPixelSize * 2 && 
      yPos > -scaledPixelSize * 2 && 
      yPos < containerSize.height + scaledPixelSize * 2
    );
  }, [scaledPixelSize, viewportOffset, containerSize]);

  const calculatePixelPrice = useCallback((x: number, y: number) => {
    const centerX = gridWidth / 2.0;
    const centerY = gridHeight / 2.0;
    const distanceFromCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
    const maxDistance = Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2));
    const normalizedDistance = distanceFromCenter / maxDistance;
    
    if (normalizedDistance < 0.212) return 299;
    if (normalizedDistance < 0.424) return 199;
    return 99;
  }, [gridWidth, gridHeight]);

  const getPixelStatus = useCallback((x: number, y: number) => {
    if (
        x >= billboardConfig.x && 
        x < billboardConfig.x + billboardConfig.width &&
        y >= billboardConfig.y &&
        y < billboardConfig.y + billboardConfig.height
    ) {
        return 'restricted';
    }

    const purchased = purchasedPixelsMap.get(`${x}-${y}`);
    if (purchased) {
      return purchased.owner_id === user?.id ? 'yours' : 'sold';
    }

    return selectedPixelsSet.has(`${x}-${y}`) ? 'selected' : 'available';
  }, [purchasedPixelsMap, selectedPixelsSet, user?.id, billboardConfig]);

  // --- 5. Selection Handler ---
  const handlePixelClick = useCallback((x: number, y: number, event: React.MouseEvent | React.TouchEvent) => {
    if (!isSelecting) return;

    const status = getPixelStatus(x, y);
    
    if (status === 'restricted') {
      toast.info("Featured Billboard Area", {
        description: "Reserved for featured community pixels.",
        icon: <Star className="w-4 h-4 text-yellow-500" />
      });
      return;
    }
    if (status === 'sold') {
      toast.error("This pixel is already owned!");
      return;
    }

    const price = calculatePixelPrice(x, y);
    const pixelId = `${x}-${y}`;

    if ((event as React.MouseEvent).shiftKey && rangeStart) {
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
          if (s === 'available') {
            newPixels.push({
              x: px,
              y: py,
              price: calculatePixelPrice(px, py),
              id: `${px}-${py}`
            });
          }
        }
      }

      const existingPixelIds = new Set(selectedPixels.map(p => p.id));
      const uniqueNewPixels = newPixels.filter(p => !existingPixelIds.has(p.id));
      
      onSelectionChange([...selectedPixels, ...uniqueNewPixels]);
      toast.success(`Selected ${uniqueNewPixels.length} pixels`);
      setRangeStart(null);
    } else {
      const existingIndex = selectedPixels.findIndex(p => p.id === pixelId);
      if (existingIndex >= 0) {
        onSelectionChange(selectedPixels.filter((_, index) => index !== existingIndex));
      } else {
        onSelectionChange([...selectedPixels, { x, y, price, id: pixelId }]);
      }
      setRangeStart({ x, y });
    }
  }, [isSelecting, getPixelStatus, calculatePixelPrice, selectedPixels, onSelectionChange, rangeStart]);

  // --- 6. Mouse Events (With Clamping) ---
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0 && event.button !== 1) return;
    setIsDragging(true);
    setDragDistance(0);
    setDragStart({
      x: event.clientX - viewportOffset.x,
      y: event.clientY - viewportOffset.y
    });
  }, [viewportOffset]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!isDragging) {
      // Hover Logic
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
    
    // Drag Logic (Clamped)
    if (dragStart) {
      const newX = event.clientX - dragStart.x;
      const newY = event.clientY - dragStart.y;
      const dist = Math.sqrt(Math.pow(newX - viewportOffset.x, 2) + Math.pow(newY - viewportOffset.y, 2));
      setDragDistance(prev => prev + dist);
      
      // Apply Clamping here!
      const clamped = clampOffset(newX, newY, zoom);
      setViewportOffset(clamped);
    }
  }, [isDragging, dragStart, scaledPixelSize, viewportOffset, gridWidth, gridHeight, clampOffset, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleContainerClick = useCallback((event: React.MouseEvent) => {
    if (dragDistance > 5) return;
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
  }, [isSelecting, dragDistance, scaledPixelSize, viewportOffset, gridWidth, gridHeight, handlePixelClick]);

  // --- 7. Event Listeners (Zoom & Touch with Clamping) ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const zoomFactor = 1.05;
      const newZoom = event.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
      // Clamp zoom levels
      const safeZoom = Math.max(0.1, Math.min(8, newZoom));
      
      onZoomChange(safeZoom);
      
      // Note: Advanced zooming towards mouse pointer requires complex math. 
      // For now, we allow the center to drift slightly but clamp it on next move.
    };

    const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            setTouchStart({ x: 0, y: 0, dist });
            setInitialZoom(zoom);
        } else if (e.touches.length === 1) {
            setIsDragging(true);
            setDragDistance(0);
            setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
        }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchStart) {
        e.preventDefault(); 
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0 && touchStart.dist > 0) {
          const scale = dist / touchStart.dist;
          const newZoom = Math.min(8, Math.max(0.1, initialZoom * scale));
          onZoomChange(newZoom);
        }
      } else if (e.touches.length === 1 && isDragging && dragStart) {
        e.preventDefault(); 
        const deltaX = e.touches[0].clientX - dragStart.x;
        const deltaY = e.touches[0].clientY - dragStart.y;
        
        setDragDistance(prev => prev + Math.abs(deltaX) + Math.abs(deltaY));
        
        const rawNewX = viewportOffset.x + deltaX; // Touch uses delta logic
        const rawNewY = viewportOffset.y + deltaY;

        // Apply Clamping
        const clamped = clampOffset(rawNewX, rawNewY, zoom);
        
        setViewportOffset(clamped);
        setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      }
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        setTouchStart(null);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [zoom, onZoomChange, touchStart, initialZoom, isDragging, dragStart, clampOffset, viewportOffset]);

  // Define isMobileDevice for rendering conditionals
  const isMobileDevice = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="relative w-full max-w-full">
      <div className="relative p-0 sm:p-2 md:p-6 rounded-none sm:rounded-2xl bg-gradient-to-br from-blue-50 via-white to-purple-50">
        
        {/* CANVAS CONTAINER */}
        <div
          ref={containerRef}
          className="relative overflow-hidden border-y-4 sm:border-4 border-indigo-500 sm:rounded-xl bg-white select-none shadow-2xl mx-auto"
          style={{ 
            width: '100%', 
            height: 'calc(100vh - 200px)',
            maxHeight: '800px',
            minHeight: '400px',
            touchAction: 'none',
            WebkitUserSelect: 'none',
            cursor: isDragging ? 'grabbing' : (isSelecting ? 'crosshair' : 'grab'),
            // Added distinct border/shadow to separate grid from "void"
            backgroundColor: '#f8fafc', // Very light slate background for the "void"
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleContainerClick}
        >
          {isLoading && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
            </div>
          )}

          <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none bg-indigo-600 text-white px-5 py-1.5 rounded-full text-xs font-bold shadow-lg z-20">
            CANVAS
          </div>

          <div 
            style={{
              transform: `translate3d(${viewportOffset.x}px, ${viewportOffset.y}px, 0)`,
              willChange: 'transform',
              transformOrigin: '0 0',
            }}
          >
            {/* Grid Boundary Shadow (Visual cue for end of world) */}
            <div 
                className="absolute pointer-events-none shadow-[0_0_50px_rgba(0,0,0,0.15)]"
                style={{
                    width: gridWidth * scaledPixelSize,
                    height: gridHeight * scaledPixelSize,
                    backgroundColor: 'white', // Ensure grid has white background
                }}
            />

            {/* Grid Background */}
            {showGrid && zoom > 0.5 && (
              <div 
                className="absolute pointer-events-none"
                style={{
                  width: gridWidth * scaledPixelSize,
                  height: gridHeight * scaledPixelSize,
                  backgroundImage: `
                    linear-gradient(to right, rgba(100, 116, 139, 0.4) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(100, 116, 139, 0.4) 1px, transparent 1px)
                  `,
                  backgroundSize: `${scaledPixelSize}px ${scaledPixelSize}px`,
                }}
              />
            )}

            {/* Price Zone Borders */}
            <div className="absolute pointer-events-none">
              <div
                className="absolute border-2 border-blue-400/50 rounded-sm"
                style={{
                  left: (gridWidth / 2 - 45) * scaledPixelSize,
                  top: (gridHeight / 2 - 45) * scaledPixelSize,
                  width: 90 * scaledPixelSize,
                  height: 90 * scaledPixelSize,
                  boxShadow: '0 0 15px rgba(59, 130, 246, 0.1)',
                }}
              />
              <div
                className="absolute border-2 border-amber-400/60 rounded-sm shadow-lg"
                style={{
                  left: (gridWidth / 2 - 22.5) * scaledPixelSize,
                  top: (gridHeight / 2 - 22.5) * scaledPixelSize,
                  width: 45 * scaledPixelSize,
                  height: 45 * scaledPixelSize,
                  boxShadow: '0 0 20px rgba(251, 191, 36, 0.2)',
                }}
              />
            </div>

            {/* --- FEATURED BILLBOARD (Dynamic User Images) --- */}
            <div
                className="absolute z-30 shadow-2xl border-4 border-yellow-500 bg-black overflow-hidden flex flex-col items-center justify-center group"
                style={{
                    left: billboardConfig.x * scaledPixelSize,
                    top: billboardConfig.y * scaledPixelSize,
                    width: billboardConfig.width * scaledPixelSize,
                    height: billboardConfig.height * scaledPixelSize,
                    pointerEvents: 'auto', 
                }}
            >
                {/* Fallback if no images found in grid */}
                {!currentFeaturedPixel ? (
                   <div className="flex flex-col items-center justify-center h-full w-full bg-neutral-900 text-center p-2">
                      <Star className="w-8 h-8 text-yellow-500 mb-1 animate-pulse" />
                      <p className="text-yellow-500 font-bold text-[8px] md:text-[10px] uppercase">
                        Premium Spot
                      </p>
                      <p className="text-white/60 text-[6px] md:text-[8px]">
                        Your Ad Here
                      </p>
                   </div>
                ) : (
                  <>
                    <div 
                      className="absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out"
                      style={{
                        backgroundImage: `url(${currentFeaturedPixel.image_url})`,
                        opacity: 0.95
                      }}
                    />
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30 flex flex-col items-center justify-between p-2 md:p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                       <div className="bg-yellow-500 text-black text-[10px] md:text-xs font-black uppercase px-2 py-0.5 rounded shadow-lg flex items-center gap-1">
                          <Star className="w-3 h-3 fill-black" /> Featured
                       </div>
                       
                       {currentFeaturedPixel.link_url && (
                         <button 
                            className="bg-white/95 hover:bg-white text-black text-[10px] font-bold px-3 py-1 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(currentFeaturedPixel.link_url || '#', '_blank');
                              toast.success(`Visiting ${currentFeaturedPixel.alt_text || 'Partner'}...`);
                            }}
                         >
                            Visit Partner <ExternalLink className="w-3 h-3" />
                         </button>
                       )}
                    </div>
                  </>
                )}
            </div>

            {/* Selected Pixels */}
            {selectedPixels.map(({ x, y, id }) => {
              if (!isVisible(x, y)) return null;
              return (
                <div
                  key={`sel-${id}`}
                  className="absolute border border-purple-500 pointer-events-none"
                  style={{
                    left: x * scaledPixelSize,
                    top: y * scaledPixelSize,
                    width: scaledPixelSize,
                    height: scaledPixelSize,
                    backgroundColor: 'rgba(168, 85, 247, 0.5)',
                  }}
                />
              );
            })}

            {/* Purchased Pixels */}
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
                  className={`absolute border ${isOwner ? 'border-green-500 z-10' : 'border-slate-300 z-0'} ${link_url ? 'cursor-pointer' : ''}`}
                  style={{
                    left: x * scaledPixelSize,
                    top: y * scaledPixelSize,
                    width: scaledPixelSize,
                    height: scaledPixelSize,
                    backgroundColor: image_url ? 'transparent' : (isOwner ? '#10b981' : '#ef4444'),
                    backgroundImage: image_url ? `url(${image_url})` : 'none',
                    backgroundSize: 'cover',
                    opacity: isOwner ? 1 : 0.85,
                    boxShadow: isOwner ? '0 0 6px rgba(16, 185, 129, 0.6)' : 'none',
                  }}
                  onClick={(e) => {
                    if (link_url) {
                      e.stopPropagation();
                      window.open(link_url, '_blank');
                      toast.success(`Opening ${alt_text || 'pixel link'}...`);
                    }
                  }}
                />
              );
            })}

            {/* Hover Highlight (Single Pixel) */}
            {hoveredPixel && isSelecting && !isDragging && (
                <div 
                   className={`absolute border pointer-events-none ${
                     getPixelStatus(hoveredPixel.x, hoveredPixel.y) === 'restricted' 
                       ? 'border-red-500 bg-red-500/30' 
                       : 'border-dashed border-indigo-400 bg-indigo-500/20'
                   }`}
                   style={{
                     left: hoveredPixel.x * scaledPixelSize,
                     top: hoveredPixel.y * scaledPixelSize,
                     width: scaledPixelSize,
                     height: scaledPixelSize,
                   }}
                />
            )}
          </div>

          <div className="absolute top-3 left-3 pointer-events-none bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-200 shadow-lg">
            <span className="text-slate-700">{Math.round(zoom * 100)}%</span>
          </div>

          {selectedPixels.length > 0 && (
            <div className="absolute top-3 right-3 pointer-events-none bg-purple-500/90 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg">
              {selectedPixels.length} selected
            </div>
          )}
        </div>
      </div>

      {hoveredPixel && !isMobileDevice && (
        <PixelTooltip 
          x={hoveredPixel.x}
          y={hoveredPixel.y}
          price={calculatePixelPrice(hoveredPixel.x, hoveredPixel.y)}
          status={getPixelStatus(hoveredPixel.x, hoveredPixel.y)}
        />
      )}

      {!isMobileDevice && (
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