import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { sendEmail, buildPurchaseConfirmationEmail } from '../_shared/email.ts'

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

interface PurchaseEmailData {
  email: string
  pixelCount: number
  totalCost: number
  pixelName: string
  linkUrl?: string
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: corsHeaders,
    })
  }

  // Verify JWT authentication
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = (await req.json()) as PurchaseEmailData

    if (
      !body.email ||
      !body.pixelName ||
      body.pixelCount <= 0 ||
      body.totalCost <= 0
    ) {
      throw new Error('Invalid request payload')
    }

    const subject = 'Purchase Confirmed — Order Receipt'
    const html = buildPurchaseConfirmationEmail({
      pixelName: body.pixelName,
      pixelCount: body.pixelCount,
      totalCost: body.totalCost,
      linkUrl: body.linkUrl,
    })

    const sent = await sendEmail(body.email, subject, html)

    if (sent) {
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // No service configured
    console.warn('⚠️ No email service configured.')
    return new Response(
      JSON.stringify({
        success: false,
        error: 'No email service configured. Set SMTP_HOSTNAME or RESEND_API_KEY in Supabase secrets.'
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Email function error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
