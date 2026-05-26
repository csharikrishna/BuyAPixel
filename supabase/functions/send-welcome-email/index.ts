import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail, buildWelcomeEmail } from '../_shared/email.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

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

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  }

  try {
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

    if (userError || !user) {
      throw new Error('Invalid or expired token')
    }

    if (!user.email) {
      throw new Error('User has no email address')
    }

    // ── SERVER-SIDE DEDUP: Check if welcome email was already sent ──
    // This is the ONLY reliable dedup mechanism. Client-side localStorage
    // is unreliable (clears on browser change, incognito, etc.)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('full_name, welcome_email_sent')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      console.error('[Welcome] Failed to fetch profile:', profileError)
      throw new Error('Could not verify user profile')
    }

    // If already sent, return success without sending again
    if (profile?.welcome_email_sent) {
      console.log(`[Welcome] Already sent for user ${user.id}, skipping`)
      return new Response(
        JSON.stringify({ success: true, message: 'Welcome email already sent', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Atomically mark as sent BEFORE sending to prevent race conditions
    // If two requests arrive simultaneously, only one will succeed in updating
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ welcome_email_sent: true })
      .eq('user_id', user.id)
      .eq('welcome_email_sent', false) // Only update if still false (atomic check)

    if (updateError) {
      console.error('[Welcome] Failed to set flag:', updateError)
      // Don't block — try sending anyway
    }

    const fullName =
      profile?.full_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email.split('@')[0]

    console.log(`[Welcome] Sending welcome email to ${user.email} (${fullName})`)

    const html = buildWelcomeEmail({ fullName })
    const sent = await sendEmail(
      user.email,
      'Welcome to BuyASpot',
      html
    )

    if (!sent) {
      // Email failed — roll back the flag so it can be retried later
      await supabaseAdmin
        .from('profiles')
        .update({ welcome_email_sent: false })
        .eq('user_id', user.id)
        .catch(e => console.error('[Welcome] Failed to rollback flag:', e))
    }

    return new Response(
      JSON.stringify({ success: sent, message: sent ? 'Welcome email sent' : 'Email service unavailable' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[Welcome] Error:', err)
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
