import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Rate limiting configuration
interface RateLimitEntry {
   count: number
   resetTime: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()
const RATE_LIMIT_REQUESTS = 5 // Max 5 marketplace orders per window
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

interface CreateMarketplaceOrderRequest {
   listing_id: string
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

      // Rate limiting by user_id
      const { allowed, remaining } = checkRateLimit(user.id)
      if (!allowed) {
         console.warn(`⚠️ Rate limit exceeded for user: ${user.id}`)
         return new Response(
            JSON.stringify({
               success: false,
               error: 'Too many order requests. Please wait before creating another order.',
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

      // Create Razorpay order
      const razorpayAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)

      const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
         method: 'POST',
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

      if (!razorpayResponse.ok) {
         const errorData = await razorpayResponse.json()
         console.error('Razorpay error:', errorData)
         throw new Error('Failed to create Razorpay order')
      }

      const razorpayOrder = await razorpayResponse.json()

      // Store order in database
      const { data: paymentOrder, error: dbError } = await supabaseAdmin
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

      if (dbError) {
         console.error('Database error:', dbError)
         throw new Error('Failed to store payment order')
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
