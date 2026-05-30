import { useState, useCallback, useRef, useEffect, RefObject } from "react";
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
   const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

   // -- State: Interaction --
   const [isDragging, setIsDragging] = useState(false);
   const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
   const [dragDistance, setDragDistance] = useState(0);
   const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number } | null>(null);

   const animationFrameRef = useRef<number>();
   const hoverTimeoutRef = useRef<NodeJS.Timeout>();

   // -- Refs for stable event handler values --
   // These prevent the wheel/touch effect from re-registering on every frame
   const zoomRef = useRef(zoom);
   const viewportOffsetRef = useRef(viewportOffset);
   const isDraggingRef = useRef(isDragging);
   const dragStartRef = useRef(dragStart);
   const initialZoomRef = useRef(zoom);
   const touchStartRef = useRef<{ x: number; y: number; dist: number } | null>(null);

   // Keep refs in sync with state
   zoomRef.current = zoom;
   viewportOffsetRef.current = viewportOffset;
   isDraggingRef.current = isDragging;
   dragStartRef.current = dragStart;

   // -- Memoized Calculations --
   // Must match render-time pixel sizing in VirtualizedPixelGrid to avoid hover offset drift.
   const scaledPixelSize = Math.max(1, pixelSize * zoom);

   const clampOffset = useCallback(
      (x: number, y: number, currentScale: number) => {
         // Use floored pixel size to match the renderer's actual grid dimensions
         const fittedPixelSize = Math.max(1, pixelSize * currentScale);
         const totalGridWidth = gridWidth * fittedPixelSize;
         const totalGridHeight = gridHeight * fittedPixelSize;
         const margin = GRID_CONFIG.PAN_VIEWPORT_MARGIN;

         const clampAxis = (
            next: number,
            contentSize: number,
            viewportSize: number
         ) => {
            if (contentSize <= viewportSize - margin * 2) {
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

         setIsDragging(true);
         setDragDistance(0);
         setHoveredPixel(null);

         if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
         }

         setDragStart({
            x: event.clientX - viewportOffset.x,
            y: event.clientY - viewportOffset.y,
         });
      },
      [enableInteraction, viewportOffset]
   );

   const handleMouseMove = useCallback(
      (event: React.MouseEvent) => {
         if (!isDragging) {
            // Hover logic with debouncing
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
                  }, GRID_CONFIG.HOVER_DEBOUNCE_MS);
               } else {
                  setHoveredPixel(null);
               }
            }
            return;
         }

         // Drag logic
         if (!enableInteraction) return;
         if (dragStart && !animationFrameRef.current) {
            animationFrameRef.current = requestAnimationFrame(() => {
               const newX = event.clientX - dragStart.x;
               const newY = event.clientY - dragStart.y;

               const dist = Math.sqrt(
                  Math.pow(newX - viewportOffset.x, 2) + Math.pow(newY - viewportOffset.y, 2)
               );
               setDragDistance((prev) => prev + dist);

               const clamped = clampOffset(newX, newY, zoom);
               setViewportOffset(clamped);

               animationFrameRef.current = undefined;
            });
         }
      },
      [isDragging, dragStart, scaledPixelSize, viewportOffset, gridWidth, gridHeight, clampOffset, zoom, containerRef, enableInteraction]
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

   // Wheel and touch handlers are only attached while canvas interaction is enabled.
   useEffect(() => {
      const container = containerRef.current;
      if (!container || !enableInteraction) return;

      const handleWheel = (event: WheelEvent) => {
         if (!event.ctrlKey && !event.metaKey) return;

         event.preventDefault();
         const currentOffset = viewportOffsetRef.current;

         // Zoom toward cursor position only with explicit modifier intent.
         const currentZoom = zoomRef.current;
         const zoomFactor = GRID_CONFIG.ZOOM_FACTOR;
         const newZoom = event.deltaY < 0 ? currentZoom * zoomFactor : currentZoom / zoomFactor;
         const safeZoom = Math.max(
            GRID_CONFIG.MIN_ZOOM,
            Math.min(GRID_CONFIG.MAX_ZOOM, newZoom)
         );

         const rect = container.getBoundingClientRect();
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
            dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
         }
      };

      const handleTouchMove = (e: TouchEvent) => {
         if (e.touches.length === 2 && touchStartRef.current) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0 && touchStartRef.current.dist > 0) {
               const scale = dist / touchStartRef.current.dist;
               const newZoom = Math.min(
                  GRID_CONFIG.MAX_ZOOM,
                  Math.max(GRID_CONFIG.MIN_ZOOM, initialZoomRef.current * scale)
               );

               // Focal-point zoom: keep the pinch center stable
               const currentZoom = zoomRef.current;
               const currentOffset = viewportOffsetRef.current;
               const rect = container.getBoundingClientRect();
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
   };
}
