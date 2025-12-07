-- Fix function search path security warnings
DROP FUNCTION IF EXISTS public.update_updated_at_column();
DROP FUNCTION IF EXISTS public.calculate_pixel_price(integer, integer);

-- Recreate functions with proper search_path settings
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_pixel_price(pixel_x integer, pixel_y integer)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Simple pricing: center pixels cost more
  RETURN 1.0 + (1000 - ABS(pixel_x - 500) - ABS(pixel_y - 500)) * 0.001;
END;
$function$;