# BuyASpot Database - Migration Walkthrough

> **Version**: 3.0.0 (Edge-Distance Pricing Fix)
> **Last Updated**: 2026-04-10  
> **Status**: Production-Ready ✅

---

## Quick Start

Execute in order in Supabase SQL Editor:

```
000_reset.sql          → Drops everything
001_extensions.sql     → UUID extension
002_core_tables.sql    → profiles, pixels, pixel_blocks
003_marketplace.sql    → listings, transactions
004_blog.sql           → posts, categories
005_admin.sql          → admin functions
006_announcements.sql  → announcements, contact
007_analytics.sql      → events, materialized views
008_rpc_functions.sql  → Frontend RPC functions
009_triggers.sql       → Helper triggers
010_seed.sql           → Grid init (10,000 pixels)
011_enhancements.sql   → Enhanced features ⭐
...                    → (012–029 incremental fixes)
030_fix_pricing_zones.sql → ⭐ Edge-distance pricing fix (v3.0)
```

---

## New Pricing Tiers (v2.2)

### Previous Pricing (v2.1)
| Tier | Price | Coverage |
|------|-------|----------|
| Economy | ₹99 | Edge areas |
| Standard | ₹199 | Middle areas |
| Gold | ₹299 | Central areas |

### Current Pricing (v3.0) ⭐ UPDATED
| Tier | Price | Zone Definition | Ad Duration | Color |
|------|-------|----------------|-------------|-------|
| **Economy** | ₹99 | Outermost 3 rows from edge (depth 0–2) | 1s | 🟢 Emerald |
| **Premium** | ₹299 | Next 5 rows (depth 3–7) | 3s | 🟣 Violet |
| **Gold** | ₹499 | Inner core (depth ≥ 8) | 6s | 🟡 Amber |

**Pricing Algorithm**: `dist_from_edge = LEAST(x, y, 99-x, 99-y)`

**Migration 030 Impact**: 
- Fixes `calculate_pixel_price()` from center-distance to edge-distance
- All existing `price_paid` values are untouched (historical)
- Future purchases use correct edge-distance pricing
- Admin analytics functions updated to match

---

## Enhanced Features (011)

| Feature | Table/Function |
|---------|----------------|
| **Pixel History** | `pixel_history` - Full audit trail |
| **Achievements** | `achievements`, `user_achievements` |
| **Moderation Queue** | `moderation_queue` |
| **Activity Feed** | `user_activity` |
| **Revenue Dashboard** | `admin_get_revenue_stats()` |
| **Heatmap Data** | `get_heatmap_data()` |
| **Bulk Operations** | `admin_bulk_reset_pixels()`, `admin_bulk_reset_area()` |

---

## Ad Tier Configuration (v2.2) ⭐ NEW

Ad tiers are managed in frontend:
```typescript
// src/utils/gridConstants.ts
export const AD_TIER_CONFIG = {
  ECONOMY: {      // ₹99 tier
    price: 99,
    depthRows: 3,
    adDuration: 1,        // seconds
    description: "Outer 3 rows · 1s billboard display",
    color: "emerald",
    icon: "Zap",
  },
  PREMIUM: {      // ₹299 tier
    price: 299,
    depthRows: 5,
    adDuration: 3,        // seconds
    description: "Next 5 rows · 3s billboard display",
    color: "violet",
    icon: "Sparkles",
  },
  GOLD: {         // ₹499 tier
    price: 499,
    depthRows: 0,         // Remaining inner core
    adDuration: 6,        // seconds
    description: "Inner core · 6s billboard display",
    color: "amber",
    icon: "Crown",
  },
}
```

**Helper Function**:
```typescript
function getAdTierByPrice(price: number): AdTierType {
  if (price >= 499) return "GOLD";
  if (price >= 299) return "PREMIUM";
  return "ECONOMY";
}
```

---

## Frontend RPC Functions

```typescript
// Pixel purchase (pricing calculated by zone)
supabase.rpc('purchase_pixel', { p_x: 50, p_y: 50, p_image_url: '...' })

// Block purchase (multi-pixel, same image)
supabase.rpc('purchase_pixels_block', {
  p_pixels: [{x: 10, y: 10}, {x: 11, y: 10}],
  p_image_url: '...',
  p_link_url: '...',
  p_alt_text: '...'
})

// Stats & Analytics
supabase.rpc('get_grid_stats')
supabase.rpc('get_heatmap_data')
supabase.rpc('get_leaderboard', { p_limit: 10 })

// Admin (super admin only)
supabase.rpc('admin_get_revenue_stats', { p_days: 30 })
supabase.rpc('admin_bulk_reset_area', { p_min_x: 0, p_max_x: 10, p_min_y: 0, p_max_y: 10 })

// Achievements
supabase.rpc('check_achievements', { p_user_id: '...' })

// Report content
supabase.rpc('report_content', { p_content_type: 'pixel', p_content_id: '...', p_reason: '...' })
```

---

## Verification

```sql
-- Verify base setup
SELECT COUNT(*) FROM pixels;              -- 10,000
SELECT COUNT(*) FROM achievements;        -- 10
SELECT * FROM mv_grid_stats;              -- Stats

-- Check new pricing metadata (if stored in pixels table)
SELECT 
  x, y, 
  price,
  CASE 
    WHEN price = 499 THEN 'GOLD'
    WHEN price = 299 THEN 'PREMIUM'
    WHEN price = 99 THEN 'ECONOMY'
    ELSE 'OTHER'
  END as tier
FROM pixels 
WHERE owner_id IS NOT NULL 
LIMIT 10;

-- Revenue by tier
SELECT 
  CASE 
    WHEN price = 499 THEN 'GOLD'
    WHEN price = 299 THEN 'PREMIUM'
    WHEN price = 99 THEN 'ECONOMY'
  END as tier,
  COUNT(*) as count,
  SUM(price) as revenue
FROM pixels
WHERE owner_id IS NOT NULL
GROUP BY tier;
```
