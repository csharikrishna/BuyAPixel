-- Add realtime functionality to pixels table for live updates
ALTER TABLE public.pixels REPLICA IDENTITY FULL;

-- Add pixels table to realtime publication
SELECT cron.schedule('add-pixels-to-publication', '0 0 1 1 *', $$
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'pixels'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.pixels;
    END IF;
  END $$;
$$);