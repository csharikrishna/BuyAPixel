import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts'

const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface VerifyPaymentRequest {
   razorpay_order_id: string
   razorpay_payment_id: string
   razorpay_signature: string
   payment_order_id: string
   image_url?: string
   link_url?: string
   alt_text?: string
}

// Verify Razorpay signature using HMAC SHA256
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
   return generatedSignature === signature
}

// Send confirmation email
async function sendConfirmationEmail(
   email: string,
   pixelCount: number,
   totalAmount: number,
   pixelName: string,
   linkUrl?: string
) {
   if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not set, skipping email')
      return
   }

   try {
      const res = await fetch('https://api.resend.com/emails', {
         method: 'POST',
         headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
         },
         body: JSON.stringify({
            from: 'BuyAPixel <onboarding@resend.dev>',
            to: [email],
            reply_to: 'support@buyapixel.in',
            subject: '🎉 Your BuyAPixel Purchase Is Confirmed',
            html: buildEmailHtml(email, pixelCount, totalAmount, pixelName, linkUrl),
         }),
      })

      if (!res.ok) {
         const error = await res.json()
         console.error('Resend error:', error)
      }
   } catch (err) {
      console.error('Email send error:', err)
   }
}

function buildEmailHtml(
   email: string,
   pixelCount: number,
   totalAmount: number,
   pixelName: string,
   linkUrl?: string
): string {
   const formatINR = (amount: number) =>
      new Intl.NumberFormat('en-IN', {
         style: 'currency',
         currency: 'INR',
         maximumFractionDigits: 0,
      }).format(amount)

   return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Purchase Confirmation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #10b981, #059669); padding: 32px; text-align: center; color: #fff; font-size: 28px; font-weight: 800; }
    .content { padding: 36px 32px; text-align: center; }
    h1 { margin-top: 0; color: #111827; }
    .receipt { margin: 28px 0; padding: 24px; border-radius: 10px; background: #f9fafb; border: 1px solid #e5e7eb; text-align: left; }
    .row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
    .row.total { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-weight: 700; font-size: 16px; }
    .button { display: inline-block; margin-top: 28px; padding: 14px 32px; background: #10b981; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .footer { padding: 22px; font-size: 12px; color: #9ca3af; text-align: center; background: #f9fafb; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">BuyAPixel</div>
    <div class="content">
      <h1>Payment Successful 🎉</h1>
      <p>You now officially own a piece of the Million Dollar Canvas. Your pixels are secured forever.</p>
      <div class="receipt">
        <div class="row"><span>Pixel Name</span><span>${pixelName}</span></div>
        <div class="row"><span>Quantity</span><span>${pixelCount} pixels</span></div>
        ${linkUrl ? `<div class="row"><span>Link</span><span><a href="${linkUrl}" style="color:#10b981">${linkUrl}</a></span></div>` : ''}
        <div class="row total"><span>Total Paid</span><span>${formatINR(totalAmount)}</span></div>
      </div>
      <a href="https://buyapixel.in/profile" class="button">View Your Pixels</a>
    </div>
    <div class="footer">
      <p>BuyAPixel — The Modern Million Dollar Homepage</p>
      <p>Reply to this email if you need help.</p>
    </div>
  </div>
</body>
</html>
`
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

      // Create Supabase client with service role for database operations
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

      // Create Supabase client with user's token to verify identity
      const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
         global: {
            headers: { Authorization: authHeader }
         }
      })

      // Get user from token
      const { data: { user }, error: userError } = await supabaseUser.auth.getUser(
         authHeader.replace('Bearer ', '')
      )

      if (userError || !user) {
         throw new Error('Invalid or expired token')
      }

      // Parse request body
      const body: VerifyPaymentRequest = await req.json()

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
         console.error('Invalid signature for order:', body.razorpay_order_id)

         // Mark payment as failed
         await supabaseAdmin
            .from('payment_orders')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', body.payment_order_id)

         throw new Error('Payment verification failed - invalid signature')
      }

      // Get the payment order to verify ownership and get metadata
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

      // Complete the purchase using the RPC function
      const { data: purchaseResult, error: purchaseError } = await supabaseAdmin
         .rpc('complete_pixel_purchase', {
            p_payment_order_id: body.payment_order_id,
            p_razorpay_payment_id: body.razorpay_payment_id,
            p_razorpay_signature: body.razorpay_signature,
            p_image_url: body.image_url || paymentOrder.purchase_metadata?.image_url,
            p_link_url: body.link_url || paymentOrder.purchase_metadata?.link_url,
            p_alt_text: body.alt_text || paymentOrder.purchase_metadata?.alt_text,
         })

      if (purchaseError) {
         console.error('Purchase error:', purchaseError)
         throw new Error('Failed to complete purchase')
      }

      if (!purchaseResult?.success) {
         throw new Error(purchaseResult?.error || 'Purchase failed')
      }

      // Send confirmation email
      const pixelCount = paymentOrder.purchase_metadata?.pixels?.length || 0
      const totalAmount = paymentOrder.amount / 100 // Convert from paise to INR

      await sendConfirmationEmail(
         user.email || '',
         pixelCount,
         totalAmount,
         body.alt_text || 'My Pixels',
         body.link_url
      )

      return new Response(
         JSON.stringify({
            success: true,
            message: 'Payment verified and purchase completed',
            data: {
               pixel_count: purchaseResult.pixel_count,
               total_price: purchaseResult.total_price,
               block_id: purchaseResult.block_id,
            }
         }),
         {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         }
      )

   } catch (err) {
      console.error('Verify payment error:', err)
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
