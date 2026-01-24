

export interface Profile {
   id: string;
   user_id: string;
   full_name: string | null;
   phone_number: string | null;
   date_of_birth: string | null;
   avatar_url: string | null;
   // Email is not stored in profiles table, comes from auth - optional for type compatibility
   email?: string | null;
   // Fields from database redesign - may have defaults
   pixel_count?: number;
   total_spent?: number;
   last_active_at?: string | null;
   deleted_at?: string | null;
   // Timestamps
   created_at: string;
   updated_at: string;
}

export interface UserPixel {
   x: number;
   y: number;
   id: string;
   image_url?: string | null;
   link_url?: string | null;
   alt_text?: string | null;
   price_paid: number;
   purchased_at: string;
   // New fields from database redesign
   block_id?: string | null;
   times_resold?: number;
   last_sale_price?: number | null;
   last_sale_date?: string | null;
}

export interface PixelStats {
   totalPixels: number;
   totalInvestment: number;
   averagePrice: number;
}

export interface ProfileField {
   name: string;
   label: string;
   completed: boolean;
   value: string | null;
   icon: React.ReactNode;
}

export interface ProfileCompletionData {
   percentage: number;
   completedFields: ProfileField[];
   missingFields: ProfileField[];
   allFields: ProfileField[];
}
