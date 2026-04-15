import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PurchasedPixel } from "@/types/grid";
import { SpatialIndex } from "@/utils/SpatialIndex";
import { toast } from "sonner";

export function usePixelGridData() {
   const [purchasedPixels, setPurchasedPixels] = useState<PurchasedPixel[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);

   const spatialIndex = useRef(new SpatialIndex());
   const loadedRef = useRef(false);
   const isMountedRef = useRef(true);

   // Optimized single-query loader (no batching)
   const loadPurchased = useCallback(async (silent = false) => {
      // Create controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      try {
         if (!silent) {
            setIsLoading(true);
         }
         setError(null);

         // Single query: Load all purchased pixels efficiently
         // Ordered by y, x for better spatial locality
         const { data, error: fetchError } = await supabase
            .from("pixels")
            .select("id, x, y, owner_id, image_url, link_url, alt_text, block_id")
            .not("owner_id", "is", null)
            .order("y", { ascending: true })
            .order("x", { ascending: true })
            .abortSignal(controller.signal);

         if (fetchError) {
            throw fetchError;
         }

         if (!isMountedRef.current) return;

         const allPixels: PurchasedPixel[] = (data || []).map((row) => ({
            id: row.id,
            x: row.x,
            y: row.y,
            owner_id: row.owner_id,
            image_url: row.image_url,
            link_url: row.link_url,
            alt_text: row.alt_text,
            block_id: row.block_id ?? null,
         }));

         // Rebuild spatial index
         spatialIndex.current.clear();
         allPixels.forEach((pixel) => {
            spatialIndex.current.add(pixel);
         });

         setPurchasedPixels(allPixels);
         loadedRef.current = true;
      } catch (err: unknown) {
         if (!isMountedRef.current) return;

         if (err instanceof DOMException && err.name === 'AbortError') {
            console.warn("Pixel grid load timed out");
            setError("Loading took too long. Please refresh.");
            toast.error("Map loading timed out. Check connection.");
         } else {
            console.error("Failed to load purchased pixels:", err);
            setError("Failed to load map data");
            if (!silent) {
               toast.error("Failed to load map data");
            }
         }
      } finally {
         clearTimeout(timeoutId);
         if (isMountedRef.current) {
            setIsLoading(false);
         }
      }
   }, []);

   // Handle realtime updates more efficiently
   const handleRealtimeUpdate = useCallback((payload: any) => {
      if (!loadedRef.current) return;

      const { eventType, new: newRecord, old: oldRecord } = payload;

      if (eventType === 'INSERT' || eventType === 'UPDATE') {
         // Only update if it's a purchased pixel
         if (newRecord?.owner_id) {
            const updatedPixel: PurchasedPixel = {
               id: newRecord.id,
               x: newRecord.x,
               y: newRecord.y,
               owner_id: newRecord.owner_id,
               image_url: newRecord.image_url,
               link_url: newRecord.link_url,
               alt_text: newRecord.alt_text,
               block_id: newRecord.block_id ?? null,
            };

            // Update spatial index
            spatialIndex.current.add(updatedPixel);

            // Update state efficiently
            setPurchasedPixels(prev => {
               const existingIndex = prev.findIndex(p => p.id === updatedPixel.id);
               if (existingIndex >= 0) {
                  const updated = [...prev];
                  updated[existingIndex] = updatedPixel;
                  return updated;
               }
               return [...prev, updatedPixel];
            });
         }
      } else if (eventType === 'DELETE' && oldRecord) {
         // Remove from state
         setPurchasedPixels(prev => prev.filter(p => p.id !== oldRecord.id));
         // Note: SpatialIndex doesn't have remove, but the pixelMap will be stale
         // This is acceptable as the pixel won't be rendered anyway
      }
   }, []);

   useEffect(() => {
      isMountedRef.current = true;
      loadPurchased();

      // Subscribe to realtime changes with smarter handling
      const channel = supabase
         .channel("pixels-realtime")
         .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "pixels" },
            handleRealtimeUpdate
         )
         .subscribe();

      return () => {
         isMountedRef.current = false;
         supabase.removeChannel(channel);
      };
   }, [loadPurchased, handleRealtimeUpdate]);

   return {
      purchasedPixels,
      isLoading,
      error,
      spatialIndex: spatialIndex.current,
      refetch: () => loadPurchased(true),
   };
}

