import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts'
import { sendEmail, buildPurchaseConfirmationEmail } from '../_shared/email.ts'

const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')



// CORS: restrict to production domain + localhost for dev
const ALLOWED_ORIGINS = [
  'https://buyaspot.in',
  'https://www.buyaspot.in',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
]

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

// Rate limiting configuration
interface RateLimitEntry {
   count: number
   resetTime: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()
const RATE_LIMIT_REQUESTS = 5 // Max 5 verification attempts per window
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute window

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
   const now = Date.now()
   const entry = rateLimitMap.get(userId)

   if (!entry || now > entry.resetTime) {
      rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
      return { allowed: true, remaining: RATE_LIMIT_REQUESTS - 1 }
   }

   if (entry.count >= RATE_LIMIT_REQUESTS) {
      return { allowed: false, remaining: 0 }
   }

   entry.count++
   return { allowed: true, remaining: RATE_LIMIT_REQUESTS - entry.count }
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

// Constant-time string comparison to prevent timing attacks
function timingSafeEqual(actual: string, received: string): boolean {
   // First check length (length leaks, but unavoidable in HTTP)
   if (actual.length !== received.length) return false
   
   // Compare all bytes regardless of mismatch to use constant time
   let result = 0
   for (let i = 0; i < actual.length; i++) {
      // XOR each character - result stays 0 only if all match
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
   // ✅ FIXED: Use constant-time comparison to prevent timing attacks
   return timingSafeEqual(generatedSignature, signature)
}

// Send confirmation email using shared module
async function sendConfirmationEmail(
   email: string,
   pixelCount: number,
   totalAmount: number,
   pixelName: string,
   linkUrl?: string,
   transactionId?: string,
   receiptUrl?: string
) {
   if (!email) {
      console.warn('[Verify] No email address provided, skipping confirmation email')
      return
   }

   const subject = 'Purchase Confirmed — Order Receipt'
   const html = buildPurchaseConfirmationEmail({
      pixelName,
      pixelCount,
      totalCost: totalAmount,
      linkUrl,
      transactionId,
      receiptUrl,
   })

   await sendEmail(email, subject, html)
}

serve(async (req: Request) => {
   const corsHeaders = getCorsHeaders(req)

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

      // Rate limiting by user_id
      const { allowed, remaining } = checkRateLimit(user.id)
      if (!allowed) {
         console.warn(`⚠️ Rate limit exceeded for user: ${user.id}`)
         return new Response(
            JSON.stringify({
               success: false,
               error: 'Too many verification attempts. Please wait before trying again.',
               retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000) + ' seconds'
            }),
            {
               status: 429,
               headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json',
                  'Retry-After': Math.ceil(RATE_LIMIT_WINDOW / 1000).toString(),
                  'X-RateLimit-Limit': RATE_LIMIT_REQUESTS.toString(),
                  'X-RateLimit-Remaining': '0',
               },
            }
         )
      }

      // Parse request body
      const body: VerifyPaymentRequest = await req.json()
      console.log('📋 Step 1: Received verify request', {
         razorpay_order_id: body.razorpay_order_id,
         razorpay_payment_id: body.razorpay_payment_id,
         has_signature: !!body.razorpay_signature,
         payment_order_id: body.payment_order_id,
      })

      if (!body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature) {
         throw new Error('Missing payment verification data')
      }

      if (!body.payment_order_id) {
         throw new Error('Missing payment order ID')
      }

      // Verify the signature
      console.log('🔐 Step 2: Verifying signature...')
      const isValid = verifySignature(
         body.razorpay_order_id,
         body.razorpay_payment_id,
         body.razorpay_signature,
         RAZORPAY_KEY_SECRET
      )

      if (!isValid) {
         console.error('❌ Signature verification FAILED for order:', body.razorpay_order_id, {
            order_id: body.razorpay_order_id,
            payment_id: body.razorpay_payment_id,
            signature_length: body.razorpay_signature?.length,
            secret_length: RAZORPAY_KEY_SECRET?.length,
         })

         // Mark payment as failed
         await supabaseAdmin
            .from('payment_orders')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', body.payment_order_id)

         throw new Error('Payment verification failed - invalid signature. This usually means RAZORPAY_KEY_SECRET does not match the key used to create the order.')
      }
      console.log('✅ Step 2: Signature valid')

      // ✅ FIXED C6: Re-validate payment amount from Razorpay API
      // Prevents underpayment attacks by verifying with authoritative source
      console.log('💰 Step 3: Fetching payment details from Razorpay API...')
      const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')
      if (!RAZORPAY_KEY_ID) throw new Error('Razorpay key ID not configured')
      
      const razorpayAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
      
      let razorpayPaymentDetails
      try {
         const controller = new AbortController()
         const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
         
         try {
            const paymentDetailsResponse = await fetch(
               `https://api.razorpay.com/v1/payments/${body.razorpay_payment_id}`,
               {
                  method: 'GET',
                  signal: controller.signal,
                  headers: {
                     'Authorization': `Basic ${razorpayAuth}`,
                  }
               }
            )
            
            if (!paymentDetailsResponse.ok) {
               const errBody = await paymentDetailsResponse.text().catch(() => 'no body')
               console.error('Razorpay payment details API error:', {
                  status: paymentDetailsResponse.status,
                  body: errBody,
               })
               throw new Error(`Razorpay API error: ${paymentDetailsResponse.status}`)
            }
            
            razorpayPaymentDetails = await paymentDetailsResponse.json()
            console.log('✅ Step 3: Payment details fetched', {
               status: razorpayPaymentDetails.status,
               amount: razorpayPaymentDetails.amount,
               currency: razorpayPaymentDetails.currency,
            })
         } finally {
            clearTimeout(timeoutId)
         }
      } catch (err) {
         console.error('Failed to fetch payment details from Razorpay:', err)
         throw new Error('Could not verify payment amount. Please try again.')
      }

      // Get the payment order to check expected amount
      const { data: paymentOrder, error: orderError } = await supabaseAdmin
         .from('payment_orders')
         .select('*')
         .eq('id', body.payment_order_id)
         .eq('user_id', user.id)
         .single()

      if (orderError || !paymentOrder) {
         throw new Error('Payment order not found or unauthorized')
      }

      // Verify amounts match
      const expectedAmount = paymentOrder.amount // in paise
      const actualAmount = razorpayPaymentDetails.amount // in paise (Razorpay uses paise)
      const paymentStatus = razorpayPaymentDetails.status // 'captured', 'authorized', etc.

      if (actualAmount !== expectedAmount) {
         console.error(
            `Amount mismatch for payment ${body.razorpay_payment_id}: expected ${expectedAmount}, got ${actualAmount}`
         )

         // Mark payment as failed
         await supabaseAdmin
            .from('payment_orders')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', body.payment_order_id)

         throw new Error('Payment amount does not match order amount')
      }

      // Verify payment is captured or authorized
      if (!['captured', 'authorized'].includes(paymentStatus)) {
         console.error(`Payment status is ${paymentStatus}, expected 'captured' or 'authorized'`)

         await supabaseAdmin
            .from('payment_orders')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', body.payment_order_id)

         throw new Error(`Payment status is ${paymentStatus}`)
      }

      // Get the payment order to verify ownership and get metadata
      // Note: Already fetched above for amount verification

      // Complete the purchase using the RPC function
      const { data: purchaseResult, error: purchaseError } = await supabaseAdmin
         .rpc('complete_pixel_purchase', {
            p_payment_order_id: body.payment_order_id,
            p_razorpay_payment_id: body.razorpay_payment_id,
            p_razorpay_signature: body.razorpay_signature,
            p_image_url: body.image_url || paymentOrder.purchase_metadata?.image_url,
            p_link_url: body.link_url || paymentOrder.purchase_metadata?.link_url,
            p_alt_text: body.alt_text || paymentOrder.purchase_metadata?.alt_text,
            p_idempotency_key: `verify-${body.razorpay_payment_id}-${user.id}`,
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

      // Extract Razorpay receipt URL if available
      const receiptUrl = razorpayPaymentDetails?.short_url || null

      await sendConfirmationEmail(
         user.email || '',
         pixelCount,
         totalAmount,
         body.alt_text || 'My Pixels',
         body.link_url,
         body.razorpay_payment_id,
         receiptUrl
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
