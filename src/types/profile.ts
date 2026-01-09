
export interface Profile {
   id: string;
   user_id: string;
   full_name: string | null;
   phone_number: string | null;
   date_of_birth: string | null;
   avatar_url: string | null;
   email: string | null;
   created_at: string;
   updated_at: string;
}

export interface UserPixel {
   x: number;
   y: number;
   id: string;
   image_url?: string;
   link_url?: string;
   alt_text?: string;
   price_paid: number;
   purchased_at: string;
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
