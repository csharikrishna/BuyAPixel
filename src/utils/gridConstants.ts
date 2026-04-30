export const GRID_CONFIG = {
   INITIAL_ZOOM: 1.0,
   MAX_INITIAL_ZOOM: 3.5,
   MIN_ZOOM: 0.1,
   MAX_ZOOM: 8,
   INITIAL_ZOOM_MULTIPLIER_DESKTOP: 1.8, // 👈 desktop zoom multiplier
   INITIAL_ZOOM_MULTIPLIER_MOBILE: 1.45, // 👈 mobile zoom multiplier
   BILLBOARD_WIDTH: 40,
   BILLBOARD_HEIGHT: 24,
   ZOOM_FACTOR: 1.05,
   PAN_CLAMP_BUFFER: 100,

   // Canvas dimensions
   CANVAS_WIDTH: 100,
   CANVAS_HEIGHT: 100,
   TOTAL_PIXELS: 10_000, // CANVAS_WIDTH * CANVAS_HEIGHT

   // Performance
   CULLING_BUFFER: 2,
   HOVER_DEBOUNCE_MS: 5,
   DRAG_THRESHOLD: 15, // Increased from 5 for better mobile tap detection
   MAX_SELECTION_AREA: 2500,

   // Optimization - reduced for faster initial render
   CHUNK_SIZE: 20, // Smaller chunks for finer spatial queries
   RENDER_BUFFER: 150, // Reduced from 500 for faster rendering
} as const;

/**
 * Pixel pricing zones — single source of truth for all pricing logic.
 *
 * Zones are defined by **depth from the outer boundary** (number of perimeter
 * layers from the edge).
 *
 *   • ECONOMY_DEPTH  = 3  → outermost 3 rows (depth 0–2) → ₹99
 *   • PREMIUM_DEPTH  = 8  → next 5 rows (depth 3–7)       → ₹299
 *   • Remaining inner core (depth ≥ 8)                     → ₹499
 *
 * The visual zone sizes are computed from these depths:
 *   • ECONOMY_ZONE_SIZE = CANVAS_SIZE (entire grid, outermost ring)
 *   • PREMIUM_ZONE_SIZE = CANVAS_SIZE − 2 × ECONOMY_DEPTH
 *   • GOLD_ZONE_SIZE    = CANVAS_SIZE − 2 × PREMIUM_DEPTH
 */
export const PIXEL_PRICING = {
   GOLD_PRICE: 499,
   PREMIUM_PRICE: 299,
   ECONOMY_PRICE: 99,
   /** Number of perimeter layers from the edge that are Economy (₹99) */
   ECONOMY_DEPTH: 3,
   /** Total depth from edge where Premium ends and Gold begins (Economy + Premium rows) */
   PREMIUM_DEPTH: 8, // 3 Economy + 5 Premium = 8 total
} as const;

/**
 * Visual zone sizes derived from pricing depths.
 * These are used to render the boundary lines on the grid.
 */
export const ZONE_SIZES = {
   /** Inner dimension of the Premium boundary (100 − 2×3 = 94) */
   PREMIUM_ZONE_SIZE: GRID_CONFIG.CANVAS_WIDTH - 2 * PIXEL_PRICING.ECONOMY_DEPTH, // 94
   /** Inner dimension of the Gold boundary (100 − 2×8 = 84) */
   GOLD_ZONE_SIZE: GRID_CONFIG.CANVAS_WIDTH - 2 * PIXEL_PRICING.PREMIUM_DEPTH,    // 84
} as const;

/** Ad tier pricing with duration information */
export const AD_TIER_CONFIG = {
   ECONOMY: {
      price: 99,
      depthRows: 3,
      adDuration: 1, // seconds
      description: "Outer 3 rows · 1s billboard display",
      color: "emerald",
      icon: "Zap",
   },
   PREMIUM: {
      price: 299,
      depthRows: 5,
      adDuration: 3, // seconds
      description: "Next 5 rows · 3s billboard display",
      color: "violet",
      icon: "Sparkles",
   },
   GOLD: {
      price: 499,
      depthRows: 0, // Remaining inner core
      adDuration: 6, // seconds
      description: "Inner core · 6s billboard display",
      color: "amber",
      icon: "Crown",
   },
} as const;

export type AdTierType = keyof typeof AD_TIER_CONFIG;

/**
 * Get the ad tier for a single pixel based on its per-pixel price.
 */
export function getAdTierByPrice(price: number): AdTierType {
   if (price >= AD_TIER_CONFIG.GOLD.price) return "GOLD";
   if (price >= AD_TIER_CONFIG.PREMIUM.price) return "PREMIUM";
   return "ECONOMY";
}

/**
 * Calculate the price of a pixel based on its distance from the outer
 * boundary of the grid (minimum distance to any edge).
 *
 *   depth 0–2 (outermost 3 rows)  → ₹99  (Economy)
 *   depth 3–7 (next 5 rows)       → ₹299 (Premium)
 *   depth ≥ 8 (inner core)        → ₹499 (Gold)
 */
export function calculatePixelPrice(
   x: number,
   y: number,
   canvasWidth = GRID_CONFIG.CANVAS_WIDTH,
   canvasHeight = GRID_CONFIG.CANVAS_HEIGHT
): number {
   // Distance from the nearest edge (minimum of all 4 sides)
   const distFromEdge = Math.min(x, y, canvasWidth - 1 - x, canvasHeight - 1 - y);

   if (distFromEdge < PIXEL_PRICING.ECONOMY_DEPTH) return PIXEL_PRICING.ECONOMY_PRICE;
   if (distFromEdge < PIXEL_PRICING.PREMIUM_DEPTH) return PIXEL_PRICING.PREMIUM_PRICE;
   return PIXEL_PRICING.GOLD_PRICE;
}

