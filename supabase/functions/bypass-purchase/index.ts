import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail, buildPurchaseConfirmationEmail } from '../_shared/email.ts'

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

// Same pricing logic as create-razorpay-order
const CANVAS_WIDTH = 100
const CANVAS_HEIGHT = 100
const ECONOMY_DEPTH = 3
const PREMIUM_DEPTH = 8
const ECONOMY_PRICE = 99
const PREMIUM_PRICE = 299
const GOLD_PRICE = 499

function serverCalculatePixelPrice(x: number, y: number): number {
  const distFromEdge = Math.min(x, y, CANVAS_WIDTH - 1 - x, CANVAS_HEIGHT - 1 - y)
  if (distFromEdge < ECONOMY_DEPTH) return ECONOMY_PRICE
  if (distFromEdge < PREMIUM_DEPTH) return PREMIUM_PRICE
  return GOLD_PRICE
}

// Input validation (same as create-razorpay-order)
function validateUrl(url?: string): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:', 'data:'].includes(parsed.protocol)) {
      throw new Error('Invalid URL scheme')
    }
    return url
  } catch {
    throw new Error('Invalid URL format')
  }
}

function validateTextField(text?: string, maxLength = 200): string | null {
  if (!text) return null
  if (typeof text !== 'string') throw new Error('Text must be a string')
  if (text.length > maxLength) throw new Error(`Text exceeds maximum length of ${maxLength}`)
  const dangerous = /<[^>]*>|javascript:|on\w+=/gi
  if (dangerous.test(text)) throw new Error('Text contains invalid characters or HTML')
  return text.trim()
}

const MAX_PIXELS_PER_PURCHASE = 1000

interface BypassPurchaseRequest {
  pixels: Array<{ x: number; y: number; price: number }>
  totalAmount: number
  imageUrl?: string
  linkUrl?: string
  altText?: string
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
    console.log('[BYPASS] Step 1: Checking bypass flag...')

    // Temporarily commented out environment variable checks to allow admin testing
    /*
    const deployEnv = Deno.env.get('DEPLOY_ENV') || 'production'
    if (deployEnv === 'production') {
      console.error(`[BYPASS] BLOCKED: DEPLOY_ENV is "production"`)
      return new Response(
        JSON.stringify({ success: false, error: 'Payment bypass is not available in production' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (BYPASS_PAYMENT_ENABLED !== 'true') {
      console.error(`[BYPASS] BYPASS_PAYMENT_ENABLED = "${BYPASS_PAYMENT_ENABLED}" (not "true")`)
      return new Response(
        JSON.stringify({ success: false, error: 'Payment bypass is not enabled on the server' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    */

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured')
    }

    console.log('[BYPASS] Step 2: Authenticating user...')
    // Authenticate user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      console.error('[BYPASS] Auth error:', userError?.message)
      throw new Error('Invalid or expired token')
    }
    console.log(`[BYPASS] User authenticated: ${user.id}`)

    // ✅ FIX CRITICAL #5: Verify user is an admin before allowing bypass
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single()
    if (!profile?.is_admin) {
      console.error(`[BYPASS] BLOCKED: User ${user.id} is not an admin`)
      return new Response(
        JSON.stringify({ success: false, error: 'Payment bypass is restricted to admin users only' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log(`[BYPASS] Admin check passed for user: ${user.id}`)

    console.log('[BYPASS] Step 3: Parsing and validating request...')
    // Parse & validate request
    const body: BypassPurchaseRequest = await req.json()

    if (!body.pixels || body.pixels.length === 0) throw new Error('No pixels provided')
    if (body.pixels.length > MAX_PIXELS_PER_PURCHASE) {
      throw new Error(`Cannot purchase more than ${MAX_PIXELS_PER_PURCHASE} pixels at once`)
    }
    if (!body.totalAmount || body.totalAmount <= 0) throw new Error('Invalid amount')

    console.log(`[BYPASS] Pixels: ${body.pixels.length}, Amount: ₹${body.totalAmount}`)

    const validatedImageUrl = body.imageUrl ? validateUrl(body.imageUrl) : null
    const validatedLinkUrl = body.linkUrl ? validateUrl(body.linkUrl) : null
    const validatedAltText = body.altText ? validateTextField(body.altText, 200) : null

    console.log('[BYPASS] Step 4: Price recalculation...')
    // Server-side price recalculation
    const serverTotal = body.pixels.reduce((sum, p) => {
      if (p.x < 0 || p.x >= CANVAS_WIDTH || p.y < 0 || p.y >= CANVAS_HEIGHT) {
        throw new Error(`Invalid pixel coordinates: (${p.x}, ${p.y})`)
      }
      return sum + serverCalculatePixelPrice(p.x, p.y)
    }, 0)

    if (serverTotal !== body.totalAmount) {
      console.error(`[BYPASS] Price mismatch: server=${serverTotal}, client=${body.totalAmount}`)
      throw new Error('Price validation failed. Please refresh and try again.')
    }
    console.log(`[BYPASS] Price validated: ₹${serverTotal}`)

    console.log('[BYPASS] Step 5: Creating payment order...')
    // Create payment order with bypassed status
    const bypassOrderId = `bypass_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const amountInPaise = Math.round(body.totalAmount * 100)

    const { data: paymentOrder, error: dbError } = await supabaseAdmin
      .from('payment_orders')
      .insert({
        user_id: user.id,
        razorpay_order_id: bypassOrderId,
        amount: amountInPaise,
        purchase_type: 'pixel_purchase',
        purchase_metadata: {
          pixels: body.pixels,
          image_url: validatedImageUrl,
          link_url: validatedLinkUrl,
          alt_text: validatedAltText,
        },
        status: 'created',
      })
      .select()
      .single()

    if (dbError || !paymentOrder) {
      console.error('[BYPASS] DB insert error:', JSON.stringify(dbError))
      throw new Error('Failed to create payment order: ' + (dbError?.message || 'Unknown DB error'))
    }
    console.log(`[BYPASS] Payment order created: ${paymentOrder.id}`)

    console.log('[BYPASS] Step 6: Calling complete_pixel_purchase RPC...')
    // Directly complete the purchase via RPC (no Razorpay verification needed)
    const bypassPaymentId = `bypass_pay_${Date.now()}`
    const { data: purchaseResult, error: purchaseError } = await supabaseAdmin
      .rpc('complete_pixel_purchase', {
        p_payment_order_id: paymentOrder.id,
        p_razorpay_payment_id: bypassPaymentId,
        p_razorpay_signature: 'bypass_signature',
        p_image_url: validatedImageUrl,
        p_link_url: validatedLinkUrl,
        p_alt_text: validatedAltText,
        p_idempotency_key: `bypass-${bypassPaymentId}-${user.id}`,
      })

    if (purchaseError) {
      console.error('[BYPASS] RPC error:', JSON.stringify(purchaseError))
      throw new Error('Failed to complete purchase: ' + purchaseError.message)
    }

    console.log('[BYPASS] RPC result:', JSON.stringify(purchaseResult))

    if (!purchaseResult?.success) {
      throw new Error(purchaseResult?.error || 'Purchase failed')
    }

    console.log(`✅ [BYPASS] Purchase completed for user ${user.id}: ${body.pixels.length} pixels`)

    // Send confirmation email (fire-and-forget, don't block purchase response)
    if (user.email) {
      try {
        const emailHtml = buildPurchaseConfirmationEmail({
          pixelName: validatedAltText || 'My Pixels',
          pixelCount: body.pixels.length,
          totalCost: body.totalAmount,
          linkUrl: validatedLinkUrl || undefined,
          isTestMode: true,
        })

        await sendEmail(
          user.email,
          '🎉 Your BuyASpot Purchase Is Confirmed',
          emailHtml
        )
        console.log('[BYPASS] Confirmation email sent to', user.email)
      } catch (emailErr) {
        // Don't fail the purchase if email fails
        console.error('[BYPASS] Email send failed:', emailErr)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Purchase completed (payment bypassed)',
        data: {
          pixel_count: purchaseResult.pixel_count,
          total_price: purchaseResult.total_price,
          block_id: purchaseResult.block_id,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[BYPASS] Error:', err instanceof Error ? err.message : err)
    console.error('[BYPASS] Stack:', err instanceof Error ? err.stack : 'N/A')
    // Return 200 even on error so supabase-js doesn't swallow the response body in a generic FunctionsHttpError
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
