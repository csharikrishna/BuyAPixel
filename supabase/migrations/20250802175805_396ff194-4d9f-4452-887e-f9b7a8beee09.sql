-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add trigger for timestamps
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update pixels table to include pricing tier
ALTER TABLE public.pixels ADD COLUMN price_tier INTEGER DEFAULT 99;

-- Function to calculate pixel price based on position
CREATE OR REPLACE FUNCTION public.calculate_pixel_price(pixel_x INTEGER, pixel_y INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  grid_size INTEGER := 224;
  center_x FLOAT := grid_size / 2.0;
  center_y FLOAT := grid_size / 2.0;
  distance_from_center FLOAT;
  corner_threshold FLOAT := grid_size * 0.3;
  middle_threshold FLOAT := grid_size * 0.15;
BEGIN
  -- Calculate distance from center
  distance_from_center := SQRT(POWER(pixel_x - center_x, 2) + POWER(pixel_y - center_y, 2));
  
  -- Determine price based on distance from center
  IF distance_from_center > corner_threshold THEN
    RETURN 99;  -- Corner pixels
  ELSIF distance_from_center > middle_threshold THEN
    RETURN 199; -- Middle-corner pixels
  ELSE
    RETURN 299; -- Center pixels
  END IF;
END;
$$;