import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

// Email config — SMTP (primary) or Resend (fallback)
const SMTP_HOSTNAME = Deno.env.get('SMTP_HOSTNAME')
const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '465')
const SMTP_USERNAME = Deno.env.get('SMTP_USERNAME')
const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD')
const SMTP_FROM = Deno.env.get('SMTP_FROM') || 'BuyASpot <noreply@buyaspot.in>'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PurchaseEmailData {
  email: string
  pixelCount: number
  totalCost: number
  pixelName: string
  linkUrl?: string
}

/* ------------------------- helpers ------------------------- */

const escapeHtml = (str: string) =>
  str.replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]!)
  )

const formatINR = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)

const formatDate = (date = new Date()) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date)

function buildEmailHtml(data: PurchaseEmailData) {
  const pixelName = escapeHtml(data.pixelName)
  const linkUrl = data.linkUrl ? escapeHtml(data.linkUrl) : null

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Purchase Confirmation</title>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background-color: #f3f4f6;
    margin: 0;
    padding: 0;
    color: #333;
  }
  .container {
    max-width: 600px;
    margin: 40px auto;
    background: #fff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 10px 25px rgba(0,0,0,0.08);
  }
  .header {
    background: linear-gradient(135deg, #10b981, #059669);
    padding: 32px;
    text-align: center;
    color: #fff;
    font-size: 28px;
    font-weight: 800;
  }
  .content {
    padding: 36px 32px;
    text-align: center;
  }
  h1 {
    margin-top: 0;
    color: #111827;
  }
  p {
    color: #4b5563;
    line-height: 1.6;
  }
  .receipt {
    margin: 28px 0;
    padding: 24px;
    border-radius: 10px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    text-align: left;
  }
  .row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
    font-size: 14px;
  }
  .row.total {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
    font-weight: 700;
    font-size: 16px;
  }
  .label { color: #6b7280; }
  .value { color: #111827; }
  .button {
    display: inline-block;
    margin-top: 28px;
    padding: 14px 32px;
    background: #10b981;
    color: #fff;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
  }
  .footer {
    padding: 22px;
    font-size: 12px;
    color: #9ca3af;
    text-align: center;
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="header">BuyASpot</div>

    <div class="content">
      <h1>Payment Successful 🎉</h1>
      <p>
        You now officially own a piece of the Million Dollar Canvas.
        Your pixels are secured forever.
      </p>

      <div class="receipt">
        <div class="row">
          <span class="label">Pixel Name</span>
          <span class="value">${pixelName}</span>
        </div>
        <div class="row">
          <span class="label">Quantity</span>
          <span class="value">${data.pixelCount} pixels</span>
        </div>
        <div class="row">
          <span class="label">Date</span>
          <span class="value">${formatDate()}</span>
        </div>
        ${linkUrl
      ? `<div class="row">
                <span class="label">Link</span>
                <span class="value">
                  <a href="${linkUrl}" style="color:#10b981;text-decoration:none">${linkUrl}</a>
                </span>
              </div>`
      : ''
    }
        <div class="row total">
          <span>Total Paid</span>
          <span>${formatINR(data.totalCost)}</span>
        </div>
      </div>

      <a href="https://buyaspot.in/profile" class="button">View Your Pixels</a>
    </div>

    <div class="footer">
      <p>BuyASpot — The Modern Million Dollar Homepage</p>
      <p>Just reply to this email if you need help.</p>
    </div>
  </div>
</body>
</html>
`
}

/* ─── Email Sending (SMTP primary, Resend fallback) ─── */

async function sendViaSmtp(to: string, subject: string, html: string): Promise<boolean> {
   if (!SMTP_HOSTNAME || !SMTP_USERNAME || !SMTP_PASSWORD) return false

   try {
      const client = new SMTPClient({
         connection: {
            hostname: SMTP_HOSTNAME,
            port: SMTP_PORT,
            tls: SMTP_PORT === 465,
            auth: {
               username: SMTP_USERNAME,
               password: SMTP_PASSWORD,
            },
         },
      })

      await client.send({
         from: SMTP_FROM,
         to: to,
         subject,
         content: 'auto',
         html,
      })

      await client.close()
      console.log('✅ Email sent via SMTP')
      return true
   } catch (err) {
      console.error('SMTP send failed:', err)
      return false
   }
}

async function sendViaResend(to: string, subject: string, html: string): Promise<boolean> {
   if (!RESEND_API_KEY) return false

   try {
      const res = await fetch('https://api.resend.com/emails', {
         method: 'POST',
         headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
         },
         body: JSON.stringify({
            from: 'BuyASpot <support@buyaspot.in>',
            to: [to],
            reply_to: 'support@buyaspot.in',
            subject,
            html,
         }),
      })

      if (!res.ok) {
         const error = await res.json()
         console.error('Resend error:', error)
         return false
      }
      console.log('✅ Email sent via Resend')
      return true
   } catch (err) {
      console.error('Resend send failed:', err)
      return false
   }
}

/* ------------------------- server ------------------------- */

serve(async (req: Request) => {
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
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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

    const subject = '🎉 Your BuyASpot Purchase Is Confirmed'
    const html = buildEmailHtml(body)

    // Strategy 1: SMTP
    const smtpSent = await sendViaSmtp(body.email, subject, html)
    if (smtpSent) {
      return new Response(
        JSON.stringify({ success: true, method: 'smtp' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Strategy 2: Resend
    const resendSent = await sendViaResend(body.email, subject, html)
    if (resendSent) {
      return new Response(
        JSON.stringify({ success: true, method: 'resend' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // No service configured
    console.warn(
      '⚠️ No email service configured. Set SMTP_* or RESEND_API_KEY env vars.'
    )
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
