-- ============================================================================
-- 034: AUDIT FIX - Admin RLS Policies
-- BuyAPixel - Add admin read access to sensitive tables
-- ============================================================================

-- ============================================================================
-- ADD ADMIN READ POLICY FOR PAYMENT_ORDERS (C10 fix)
-- Allows admins to audit/review payment history
-- ============================================================================

CREATE POLICY "admins_select_all_payment_orders" ON public.payment_orders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- ============================================================================
-- ADD ADMIN READ POLICY FOR PIXELS
-- Allows admins to view pixel details for support purposes
-- ============================================================================

CREATE POLICY "admins_select_all_pixels" ON public.pixels
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- ============================================================================
-- ADD ADMIN READ POLICY FOR PIXEL_BLOCKS
-- Allows admins to view block details
-- ============================================================================

CREATE POLICY "admins_select_all_pixel_blocks" ON public.pixel_blocks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- ============================================================================
-- END OF 034
-- ============================================================================
