-- Add category column to contact_messages table
ALTER TABLE public.contact_messages 
ADD COLUMN category TEXT DEFAULT 'general' 
CHECK (category IN ('general', 'support', 'billing', 'partnership', 'feedback', 'other'));

-- Update RLS policy to include category validation
DROP POLICY IF EXISTS "contact_insert_all" ON public.contact_messages;

CREATE POLICY "contact_insert_all" ON public.contact_messages
  FOR INSERT WITH CHECK (
    length(name) BETWEEN 2 AND 100
    AND position('@' IN email) > 1
    AND length(subject) BETWEEN 3 AND 200
    AND length(message) BETWEEN 10 AND 5000
    AND category IN ('general', 'support', 'billing', 'partnership', 'feedback', 'other')
  );

-- Create index for category queries
CREATE INDEX IF NOT EXISTS idx_contact_messages_category ON public.contact_messages(category);
