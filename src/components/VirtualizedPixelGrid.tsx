import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
  useMemo,
  useTransition,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import { PixelTooltip } from "./PixelTooltip";
import { PixelInfoModal } from "./PixelInfoModal";
import { toast } from "sonner";
import { Star, ExternalLink, Loader2 } from "lucide-react";
import { openAdvertiserUrl } from "@/utils/utmUtils";
import { useSearchParams } from "react-router-dom";
import { usePixelGridData } from "@/hooks/usePixelGridData";
import { useGridInteraction } from "@/hooks/useGridInteraction";
import { GRID_CONFIG, ZONE_SIZES, AD_TIER_CONFIG, getAdTierByPrice, calculatePixelPrice } from "@/utils/gridConstants";
import { SelectedPixel, PurchasedPixel, PixelBlock } from "@/types/grid";
import { getGridImageUrl, getBillboardImageUrl } from "@/utils/imageOptimization";
import {
  createSelectedPixel,
  getBillboardBounds,
  getPixelFocusViewportOffset,
  getPixelId,
  getPixelSelectionStatus,
  isInGridBounds,
  summarizeSelectionRejections,
  validatePixelSelection,
} from "@/utils/gridDomain";
import type { PixelSelectionValidationResult } from "@/utils/gridDomain";
import { trackPixelClick } from "@/utils/pixelAnalytics";
import "./pixelAnimations.css";

// ============================================================
// Types
// ============================================================

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
  onAvailablePixelFocused?: (x: number, y: number) => void;
}

export interface GridHandle {
  resetViewport: () => void;
  refetchData: () => void;
  validateSelection: (pixels: SelectedPixel[]) => PixelSelectionValidationResult;
}

// ============================================================
// Helpers
// ============================================================

/** @deprecated Use openAdvertiserUrl from utmUtils instead */
function openUrl(url: string, campaign = 'pixel_ad') {
  openAdvertiserUrl(url, campaign);
}

function getTierAnimationClass(pricePaid = 0): string {
  if (pricePaid >= AD_TIER_CONFIG.GOLD.price) return " pixel-gold-glow";
  if (pricePaid >= AD_TIER_CONFIG.PREMIUM.price) return " pixel-premium-shimmer";
  return "";
}

// ============================================================
// Component
// ============================================================

// NOTE: forwardRef is deprecated in React 19. Migrate to ref-as-prop when upgrading.
export const VirtualizedPixelGrid = forwardRef<
  GridHandle,
  VirtualizedPixelGridProps
>(
  (
    {
      selectedPixels,
      onSelectionChange,
      isSelecting,
      gridWidth = 100,
      gridHeight = 100,
      pixelSize = 10,
      zoom,
      onZoomChange,
      showGrid = true,
      showMyPixels = false,
      enableInteraction = true,
      onAvailablePixelFocused,
    },
    ref
  ) => {
    const { user } = useAuth();
    const containerRef = useRef<HTMLDivElement>(null);
    const hasInitializedRef = useRef(false);
    const handledPixelParam = useRef<string | null>(null);
    const [searchParams] = useSearchParams();
    const highlightUser = searchParams.get('highlightUser');
    const imageUrlsRef = useRef<Set<string>>(new Set());

    // ── Data & Interaction Hooks ──────────────────────────────
    const { purchasedPixels, isLoading, error, spatialIndex, refetch } =
      usePixelGridData();

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

    const getPurchasedPixel = useCallback(
      (x: number, y: number) => spatialIndex.get(x, y),
      [spatialIndex]
    );

    const validateSelection = useCallback(
      (pixels: SelectedPixel[]) =>
        validatePixelSelection(pixels, {
          gridWidth,
          gridHeight,
          getPurchasedPixel,
          getPixelPrice: calculatePixelPrice,
        }),
      [gridWidth, gridHeight, getPurchasedPixel]
    );

    const calculateFittedViewport = useCallback(
      (clientWidth: number, clientHeight: number) => {
        const gridPixelWidth = gridWidth * pixelSize;
        const gridPixelHeight = gridHeight * pixelSize;
        const isMobileDevice = clientWidth < 768;
        const padding = 0;
        const fitZoomX = (clientWidth - padding * 2) / gridPixelWidth;
        const fitZoomY = (clientHeight - padding * 2) / gridPixelHeight;
        const fitZoom = Math.min(fitZoomX, fitZoomY);
        const zoomMultiplier = isMobileDevice
          ? GRID_CONFIG.INITIAL_ZOOM_MULTIPLIER_MOBILE || 1.30
          : GRID_CONFIG.INITIAL_ZOOM_MULTIPLIER_DESKTOP || 2.2;
        const mobileMaxZoom = fitZoom * Math.max(1.05, zoomMultiplier);
        const clampedZoom = Math.min(
          Math.max(fitZoom * zoomMultiplier, GRID_CONFIG.MIN_ZOOM),
          isMobileDevice
            ? Math.min(mobileMaxZoom, GRID_CONFIG.MAX_INITIAL_ZOOM)
            : GRID_CONFIG.MAX_INITIAL_ZOOM
        );

        const fittedPixelSize = Math.max(1, pixelSize * clampedZoom);
        const renderedGridWidth = gridWidth * fittedPixelSize;
        const renderedGridHeight = gridHeight * fittedPixelSize;

        return {
          zoom: clampedZoom,
          offset: {
            x: (clientWidth - renderedGridWidth) / 2,
            y: (clientHeight - renderedGridHeight) / 2,
          },
        };
      },
      [gridWidth, gridHeight, pixelSize]
    );

    // ── Imperative Handle ─────────────────────────────────────
    useImperativeHandle(
      ref,
      () => ({
        resetViewport: () => {
          if (!containerRef.current) return;
          const { clientWidth, clientHeight } = containerRef.current;
          if (!clientWidth || !clientHeight) return;

          const fitted = calculateFittedViewport(clientWidth, clientHeight);
          onZoomChange(fitted.zoom);
          setViewportOffset(fitted.offset);
        },
        refetchData: () => {
          refetch();
        },
        validateSelection,
      }),
      [calculateFittedViewport, onZoomChange, setViewportOffset, refetch, validateSelection]
    );

    // ── Concurrency ───────────────────────────────────────────
    const [isPending, startTransition] = useTransition();

    // ── Local State ───────────────────────────────────────────
    const [isMobile, setIsMobile] = useState(false);
    const [currentFeaturedIndex, setCurrentFeaturedIndex] = useState(0);
    const [rangeStart, setRangeStart] = useState<{ x: number; y: number } | null>(null);

    // Pixel info modal state
    const [infoModalPixel, setInfoModalPixel] = useState<PurchasedPixel | null>(null);
    const [infoModalBlock, setInfoModalBlock] = useState<PixelBlock | null>(null);
    const [infoModalOpen, setInfoModalOpen] = useState(false);

    // ── Memoized Derivations ──────────────────────────────────

    const scaledPixelSize = useMemo(
      () => Math.max(1, pixelSize * zoom),
      [pixelSize, zoom]
    );

    const getCenteredOffset = useCallback(
      (containerUnits: number, itemUnits: number) =>
        ((containerUnits - itemUnits) * scaledPixelSize) / 2,
      [scaledPixelSize]
    );

    const billboardConfig = useMemo(
      () => getBillboardBounds(gridWidth, gridHeight),
      [gridWidth, gridHeight]
    );

    const selectedPixelsSet = useMemo(() => {
      const set = new Set<string>();
      selectedPixels.forEach((p) => set.add(p.id));
      return set;
    }, [selectedPixels]);

    const featuredPixelsList = useMemo(
      () => purchasedPixels.filter((p) => p.image_url?.length > 0),
      [purchasedPixels]
    );

    const currentFeaturedPixel = featuredPixelsList[currentFeaturedIndex] ?? null;

    // ── Pixel Logic ───────────────────────────────────────────

    const getPixelStatus = useCallback(
      (x: number, y: number) => {
        return getPixelSelectionStatus(x, y, {
          gridWidth,
          gridHeight,
          selectedPixelIds: selectedPixelsSet,
          getPurchasedPixel,
          currentUserId: user?.id,
        });
      },
      [gridWidth, gridHeight, selectedPixelsSet, getPurchasedPixel, user?.id]
    );

    const handlePixelClick = useCallback(
      (
        x: number,
        y: number,
        event: React.MouseEvent | React.TouchEvent | React.KeyboardEvent
      ) => {
        if (!isSelecting) return;

        const status = getPixelStatus(x, y);

        if (status === "restricted") {
          toast.info("Featured Billboard Area", {
            description: "Reserved for featured community pixels.",
            icon: <Star className="w-4 h-4 text-yellow-500" />,
          });
          return;
        }
        if (status === "sold" || status === "yours") {
          toast.error(
            status === "yours" ? "You already own this pixel!" : "This pixel is already owned!"
          );
          return;
        }

        const pixelId = getPixelId(x, y);

        // Range selection via Shift+Click
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

          const existingIds = new Set(selectedPixels.map((p) => p.id));
          const newPixels: SelectedPixel[] = [];

          for (let px = startX; px <= endX; px++) {
            for (let py = startY; py <= endY; py++) {
              if (getPixelStatus(px, py) === "available") {
                const id = getPixelId(px, py);
                if (!existingIds.has(id)) {
                  newPixels.push(createSelectedPixel(px, py));
                }
              }
            }
          }

          startTransition(() => onSelectionChange([...selectedPixels, ...newPixels]));
          toast.success(`Selected ${newPixels.length} pixels`);
          setRangeStart(null);
          return;
        }

        // Single toggle
        const existingIndex = selectedPixels.findIndex((p) => p.id === pixelId);
        if (existingIndex >= 0) {
          startTransition(() =>
            onSelectionChange(selectedPixels.filter((_, i) => i !== existingIndex))
          );
        } else {
          startTransition(() =>
            onSelectionChange([
              ...selectedPixels,
              createSelectedPixel(x, y),
            ])
          );
        }
        setRangeStart({ x, y });
      },
      [isSelecting, getPixelStatus, selectedPixels, onSelectionChange, rangeStart]
    );

    const handleContainerClick = useCallback(
      (event: React.MouseEvent) => {
        if (dragDistance > GRID_CONFIG.DRAG_THRESHOLD) return;

        if (!isSelecting) {
          toast.info(
            <span className="text-sm">
              To buy pixels, you should click on the <strong className="text-emerald-600 dark:text-emerald-400 font-bold">Buy Pixels</strong> button to proceed.
            </span>,
            { duration: 4000 }
          );
          return;
        }

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const pixelX = Math.floor((event.clientX - rect.left - viewportOffset.x) / scaledPixelSize);
        const pixelY = Math.floor((event.clientY - rect.top - viewportOffset.y) / scaledPixelSize);

        if (pixelX >= 0 && pixelX < gridWidth && pixelY >= 0 && pixelY < gridHeight) {
          handlePixelClick(pixelX, pixelY, event);
        }
      },
      [isSelecting, dragDistance, scaledPixelSize, viewportOffset, gridWidth, gridHeight, handlePixelClick]
    );

    const handleKeyDown = useCallback(
      (event: KeyboardEvent) => {
        if (!isSelecting || !hoveredPixel) return;

        // Don't intercept keys when user is typing in an input/textarea
        const tag = (event.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
          (event.target as HTMLElement)?.isContentEditable) {
          return;
        }

        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
          event.preventDefault();
          // TODO: expose setHoveredPixel from useGridInteraction to support keyboard nav
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handlePixelClick(hoveredPixel.x, hoveredPixel.y, event as unknown as React.KeyboardEvent);
        }
      },
      [isSelecting, hoveredPixel, handlePixelClick]
    );

    // ── Effects ───────────────────────────────────────────────

    useEffect(() => {
      const check = () => setIsMobile(window.innerWidth < 768);
      check();
      window.addEventListener("resize", check);
      return () => window.removeEventListener("resize", check);
    }, []);

    useEffect(() => {
      if (!enableInteraction) return;
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown, enableInteraction]);

    // Fixed: stable dep array — hasInitializedRef prevents double-run
    useLayoutEffect(() => {
      if (!containerRef.current || hasInitializedRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      if (!clientWidth || !clientHeight) return;

      const fitted = calculateFittedViewport(clientWidth, clientHeight);
      onZoomChange(fitted.zoom);
      setViewportOffset(fitted.offset);
      hasInitializedRef.current = true;
    }, [calculateFittedViewport, onZoomChange, setViewportOffset]);

    useEffect(() => {
      if (!containerRef.current || !containerSize.width || !containerSize.height) return;

      // Keep the preview centered in non-interactive mode where users cannot pan/zoom manually.
      if (!enableInteraction) {
        const fitted = calculateFittedViewport(containerSize.width, containerSize.height);
        onZoomChange(fitted.zoom);
        setViewportOffset(fitted.offset);
      }
    }, [
      containerSize.width,
      containerSize.height,
      enableInteraction,
      calculateFittedViewport,
      onZoomChange,
      setViewportOffset,
    ]);

    useEffect(() => {
      if (!featuredPixelsList.length) return;
      // Use per-tier ad duration: Gold = 6s, Premium = 3s, Economy = 1s
      const currentPixel = featuredPixelsList[currentFeaturedIndex];
      const tier = currentPixel?.price_paid
        ? getAdTierByPrice(currentPixel.price_paid)
        : "ECONOMY";
      const durationMs = AD_TIER_CONFIG[tier].adDuration * 1000;

      const id = setTimeout(
        () => setCurrentFeaturedIndex((i) => (i + 1) % featuredPixelsList.length),
        durationMs
      );
      return () => clearTimeout(id);
    }, [featuredPixelsList, currentFeaturedIndex]);

    useEffect(() => {
      const imageUrls = imageUrlsRef.current;
      return () => {
        imageUrls.forEach((url) => {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
        });
        imageUrls.clear();
      };
    }, []);

    useEffect(() => {
      if (!import.meta.env.DEV) return;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 16) console.warn("Slow render:", entry.name, entry.duration);
        }
      });
      observer.observe({ entryTypes: ["measure"] });
      return () => observer.disconnect();
    }, []);

    // ── Handle URL Pixel Focus ─────────────────────────────────
    useEffect(() => {
      const pixelParam = searchParams.get('pixel');
      if (!pixelParam || handledPixelParam.current === pixelParam) return;
      if (isLoading || !containerSize.width || !containerSize.height) return;

      handledPixelParam.current = pixelParam;

      const [xStr, yStr] = pixelParam.split(',');
      const px = parseInt(xStr, 10);
      const py = parseInt(yStr, 10);

      if (isNaN(px) || isNaN(py) || !isInGridBounds(px, py, gridWidth, gridHeight)) {
        toast.error("Invalid pixel coordinates in URL");
        return;
      }

      // Found a valid pixel to focus
      const targetZoom = Math.min(8, GRID_CONFIG.MAX_ZOOM);
      onZoomChange(targetZoom);
      const scaled = Math.max(1, Math.floor(pixelSize * targetZoom));
      setViewportOffset(
        getPixelFocusViewportOffset({
          x: px,
          y: py,
          containerWidth: containerSize.width,
          containerHeight: containerSize.height,
          scaledPixelSize: scaled,
        })
      );

      const purchased = getPurchasedPixel(px, py);
      if (purchased) {
        let block: PixelBlock | null = null;
        if (purchased.block_id) {
          // Find all pixels in this block
          const blockPixels = purchasedPixels.filter(p => p.block_id === purchased.block_id);
          if (blockPixels.length > 0) {
            const xs = blockPixels.map(p => p.x);
            const ys = blockPixels.map(p => p.y);
            block = {
              id: purchased.block_id,
              owner_id: purchased.owner_id,
              image_url: purchased.image_url || null,
              link_url: purchased.link_url || null,
              alt_text: purchased.alt_text || null,
              min_x: Math.min(...xs),
              max_x: Math.max(...xs),
              min_y: Math.min(...ys),
              max_y: Math.max(...ys),
              pixel_count: blockPixels.length,
              total_price: blockPixels.reduce((sum, p) => sum + (p.price_paid || 0), 0),
              created_at: purchased.purchased_at || new Date().toISOString(),
              updated_at: purchased.purchased_at || new Date().toISOString()
            };
          }
        }
        setInfoModalPixel(purchased);
        setInfoModalBlock(block);

        // Add a slight delay to open the modal so the zoom animation feels smooth
        setTimeout(() => setInfoModalOpen(true), 100);

      } else {
        const selectionValidation = validateSelection([createSelectedPixel(px, py)]);
        if (selectionValidation.accepted.length === 0) {
          toast.info(`Pixel at (${px}, ${py}) can't be selected`, {
            description: summarizeSelectionRejections(selectionValidation.rejected),
            duration: 5000,
          });
          return;
        }

        toast.success(`Pixel at (${px}, ${py}) is available!`, {
          description: "We've selected it for you. Buy it now to own a piece of internet history.",
          duration: 5000,
        });

        if (onAvailablePixelFocused) {
          onAvailablePixelFocused(px, py);
        }
      }
    }, [
      searchParams,
      isLoading,
      containerSize.width,
      containerSize.height,
      purchasedPixels,
      getPurchasedPixel,
      gridWidth,
      gridHeight,
      pixelSize,
      onZoomChange,
      setViewportOffset,
      onAvailablePixelFocused,
      validateSelection
    ]);

    // ── Render Pre-calculations ───────────────────────────────

    const visibleRange = useMemo(() => {
      if (!containerSize.width) return null;
      const buf = GRID_CONFIG.RENDER_BUFFER;
      const minX = Math.floor((-viewportOffset.x - buf) / scaledPixelSize);
      const maxX = Math.ceil((containerSize.width - viewportOffset.x + buf) / scaledPixelSize);
      const minY = Math.floor((-viewportOffset.y - buf) / scaledPixelSize);
      const maxY = Math.ceil((containerSize.height - viewportOffset.y + buf) / scaledPixelSize);
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }, [viewportOffset, containerSize, scaledPixelSize]);

    const visiblePurchasedPixels = useMemo(() => {
      if (!visibleRange) return [];
      if (purchasedPixels.length === 0) return [];
      return spatialIndex.query(visibleRange.x, visibleRange.y, visibleRange.w, visibleRange.h);
    }, [spatialIndex, visibleRange, purchasedPixels]);

    // Track blob URLs for cleanup (moved out of render path)
    useEffect(() => {
      visiblePurchasedPixels.forEach((p) => {
        if (p.image_url) imageUrlsRef.current.add(p.image_url);
      });
    }, [visiblePurchasedPixels]);

    const { blockData, individualPixels } = useMemo(() => {
      const blockMap = new Map<string, PurchasedPixel[]>();
      const individuals: PurchasedPixel[] = [];

      visiblePurchasedPixels.forEach((pixel) => {
        if (pixel.block_id && pixel.image_url) {
          const group = blockMap.get(pixel.block_id) ?? [];
          group.push(pixel);
          blockMap.set(pixel.block_id, group);
        } else {
          individuals.push(pixel);
        }
      });

      const blocks = Array.from(blockMap.entries()).map(([blockId, pixels]) => {
        const xs = pixels.map((p) => p.x);
        const ys = pixels.map((p) => p.y);
        const first = pixels[0];
        return {
          blockId,
          minX: Math.min(...xs),
          minY: Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs) + 1,
          height: Math.max(...ys) - Math.min(...ys) + 1,
          imageUrl: first.image_url!,
          linkUrl: first.link_url,
          altText: first.alt_text,
          ownerId: first.owner_id,
          tierAnimationClass: getTierAnimationClass(first.price_paid),
        };
      });

      return { blockData: blocks, individualPixels: individuals };
    }, [visiblePurchasedPixels]);

    const visibleSelectedPixels = useMemo(() => {
      if (!visibleRange) return selectedPixels;
      return selectedPixels.filter(
        (p) =>
          p.x >= visibleRange.x &&
          p.x <= visibleRange.x + visibleRange.w &&
          p.y >= visibleRange.y &&
          p.y <= visibleRange.y + visibleRange.h
      );
    }, [selectedPixels, visibleRange]);

    // ── Derived render values (avoid repeated calls in JSX) ──
    const hoveredStatus = hoveredPixel ? getPixelStatus(hoveredPixel.x, hoveredPixel.y) : null;
    const tooltipStatus =
      hoveredStatus === "restricted" ? "available" : (hoveredStatus ?? "available");

    const cursor = isDragging
      ? "grabbing"
      : !enableInteraction
        ? "default"
        : isSelecting
          ? "crosshair"
          : "grab";

    // ── Render ────────────────────────────────────────────────

    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <div
          ref={containerRef}
          className="relative overflow-hidden select-none rounded-lg shadow-2xl"
          style={{
            width: "100%",
            height: "100%",
            touchAction: enableInteraction ? "none" : "pan-y",
            WebkitUserSelect: "none",
            cursor,
            backgroundColor: "#e8ecf1",
            backgroundImage:
              "linear-gradient(45deg, #dfe3e8 25%, transparent 25%), linear-gradient(-45deg, #dfe3e8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #dfe3e8 75%), linear-gradient(-45deg, transparent 75%, #dfe3e8 75%)",
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleContainerClick}
          role={enableInteraction ? "application" : "region"}
          aria-label={
            enableInteraction
              ? `Interactive pixel grid canvas, ${purchasedPixels.length} pixels sold, ${selectedPixels.length} selected`
              : `Pixel grid preview, ${purchasedPixels.length} pixels sold`
          }
          aria-live="polite"
          tabIndex={0}
        >
          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center z-50 gap-3">
              <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
              <p className="text-sm font-medium text-indigo-600">Loading the grid...</p>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm z-50">
              {error}
            </div>
          )}

          {/* Grid Canvas */}
          <div
            style={{
              transform: `translate3d(${Math.round(viewportOffset.x)}px, ${Math.round(viewportOffset.y)}px, 0)`,
              willChange: isDragging ? "transform" : "auto",
              transformOrigin: "0 0",
            }}
          >
            {/* Grid Background */}
            <div
              className="absolute pointer-events-none rounded-md"
              style={{
                width: gridWidth * scaledPixelSize,
                height: gridHeight * scaledPixelSize,
                backgroundColor: "#ffffff",
                boxShadow: "0 4px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)",
              }}
            />

            {/* Grid Lines — only show when pixels are large enough to distinguish */}
            {showGrid && scaledPixelSize >= 4 && (
              <div
                className="absolute pointer-events-none rounded-md"
                style={{
                  width: gridWidth * scaledPixelSize,
                  height: gridHeight * scaledPixelSize,
                  backgroundImage:
                    "linear-gradient(to right, rgba(148,163,184,0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.3) 1px, transparent 1px)",
                  backgroundSize: `${scaledPixelSize}px ${scaledPixelSize}px`,
                }}
              />
            )}

            {/* Price Zone Boundaries — 3 distinct colors per spec */}
            <div className="absolute pointer-events-none">
              {/* Economy / Premium boundary (outermost 3 rows end here) — emerald */}
              <div
                className="absolute rounded-md"
                style={{
                  left: getCenteredOffset(gridWidth, ZONE_SIZES.PREMIUM_ZONE_SIZE),
                  top: getCenteredOffset(gridHeight, ZONE_SIZES.PREMIUM_ZONE_SIZE),
                  width: ZONE_SIZES.PREMIUM_ZONE_SIZE * scaledPixelSize,
                  height: ZONE_SIZES.PREMIUM_ZONE_SIZE * scaledPixelSize,
                  border: "2px solid rgba(16, 185, 129, 0.6)",
                  boxShadow: "inset 0 0 30px rgba(16,185,129,0.06)",
                }}
              />
              {/* Premium / Gold boundary (next 5 rows end here) — violet */}
              <div
                className="absolute rounded-md"
                style={{
                  left: getCenteredOffset(gridWidth, ZONE_SIZES.GOLD_ZONE_SIZE),
                  top: getCenteredOffset(gridHeight, ZONE_SIZES.GOLD_ZONE_SIZE),
                  width: ZONE_SIZES.GOLD_ZONE_SIZE * scaledPixelSize,
                  height: ZONE_SIZES.GOLD_ZONE_SIZE * scaledPixelSize,
                  border: "2px solid rgba(139, 92, 246, 0.6)",
                  boxShadow: "inset 0 0 25px rgba(139,92,246,0.08)",
                }}
              />
            </div>

            {/* Billboard */}
            <div
              className="absolute z-30 overflow-hidden flex flex-col items-center justify-center group rounded-md"
              style={{
                left: getCenteredOffset(gridWidth, billboardConfig.width),
                top: getCenteredOffset(gridHeight, billboardConfig.height),
                width: billboardConfig.width * scaledPixelSize,
                height: billboardConfig.height * scaledPixelSize,
                pointerEvents: "auto",
                border: "3px solid #eab308",
                backgroundColor: "#18181b",
                boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
              }}
              role="region"
              aria-label="Featured billboard area"
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
                    className="absolute inset-0 bg-contain bg-center bg-no-repeat transition-all duration-1000 ease-in-out"
                    style={{
                      backgroundImage: `url(${getBillboardImageUrl(currentFeaturedPixel.image_url)})`,
                      backgroundColor: '#18181b',
                      opacity: 0.95,
                      imageRendering: zoom < 1 ? "auto" : "pixelated",
                    }}
                    role="img"
                    aria-label={currentFeaturedPixel.alt_text || "Featured billboard content"}
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
                          openAdvertiserUrl(currentFeaturedPixel.link_url!, 'billboard');
                          trackPixelClick(null, currentFeaturedPixel.block_id, 'billboard');
                        }}
                        aria-label={`Visit ${currentFeaturedPixel.alt_text || "featured partner"}`}
                      >
                        Visit Partner <ExternalLink className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Selected Pixels */}
            {visibleSelectedPixels.map(({ x, y, id }) => (
              <div
                key={`sel-${id}`}
                className="absolute pointer-events-none"
                style={{
                  left: Math.floor(x * scaledPixelSize),
                  top: Math.floor(y * scaledPixelSize),
                  width: scaledPixelSize,
                  height: scaledPixelSize,
                  backgroundColor: isPending
                    ? "rgba(168,85,247,0.3)"
                    : "rgba(168,85,247,0.5)",
                  border: "1px solid #a855f7",
                  opacity: isPending ? 0.7 : 1,
                }}
              />
            ))}

            {/* Block Images */}
            {blockData.map((block) => {
              if (showMyPixels && block.ownerId !== user?.id) return null;
              const isOwner = block.ownerId === user?.id;
              const isHighlight = highlightUser === block.ownerId;
              return (
                <div
                  key={`block-${block.blockId}`}
                  role="button"
                  tabIndex={0}
                  className={`cursor-pointer transition-all duration-300${scaledPixelSize >= 6 && !isOwner && !isHighlight ? block.tierAnimationClass : ""}`}
                  style={{
                    position: "absolute",
                    left: Math.floor(block.minX * scaledPixelSize),
                    top: Math.floor(block.minY * scaledPixelSize),
                    width: block.width * scaledPixelSize,
                    height: block.height * scaledPixelSize,
                    backgroundImage: `url(${getGridImageUrl(block.imageUrl, zoom)})`,
                    backgroundSize: "contain",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    backgroundColor: "#1e1e2e",
                    opacity: isHighlight ? 1 : isOwner ? 1 : 0.9,
                    boxShadow: isHighlight
                      ? "0 0 15px rgba(249,115,22,1)"
                      : isOwner
                        ? "0 0 8px rgba(16,185,129,0.7)"
                        : "0 2px 8px rgba(0,0,0,0.15)",
                    border: isHighlight
                      ? "3px solid #f97316"
                      : isOwner ? "2px solid #10b981" : "1px solid #cbd5e1",
                    borderRadius: "2px",
                    zIndex: isHighlight ? 20 : isOwner ? 15 : 5,
                    imageRendering: zoom < 1 ? "auto" : "pixelated",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (dragDistance > GRID_CONFIG.DRAG_THRESHOLD) return;
                    if (!isSelecting) {
                      // Open pixel info modal
                      const firstPixel = visiblePurchasedPixels.find(
                        (p) => p.block_id === block.blockId
                      );
                      if (firstPixel) {
                        setInfoModalPixel(firstPixel);
                        setInfoModalBlock({
                          id: block.blockId,
                          owner_id: block.ownerId,
                          image_url: block.imageUrl,
                          link_url: block.linkUrl || null,
                          alt_text: block.altText || null,
                          min_x: block.minX,
                          max_x: block.minX + block.width - 1,
                          min_y: block.minY,
                          max_y: block.minY + block.height - 1,
                          pixel_count: block.width * block.height,
                          total_price: 0,
                          created_at: firstPixel.purchased_at || new Date().toISOString(),
                          updated_at: firstPixel.purchased_at || new Date().toISOString(),
                        });
                        setInfoModalOpen(true);
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (block.linkUrl) {
                        openUrl(block.linkUrl);
                        trackPixelClick(null, block.blockId, 'grid');
                      }
                    }
                  }}
                  aria-label={block.altText || `Pixel block at (${block.minX}, ${block.minY})`}
                />
              );
            })}

            {/* Individual Pixels */}
            {individualPixels.map((pixel) => {
              if (showMyPixels && pixel.owner_id !== user?.id) return null;
              const { x, y, id, owner_id, image_url, link_url, alt_text } = pixel;
              const isOwner = owner_id === user?.id;
              const isHighlight = highlightUser === owner_id;
              const tierAnimationClass =
                scaledPixelSize >= 6 && !isOwner && !isHighlight
                  ? getTierAnimationClass(pixel.price_paid)
                  : "";
              return (
                <div
                  key={`sold-${id}`}
                  role="button"
                  tabIndex={0}
                  className={`cursor-pointer transition-all duration-300${tierAnimationClass}`}
                  style={{
                    position: "absolute",
                    left: Math.floor(x * scaledPixelSize),
                    top: Math.floor(y * scaledPixelSize),
                    width: scaledPixelSize,
                    height: scaledPixelSize,
                    backgroundColor: image_url
                      ? "transparent"
                      : isOwner
                        ? "#10b981"
                        : "#ef4444",
                    backgroundImage: image_url
                      ? `url(${getGridImageUrl(image_url, zoom)})`
                      : "none",
                    backgroundSize: "contain",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    opacity: isHighlight ? 1 : isOwner ? 1 : 0.85,
                    boxShadow: isHighlight
                      ? "0 0 12px rgba(249,115,22,1)"
                      : isOwner ? "0 0 6px rgba(16,185,129,0.6)" : "none",
                    border: isHighlight
                      ? "2px solid #f97316"
                      : isOwner ? "1px solid #10b981" : "1px solid #cbd5e1",
                    zIndex: isHighlight ? 20 : isOwner ? 10 : 0,
                    imageRendering: zoom < 1 ? "auto" : "pixelated",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (dragDistance > GRID_CONFIG.DRAG_THRESHOLD) return;
                    if (!isSelecting) {
                      // Open pixel info modal for individual pixel
                      setInfoModalPixel(pixel);
                      setInfoModalBlock(null);
                      setInfoModalOpen(true);
                    }
                  }}
                  onKeyDown={(e) => {
                    if ((link_url || image_url) && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      if (link_url) {
                        openUrl(link_url);
                        trackPixelClick(id, null, 'grid');
                      }
                    }
                  }}
                  aria-label={alt_text || `Pixel at ${x}, ${y}`}
                />
              );
            })}

            {/* Hover Indicator */}
            {hoveredPixel && hoveredStatus && isSelecting && !isDragging && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: Math.floor(hoveredPixel.x * scaledPixelSize),
                  top: Math.floor(hoveredPixel.y * scaledPixelSize),
                  width: scaledPixelSize,
                  height: scaledPixelSize,
                  backgroundColor:
                    hoveredStatus === "restricted"
                      ? "rgba(239, 68, 68, 0.3)"
                      : "rgba(99, 102, 241, 0.2)",
                  borderStyle: hoveredStatus === "restricted" ? "solid" : "dashed",
                  borderWidth: "1px",
                  borderColor:
                    hoveredStatus === "restricted" ? "#ef4444" : "#818cf8",
                }}
              />
            )}
          </div>

          {/* Selection Count Badge */}
          {selectedPixels.length > 0 && (
            <div className="absolute top-3 right-3 pointer-events-none bg-purple-500/90 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg">
              {selectedPixels.length} selected
              {isPending && <span className="ml-2 inline-block animate-pulse">...</span>}
            </div>
          )}

          {/* Test Mode Badge — visible when payment bypass is active */}
          {import.meta.env.VITE_BYPASS_PAYMENT === 'true' && (
            <div className="absolute bottom-3 right-3 pointer-events-none bg-amber-500/90 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-lg flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Test Mode
            </div>
          )}
        </div>

        {/* Tooltip */}
        {hoveredPixel && !isMobile && !isDragging && (
          <PixelTooltip
            x={hoveredPixel.x}
            y={hoveredPixel.y}
            price={calculatePixelPrice(hoveredPixel.x, hoveredPixel.y)}
            status={tooltipStatus}
          />
        )}

        {/* Pixel Info Modal — shown when user clicks a purchased pixel */}
        <PixelInfoModal
          isOpen={infoModalOpen}
          onClose={() => {
            setInfoModalOpen(false);
            setInfoModalPixel(null);
            setInfoModalBlock(null);
          }}
          pixel={infoModalPixel}
          block={infoModalBlock}
        />
      </div>
    );
  }
);

VirtualizedPixelGrid.displayName = "VirtualizedPixelGrid";
