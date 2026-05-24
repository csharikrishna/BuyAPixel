import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const BYPASS_PAYMENT_ENABLED = Deno.env.get('BYPASS_PAYMENT_ENABLED')

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

interface BypassMarketplaceRequest {
  listing_id: string
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  }

  try {
    // ⛔ Server-side guard: refuse to run if bypass is not explicitly enabled
    if (BYPASS_PAYMENT_ENABLED !== 'true') {
      return new Response(
        JSON.stringify({ success: false, error: 'Payment bypass is not enabled on the server' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured')
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) throw new Error('Invalid or expired token')

    // Parse request
    const body: BypassMarketplaceRequest = await req.json()
    if (!body.listing_id) throw new Error('Listing ID is required')

    // Get listing details
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

    if (listing.seller_id === user.id) {
      throw new Error('Cannot purchase your own listing')
    }

    // Create payment order with bypassed status
    const bypassOrderId = `bypass_mkt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const amountInPaise = Math.round(listing.asking_price * 100)

    const { data: paymentOrder, error: dbError } = await supabaseAdmin
      .from('payment_orders')
      .insert({
        user_id: user.id,
        razorpay_order_id: bypassOrderId,
        amount: amountInPaise,
        purchase_type: 'marketplace_purchase',
        purchase_metadata: {
          listing_id: body.listing_id,
          pixel_id: listing.pixel_id,
          seller_id: listing.seller_id,
          asking_price: listing.asking_price,
          pixel_coords: listing.pixels,
        },
        status: 'created',
      })
      .select()
      .single()

    if (dbError || !paymentOrder) {
      console.error('DB error:', dbError)
      throw new Error('Failed to create payment order')
    }

    // Directly complete the marketplace purchase via RPC
    const bypassPaymentId = `bypass_mkt_pay_${Date.now()}`
    const { data: purchaseResult, error: purchaseError } = await supabaseAdmin
      .rpc('complete_marketplace_purchase', {
        p_payment_order_id: paymentOrder.id,
        p_razorpay_payment_id: bypassPaymentId,
        p_razorpay_signature: 'bypass_signature',
      })

    if (purchaseError) {
      console.error('Marketplace purchase RPC error:', purchaseError)
      throw new Error('Failed to complete marketplace purchase: ' + purchaseError.message)
    }

    if (!purchaseResult?.success) {
      throw new Error(purchaseResult?.error || 'Marketplace purchase failed')
    }

    console.log(`✅ [BYPASS] Marketplace purchase completed for user ${user.id}: listing ${body.listing_id}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Marketplace purchase completed (payment bypassed)',
        data: purchaseResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Bypass marketplace purchase error:', err)
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
