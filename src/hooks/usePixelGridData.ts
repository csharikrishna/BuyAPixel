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

   // Batching refs for realtime updates
   // When a 2×2 block is purchased, 4 UPDATE events fire within ~50ms.
   // Without batching, each triggers a full state update + re-render.
   // With batching, we collect them and flush once.
   const pendingUpdatesRef = useRef<PurchasedPixel[]>([]);
   const pendingDeletesRef = useRef<string[]>([]);
   const flushTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

   // Optimized single-query loader with auto-retry
   const loadPurchased = useCallback(async (silent = false, retryCount = 0) => {
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
            .select("id, x, y, owner_id, image_url, link_url, alt_text, block_id, price_paid, purchased_at")
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
            price_paid: row.price_paid ?? undefined,
            purchased_at: row.purchased_at ?? undefined,
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

            // Auto-retry once after 3 seconds on initial load failure
            if (retryCount < 1 && !silent) {
               console.log("Auto-retrying pixel grid load in 3s...");
               setTimeout(() => {
                  if (isMountedRef.current) {
                     loadPurchased(silent, retryCount + 1);
                  }
               }, 3000);
               return; // Don't set error yet — we're retrying
            }

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

   // Flush batched realtime updates into state
   const flushPendingUpdates = useCallback(() => {
      if (!isMountedRef.current) return;

      const updates = pendingUpdatesRef.current.splice(0);
      const deletes = pendingDeletesRef.current.splice(0);

      if (updates.length === 0 && deletes.length === 0) return;

      // Update spatial index for all batched updates
      updates.forEach((pixel) => {
         spatialIndex.current.add(pixel);
      });

      setPurchasedPixels(prev => {
         // Build a map for O(1) lookups
         const map = new Map(prev.map(p => [p.id, p]));

         // Apply updates
         updates.forEach(p => map.set(p.id, p));

         // Apply deletes
         deletes.forEach(id => map.delete(id));

         return Array.from(map.values());
      });
   }, []);

   // Handle realtime updates with batching
   const handleRealtimeUpdate = useCallback((payload: any) => {
      if (!loadedRef.current) return;

      const { eventType, new: newRecord, old: oldRecord } = payload;

      if (eventType === 'INSERT' || eventType === 'UPDATE') {
         // Only process purchased pixels
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

            pendingUpdatesRef.current.push(updatedPixel);
         }
      } else if (eventType === 'DELETE' && oldRecord) {
         pendingDeletesRef.current.push(oldRecord.id);
      }

      // Debounce: wait 100ms for more events before flushing
      // This collapses a 4-pixel block purchase (4 events) into 1 render
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = setTimeout(flushPendingUpdates, 100);
   }, [flushPendingUpdates]);

   useEffect(() => {
      isMountedRef.current = true;
      loadPurchased();

      // Subscribe to realtime changes with batched handling
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
         clearTimeout(flushTimeoutRef.current);
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
