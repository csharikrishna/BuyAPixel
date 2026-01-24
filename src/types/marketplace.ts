// Marketplace type definitions aligned with database schema

export interface MarketplaceListing {
   id: string;
   pixel_id: string;
   seller_id: string;
   asking_price: number;
   original_price: number;
   status: 'active' | 'sold' | 'cancelled' | 'expired';
   created_at: string;
   updated_at: string;
   sold_at: string | null;

   // Relations (from joins)
   pixel?: {
      x: number;
      y: number;
      image_url: string | null;
      alt_text: string | null;
   };
   seller?: {
      full_name: string | null;
      avatar_url: string | null;
   };
}

export interface MarketplaceTransaction {
   id: string;
   listing_id: string;
   buyer_id: string;
   seller_id: string;
   pixel_id: string;
   sale_price: number;
   seller_net: number;
   platform_fee: number;
   status: 'pending' | 'completed' | 'failed' | 'refunded';
   created_at: string;
}

export interface MarketplaceStats {
   active_listings: number;
   total_sold: number;
   average_price: number;
   highest_price: number;
   lowest_price: number;
}

export interface CreateListingParams {
   pixel_id: string;
   asking_price: number;
}

export interface PurchaseListingParams {
   listing_id: string;
}
