-- ============================================================================
-- 001: EXTENSIONS
-- BuyAPixel - Required PostgreSQL Extensions
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for text search (optional, for future search features)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- END OF 001
-- ============================================================================
