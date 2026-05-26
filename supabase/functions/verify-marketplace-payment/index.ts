import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts'
import {
  sendEmail,
  buildMarketplaceBuyerEmail,
  buildMarketplaceSellerEmail,
} from '../_shared/email.ts'

const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface VerifyMarketplacePaymentRequest {
   razorpay_order_id: string
   razorpay_payment_id: string
   razorpay_signature: string
   payment_order_id: string
}

// Constant-time string comparison to prevent timing attacks
function timingSafeEqual(actual: string, received: string): boolean {
   if (actual.length !== received.length) return false
   let result = 0
   for (let i = 0; i < actual.length; i++) {
      result |= actual.charCodeAt(i) ^ received.charCodeAt(i)
   }
   return result === 0
}

// Verify Razorpay signature using HMAC SHA256 with constant-time comparison
function verifySignature(
   orderId: string,
   paymentId: string,
   signature: string,
   secret: string
): boolean {
   const message = `${orderId}|${paymentId}`
   const hmac = createHmac('sha256', secret)
   hmac.update(message)
   const generatedSignature = hmac.digest('hex')
   return timingSafeEqual(generatedSignature, signature)
}

serve(async (req: Request) => {
   // Handle CORS preflight
   if (req.method === 'OPTIONS') {
      return new Response('ok', { status: 200, headers: corsHeaders })
   }

   if (req.method !== 'POST') {
      return new Response('Method Not Allowed', {
         status: 405,
         headers: corsHeaders,
      })
   }

   try {
      // Validate environment variables
      if (!RAZORPAY_KEY_SECRET) {
         throw new Error('Razorpay secret not configured')
      }

      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
         throw new Error('Supabase credentials not configured')
      }

      // Get auth token from request
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
         throw new Error('No authorization header')
      }

      // Create Supabase client with service role
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

      // Get user from token
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
         authHeader.replace('Bearer ', '')
      )

      if (userError || !user) {
         throw new Error('Invalid or expired token')
      }

      // Parse request body
      const body: VerifyMarketplacePaymentRequest = await req.json()

      if (!body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature) {
         throw new Error('Missing payment verification data')
      }

      if (!body.payment_order_id) {
         throw new Error('Missing payment order ID')
      }

      // Verify the signature
      const isValid = verifySignature(
         body.razorpay_order_id,
         body.razorpay_payment_id,
         body.razorpay_signature,
         RAZORPAY_KEY_SECRET
      )

      if (!isValid) {
         console.error('Invalid signature for marketplace order:', body.razorpay_order_id)

         // Mark payment as failed
         await supabaseAdmin
            .from('payment_orders')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', body.payment_order_id)

         throw new Error('Payment verification failed - invalid signature')
      }

      // Get payment order to verify ownership and get metadata
      const { data: paymentOrder, error: orderError } = await supabaseAdmin
         .from('payment_orders')
         .select('*')
         .eq('id', body.payment_order_id)
         .eq('user_id', user.id)
         .single()

      if (orderError || !paymentOrder) {
         throw new Error('Payment order not found or unauthorized')
      }

      if (paymentOrder.status !== 'created') {
         throw new Error('Payment order already processed')
      }

      // Complete the marketplace purchase using the RPC function
      const { data: purchaseResult, error: purchaseError } = await supabaseAdmin
         .rpc('complete_marketplace_purchase', {
            p_payment_order_id: body.payment_order_id,
            p_razorpay_payment_id: body.razorpay_payment_id,
            p_razorpay_signature: body.razorpay_signature,
         })

      if (purchaseError) {
         console.error('Marketplace purchase error:', purchaseError)
         throw new Error('Failed to complete marketplace purchase')
      }

      if (!purchaseResult?.success) {
         throw new Error(purchaseResult?.error || 'Marketplace purchase failed')
      }

      // Get pixel coordinates from payment metadata
      const pixelCoords = paymentOrder.purchase_metadata?.pixel_coords || null

      // Send confirmation email to buyer (using shared template)
      const buyerHtml = buildMarketplaceBuyerEmail({
         salePrice: purchaseResult.sale_price,
         pixelCoords,
         transactionId: purchaseResult.transaction_id,
      })
      await sendEmail(
         user.email || '',
         'Marketplace Purchase Confirmed',
         buyerHtml
      )

      // Get seller email and send notification
      if (purchaseResult.seller_id) {
         const { data: sellerData } = await supabaseAdmin.auth.admin.getUserById(purchaseResult.seller_id)
         if (sellerData?.user?.email) {
            const sellerHtml = buildMarketplaceSellerEmail({
               salePrice: purchaseResult.sale_price,
               platformFee: purchaseResult.platform_fee,
               sellerNet: purchaseResult.seller_net,
               pixelCoords,
            })
            await sendEmail(
               sellerData.user.email,
               'Your Pixel Has Been Sold',
               sellerHtml
            )
         }
      }

      return new Response(
         JSON.stringify({
            success: true,
            message: 'Marketplace purchase completed',
            data: {
               transaction_id: purchaseResult.transaction_id,
               pixel_id: purchaseResult.pixel_id,
               sale_price: purchaseResult.sale_price,
               platform_fee: purchaseResult.platform_fee,
               seller_net: purchaseResult.seller_net,
            }
         }),
         {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         }
      )

   } catch (err) {
      console.error('Verify marketplace payment error:', err)
      return new Response(
         JSON.stringify({
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
         }),
         {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         }
      )
   }
})
