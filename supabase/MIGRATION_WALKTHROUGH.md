# BuyAPixel Database - Migration Walkthrough

> **Version**: 2.1.0 (With Enhanced Features)  
> **Last Updated**: 2026-01-15  
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
011_enhancements.sql   → Enhanced features ⭐ NEW
```

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

## Frontend RPC Functions

```typescript
// Pixel purchase
supabase.rpc('purchase_pixel', { p_x: 50, p_y: 50, p_image_url: '...' })

// Block purchase
supabase.rpc('purchase_pixels_block', {
  p_pixels: [{x: 10, y: 10}, {x: 11, y: 10}],
  p_image_url: '...'
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

## Default Achievements

| ID | Name | Requirement |
|----|------|-------------|
| `first_pixel` | First Step | Own 1 pixel |
| `collector` | Collector | Own 10 pixels |
| `landlord` | Landlord | Own 50 pixels |
| `mogul` | Pixel Mogul | Own 100 pixels |
| `big_spender` | Big Spender | Spend ₹1,000 |
| `whale` | Whale | Spend ₹10,000 |
| `gold_rush` | Gold Rush | Own Gold Zone pixel |
| `block_builder` | Block Builder | Create a block |
| `trader` | Trader | 1 sale |
| `market_maker` | Market Maker | 10 sales |

---

## Verification

```sql
SELECT COUNT(*) FROM pixels;              -- 10,000
SELECT COUNT(*) FROM achievements;        -- 10
SELECT * FROM mv_grid_stats;              -- Stats
```
