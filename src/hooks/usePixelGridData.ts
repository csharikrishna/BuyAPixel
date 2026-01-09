import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PurchasedPixel } from "@/types/grid";
import { SpatialIndex } from "@/utils/SpatialIndex";
import { toast } from "sonner";

export function usePixelGridData() {
   const [purchasedPixels, setPurchasedPixels] = useState<PurchasedPixel[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);

   const spatialIndex = useRef(new SpatialIndex());

   useEffect(() => {
      let isMounted = true;

      const loadPurchased = async () => {
         try {
            setIsLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
               .from("pixels")
               .select("id, x, y, owner_id, image_url, link_url, alt_text")
               .not("owner_id", "is", null);

            if (!isMounted) return;

            if (fetchError) {
               console.error("Failed to load purchased pixels", fetchError);
               setError("Failed to load map data");
               toast.error("Failed to load map data");
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

            // Update spatial index
            spatialIndex.current.clear();
            formattedPixels.forEach((pixel) => {
               spatialIndex.current.add(pixel);
            });

            setPurchasedPixels(formattedPixels);
         } catch (err) {
            if (!isMounted) return;
            console.error("Unexpected error loading pixels:", err);
            setError("An unexpected error occurred");
         } finally {
            if (isMounted) {
               setIsLoading(false);
            }
         }
      };

      loadPurchased();

      // Subscribe to realtime changes
      const channel = supabase
         .channel("pixels-changes")
         .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "pixels" },
            () => {
               if (isMounted) {
                  loadPurchased();
               }
            }
         )
         .subscribe();

      return () => {
         isMounted = false;
         supabase.removeChannel(channel);
      };
   }, []);

   return {
      purchasedPixels,
      isLoading,
      error,
      spatialIndex: spatialIndex.current,
   };
}
