-- Harden function search_path to satisfy linter without dropping dependent triggers
-- Set secure search_path and security definer on functions
ALTER FUNCTION public.update_updated_at_column() SECURITY DEFINER;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

ALTER FUNCTION public.calculate_pixel_price(integer, integer) SECURITY DEFINER;
ALTER FUNCTION public.calculate_pixel_price(integer, integer) SET search_path = public;