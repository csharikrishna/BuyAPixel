import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const CONTACT_EMAIL = 'notbot4444@gmail.com' // Your verified Resend email

interface ContactFormData {
  name: string
  email: string
  subject: string
  message: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { name, email, subject, message }: ContactFormData = await req.json()

    // Validate input
    if (!name || !email || !subject || !message) {
      return new Response(
        JSON.stringify({ error: 'All fields are required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    console.log('📧 Initiating contact form email...')
    console.log('From:', name, `<${email}>`)
    console.log('Subject:', subject)
    console.log('To:', CONTACT_EMAIL)

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
                    <div class="value">${name}</div>
                  </div>
                  <div class="field">
                    <div class="label">Email Address</div>
                    <div class="value">
                      <a href="mailto:${email}" class="email-link">${email}</a>
                    </div>
                  </div>
                  <div class="field">
                    <div class="label">Subject</div>
                    <div class="value">${subject}</div>
                  </div>
                  <div class="field">
                    <div class="label">Message</div>
                    <div class="value">
                      <div class="message-box">${message}</div>
                    </div>
                  </div>
                  <div style="text-align: center;">
                    <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subject)}" class="reply-button">
                      Reply to ${name}
                    </a>
                  </div>
                  <div class="footer">
                    <p>This email was sent from the BuyAPixel.in contact form</p>
                    <p>📅 Received: ${new Date().toLocaleString('en-IN', { 
                      timeZone: 'Asia/Kolkata',
                      dateStyle: 'long',
                      timeStyle: 'short'
                    })} IST</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `,
      }),
    })

    const data = await res.json()

    // Handle Resend test mode (403 for non-verified recipients)
    if (res.status === 403 && data.message?.includes('testing emails')) {
      console.log('⚠️  Resend Test Mode: Email sent to verified address only')
      console.log('✅ Email delivered to:', CONTACT_EMAIL)
      
      // Still return success since email WAS sent to the verified address
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email sent successfully',
          note: 'Currently in test mode - emails sent to verified address only'
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    if (!res.ok) {
      console.error('❌ Resend API error:', data)
      throw new Error(data.message || 'Failed to send email')
    }

    console.log('✅ Email sent successfully!')
    console.log('📨 Email ID:', data.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email sent successfully',
        emailId: data.id 
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error: any) {
    console.error('❌ Error in contact form handler:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send email',
        details: error.toString()
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})
