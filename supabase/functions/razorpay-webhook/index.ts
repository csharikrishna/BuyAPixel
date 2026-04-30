import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts'

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://buyaspot.in',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface RazorpayWebhookPayload {
  event: string
  created_at: number
  entity: {
    id: string
    entity: string
    amount?: number
    currency?: string
    status?: string
    order_id?: string
    payment_id?: string
    signature?: string
    notes?: Record<string, unknown>
  }
}

// ✅ FIXED C11: Function to initiate automatic refund for orphaned payments
async function initiateAutomaticRefund(
  paymentId: string,
  amount: number,
  supabaseAdmin: any
): Promise<{ success: boolean; refundId?: string; error?: string }> {
  try {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return { success: false, error: 'Razorpay credentials not configured' }
    }

    const razorpayAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)

    // Call Razorpay refund API
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const refundResponse = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Basic ${razorpayAuth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount, // Refund full amount in paise
          notes: {
            reason: 'orphaned_payment_automatic_recovery'
          }
        }),
      })

      if (!refundResponse.ok) {
        const errorData = await refundResponse.json()
        console.error('Refund API error:', errorData)
        return { success: false, error: errorData.error?.description || 'Refund API error' }
      }

      const refundData = await refundResponse.json()
      return { success: true, refundId: refundData.id }
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (err) {
    console.error('Refund initiation error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// Verify Razorpay webhook signature (with constant-time comparison)
function timingSafeEqual(actual: string, received: string): boolean {
  if (actual.length !== received.length) return false
  let result = 0
  for (let i = 0; i < actual.length; i++) {
    result |= actual.charCodeAt(i) ^ received.charCodeAt(i)
  }
  return result === 0
}

// Send payment reconciliation notification email
async function sendReconciliationEmail(
  email: string,
  status: string,
  paymentId: string,
  amount: number,
  reason: string
) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set, skipping email')
    return
  }

  try {
    const statusBadge = status === 'resolved' ? '✅' : status === 'failed' ? '❌' : '⚠️'
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'BuyASpot Support <onboarding@resend.dev>',
        to: [email],
        reply_to: 'support@buyaspot.in',
        subject: `${statusBadge} Payment Notification - ${paymentId.slice(-8)}`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Payment Notification</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #10b981, #059669); padding: 32px; text-align: center; color: #fff; font-size: 24px; font-weight: 800; }
    .content { padding: 36px 32px; text-align: center; }
    .receipt { margin: 28px 0; padding: 24px; border-radius: 10px; background: #f9fafb; border: 1px solid #e5e7eb; text-align: left; }
    .row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
    .footer { padding: 22px; font-size: 12px; color: #9ca3af; text-align: center; background: #f9fafb; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">BuyASpot</div>
    <div class="content">
      <h1>Payment Notification</h1>
      <div class="receipt">
        <div class="row"><span>Status</span><span>${status.toUpperCase()}</span></div>
        <div class="row"><span>Payment ID</span><span>${paymentId}</span></div>
        <div class="row"><span>Amount</span><span>₹${(amount / 100).toFixed(2)}</span></div>
        <div class="row"><span>Details</span><span>${reason}</span></div>
      </div>
      ${status === 'failed' ? '<p style="color: #dc2626;">If your payment was deducted but not reflected, please contact support immediately.</p>' : ''}
    </div>
    <div class="footer">
      <p>BuyASpot — The Modern Million Dollar Homepage</p>
      <p>Reply to this email if you need help.</p>
    </div>
  </div>
</body>
</html>
        `,
      }),
    })

    if (!res.ok) {
      const error = await res.json()
      console.error('Resend error:', error)
    }
  } catch (err) {
    console.error('Email send error:', err)
  }
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
    if (!RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay secret not configured')
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured')
    }

    // Get webhook signature from headers
    const signature = req.headers.get('x-razorpay-signature')
    if (!signature) {
      console.warn('⚠️ Webhook request missing signature')
      return new Response(
        JSON.stringify({ success: false, error: 'Missing signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get raw body for signature verification
    const body = await req.text()

    // Verify webhook signature with constant-time comparison
    const hmac = createHmac('sha256', RAZORPAY_KEY_SECRET)
    hmac.update(body)
    const generatedSignature = hmac.digest('hex')
    const isValid = timingSafeEqual(generatedSignature, signature)
    if (!isValid) {
      console.error('❌ Invalid webhook signature')
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse webhook payload
    const payload: RazorpayWebhookPayload = JSON.parse(body)

    // Create Supabase client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    console.log(`📨 Webhook received: ${payload.event}`, payload.entity.id)

    // Handle different webhook events
    switch (payload.event) {
      case 'payment.authorized': // Payment successful
      case 'payment.captured':
        {
          const paymentId = payload.entity.id
          const orderId = payload.entity.order_id

          if (!orderId) {
            console.warn('⚠️ Payment webhook missing order_id')
            break
          }

          // Find the payment order
          const { data: paymentOrder, error: orderError } = await supabaseAdmin
            .from('payment_orders')
            .select('*')
            .eq('razorpay_order_id', orderId)
            .maybeSingle()

          if (orderError) {
            console.error('Error fetching payment order:', orderError)
            break
          }

          if (!paymentOrder) {
            // ✅ FIXED C11: Handle orphaned payment with automatic refund
            console.warn(`⚠️ Orphaned payment detected: ${paymentId} for order ${orderId}`)

            // Record orphaned payment
            const { data: orphanedOrder } = await supabaseAdmin
              .from('orphaned_orders')
              .insert({
                razorpay_order_id: orderId,
                user_id: null, // We don't know the user since there's no order
                amount: payload.entity.amount || 0,
                error_message: 'Order not found in database',
                status: 'pending_refund'
              })
              .select('id')
              .single()

            // Attempt automatic refund
            const refundResult = await initiateAutomaticRefund(
              paymentId,
              payload.entity.amount || 0,
              supabaseAdmin
            )

            if (refundResult.success && refundResult.refundId && orphanedOrder) {
              // Update orphaned order with refund info
              await supabaseAdmin
                .from('orphaned_orders')
                .update({
                  refund_id: refundResult.refundId,
                  status: 'refunded',
                  notes: 'Automatic refund initiated for orphaned payment',
                  resolved_at: new Date().toISOString()
                })
                .eq('id', orphanedOrder.id)
                .catch(e => console.error('Error updating orphaned order:', e))

              console.log(`✅ Automatic refund initiated: ${refundResult.refundId}`)
            } else {
              // Refund failed - log for manual review
              await supabaseAdmin
                .from('orphaned_orders')
                .update({
                  status: 'pending_manual_review',
                  notes: `Automatic refund failed: ${refundResult.error}. Manual intervention required.`
                })
                .eq('id', orphanedOrder?.id)
                .catch(e => console.error('Error updating orphaned order:', e))

              console.error(`❌ Automatic refund failed: ${refundResult.error}`)
            }

            // Log event for admin review
            await supabaseAdmin.from('event_log').insert({
              event_type: 'orphaned_payment_refund_attempt',
              description: `Orphaned payment ${paymentId} - refund ${refundResult.success ? 'succeeded' : 'failed'}`,
              payload: {
                razorpay_payment_id: paymentId,
                razorpay_order_id: orderId,
                amount: payload.entity.amount,
                refund_id: refundResult.refundId || null,
                refund_error: refundResult.error || null,
              },
            }).catch(e => console.error('Error logging orphaned payment:', e))

            break
          }

          // Check if already processed
          if (paymentOrder.status === 'paid') {
            console.log(`✅ Payment already processed: ${paymentId}`)
            break
          }

          // Complete the purchase
          const { data: user, error: userError } = await supabaseAdmin
            .from('profiles')
            .select('email')
            .eq('user_id', paymentOrder.user_id)
            .single()

          if (!userError && user?.email) {
            // Send confirmation email
            const pixelCount = paymentOrder.purchase_metadata?.pixels?.length || 0
            const totalAmount = paymentOrder.amount / 100 // Convert from paise to INR

            await sendReconciliationEmail(
              user.email,
              'resolved',
              paymentId,
              paymentOrder.amount,
              `Payment successfully received. ${pixelCount} pixels secured.`
            )
          }

          // Update payment order status
          await supabaseAdmin
            .from('payment_orders')
            .update({
              status: 'paid',
              razorpay_payment_id: paymentId,
              paid_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', paymentOrder.id)

          // ── SERVER-SIDE RECONCILIATION ────────────────────────────
          // Call the appropriate RPC to actually assign pixels/complete
          // the marketplace transfer. This is the safety net for cases
          // where the client's verify call failed (network timeout, etc.).
          try {
            if (paymentOrder.purchase_type === 'pixel_purchase') {
              const { data: rpcResult, error: rpcError } = await supabaseAdmin
                .rpc('complete_pixel_purchase', {
                  p_payment_order_id: paymentOrder.id,
                  p_razorpay_payment_id: paymentId,
                  p_razorpay_signature: '',
                })
              if (rpcError) {
                console.error('⚠️ Webhook pixel reconciliation failed:', rpcError)
              } else {
                console.log('✅ Webhook pixel reconciliation result:', rpcResult)
              }
            } else if (paymentOrder.purchase_type === 'marketplace_purchase') {
              const { data: rpcResult, error: rpcError } = await supabaseAdmin
                .rpc('complete_marketplace_purchase', {
                  p_payment_order_id: paymentOrder.id,
                  p_razorpay_payment_id: paymentId,
                  p_razorpay_signature: '',
                })
              if (rpcError) {
                console.error('⚠️ Webhook marketplace reconciliation failed:', rpcError)
              } else {
                console.log('✅ Webhook marketplace reconciliation result:', rpcResult)
              }
            }
          } catch (reconcileErr) {
            console.error('❌ Webhook reconciliation error:', reconcileErr)
          }

          console.log(`✅ Payment reconciled: ${paymentId}`)
        }
        break

      case 'payment.failed':
        {
          const paymentId = payload.entity.id
          const orderId = payload.entity.order_id

          if (!orderId) break

          // Find and mark payment order as failed
          const { error: updateError } = await supabaseAdmin
            .from('payment_orders')
            .update({
              status: 'failed',
              razorpay_payment_id: paymentId,
              updated_at: new Date().toISOString(),
            })
            .eq('razorpay_order_id', orderId)

          if (!updateError) {
            // Fetch user email for notification
            const { data: paymentOrder } = await supabaseAdmin
              .from('payment_orders')
              .select('user_id')
              .eq('razorpay_order_id', orderId)
              .single()

            if (paymentOrder) {
              const { data: user } = await supabaseAdmin
                .from('profiles')
                .select('email')
                .eq('user_id', paymentOrder.user_id)
                .single()

              if (user?.email) {
                await sendReconciliationEmail(
                  user.email,
                  'failed',
                  paymentId,
                  payload.entity.amount || 0,
                  'Your payment was declined. Please try again.'
                )
              }
            }
          }

          console.log(`❌ Payment failed: ${paymentId}`)
        }
        break

      case 'order.paid':
        // Order fully paid event (can be used for additional tracking)
        console.log(`💰 Order paid: ${payload.entity.id}`)
        break

      default:
        // Acknowledge other events but don't process
        console.log(`ℹ️ Unhandled event: ${payload.event}`)
    }

    // Always return 200 to acknowledge webhook reception
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
