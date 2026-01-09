import { useState, useCallback, useRef, useEffect, RefObject } from "react";
import { GRID_CONFIG } from "@/utils/gridConstants";
import { toast } from "sonner";

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
   const [touchStart, setTouchStart] = useState<{ x: number; y: number; dist: number } | null>(null);
   const [initialZoom, setInitialZoom] = useState(zoom);

   const animationFrameRef = useRef<number>();
   const hoverTimeoutRef = useRef<NodeJS.Timeout>();
   const lastWarningRef = useRef<number>(0);

   // -- Memoized Calculations --
   const scaledPixelSize = pixelSize * zoom;

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

   const handleInteractionWarning = useCallback(() => {
      const now = Date.now();
      if (now - lastWarningRef.current > 2000) {
         toast.info("Interaction Paused", {
            description: "Click 'Buy Pixels' to zoom, pan, and select!",
            duration: 3000,
         });
         lastWarningRef.current = now;
      }
   }, []);


   // -- Event Handlers --

   const handleMouseDown = useCallback(
      (event: React.MouseEvent) => {
         if (!enableInteraction) {
            handleInteractionWarning();
            return;
         }
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
      [viewportOffset, enableInteraction, handleInteractionWarning]
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
      [isDragging, dragStart, scaledPixelSize, viewportOffset, gridWidth, gridHeight, clampOffset, zoom, containerRef]
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

   // Wheel & Touch
   useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const handleWheel = (event: WheelEvent) => {
         if (!enableInteraction) return;
         event.preventDefault();
         const zoomFactor = GRID_CONFIG.ZOOM_FACTOR;
         const newZoom = event.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
         const safeZoom = Math.max(
            GRID_CONFIG.MIN_ZOOM,
            Math.min(GRID_CONFIG.MAX_ZOOM, newZoom)
         );
         onZoomChange(safeZoom);
      };

      const handleTouchStart = (e: TouchEvent) => {
         if (!enableInteraction) {
            handleInteractionWarning();
            return;
         }
         if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            setTouchStart({ x: 0, y: 0, dist });
            setInitialZoom(zoom);
         } else if (e.touches.length === 1) {
            setIsDragging(true);
            setDragDistance(0);
            setHoveredPixel(null);
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
               const newZoom = Math.min(
                  GRID_CONFIG.MAX_ZOOM,
                  Math.max(GRID_CONFIG.MIN_ZOOM, initialZoom * scale)
               );
               onZoomChange(newZoom);
            }
         } else if (e.touches.length === 1 && isDragging && dragStart) {
            e.preventDefault();
            const deltaX = e.touches[0].clientX - dragStart.x;
            const deltaY = e.touches[0].clientY - dragStart.y;
            setDragDistance((prev) => prev + Math.abs(deltaX) + Math.abs(deltaY));
            const rawNewX = viewportOffset.x + deltaX;
            const rawNewY = viewportOffset.y + deltaY;
            setViewportOffset(clampOffset(rawNewX, rawNewY, zoom));
            setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
         }
      };

      const handleTouchEnd = () => {
         setIsDragging(false);
         setTouchStart(null);
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
   }, [
      containerRef,
      enableInteraction,
      zoom,
      onZoomChange,
      touchStart,
      initialZoom,
      isDragging,
      dragStart,
      clampOffset,
      viewportOffset,
      // Add grid props to dependencies if they affect calculation (indirectly via clampOffset)
      gridWidth,
      gridHeight,
      pixelSize
   ]);

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
