import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// Email config — SMTP (primary) or Resend (fallback)
const SMTP_HOSTNAME = Deno.env.get('SMTP_HOSTNAME')
const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '465')
const SMTP_USERNAME = Deno.env.get('SMTP_USERNAME')
const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD')
const SMTP_FROM = Deno.env.get('SMTP_FROM') || 'BuyASpot <noreply@buyaspot.in>'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

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

// ─── Shared Email Sender (SMTP primary, Resend fallback) ────────────────────

async function sendEmail(to: string, subject: string, html: string) {
   if (!to) return

   // Strategy 1: SMTP
   if (SMTP_HOSTNAME && SMTP_USERNAME && SMTP_PASSWORD) {
      try {
         const client = new SMTPClient({
            connection: {
               hostname: SMTP_HOSTNAME,
               port: SMTP_PORT,
               tls: SMTP_PORT === 465,
               auth: { username: SMTP_USERNAME, password: SMTP_PASSWORD },
            },
         })
         await client.send({ from: SMTP_FROM, to, subject, content: 'auto', html })
         await client.close()
         console.log('✅ Email sent via SMTP to:', to)
         return
      } catch (err) {
         console.error('SMTP failed, trying fallback:', err)
      }
   }

   // Strategy 2: Resend
   if (RESEND_API_KEY) {
      try {
         const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
               Authorization: `Bearer ${RESEND_API_KEY}`,
               'Content-Type': 'application/json',
            },
            body: JSON.stringify({
               from: 'BuyASpot <support@buyaspot.in>',
               to: [to],
               reply_to: 'support@buyaspot.in',
               subject,
               html,
            }),
         })
         if (res.ok) {
            console.log('✅ Email sent via Resend to:', to)
            return
         }
         const error = await res.json()
         console.error('Resend error:', error)
      } catch (err) {
         console.error('Resend failed:', err)
      }
   }

   console.warn(`⚠️ No email service configured. Skipped email for: ${to}`)
}

// Send confirmation email to buyer
async function sendBuyerConfirmationEmail(
   email: string,
   salePrice: number,
   pixelCoords: { x: number; y: number } | null,
   transactionId: string
) {
   const coordsText = pixelCoords ? `(${pixelCoords.x}, ${pixelCoords.y})` : 'Unknown'

   const formatINR = (amount: number) =>
      new Intl.NumberFormat('en-IN', {
         style: 'currency',
         currency: 'INR',
         maximumFractionDigits: 0,
      }).format(amount)

   const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Marketplace Purchase Confirmation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px; text-align: center; color: #fff; font-size: 28px; font-weight: 800; }
    .content { padding: 36px 32px; text-align: center; }
    h1 { margin-top: 0; color: #111827; }
    .receipt { margin: 28px 0; padding: 24px; border-radius: 10px; background: #f9fafb; border: 1px solid #e5e7eb; text-align: left; }
    .row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
    .row.total { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-weight: 700; font-size: 16px; }
    .button { display: inline-block; margin-top: 28px; padding: 14px 32px; background: #6366f1; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .footer { padding: 22px; font-size: 12px; color: #9ca3af; text-align: center; background: #f9fafb; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">BuyASpot</div>
    <div class="content">
      <h1>Marketplace Purchase Complete 🛒</h1>
      <p>Congratulations! You've acquired a pixel from the marketplace.</p>
      <div class="receipt">
        <div class="row"><span>Pixel Location</span><span>${coordsText}</span></div>
        <div class="row"><span>Transaction ID</span><span style="font-family: monospace; font-size: 12px;">${transactionId.substring(0, 8)}...</span></div>
        <div class="row total"><span>Total Paid</span><span>${formatINR(salePrice)}</span></div>
      </div>
      <a href="https://buyaspot.in/profile" class="button">View Your Pixels</a>
    </div>
    <div class="footer">
      <p>BuyASpot — The Modern Million Dollar Homepage</p>
      <p>Reply to this email if you need help.</p>
    </div>
  </div>
</body>
</html>
`

   await sendEmail(email, '🎉 Marketplace Purchase Confirmed!', html)
}

// Send sale notification email to seller
async function sendSellerNotificationEmail(
   email: string,
   salePrice: number,
   platformFee: number,
   sellerNet: number,
   pixelCoords: { x: number; y: number } | null
) {
   const coordsText = pixelCoords ? `(${pixelCoords.x}, ${pixelCoords.y})` : 'Unknown'

   const formatINR = (amount: number) =>
      new Intl.NumberFormat('en-IN', {
         style: 'currency',
         currency: 'INR',
         maximumFractionDigits: 0,
      }).format(amount)

   const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sale Notification</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #10b981, #059669); padding: 32px; text-align: center; color: #fff; font-size: 28px; font-weight: 800; }
    .content { padding: 36px 32px; text-align: center; }
    h1 { margin-top: 0; color: #111827; }
    .receipt { margin: 28px 0; padding: 24px; border-radius: 10px; background: #f9fafb; border: 1px solid #e5e7eb; text-align: left; }
    .row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
    .row.total { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-weight: 700; font-size: 16px; color: #10b981; }
    .button { display: inline-block; margin-top: 28px; padding: 14px 32px; background: #10b981; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .footer { padding: 22px; font-size: 12px; color: #9ca3af; text-align: center; background: #f9fafb; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">BuyASpot</div>
    <div class="content">
      <h1>Your Pixel Sold! 💰</h1>
      <p>Great news! Someone just purchased your pixel from the marketplace.</p>
      <div class="receipt">
        <div class="row"><span>Pixel Location</span><span>${coordsText}</span></div>
        <div class="row"><span>Sale Price</span><span>${formatINR(salePrice)}</span></div>
        <div class="row"><span>Platform Fee (5%)</span><span>-${formatINR(platformFee)}</span></div>
        <div class="row total"><span>Your Earnings</span><span>${formatINR(sellerNet)}</span></div>
      </div>
      <a href="https://buyaspot.in/marketplace" class="button">View Marketplace</a>
    </div>
    <div class="footer">
      <p>BuyASpot — The Modern Million Dollar Homepage</p>
      <p>Reply to this email if you need help.</p>
    </div>
  </div>
</body>
</html>
`

   await sendEmail(email, '💰 Your Pixel Has Been Sold!', html)
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
      // NOTE: Uses `complete_marketplace_purchase` (migration 031) which accepts
      // a payment_order_id and handles the full ownership transfer atomically.
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

      // Send confirmation email to buyer
      await sendBuyerConfirmationEmail(
         user.email || '',
         purchaseResult.sale_price,
         pixelCoords,
         purchaseResult.transaction_id
      )

      // Get seller email and send notification
      if (purchaseResult.seller_id) {
         const { data: sellerData } = await supabaseAdmin.auth.admin.getUserById(purchaseResult.seller_id)
         if (sellerData?.user?.email) {
            await sendSellerNotificationEmail(
               sellerData.user.email,
               purchaseResult.sale_price,
               purchaseResult.platform_fee,
               purchaseResult.seller_net,
               pixelCoords
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
