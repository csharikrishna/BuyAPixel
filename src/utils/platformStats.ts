import type { Json } from "@/integrations/supabase/types";

export interface GridStatsResult {
  totalPixels: number;
  pixelsSold: number;
  pixelsAvailable: number;
  uniqueOwners: number;
  averagePrice: number;
}

const asRecord = (value: Json | null | undefined): Record<string, Json | undefined> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
};

const numericField = (
  record: Record<string, Json | undefined>,
  keys: string[],
  fallback = 0
) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
};

export const parseGridStats = (value: Json | null | undefined): GridStatsResult | null => {
  const record = asRecord(value);
  if (!record) return null;

  return {
    totalPixels: numericField(record, ["total_pixels"], 10000),
    pixelsSold: numericField(record, ["sold_pixels", "sold_count"]),
    pixelsAvailable: numericField(record, ["available_pixels", "available_count"], 10000),
    uniqueOwners: numericField(record, ["unique_owners"]),
    averagePrice: Math.round(numericField(record, ["avg_price", "average_price"])),
  };
};
