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

interface CreateOrderRequest {
  pixels: Array<{ x: number; y: number; price: number }>
  totalAmount: number
  imageUrl?: string
  linkUrl?: string
  altText?: string
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
      throw new Error('Invalid or expired token')
    }

    // Parse request body
    const body: CreateOrderRequest = await req.json()

    if (!body.pixels || body.pixels.length === 0) {
      throw new Error('No pixels provided')
    }

    if (!body.totalAmount || body.totalAmount <= 0) {
      throw new Error('Invalid amount')
    }

    // Validate pixels are available (optional additional check)
    const pixelCoords = body.pixels.map(p => ({ x: p.x, y: p.y }))
    
    // Amount in paise (INR * 100)
    const amountInPaise = Math.round(body.totalAmount * 100)

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
        receipt: `pixel_${Date.now()}`,
        notes: {
          user_id: user.id,
          pixel_count: body.pixels.length,
          purpose: 'pixel_purchase'
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
    const { data: paymentOrder, error: dbError } = await supabase
      .from('payment_orders')
      .insert({
        user_id: user.id,
        razorpay_order_id: razorpayOrder.id,
        amount: amountInPaise,
        purchase_type: 'pixel_purchase',
        purchase_metadata: {
          pixels: body.pixels,
          image_url: body.imageUrl || null,
          link_url: body.linkUrl || null,
          alt_text: body.altText || null,
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
