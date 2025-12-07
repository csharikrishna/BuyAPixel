-- Ensure all pixel coordinates are properly initialized for purchase functionality
DO $$
DECLARE
    x_coord INTEGER;
    y_coord INTEGER;
BEGIN
    -- Check if we need to populate pixels table with coordinates
    IF (SELECT COUNT(*) FROM pixels) = 0 THEN
        -- Populate the pixels table with all coordinates (0,0) to (399,249) = 100,000 pixels
        FOR x_coord IN 0..399 LOOP
            FOR y_coord IN 0..249 LOOP
                INSERT INTO pixels (x, y, price_tier, is_active)
                VALUES (x_coord, y_coord, 1, true)
                ON CONFLICT (x, y) DO NOTHING; -- Avoid duplicates if they already exist
            END LOOP;
        END LOOP;
        
        RAISE NOTICE 'Initialized pixels table with 100,000 pixel coordinates';
    ELSE
        RAISE NOTICE 'Pixels table already contains % records', (SELECT COUNT(*) FROM pixels);
    END IF;
END $$;