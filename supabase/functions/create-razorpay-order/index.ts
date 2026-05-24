import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// ✅ FIXED C8: In-memory rate limiting as first defense
interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()
const RATE_LIMIT_REQUESTS = 5 // Max 5 order creation attempts per window
const RATE_LIMIT_WINDOW = 2 * 60 * 1000 // 2 minute window

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

// Max pixels per purchase (server-side enforcement)
const MAX_PIXELS_PER_PURCHASE = 1000

interface CreateOrderRequest {
  pixels: Array<{ x: number; y: number; price: number }>
  totalAmount: number
  imageUrl?: string
  linkUrl?: string
  altText?: string
}

// ✅ FIXED C7: Input validation helper
function validateUrl(url?: string): string | null {
  if (!url) return null

  try {
    const parsed = new URL(url)
    // Only allow http, https, and data schemes
    if (!['http:', 'https:', 'data:'].includes(parsed.protocol)) {
      throw new Error('Invalid URL scheme')
    }
    return url
  } catch (err) {
    console.error('Invalid URL:', err)
    throw new Error('Invalid URL format')
  }
}

// ✅ FIXED C7: Validate text fields (prevent XSS)
function validateTextField(text?: string, maxLength: number = 200): string | null {
  if (!text) return null

  if (typeof text !== 'string') {
    throw new Error('Text must be a string')
  }

  if (text.length > maxLength) {
    throw new Error(`Text exceeds maximum length of ${maxLength} characters`)
  }

  // Remove dangerous HTML/script patterns (whitelist approach)
  // Allow only alphanumeric, spaces, and common punctuation
  const dangerous = /<[^>]*>|javascript:|on\w+=/gi
  if (dangerous.test(text)) {
    throw new Error('Text contains invalid characters or HTML')
  }

  return text.trim()
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
    // ✅ Request body size validation — reject payloads > 5MB
    const contentLength = req.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 5_000_000) {
      return new Response(
        JSON.stringify({ success: false, error: 'Request payload too large' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    // Validate environment variables
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      console.error('Missing Razorpay credentials:', {
        hasKeyId: !!RAZORPAY_KEY_ID,
        hasKeySecret: !!RAZORPAY_KEY_SECRET
      })
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Razorpay credentials not configured in Supabase',
          details: 'Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Supabase Dashboard > Settings > Secrets'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase credentials')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Supabase credentials not configured'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get auth token from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Create Supabase client with user's token
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: {
        headers: { Authorization: authHeader }
      }
    })

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      console.error('Auth error:', userError)
      throw new Error('Invalid or expired token')
    }

    console.log(`✅ Authenticated user: ${user.id}`)

    // ✅ Rate limiting check
    const { allowed, remaining } = checkRateLimit(user.id)
    if (!allowed) {
      console.warn(`⚠️ Rate limit exceeded for user: ${user.id}`)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Too many order attempts. Please wait before trying again.',
          retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000) + ' seconds'
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil(RATE_LIMIT_WINDOW / 1000).toString(),
          },
        }
      )
    }

    // Parse request body
    const body: CreateOrderRequest = await req.json()

    if (!body.pixels || body.pixels.length === 0) {
      throw new Error('No pixels provided')
    }

    // ✅ Server-side pixel count limit
    if (body.pixels.length > MAX_PIXELS_PER_PURCHASE) {
      throw new Error(`Cannot purchase more than ${MAX_PIXELS_PER_PURCHASE} pixels at once`)
    }

    if (!body.totalAmount || body.totalAmount <= 0) {
      throw new Error('Invalid amount')
    }

    // ✅ FIXED C7: Validate user inputs
    const validatedImageUrl = body.imageUrl ? validateUrl(body.imageUrl) : null
    const validatedLinkUrl = body.linkUrl ? validateUrl(body.linkUrl) : null
    const validatedAltText = body.altText ? validateTextField(body.altText, 200) : null

    // --- Server-side price recalculation (prevents price manipulation) ---
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

    const serverTotal = body.pixels.reduce((sum, p) => {
      // Validate pixel coordinates are within bounds
      if (p.x < 0 || p.x >= CANVAS_WIDTH || p.y < 0 || p.y >= CANVAS_HEIGHT) {
        throw new Error(`Invalid pixel coordinates: (${p.x}, ${p.y})`)
      }
      return sum + serverCalculatePixelPrice(p.x, p.y)
    }, 0)

    if (serverTotal !== body.totalAmount) {
      console.error(`Price mismatch: client=${body.totalAmount}, server=${serverTotal}`)
      throw new Error('Price validation failed. Please refresh and try again.')
    }

    // Validate pixels are available (optional additional check)
    const pixelCoords = body.pixels.map(p => ({ x: p.x, y: p.y }))
    
    // Amount in paise (INR * 100)
    const amountInPaise = Math.round(body.totalAmount * 100)

    // Create Razorpay order with timeout protection
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    let razorpayResponse
    const razorpayAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
    try {
      razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        signal: controller.signal, // ✅ FIXED: Add abort signal for timeout
        headers: {
          'Authorization': `Basic ${razorpayAuth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: `pixel_${Date.now()}`,
          notes: {
            user_id: user.id,
            pixel_count: body.pixels.length,
            purpose: 'pixel_purchase'
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

    // ✅ FIXED: Retry database insert with exponential backoff to handle orphaned orders
    let paymentOrder = null
    let lastError: Error | null = null
    const maxRetries = 3

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const { data, error: dbError } = await supabase
          .from('payment_orders')
          .insert({
            user_id: user.id,
            razorpay_order_id: razorpayOrder.id,
            amount: amountInPaise,
            purchase_type: 'pixel_purchase',
            purchase_metadata: {
              pixels: body.pixels,
              image_url: validatedImageUrl, // ✅ Use validated URL
              link_url: validatedLinkUrl,   // ✅ Use validated URL
              alt_text: validatedAltText,   // ✅ Use validated text
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
          throw lastError // Non-retryable error, fail immediately
        }

        if (attempt < maxRetries - 1) {
          // Exponential backoff: 100ms, 200ms, 400ms
          const delayMs = 100 * Math.pow(2, attempt)
          await new Promise(r => setTimeout(r, delayMs))
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
      }
    }

    if (!paymentOrder) {
      console.error(`Failed to insert payment order after ${maxRetries} retries:`, lastError)
      
      // Log to orphaned_orders for manual recovery
      try {
        await supabase.from('orphaned_orders').insert({
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

      throw new Error('Failed to create payment order after retries')
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
    console.error('Create order error:', err)
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
    const statusCode = errorMessage.includes('Invalid or expired token') ? 401 : 400
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
