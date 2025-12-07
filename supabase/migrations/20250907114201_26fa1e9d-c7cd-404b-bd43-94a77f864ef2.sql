-- Initialize the pixel grid with all 100,000 pixels (400x250)
DO $$
DECLARE
    x_coord INTEGER;
    y_coord INTEGER;
BEGIN
    FOR x_coord IN 0..399 LOOP
        FOR y_coord IN 0..249 LOOP
            INSERT INTO public.pixels (x, y, owner_id, price_tier, is_active)
            VALUES (x_coord, y_coord, NULL, 1, true);
        END LOOP;
    END LOOP;
END $$;