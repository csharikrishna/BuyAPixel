import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// ✅ FIX M11: Restrict CORS to explicit allow-list (was wildcard)
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

// ✅ FIX HIGH #7: DB-backed rate limiting (replaces in-memory maps that reset on cold starts)
const RATE_LIMIT_REQUESTS = 5 // Max 5 marketplace orders per window
const RATE_LIMIT_WINDOW_SECONDS = 60 // 1 minute window

interface CreateMarketplaceOrderRequest {
   listing_id: string
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
      if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
         throw new Error('Razorpay credentials not configured')
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

      // ✅ FIX HIGH #7: DB-backed rate limiting (persistent across cold starts)
      const { data: rateLimitResult, error: rateLimitError } = await supabaseAdmin
        .rpc('check_and_record_rate_limit', {
          p_user_id: user.id,
          p_endpoint: 'create_marketplace_order',
          p_max_requests: RATE_LIMIT_REQUESTS,
          p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
        })

      if (rateLimitError) {
        console.error('Rate limit check error:', rateLimitError)
        // Fail open — allow request but log the error
      } else if (rateLimitResult && !rateLimitResult[0]?.allowed) {
         console.warn(`⚠️ Rate limit exceeded for user: ${user.id}`)
         return new Response(
            JSON.stringify({
               success: false,
               error: 'Too many order requests. Please wait before creating another order.',
               retryAfter: RATE_LIMIT_WINDOW_SECONDS + ' seconds'
            }),
            {
               status: 429,
               headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json',
                  'Retry-After': RATE_LIMIT_WINDOW_SECONDS.toString(),
                  'X-RateLimit-Limit': RATE_LIMIT_REQUESTS.toString(),
                  'X-RateLimit-Remaining': '0',
               },
            }
         )
      }

      // Parse request body
      const body: CreateMarketplaceOrderRequest = await req.json()

      if (!body.listing_id) {
         throw new Error('Listing ID is required')
      }

      // Get the listing details
      const { data: listing, error: listingError } = await supabaseAdmin
         .from('marketplace_listings')
         .select(`
        id,
        pixel_id,
        seller_id,
        asking_price,
        status,
        pixels (x, y)
      `)
         .eq('id', body.listing_id)
         .eq('status', 'active')
         .single()

      if (listingError || !listing) {
         throw new Error('Listing not found or no longer available')
      }

      // Verify buyer is not the seller
      if (listing.seller_id === user.id) {
         throw new Error('Cannot purchase your own listing')
      }

      // Amount in paise (INR * 100)
      const amountInPaise = Math.round(listing.asking_price * 100)

      // Create Razorpay order with timeout protection
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      let razorpayResponse
      const razorpayAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)

      try {
         razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            signal: controller.signal,
            headers: {
               'Authorization': `Basic ${razorpayAuth}`,
               'Content-Type': 'application/json',
            },
            body: JSON.stringify({
               amount: amountInPaise,
               currency: 'INR',
               receipt: `marketplace_${Date.now()}`,
               notes: {
                  user_id: user.id,
                  listing_id: body.listing_id,
                  seller_id: listing.seller_id,
                  purpose: 'marketplace_purchase'
               }
            }),
         })
      } finally {
         clearTimeout(timeoutId)
      }

      if (!razorpayResponse.ok) {
         const errorData = await razorpayResponse.json()
         console.error('Razorpay API error:', {
           status: razorpayResponse.status,
           error: errorData?.error,
           description: errorData?.error?.description,
         })
         throw new Error(`Razorpay API error (${razorpayResponse.status}): ${errorData?.error?.description || 'Unknown'}`)
      }

      const razorpayOrder = await razorpayResponse.json()

      // Retry database insert with exponential backoff to handle orphaned orders
      let paymentOrder = null
      let lastError: Error | null = null
      const maxRetries = 3

      for (let attempt = 0; attempt < maxRetries; attempt++) {
         try {
            const { data, error: dbError } = await supabaseAdmin
               .from('payment_orders')
               .insert({
                  user_id: user.id,
                  razorpay_order_id: razorpayOrder.id,
                  amount: amountInPaise,
                  purchase_type: 'marketplace_purchase',
                  purchase_metadata: {
                     listing_id: body.listing_id,
                     pixel_id: listing.pixel_id,
                     seller_id: listing.seller_id,
                     asking_price: listing.asking_price,
                     pixel_coords: listing.pixels
                  },
                  status: 'created',
               })
               .select()
               .single()

            if (!dbError) {
               paymentOrder = data
               break // Success!
            }

            lastError = new Error(dbError.message)
            
            // Check if error is retryable (connection timeout, pool exhaustion)
            const isRetryable = 
               dbError.message.includes('timeout') ||
               dbError.message.includes('pool') ||
               dbError.message.includes('connection')
            
            if (!isRetryable) {
               // Break the loop on non-retryable errors
               break
            }

            if (attempt < maxRetries - 1) {
               // Exponential backoff: 100ms, 200ms, 400ms
               const delayMs = 100 * Math.pow(2, attempt)
               await new Promise(r => setTimeout(r, delayMs))
            }
         } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err))
            const errMsg = lastError.message
            if (!errMsg.includes('timeout') && 
                !errMsg.includes('pool') && 
                !errMsg.includes('connection')) {
               break
            }
         }
      }

      if (!paymentOrder) {
         console.error(`Failed to insert payment order after ${maxRetries} retries:`, lastError)
         
         // Log to orphaned_orders for manual recovery
         try {
            await supabaseAdmin.from('orphaned_orders').insert({
               razorpay_order_id: razorpayOrder.id,
               user_id: user.id,
               amount: amountInPaise,
               error_message: lastError?.message || 'Unknown error',
               attempted_at: new Date().toISOString(),
               status: 'pending_manual_review'
            }).catch(console.error)
         } catch (logErr) {
            console.error('Failed to log orphaned order:', logErr)
         }

         throw new Error(`DB Error: ${lastError?.message || 'Failed to create payment order'}`)
      }

      // Return order details for frontend
      return new Response(
         JSON.stringify({
            success: true,
            order: {
               id: paymentOrder.id,
               razorpay_order_id: razorpayOrder.id,
               amount: amountInPaise,
               currency: 'INR',
               key_id: RAZORPAY_KEY_ID,
            },
            listing: {
               id: listing.id,
               asking_price: listing.asking_price,
               pixel_coords: listing.pixels
            },
            user: {
               email: user.email,
               name: user.user_metadata?.full_name || user.email?.split('@')[0],
            }
         }),
         {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         }
      )

   } catch (err) {
      console.error('Create marketplace order error:', err)
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
