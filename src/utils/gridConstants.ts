export const GRID_CONFIG = {
   INITIAL_ZOOM: 1.5,
   MAX_INITIAL_ZOOM: 3.5,
   MIN_ZOOM: 0.1,
   MAX_ZOOM: 8,
   BILLBOARD_WIDTH: 60,
   BILLBOARD_HEIGHT: 34,
   PREMIUM_ZONE_SIZE: 120,
   GOLD_ZONE_SIZE: 60,
   ZOOM_FACTOR: 1.05,
   PAN_CLAMP_BUFFER: 100,

   // Performance
   CULLING_BUFFER: 2, // Will be increased in optimization
   HOVER_DEBOUNCE_MS: 5,
   BILLBOARD_ROTATION_MS: 4000,
   DRAG_THRESHOLD: 5, // Pixels moved before click is rejected
   MAX_SELECTION_AREA: 2500,

   // Optimization
   CHUNK_SIZE: 32, // Size of chunks for spatial hashing
   RENDER_BUFFER: 500, // Pixels around viewport to render
} as const;
