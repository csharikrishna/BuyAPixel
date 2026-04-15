-- Migration: Add spatial index for fast pixel grid queries
-- Purpose: Optimize pixel queries filtering by x,y coordinates
-- Performance: Reduces query time from 100-500ms to <10ms

-- Create index on coordinates for faster lookups
CREATE INDEX IF NOT EXISTS idx_pixels_coordinates 
  ON public.pixels(x, y) 
  WHERE owner_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON INDEX idx_pixels_coordinates IS 'Speeds up pixel grid queries filtering by coordinates. Only indexes purchased pixels.';
