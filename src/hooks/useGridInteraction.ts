import { useState, useCallback, useRef, useEffect, RefObject } from "react";
import { toast } from "sonner";
import { GRID_CONFIG } from "@/utils/gridConstants";

interface UseGridInteractionProps {
   gridWidth: number;
   gridHeight: number;
   pixelSize: number;
   containerRef: RefObject<HTMLDivElement>;
   zoom: number;
   onZoomChange: (zoom: number) => void;
   enableInteraction: boolean;
}

export function useGridInteraction({
   gridWidth,
   gridHeight,
   pixelSize,
   containerRef,
   zoom,
   onZoomChange,
   enableInteraction,
}: UseGridInteractionProps) {
   // -- State: Viewport --
   const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });
   const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

   // -- State: Interaction --
   const [isDragging, setIsDragging] = useState(false);
   const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
   const [dragDistance, setDragDistance] = useState(0);
   const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number } | null>(null);
   const [isForcePanning, setIsForcePanning] = useState(false);

   const animationFrameRef = useRef<number>();
   const hoverTimeoutRef = useRef<NodeJS.Timeout>();
   const longPressTimeoutRef = useRef<NodeJS.Timeout>();

   // -- Refs for stable event handler values --
   // These prevent the wheel/touch effect from re-registering on every frame
   const zoomRef = useRef(zoom);
   const viewportOffsetRef = useRef(viewportOffset);
   const isDraggingRef = useRef(isDragging);
   const dragStartRef = useRef(dragStart);
   const initialZoomRef = useRef(zoom);
   const touchStartRef = useRef<{ x: number; y: number; dist: number } | null>(null);
   const isForcePanningRef = useRef(isForcePanning);

   // Keep refs in sync with state
   zoomRef.current = zoom;
   viewportOffsetRef.current = viewportOffset;
   isDraggingRef.current = isDragging;
   dragStartRef.current = dragStart;
   isForcePanningRef.current = isForcePanning;

   // -- Memoized Calculations --
   // Must match render-time pixel sizing in VirtualizedPixelGrid to avoid hover offset drift.
   const scaledPixelSize = Math.max(1, pixelSize * zoom);

   const clampOffset = useCallback(
      (x: number, y: number, currentScale: number) => {
         // Must match the rendering formula: pixelSize * zoom (no Math.floor).
         const fittedPixelSize = Math.max(1, pixelSize * currentScale);
         const totalGridWidth = gridWidth * fittedPixelSize;
         const totalGridHeight = gridHeight * fittedPixelSize;
         const margin = GRID_CONFIG.PAN_VIEWPORT_MARGIN;

         const clampAxis = (
            next: number,
            contentSize: number,
            viewportSize: number
         ) => {
            if (contentSize <= viewportSize) {
               return (viewportSize - contentSize) / 2;
            }

            const min = viewportSize - contentSize - margin;
            const max = margin;
            return Math.min(Math.max(next, min), max);
         };

         return {
            x: clampAxis(x, totalGridWidth, containerSize.width),
            y: clampAxis(y, totalGridHeight, containerSize.height),
         };
      },
      [containerSize, gridWidth, gridHeight, pixelSize]
   );

   // Store clampOffset in ref for stable access in event handlers
   const clampOffsetRef = useRef(clampOffset);
   clampOffsetRef.current = clampOffset;




   // -- Event Handlers --

   const handleMouseDown = useCallback(
      (event: React.MouseEvent) => {
         if (!enableInteraction) return;
         if (event.button !== 0 && event.button !== 1) return;

         // Ignore mouse down on buttons
         if ((event.target as HTMLElement).closest('button')) return;

         setIsDragging(true);
         isDraggingRef.current = true;
         setDragDistance(0);
         setHoveredPixel(null);

         if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
         }

         const startX = event.clientX - viewportOffsetRef.current.x;
         const startY = event.clientY - viewportOffsetRef.current.y;
         setDragStart({ x: startX, y: startY });
         dragStartRef.current = { x: startX, y: startY };
      },
      [enableInteraction]
   );

   const handleMouseMove = useCallback(
      (event: React.MouseEvent) => {
         if (!isDraggingRef.current) {
            // Hover logic with debouncing
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
               const relativeX = event.clientX - rect.left - viewportOffsetRef.current.x;
               const relativeY = event.clientY - rect.top - viewportOffsetRef.current.y;
               
               // Must match the render-time pixel sizing formula exactly
               const currentScaledPixelSize = Math.max(1, pixelSize * zoomRef.current);
               const pixelX = Math.floor(relativeX / currentScaledPixelSize);
               const pixelY = Math.floor(relativeY / currentScaledPixelSize);

               if (pixelX >= 0 && pixelX < gridWidth && pixelY >= 0 && pixelY < gridHeight) {
                  if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                  hoverTimeoutRef.current = setTimeout(() => {
                     setHoveredPixel({ x: pixelX, y: pixelY });
                  }, GRID_CONFIG.HOVER_DEBOUNCE_MS);
               } else {
                  setHoveredPixel(null);
               }
            }
            return;
         }

         // Drag logic
         if (!enableInteraction) return;
         const start = dragStartRef.current;
         if (start && !animationFrameRef.current) {
            animationFrameRef.current = requestAnimationFrame(() => {
               const newX = event.clientX - start.x;
               const newY = event.clientY - start.y;

               const dist = Math.sqrt(
                  Math.pow(newX - viewportOffsetRef.current.x, 2) + Math.pow(newY - viewportOffsetRef.current.y, 2)
               );
               setDragDistance((prev) => prev + dist);

               const clamped = clampOffsetRef.current(newX, newY, zoomRef.current);
               setViewportOffset(clamped);

               animationFrameRef.current = undefined;
            });
         }
      },
      [enableInteraction, gridWidth, gridHeight, pixelSize, containerRef]
   );

   const handleMouseUp = useCallback(() => {
      setIsDragging(false);
      if (animationFrameRef.current) {
         cancelAnimationFrame(animationFrameRef.current);
         animationFrameRef.current = undefined;
      }
   }, []);

   // -- Effects --

   // Container Sizing
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
      const ro = new ResizeObserver(updateSize);
      ro.observe(containerRef.current);
      return () => ro.disconnect();
   }, [containerRef]);

   useEffect(() => {
      setViewportOffset((current) => {
         const clamped = clampOffset(current.x, current.y, zoom);
         if (clamped.x === current.x && clamped.y === current.y) return current;
         viewportOffsetRef.current = clamped;
         return clamped;
      });
   }, [clampOffset, zoom]);

   useEffect(() => {
      if (enableInteraction) return;
      setIsDragging(false);
      isDraggingRef.current = false;
      dragStartRef.current = null;
      setDragStart(null);
      touchStartRef.current = null;
   }, [enableInteraction]);

   // Wheel and touch handlers are now always attached so zooming and long-press panning work.
   useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const handleWheel = (event: WheelEvent) => {
         // Ignore wheel events on overlay buttons
         if ((event.target as HTMLElement).closest('button')) return;

         // PREVENT default page scroll when interacting with the canvas
         event.preventDefault();
         
         const currentOffset = viewportOffsetRef.current;

         // Zoom toward cursor position only with explicit modifier intent.
         const currentZoom = zoomRef.current;
         const zoomFactor = GRID_CONFIG.ZOOM_FACTOR;
         const newZoom = event.deltaY < 0 ? currentZoom * zoomFactor : currentZoom / zoomFactor;
         const rect = container.getBoundingClientRect();
         
         // Calculate dynamic minimum zoom so users don't get lost
         const fitZoomX = rect.width / (gridWidth * pixelSize);
         const fitZoomY = rect.height / (gridHeight * pixelSize);
         const dynamicMinZoom = Math.min(fitZoomX, fitZoomY) * 0.5;
         const minZoomLimit = Math.max(GRID_CONFIG.MIN_ZOOM, dynamicMinZoom);

         const safeZoom = Math.max(
            minZoomLimit,
            Math.min(GRID_CONFIG.MAX_ZOOM, newZoom)
         );

         // Haptic feedback when hitting zoom limits
         if (navigator.vibrate && safeZoom !== currentZoom && (safeZoom === minZoomLimit || safeZoom === GRID_CONFIG.MAX_ZOOM)) {
            navigator.vibrate(20);
         }
         const cursorX = event.clientX - rect.left;
         const cursorY = event.clientY - rect.top;
         const scale = safeZoom / currentZoom;
         const newOffX = cursorX - (cursorX - currentOffset.x) * scale;
         const newOffY = cursorY - (cursorY - currentOffset.y) * scale;
         const clamped = clampOffsetRef.current(newOffX, newOffY, safeZoom);
         setViewportOffset(clamped);

         onZoomChange(safeZoom);
      };

      const handleTouchStart = (e: TouchEvent) => {
         // Ignore touches on overlay buttons
         if ((e.target as HTMLElement).closest('button')) return;

         if (e.touches.length === 2) {
            e.preventDefault(); // Prevent browser zoom
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            // Store the pinch midpoint as the focal center
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            touchStartRef.current = { x: midX, y: midY, dist };
            initialZoomRef.current = zoomRef.current;
         } else if (e.touches.length === 1) {
            // Do not prevent default on touchstart so a pure tap can still emit click
            // and trigger pixel selection on mobile. We prevent default in touchmove
            // while actively panning to avoid page scroll.
            setIsDragging(true);
            isDraggingRef.current = true;
            setDragDistance(0);
            setHoveredPixel(null);
            const startX = e.touches[0].clientX;
            const startY = e.touches[0].clientY;
            dragStartRef.current = { x: startX, y: startY };
            setDragStart({ x: startX, y: startY });

            // Start long press timer if interaction is not normally enabled
            if (!enableInteraction) {
               longPressTimeoutRef.current = setTimeout(() => {
                  setIsForcePanning(true);
                  isForcePanningRef.current = true;
                  if (navigator.vibrate) navigator.vibrate(50);
                  toast.info("Grid movement enabled", { duration: 1500, position: "top-center" });
               }, 600); // 600ms long press to enable panning
            }
         }
      };

      const handleTouchMove = (e: TouchEvent) => {
         // Ignore touches on overlay buttons
         if ((e.target as HTMLElement).closest('button')) return;

         // Clear long press if they move their finger before it triggers
         if (longPressTimeoutRef.current && !isForcePanningRef.current && dragStartRef.current) {
            const dx = Math.abs(e.touches[0].clientX - dragStartRef.current.x);
            const dy = Math.abs(e.touches[0].clientY - dragStartRef.current.y);
            if (dx > 10 || dy > 10) {
               clearTimeout(longPressTimeoutRef.current);
               longPressTimeoutRef.current = undefined;
            }
         }

         if (e.touches.length === 2 && touchStartRef.current) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0 && touchStartRef.current.dist > 0) {
               const scale = dist / touchStartRef.current.dist;
               const rect = container.getBoundingClientRect();
               
               // Calculate dynamic minimum zoom so users don't get lost
               const fitZoomX = rect.width / (gridWidth * pixelSize);
               const fitZoomY = rect.height / (gridHeight * pixelSize);
               const dynamicMinZoom = Math.min(fitZoomX, fitZoomY) * 0.5;
               const minZoomLimit = Math.max(GRID_CONFIG.MIN_ZOOM, dynamicMinZoom);

               const newZoom = Math.min(
                  GRID_CONFIG.MAX_ZOOM,
                  Math.max(minZoomLimit, initialZoomRef.current * scale)
               );

               // Focal-point zoom: keep the pinch center stable
               const currentZoom = zoomRef.current;
               
               // Haptic feedback when hitting zoom limits during pinch
               if (navigator.vibrate && newZoom !== currentZoom && (newZoom === minZoomLimit || newZoom === GRID_CONFIG.MAX_ZOOM)) {
                  navigator.vibrate(20);
               }
               const currentOffset = viewportOffsetRef.current;
               const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
               const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
               const focalX = midX - rect.left;
               const focalY = midY - rect.top;
               const zoomScale = newZoom / currentZoom;
               const newOffX = focalX - (focalX - currentOffset.x) * zoomScale;
               const newOffY = focalY - (focalY - currentOffset.y) * zoomScale;
               const clamped = clampOffsetRef.current(newOffX, newOffY, newZoom);
               setViewportOffset(clamped);

               onZoomChange(newZoom);
            }
         } else if (e.touches.length === 1 && isDraggingRef.current && dragStartRef.current) {
            if (!enableInteraction && !isForcePanningRef.current) return;
            e.preventDefault();
            const currentOffset = viewportOffsetRef.current;
            const currentZoom = zoomRef.current;
            const deltaX = e.touches[0].clientX - dragStartRef.current.x;
            const deltaY = e.touches[0].clientY - dragStartRef.current.y;
            setDragDistance((prev) => prev + Math.abs(deltaX) + Math.abs(deltaY));
            const rawNewX = currentOffset.x + deltaX;
            const rawNewY = currentOffset.y + deltaY;
            const clamped = clampOffsetRef.current(rawNewX, rawNewY, currentZoom);
            setViewportOffset(clamped);
            dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
         }
      };

      const handleTouchEnd = () => {
         setIsDragging(false);
         isDraggingRef.current = false;
         touchStartRef.current = null;
         if (longPressTimeoutRef.current) {
            clearTimeout(longPressTimeoutRef.current);
            longPressTimeoutRef.current = undefined;
         }
         setIsForcePanning(false);
         isForcePanningRef.current = false;
      };

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
      // Re-register when interaction mode changes so view mode has no touch/wheel hijackers.
      // All mutable values are read from refs inside the handlers.
   }, [containerRef, onZoomChange, enableInteraction]);

   return {
      viewportOffset,
      setViewportOffset,
      containerSize,
      isDragging,
      dragDistance,
      hoveredPixel,
      handleMouseDown,
      handleMouseMove,
      handleMouseUp,
      clampOffset, // Exporting for usage if needed
      isForcePanning,
   };
}
