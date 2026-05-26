import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import * as supabaseJs2 from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail, buildContactFormEmail } from '../_shared/email.ts'

// Environment variables
const CONTACT_EMAIL = Deno.env.get('CONTACT_EMAIL') || 'support@buyaspot.in'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const ALLOWED_ORIGINS = [
  'https://buyaspot.in',
  'http://localhost:5173',
  'http://localhost:8080'
]

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Supabase credentials are required')
}

interface ContactFormData {
  name: string
  email: string
  subject: string
  message: string
  category?: string
  honeypot?: string
  file_url?: string
}

interface RateLimitEntry {
  count: number
  lastReset: number
}

// In-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, RateLimitEntry>()
const RATE_LIMIT = 3 // Max requests per time window
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour in milliseconds

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Check rate limit
function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(identifier)

  if (!entry) {
    rateLimitMap.set(identifier, { count: 1, lastReset: now })
    return { allowed: true, remaining: RATE_LIMIT - 1 }
  }

  // Reset if window has passed
  if (now - entry.lastReset > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(identifier, { count: 1, lastReset: now })
    return { allowed: true, remaining: RATE_LIMIT - 1 }
  }

  // Check if limit exceeded
  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 }
  }

  // Increment count
  entry.count++
  return { allowed: true, remaining: RATE_LIMIT - entry.count }
}

// Validate email format
function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false
  return EMAIL_REGEX.test(email)
}

// Get CORS headers
function getCorsHeaders(origin: string | null): HeadersInit {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0]

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

// Log contact submission to database and return the generated ticket_id
async function logContactSubmission(
  data: ContactFormData,
  metadata: { ip: string; userAgent: string }
): Promise<string | null> {
  try {
    const supabase = supabaseJs2.createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    const { data: inserted, error } = await supabase
      .from('contact_messages')
      .insert({
        name: data.name,
        email: data.email,
        subject: data.subject,
        message: data.message,
        category: data.category || null,
        file_url: data.file_url || null,
        ip_address: metadata.ip,
        user_agent: metadata.userAgent,
      })
      .select('ticket_id')
      .single()

    if (error) {
      console.error('Failed to log contact submission:', error)
      return null
    }

    return inserted?.ticket_id || null
  } catch (error) {
    console.error('Failed to log contact submission:', error)
    return null
  }
}

serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    // Get request metadata
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    // Rate limiting based on IP
    const { allowed, remaining } = checkRateLimit(ip)
    if (!allowed) {
      console.warn(`⚠️  Rate limit exceeded for IP: ${ip}`)
      return new Response(
        JSON.stringify({
          error: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000 / 60) + ' minutes'
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': RATE_LIMIT.toString(),
            'X-RateLimit-Remaining': '0',
            'Retry-After': Math.ceil(RATE_LIMIT_WINDOW / 1000).toString(),
          }
        }
      )
    }

    // Parse request body
    let formData: ContactFormData
    try {
      formData = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { name, email, subject, message, honeypot } = formData

    // Honeypot spam check (invisible field that bots fill)
    if (honeypot) {
      console.warn('🚫 Spam detected via honeypot field')
      // Return success to not reveal spam detection
      return new Response(
        JSON.stringify({ success: true, message: 'Email sent successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return new Response(
        JSON.stringify({
          error: 'All fields are required',
          fields: {
            name: !name ? 'Name is required' : undefined,
            email: !email ? 'Email is required' : undefined,
            subject: !subject ? 'Subject is required' : undefined,
            message: !message ? 'Message is required' : undefined,
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate field lengths
    if (name.length < 2 || name.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Name must be between 2 and 100 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (subject.length < 3 || subject.length > 200) {
      return new Response(
        JSON.stringify({ error: 'Subject must be between 3 and 200 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (message.length < 10 || message.length > 5000) {
      return new Response(
        JSON.stringify({ error: 'Message must be between 10 and 5000 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check for suspicious patterns (spam keywords)
    const spamKeywords = ['viagra', 'casino', 'crypto', 'bitcoin', 'lottery', 'prize']
    const messageLower = message.toLowerCase()
    const subjectLower = subject.toLowerCase()

    if (spamKeywords.some(keyword =>
      messageLower.includes(keyword) || subjectLower.includes(keyword)
    )) {
      console.warn('🚫 Potential spam detected via keywords')
      // Return success to not reveal spam detection
      return new Response(
        JSON.stringify({ success: true, message: 'Email sent successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log to database FIRST to get ticket_id
    const ticketId = await logContactSubmission(formData, { ip, userAgent })

    console.log('📧 Initiating contact form email...')
    console.log('From:', name, `<${email}>`)
    console.log('Subject:', subject)
    console.log('Ticket ID:', ticketId)
    console.log('To:', CONTACT_EMAIL)

    // Build the Gmail-compatible HTML email
    const mailSubject = ticketId
      ? `[${ticketId}] ${subject}`
      : `[Contact Form] ${subject}`

    const mailHtml = buildContactFormEmail({
      name,
      email,
      subject,
      message,
      category: formData.category,
      ticketId: ticketId || undefined,
      fileUrl: formData.file_url || undefined,
      ip,
      userAgent,
    })

    // Send using shared email utility (SMTP → Resend fallback)
    const emailSent = await sendEmail(CONTACT_EMAIL, mailSubject, mailHtml, email)

    if (!emailSent) {
      // Email failed but the DB record was created — still return ticket
      console.warn('⚠️ Email sending failed, but ticket was created')
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Support request submitted successfully',
        ticket_id: ticketId,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': RATE_LIMIT.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
        },
      }
    )
  } catch (error: unknown) {
    console.error('❌ Error in contact form handler:', error)

    return new Response(
      JSON.stringify({
        error: 'Failed to send email. Please try again later.',
        message: error instanceof Error ? error.message : 'Internal server error'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})
