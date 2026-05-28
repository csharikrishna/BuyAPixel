import { supabase } from "@/integrations/supabase/client";

interface PixelClickInsert {
  pixel_id: string | null;
  block_id: string | null;
  source: string;
  referrer: string | null;
  user_agent: string | null;
}

interface PixelClickInsertResult {
  error: { message: string } | null;
}

interface PixelClickTableAdapter {
  insert(values: PixelClickInsert): PromiseLike<PixelClickInsertResult>;
}

interface PixelClickSupabaseAdapter {
  from(table: "pixel_clicks"): PixelClickTableAdapter;
}

const pixelClickClient = supabase as unknown as PixelClickSupabaseAdapter;

export function trackPixelClick(
  pixelId: string | null,
  blockId: string | null,
  source = "grid"
): void {
  if (!pixelId && !blockId) return;
  if (typeof document === "undefined" || typeof navigator === "undefined") return;

  Promise.resolve(
    pixelClickClient.from("pixel_clicks").insert({
      pixel_id: pixelId,
      block_id: blockId,
      source,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent || null,
    })
  )
    .then(({ error }) => {
      if (error) console.warn("Click tracking failed:", error.message);
    })
    .catch((error: unknown) => {
      console.warn(
        "Click tracking failed:",
        error instanceof Error ? error.message : error
      );
    });
}
