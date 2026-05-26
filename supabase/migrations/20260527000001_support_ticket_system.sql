-- ============================================================================
-- Support Ticket System: ticket_id generation + file upload support
-- ============================================================================

-- 1. Create sequence for ticket numbering
CREATE SEQUENCE IF NOT EXISTS public.contact_ticket_seq
  START WITH 1001
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

-- 2. Add ticket_id and file_url columns
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS ticket_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS file_url TEXT;

-- 3. Create function to auto-generate ticket IDs on insert
CREATE OR REPLACE FUNCTION public.generate_ticket_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ticket_id IS NULL THEN
    NEW.ticket_id := 'CT-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(nextval('public.contact_ticket_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Create trigger
DROP TRIGGER IF EXISTS trg_generate_ticket_id ON public.contact_messages;
CREATE TRIGGER trg_generate_ticket_id
  BEFORE INSERT ON public.contact_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_ticket_id();

-- 5. Index on ticket_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_contact_messages_ticket_id
  ON public.contact_messages(ticket_id);

-- 6. Update RLS insert policy to allow new columns
DROP POLICY IF EXISTS "contact_insert_all" ON public.contact_messages;
CREATE POLICY "contact_insert_all" ON public.contact_messages
  FOR INSERT WITH CHECK (
    length(name) BETWEEN 2 AND 100
    AND position('@' IN email) > 1
    AND length(subject) BETWEEN 3 AND 200
    AND length(message) BETWEEN 10 AND 5000
  );

-- 7. Create storage bucket for support attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-attachments',
  'support-attachments',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- 8. Storage RLS policies
-- Allow anyone to upload (insert) files to support-attachments
CREATE POLICY "support_attachments_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'support-attachments');

-- Allow authenticated users (admins) to read files
CREATE POLICY "support_attachments_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'support-attachments');

-- ============================================================================
-- END
-- ============================================================================
