import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set')
      throw new Error('Server misconfiguration: RESEND_API_KEY missing')
    }

    const {
      email,
      pixelCount,
      totalCost,
      pixelName,
      linkUrl,
    }: PurchaseEmailData = await req.json()

    if (!email) {
      throw new Error('Email is required')
    }

    console.log(`Sending purchase confirmation to ${email} for ${pixelCount} pixels`)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'BuyAPixel <onboarding@resend.dev>',
        to: [email],
        subject: '🎉 You Own a Piece of History! Purchase Confirmation',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Purchase Confirmation</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      margin: 0;
      padding: 0;
      background-color: #f3f4f6;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      padding: 32px 20px;
      text-align: center;
    }
    .logo {
      font-size: 28px;
      font-weight: 800;
      color: #ffffff;
      text-decoration: none;
      letter-spacing: -0.5px;
    }
    .content {
      padding: 40px 32px;
    }
    h1 {
      margin-top: 0;
      color: #111827;
      font-size: 24px;
      font-weight: 700;
      text-align: center;
    }
    p {
      color: #4b5563;
      margin-bottom: 24px;
      text-align: center;
    }
    .receipt {
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 24px;
      margin: 24px 0;
    }
    .receipt-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
      font-size: 14px;
    }
    .receipt-row:last-child {
      margin-bottom: 0;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      font-weight: 700;
      font-size: 16px;
      color: #111827;
    }
    .label {
      color: #6b7280;
    }
    .value {
      color: #111827;
      font-weight: 500;
    }
    .button-container {
      text-align: center;
      margin-top: 32px;
    }
    .button {
      display: inline-block;
      background-color: #10b981;
      color: #ffffff;
      padding: 14px 32px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      transition: background-color 0.2s;
    }
    .footer {
      background-color: #f9fafb;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
      border-top: 1px solid #e5e7eb;
    }
    .link {
      color: #10b981;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <a href="https://buyapixel.in" class="logo">BuyAPixel</a>
    </div>
    
    <div class="content">
      <h1>Payment Successful! 🎉</h1>
      <p>Congratulations! You are now the official owner of new pixels on the Million Dollar Canvas. Your space is secured forever.</p>
      
      <div class="receipt">
        <div class="receipt-row">
          <span class="label">Pixel Name</span>
          <span class="value">${pixelName}</span>
        </div>
        <div class="receipt-row">
          <span class="label">Quantity</span>
          <span class="value">${pixelCount} pixels</span>
        </div>
        <div class="receipt-row">
          <span class="label">Date</span>
          <span class="value">${new Date().toLocaleDateString()}</span>
        </div>
        ${linkUrl ? `
        <div class="receipt-row">
          <span class="label">Link</span>
          <span class="value"><a href="${linkUrl}" class="link" style="color: #10b981; text-decoration: none;">${linkUrl}</a></span>
        </div>
        ` : ''}
        <div class="receipt-row">
          <span class="label">Total Paid</span>
          <span class="value">₹${totalCost.toLocaleString()}</span>
        </div>
      </div>

      <div class="button-container">
        <a href="https://buyapixel.in/profile" class="button">View Your Pixels</a>
      </div>
    </div>

    <div class="footer">
      <p style="margin-bottom: 8px;">BuyAPixel - The Modern Million Dollar Homepage</p>
      <p>If you have any questions, please reply to this email.</p>
    </div>
  </div>
</body>
</html>
        `,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Resend API Error:', data)
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Email could not be sent',
          details: data,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('Function Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
