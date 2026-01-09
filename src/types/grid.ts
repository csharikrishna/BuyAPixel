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
}
