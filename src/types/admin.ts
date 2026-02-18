/**
 * Shared admin types used across AdminDashboard and its sub-components.
 */

/** Matches the return type of public.admin_get_all_users() */
export interface AdminUserRecord {
   user_id: string;
   email: string;
   full_name: string | null;
   pixel_count: number;
   total_spent: number;
   is_blocked: boolean;
   created_at: string;
   last_active_at: string | null;
}

export interface AuditLog {
   id: string;
   admin_email: string;
   action: string;
   target_type: string;
   target_id: string;
   details: Record<string, unknown>;
   created_at: string;
}

export interface AdminMarketplaceListing {
   id: string;
   pixel_id: string;
   seller_id: string;
   asking_price: number;
   status: string;
   featured: boolean;
   created_at: string;
   pixels: {
      x: number;
      y: number;
   };
   profiles: {
      email: string;
      full_name: string;
   };
}

export interface AdminUser {
   user_id: string;
   email: string;
   full_name: string | null;
   created_at: string;
}

export interface MarketplaceAnalytics {
   total_revenue: number;
   total_refunds: number;
   active_listings: number;
   featured_listings: number;
   top_sellers: Array<{
      seller_id: string;
      sales: number;
      earned: number;
   }>;
}

export interface AdminPixel {
   id: string;
   x: number;
   y: number;
   price_paid: number;
   owner_id: string;
   image_url: string | null;
   link_url: string | null;
   alt_text: string | null;
   created_at: string;
}

export type UserFilter = 'all' | 'active' | 'blocked' | 'paid';
export type SortField = 'created_at' | 'pixels_owned' | 'total_spent';
export type SortOrder = 'asc' | 'desc';
