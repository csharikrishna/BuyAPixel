export const GRID_CONFIG = {
   INITIAL_ZOOM: 1.0,
   MAX_INITIAL_ZOOM: 3.5,
   MIN_ZOOM: 0.1,
   MAX_ZOOM: 8,
   INITIAL_ZOOM_MULTIPLIER: 1.25, // 👈 Change this to make the grid start larger or smaller! (e.g., 1 for fit-to-screen, 3 for very zoomed in)
   BILLBOARD_WIDTH: 40,
   BILLBOARD_HEIGHT: 24,
   PREMIUM_ZONE_SIZE: 80,
   GOLD_ZONE_SIZE: 40,
   ZOOM_FACTOR: 1.05,
   PAN_CLAMP_BUFFER: 100,

   // Canvas dimensions
   CANVAS_WIDTH: 100,
   CANVAS_HEIGHT: 100,
   TOTAL_PIXELS: 10_000, // CANVAS_WIDTH * CANVAS_HEIGHT

   // Performance
   CULLING_BUFFER: 2,
   HOVER_DEBOUNCE_MS: 5,
   BILLBOARD_ROTATION_MS: 4000,
   DRAG_THRESHOLD: 5,
   MAX_SELECTION_AREA: 2500,

   // Optimization - reduced for faster initial render
   CHUNK_SIZE: 20, // Smaller chunks for finer spatial queries
   RENDER_BUFFER: 150, // Reduced from 500 for faster rendering
} as const;

/** Pixel pricing zones — single source of truth for all pricing logic */
export const PIXEL_PRICING = {
   GOLD_PRICE: 299,
   PREMIUM_PRICE: 199,
   ECONOMY_PRICE: 99,
   GOLD_RADIUS: 20,
   PREMIUM_RADIUS: 40,
} as const;

/**
 * Calculate the price of a pixel based on its distance from the canvas center.
 * Uses PIXEL_PRICING zone radii and prices.
 */
export function calculatePixelPrice(
   x: number,
   y: number,
   canvasWidth = GRID_CONFIG.CANVAS_WIDTH,
   canvasHeight = GRID_CONFIG.CANVAS_HEIGHT
): number {
   const centerX = canvasWidth / 2.0;
   const centerY = canvasHeight / 2.0;
   const dx = Math.abs(x - centerX);
   const dy = Math.abs(y - centerY);
   const maxDist = Math.max(dx, dy);

   if (maxDist < PIXEL_PRICING.GOLD_RADIUS) return PIXEL_PRICING.GOLD_PRICE;
   if (maxDist < PIXEL_PRICING.PREMIUM_RADIUS) return PIXEL_PRICING.PREMIUM_PRICE;
   return PIXEL_PRICING.ECONOMY_PRICE;
}

