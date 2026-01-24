export interface SelectedPixel {
   x: number;
   y: number;
   price: number;
   id: string;
}

export interface PurchasedPixel {
   x: number;
   y: number;
   id: string;
   image_url: string | null;
   link_url: string | null;
   alt_text: string | null;
   owner_id: string;
   block_id: string | null;
   // New fields from database redesign
   price_paid?: number;
   purchased_at?: string;
   times_resold?: number;
}

export interface PixelBlock {
   id: string;
   owner_id: string;
   image_url: string;
   link_url: string | null;
   alt_text: string | null;
   min_x: number;
   max_x: number;
   min_y: number;
   max_y: number;
   pixel_count: number;
   total_price: number;
   created_at: string;
   updated_at: string;
}
