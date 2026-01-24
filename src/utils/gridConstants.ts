export const GRID_CONFIG = {
   INITIAL_ZOOM: 1.0,
   MAX_INITIAL_ZOOM: 3.5,
   MIN_ZOOM: 0.1,
   MAX_ZOOM: 8,
   BILLBOARD_WIDTH: 40,
   BILLBOARD_HEIGHT: 24,
   PREMIUM_ZONE_SIZE: 80,
   GOLD_ZONE_SIZE: 40,
   ZOOM_FACTOR: 1.05,
   PAN_CLAMP_BUFFER: 100,

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

