-- ============================================================================
-- 006: ANNOUNCEMENTS & CONTACT
-- BuyAPixel - System Announcements and Contact Messages
-- ============================================================================

-- ============================================================================
-- ANNOUNCEMENTS TABLE
-- ============================================================================

CREATE TABLE public.announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Content
  title TEXT,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
  
  -- Targeting (optional)
  target_audience TEXT DEFAULT 'all' CHECK (target_audience IN ('all', 'authenticated', 'anonymous')),
  
  -- Display
  is_active BOOLEAN DEFAULT false,
  is_dismissible BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  
  -- Scheduling
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  
  -- Tracking
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_announcements_active ON public.announcements(is_active, priority DESC) 
  WHERE is_active = true;

-- ============================================================================
-- CONTACT MESSAGES TABLE
-- ============================================================================

CREATE TABLE public.contact_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Sender info
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),  -- If authenticated
  
  -- Message
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'read', 'responded', 'archived', 'spam')),
  
  -- Response
  response TEXT,
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_contact_messages_status ON public.contact_messages(status, created_at DESC);
CREATE INDEX idx_contact_messages_email ON public.contact_messages(email);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Announcements policies
CREATE POLICY "announcements_select_active" ON public.announcements
  FOR SELECT USING (
    is_active = true 
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (ends_at IS NULL OR ends_at > NOW())
  );

CREATE POLICY "announcements_admin_all" ON public.announcements
  FOR ALL TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

-- Contact messages policies
CREATE POLICY "contact_insert_all" ON public.contact_messages
  FOR INSERT WITH CHECK (
    length(name) BETWEEN 2 AND 100
    AND position('@' IN email) > 1
    AND length(subject) BETWEEN 3 AND 200
    AND length(message) BETWEEN 10 AND 5000
  );

CREATE POLICY "contact_admin_select" ON public.contact_messages
  FOR SELECT TO authenticated
  USING (is_current_user_super_admin());

CREATE POLICY "contact_admin_update" ON public.contact_messages
  FOR UPDATE TO authenticated
  USING (is_current_user_super_admin());

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER set_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- END OF 006
-- ============================================================================
