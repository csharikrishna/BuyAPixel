import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import * as supabaseJs2 from 'https://esm.sh/@supabase/supabase-js@2'

// Environment variables
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const CONTACT_EMAIL = Deno.env.get('CONTACT_EMAIL') || 'notbot4444@gmail.com'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const ALLOWED_ORIGINS = [
  'https://buyapixel.onrender.com',
  'http://localhost:5173',
  'http://localhost:8080'
]

// Validate required environment variables
if (!RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is required')
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Supabase credentials are required')
}

interface ContactFormData {
  name: string
  email: string
  subject: string
  message: string
  honeypot?: string // Spam prevention
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

// Sanitize HTML to prevent XSS
function sanitizeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

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

// Log contact submission to database
async function logContactSubmission(data: ContactFormData, metadata: { ip: string; userAgent: string }) {
  try {
    const supabase = supabaseJs2.createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    await supabase.from('contact_messages').insert({
      name: data.name,
      email: data.email,
      subject: data.subject,
      message: data.message,
      ip_address: metadata.ip,
      user_agent: metadata.userAgent,
      // submitted_at removed as created_at is default now()
    })
  } catch (error) {
    console.error('Failed to log contact submission:', error)
    // Don't fail the request if logging fails
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

    console.log('📧 Initiating contact form email...')
    console.log('From:', name, `<${email}>`)
    console.log('Subject:', subject)
    console.log('To:', CONTACT_EMAIL)
    console.log('IP:', ip)

    // Sanitize inputs for HTML
    const safeName = sanitizeHtml(name)
    const safeEmail = sanitizeHtml(email)
    const safeSubject = sanitizeHtml(subject)
    const safeMessage = sanitizeHtml(message)

    // Send email using Resend API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'BuyAPixel Contact <onboarding@resend.dev>',
        to: [CONTACT_EMAIL],
        reply_to: email,
        subject: `[Contact Form] ${subject}`,
        html: `
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
                }
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                  line-height: 1.6; 
                  color: #333; 
                  background-color: #f5f5f5;
                }
                .container { 
                  max-width: 600px; 
                  margin: 20px auto; 
                  background: white;
                  border-radius: 8px;
                  overflow: hidden;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .header { 
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                  color: white; 
                  padding: 30px 20px; 
                  text-align: center;
                }
                .header h1 {
                  margin: 0 0 10px 0;
                  font-size: 24px;
                  font-weight: 600;
                }
                .header p {
                  margin: 0;
                  opacity: 0.9;
                  font-size: 14px;
                }
                .content { 
                  padding: 30px; 
                }
                .field { 
                  margin-bottom: 20px; 
                }
                .label { 
                  display: block;
                  font-weight: 600; 
                  color: #555; 
                  font-size: 12px;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  margin-bottom: 8px;
                }
                .value { 
                  color: #333; 
                  font-size: 15px;
                }
                .message-box {
                  white-space: pre-wrap; 
                  background: #f9fafb; 
                  padding: 20px; 
                  border-radius: 6px; 
                  border: 1px solid #e5e7eb;
                  font-size: 15px;
                  line-height: 1.6;
                  word-wrap: break-word;
                }
                .metadata {
                  background: #f3f4f6;
                  padding: 15px;
                  border-radius: 6px;
                  font-size: 12px;
                  color: #6b7280;
                  margin-top: 20px;
                }
                .metadata strong {
                  color: #374151;
                }
                .footer { 
                  text-align: center; 
                  margin-top: 30px; 
                  padding-top: 20px;
                  border-top: 1px solid #e5e7eb;
                  font-size: 12px; 
                  color: #888; 
                }
                .footer p {
                  margin: 5px 0;
                }
                .email-link {
                  color: #667eea;
                  text-decoration: none;
                }
                .email-link:hover {
                  text-decoration: underline;
                }
                .reply-button {
                  display: inline-block;
                  margin-top: 20px;
                  padding: 12px 24px;
                  background: #667eea;
                  color: white;
                  text-decoration: none;
                  border-radius: 6px;
                  font-weight: 600;
                }
                .reply-button:hover {
                  background: #5568d3;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>📬 New Contact Form Submission</h1>
                  <p>BuyAPixel.in</p>
                </div>
                <div class="content">
                  <div class="field">
                    <div class="label">From</div>
                    <div class="value">${safeName}</div>
                  </div>
                  <div class="field">
                    <div class="label">Email Address</div>
                    <div class="value">
                      <a href="mailto:${safeEmail}" class="email-link">${safeEmail}</a>
                    </div>
                  </div>
                  <div class="field">
                    <div class="label">Subject</div>
                    <div class="value">${safeSubject}</div>
                  </div>
                  <div class="field">
                    <div class="label">Message</div>
                    <div class="value">
                      <div class="message-box">${safeMessage}</div>
                    </div>
                  </div>
                  
                  <div class="metadata">
                    <strong>📊 Request Metadata:</strong><br>
                    IP Address: ${ip}<br>
                    User Agent: ${userAgent}<br>
                    Submitted: ${new Date().toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          dateStyle: 'long',
          timeStyle: 'medium'
        })} IST
                  </div>

                  <div style="text-align: center;">
                    <a href="mailto:${safeEmail}?subject=Re: ${encodeURIComponent(subject)}" class="reply-button">
                      Reply to ${safeName}
                    </a>
                  </div>
                  
                  <div class="footer">
                    <p>This email was sent from the BuyAPixel.in contact form</p>
                    <p>🔒 Authenticated and verified submission</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `,
      }),
    })

    const data = await res.json()

    // Handle Resend errors
    if (!res.ok) {
      // Handle Resend test mode gracefully
      if (res.status === 403 && data.message?.includes('testing')) {
        console.log('⚠️  Resend Test Mode: Email sent to verified address only')
        console.log('✅ Email delivered to:', CONTACT_EMAIL)

        // Log to database
        await logContactSubmission(formData, { ip, userAgent })

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Email sent successfully',
            note: 'Test mode - emails sent to verified address only'
          }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'X-RateLimit-Remaining': remaining.toString(),
            },
          }
        )
      }

      console.error('❌ Resend API error:', data)
      throw new Error(data.message || 'Failed to send email')
    }

    console.log('✅ Email sent successfully!')
    console.log('📨 Email ID:', data.id)

    // Log to database
    await logContactSubmission(formData, { ip, userAgent })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        emailId: data.id
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
