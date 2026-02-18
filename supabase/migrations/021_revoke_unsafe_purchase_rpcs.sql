-- ============================================================================
-- Migration 021: Revoke Unsafe Purchase RPCs
-- ============================================================================
-- SECURITY FIX: The old purchase_pixel and purchase_pixels_block functions
-- allow any authenticated user to claim pixels WITHOUT payment. These were
-- superseded by the Razorpay payment flow (create-razorpay-order edge function
-- → verify-razorpay-payment edge function → complete_pixel_purchase RPC).
--
-- Additionally, complete_pixel_purchase and create_payment_order should only
-- be callable by the service role (edge functions), not by authenticated users
-- directly, since they bypass Razorpay signature verification.
-- ============================================================================

-- 1. Revoke and drop the old free-purchase functions
REVOKE EXECUTE ON FUNCTION public.purchase_pixel(INTEGER, INTEGER, TEXT, TEXT, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.purchase_pixels_block(JSONB, TEXT, TEXT, TEXT) FROM authenticated;

DROP FUNCTION IF EXISTS public.purchase_pixel(INTEGER, INTEGER, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.purchase_pixels_block(JSONB, TEXT, TEXT, TEXT);

-- 2. Revoke complete_pixel_purchase from authenticated
-- Only the verify-razorpay-payment edge function (service role) should call this
REVOKE EXECUTE ON FUNCTION public.complete_pixel_purchase(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM authenticated;

-- 3. Revoke create_payment_order from authenticated
-- The create-razorpay-order edge function inserts directly into payment_orders
-- via service role — this RPC is not used by the frontend and should not be callable
REVOKE EXECUTE ON FUNCTION public.create_payment_order(TEXT, INTEGER, TEXT, JSONB) FROM authenticated;
