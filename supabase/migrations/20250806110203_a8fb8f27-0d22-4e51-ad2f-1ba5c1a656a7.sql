-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone_number TEXT,
  date_of_birth DATE,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create pixels table
CREATE TABLE public.pixels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  owner_id UUID REFERENCES auth.users(id),
  image_url TEXT,
  link_url TEXT,
  alt_text TEXT,
  price_tier INTEGER DEFAULT 1,
  price_paid NUMERIC(10,2),
  purchased_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(x, y)
);

-- Enable Row Level Security
ALTER TABLE public.pixels ENABLE ROW LEVEL SECURITY;

-- Create policies for pixels
CREATE POLICY "Pixels are viewable by everyone" 
ON public.pixels 
FOR SELECT 
USING (true);

CREATE POLICY "Users can update their own pixels" 
ON public.pixels 
FOR UPDATE 
USING (auth.uid() = owner_id);

-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Create storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pixels_updated_at
BEFORE UPDATE ON public.pixels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to calculate pixel price
CREATE OR REPLACE FUNCTION public.calculate_pixel_price(pixel_x INTEGER, pixel_y INTEGER)
RETURNS NUMERIC AS $$
BEGIN
  -- Simple pricing: center pixels cost more
  RETURN 1.0 + (1000 - ABS(pixel_x - 500) - ABS(pixel_y - 500)) * 0.001;
END;
$$ LANGUAGE plpgsql;