-- Create pixels table to store pixel ownership and content
CREATE TABLE public.pixels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  owner_id UUID REFERENCES auth.users(id),
  image_url TEXT,
  link_url TEXT,
  alt_text TEXT,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  price_paid INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique pixel positions
  UNIQUE(x, y)
);

-- Enable Row Level Security
ALTER TABLE public.pixels ENABLE ROW LEVEL SECURITY;

-- Policies for pixels
CREATE POLICY "Anyone can view active pixels" 
ON public.pixels 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Users can insert their own pixels" 
ON public.pixels 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own pixels" 
ON public.pixels 
FOR UPDATE 
USING (auth.uid() = owner_id);

-- Create index for better performance
CREATE INDEX idx_pixels_position ON public.pixels(x, y);
CREATE INDEX idx_pixels_owner ON public.pixels(owner_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_pixels_updated_at
BEFORE UPDATE ON public.pixels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();