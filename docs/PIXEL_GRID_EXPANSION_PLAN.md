# Pixel Grid Expansion Plan

**Status**: Not yet implemented  
**Complexity**: High  
**Timeline**: 2-4 weeks (with proper testing)

## Current State

- Grid size: **100×100 pixels** (10,000 total)
- Hardcoded in: [tailwind.config.ts](tailwind.config.ts), frontend components, database queries, leaderboard
- All coordinates stored as INTEGER (0-99)
- Pixel pricing based on position within 100×100 grid

## Expansion Target

Once grid is near-full (8,000+ pixels sold), expand to:
- **Option A** (Conservative): 150×150 (22,500 pixels) - 2.25x growth
- **Option B** (Moderate): 200×200 (40,000 pixels) - 4x growth
- **Option C** (Aggressive): 500×500 (250,000 pixels) - 25x growth

**Recommended**: Option B (200×200) for balanced growth

## Impact Analysis

### Database Schema Changes
- Pixel coordinates remain INTEGER (supports up to 32k×32k)
- No schema migration needed for coordinates
- Add `grid_version` column to track expansion history
- Add `grid_expanded_at` timestamp

### Business Logic Changes

#### Pixel Pricing
Current: Based on `calculate_pixel_price(x, y)` function
- **Issue**: Prices vary by location (center more expensive)
- **Solution**: Maintain same pricing structure but apply to new areas
- Must update price function to handle new boundaries

#### Leaderboard
Current: Materialized view `mv_leaderboard`
- **Issue**: Rankings based strictly on pixel_count
- **Solution**: No change needed (query-based, not position-based)
- Just refresh materialized view after expansion

#### Marketplace
Current: All pixels can be listed
- **Issue**: Old pixel prices vs new pixel prices creates market confusion
- **Solution**: Add `marked_as_legacy` flag or show "Original Canvas" vs "Expansion" zones

### Frontend Changes

#### Canvas Rendering
Files to update:
- `src/components/VirtualizedPixelGrid.tsx` - Grid size constants
- `src/lib/utils.ts` - Grid dimension calculations
- `src/hooks/useGridInteraction.ts` - Coordinate handling
- `tailwind.config.ts` - Update grid width/height

Current constants:
```typescript
const CANVAS_WIDTH = 100;
const CANVAS_HEIGHT = 100;
const PIXEL_SIZE = 10; // pixels
```

New for 200×200:
```typescript
const CANVAS_WIDTH = 200;
const CANVAS_HEIGHT = 200;
```

#### MiniMap
- Update `src/components/MiniMap.tsx` to show new boundaries
- May need to zoom-level adjustments

### Migration Strategy (Zero-Downtime)

#### Phase 1: Preparation (1 week)
1. Create feature branch, disable via feature flag initially
2. Add `grid_version` column to pixels table
3. Update price calculation function to support new boundaries
4. Create DB migration for new expansion schema

#### Phase 2: Code Deployment (1 week development + testing)
1. Update frontend constants to new grid size
2. Deploy with feature flag OFF
3. Extensive testing on new grid rendering
4. Load test with 40,000 pixels

#### Phase 3: Enable Expansion
1. Create new empty pixels for expanded area (positions 100-199)
2. Run batched INSERT to avoid locking:
```sql
-- Insert in chunks of 1000
INSERT INTO pixels (x, y, owner_id, block_id, created_at, updated_at, grid_version)
SELECT x, y, NULL, NULL, NOW(), NOW(), 2
FROM generate_series(100, 199) AS x
CROSS JOIN generate_series(0, 199) AS y
WHERE (x, y) NOT IN (SELECT x, y FROM pixels WHERE grid_version = 1);
-- Repeat chunking to avoid timeout
```

3. Enable feature flag
4. Announce expansion to users (marketing)

#### Phase 4: Monitoring
1. Monitor websocket realtime load  
2. Check Supabase write operations
3. Track grid sell-through rate

## Database Migration Sample

```sql
-- 030_expand_pixel_grid.sql

-- Add grid versioning
ALTER TABLE public.pixels
ADD COLUMN IF NOT EXISTS grid_version INTEGER DEFAULT 1;

-- Add metadata for expansion tracking
CREATE TABLE IF NOT EXISTS public.grid_expansion_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL,
  previous_width INTEGER NOT NULL,
  previous_height INTEGER NOT NULL,
  new_width INTEGER NOT NULL,
  new_height INTEGER NOT NULL,
  new_pixels_count INTEGER NOT NULL,
  expanded_at TIMESTAMP WITH TIME ZONE NOT NULL,
  notes TEXT
);

-- Track expansion event
INSERT INTO public.grid_expansion_history (
  version, previous_width, previous_height,
  new_width, new_height, new_pixels_count,
  expanded_at, notes
) VALUES (
  2, 100, 100, 200, 200, 30000,
  NOW(),
  'Expansion to 200x200 grid'
);

-- Insert new pixels in expansion area
INSERT INTO public.pixels (id, x, y, owner_id, created_at, updated_at, grid_version)
SELECT 
  gen_random_uuid() as id,
  x.val as x,
  y.val as y,
  NULL as owner_id,
  NOW() as created_at,
  NOW() as updated_at,
  2 as grid_version
FROM generate_series(100, 199) AS x(val)
CROSS JOIN generate_series(0, 199) AS y(val)
ON CONFLICT DO NOTHING;

-- Refresh leaderboard materialized view
REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_leaderboard;
REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_grid_stats;
```

## Configuration Table

If expansion becomes regular feature, consider config table:

```sql
CREATE TABLE public.grid_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  current_width INTEGER NOT NULL DEFAULT 100,
  current_height INTEGER NOT NULL DEFAULT 100,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT only_one_row CHECK (id = 1)
);
```

Then queries reference:
```sql
SELECT * FROM pixels 
WHERE x < (SELECT current_width FROM grid_config);
```

## Frontend Implementation Checklist

- [ ] Update CANVAS_WIDTH & CANVAS_HEIGHT constants
- [ ] Test VirtualizedPixelGrid with new size
- [ ] Update grid interaction calculations
- [ ] Test MiniMap rendering
- [ ] Test leaderboard with mixed-generation pixels
- [ ] Load test with 40k pixels on websocket
- [ ] Test marketplace queries with new pixel counts
- [ ] Update admin grid visualization
- [ ] Test mobile responsiveness with bigger grid
- [ ] Create rollback plan if performance degradation

## Rollback Plan

If expansion causes issues:

1. **Soft Rollback** (5 min):
   - Feature flag OFF → hides new pixels temporarily
   - Users still see 100×100 grid
   - New pixels not available for sale

2. **Hard Rollback** (30 min + DB work):
   - DELETE excess pixels created in expansion
   - Revert grid_config to version 1
   - Redeploy frontend with v1 constants

## Cost Implications

- **Supabase Storage**: No change (only pixel data, not images)
- **Realtime**: 4x more pixels = possibly 4x more broadcasts (monitor closely)
- **Leaderboard refresh**: Could take slightly longer with 40k pixels
- **Database size**: ~3x with 40k pixels (but still <1GB)
- **Row-level security**: Scales linearly, no issues

## Future Considerations

If expansion beyond 200×200 needed later:
- Consider sharding pixels table by X coordinate
- Use pagination for canvas rendering (never load all at once)
- Archive sold pixels separately for performance
- Consider Redis cache for hot pixel regions

## Success Criteria

✅ All 40,000 new pixels render and interact correctly  
✅ No performance degradation vs 10,000 pixels  
✅ Marketplace queries complete in <100ms  
✅ Zero downtime during deployment  
✅ Realtime subscriptions handle load  

---

**Next Steps**:
1. When grid is at 80% capacity (~8,000 pixels), open GitHub issue to trigger expansion code review
2. Allocate 2-week sprint for implementation
3. Announce expansion 2 weeks before go-live
