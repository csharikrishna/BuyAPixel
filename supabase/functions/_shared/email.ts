/**
 * Shared Email Utilities for BuyASpot Edge Functions
 * ─────────────────────────────────────────────────────
 * - sendEmail(): Resend API primary, raw SMTP fallback
 * - All HTML templates use 100% INLINE styles (Gmail strips <style> blocks)
 * - Table-based layouts for maximum email client compatibility
 */

// ── Environment ──────────────────────────────────────────────────────────────
const SMTP_HOSTNAME = Deno.env.get('SMTP_HOSTNAME')
const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '465')
const SMTP_USERNAME = Deno.env.get('SMTP_USERNAME')
const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD')
const SMTP_FROM = Deno.env.get('SMTP_FROM') || 'BuyASpot <noreply@buyaspot.in>'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

// ── Helpers ──────────────────────────────────────────────────────────────────

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(date)
}

// ── Email Sending ────────────────────────────────────────────────────────────

/**
 * Send via Resend API (primary — handles MIME encoding correctly)
 */
async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  replyTo?: string
): Promise<boolean> {
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
        reply_to: replyTo || 'support@buyaspot.in',
        subject,
        html,
      }),
    })

    if (!res.ok) {
      const error = await res.json()
      if (res.status === 403 && error.message?.includes('testing')) {
        console.log('⚠️ Resend test mode: email delivered to verified address only')
        return true
      }
      console.error('Resend API error:', error)
      return false
    }

    console.log(`✅ Email sent via Resend to: ${to}`)
    return true
  } catch (err) {
    console.error('Resend send failed:', err)
    return false
  }
}

/**
 * Encode a string to Base64 for SMTP transmission.
 * Base64 avoids ALL quoted-printable encoding issues.
 */
function toBase64(str: string): string {
  return btoa(
    new TextEncoder()
      .encode(str)
      .reduce((data, byte) => data + String.fromCharCode(byte), '')
  )
}

/**
 * Encode a UTF-8 subject line per RFC 2047 so emojis/special chars work.
 */
function encodeSubject(subject: string): string {
  // Check if subject contains non-ASCII characters
  if (/^[\x20-\x7E]*$/.test(subject)) return subject
  return `=?UTF-8?B?${toBase64(subject)}?=`
}

/**
 * Send via raw SMTP over TLS (fallback).
 * We manually construct the MIME message to avoid library encoding bugs.
 */
async function sendViaSmtp(
  to: string,
  subject: string,
  html: string,
  replyTo?: string
): Promise<boolean> {
  if (!SMTP_HOSTNAME || !SMTP_USERNAME || !SMTP_PASSWORD) return false

  try {
    // Connect via TLS
    const conn = await Deno.connectTls({
      hostname: SMTP_HOSTNAME,
      port: SMTP_PORT,
    })

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    // Helper to read server response
    async function readResponse(): Promise<string> {
      const buf = new Uint8Array(4096)
      const n = await conn.read(buf)
      return n ? decoder.decode(buf.subarray(0, n)) : ''
    }

    // Helper to send a command and read response
    async function sendCmd(cmd: string): Promise<string> {
      await conn.write(encoder.encode(cmd + '\r\n'))
      return await readResponse()
    }

    // SMTP conversation
    await readResponse() // 220 greeting
    await sendCmd(`EHLO buyaspot.in`)

    // AUTH LOGIN
    await sendCmd('AUTH LOGIN')
    await sendCmd(btoa(SMTP_USERNAME))
    await sendCmd(btoa(SMTP_PASSWORD))

    // Extract email from "Name <email>" format
    const fromEmail = SMTP_FROM.match(/<(.+?)>/)?.[1] || SMTP_FROM
    await sendCmd(`MAIL FROM:<${fromEmail}>`)
    await sendCmd(`RCPT TO:<${to}>`)
    await sendCmd('DATA')

    // Build RFC 2822 compliant email with Base64 encoding (avoids QP issues)
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const htmlBase64 = toBase64(html)
    // Split base64 into 76-char lines per RFC 2045
    const htmlBase64Lines = htmlBase64.match(/.{1,76}/g)?.join('\r\n') || htmlBase64

    const message = [
      `From: ${SMTP_FROM}`,
      `To: ${to}`,
      `Subject: ${encodeSubject(subject)}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      replyTo ? `Reply-To: ${replyTo}` : '',
      `Date: ${new Date().toUTCString()}`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="utf-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      toBase64('View this email in an HTML-capable email client.'),
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset="utf-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      htmlBase64Lines,
      ``,
      `--${boundary}--`,
    ].filter(Boolean).join('\r\n')

    await conn.write(encoder.encode(message + '\r\n.\r\n'))
    await readResponse() // 250 OK

    await sendCmd('QUIT')
    conn.close()

    console.log(`✅ Email sent via SMTP to: ${to}`)
    return true
  } catch (err) {
    console.error('SMTP send failed:', err)
    return false
  }
}

/**
 * Send an email. Tries Resend API first (reliable), falls back to raw SMTP.
 * Returns true if at least one method succeeded.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  replyTo?: string
): Promise<boolean> {
  if (!to) {
    console.warn('⚠️ No recipient email provided, skipping')
    return false
  }

  // Strategy 1: SMTP (primary — unlimited, no daily cap)
  const smtpSent = await sendViaSmtp(to, subject, html, replyTo)
  if (smtpSent) return true

  // Strategy 2: Resend API (fallback — 100/day free tier limit)
  const resendSent = await sendViaResend(to, subject, html, replyTo)
  if (resendSent) return true

  console.warn(
    `⚠️ No email service succeeded. Set SMTP_* or RESEND_API_KEY secrets.\n   Skipped email for: ${to}`
  )
  return false
}

// ── Shared Layout Components (inline styles, table-based) ────────────────────
// Gmail strips <style> blocks, so every style MUST be inline.

function emailWrapper(headerBg: string, headerText: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="color-scheme" content="light dark"/>
  <meta name="supported-color-schemes" content="light dark"/>
  <title>${escapeHtml(headerText)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:${headerBg};padding:32px 24px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:28px;font-weight:800;color:#ffffff;text-align:center;line-height:1.3;">
                    ${headerText}
                  </td>
                </tr>
                <tr>
                  <td style="font-size:13px;color:rgba(255,255,255,0.85);text-align:center;padding-top:8px;">
                    buyaspot.in
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 32px;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;text-align:center;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;">BuyASpot — The Modern Million Dollar Homepage</p>
              <p style="margin:0;font-size:12px;color:#9ca3af;">Reply to this email if you need help.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function receiptRow(label: string, value: string, isBold = false): string {
  const weight = isBold ? 'font-weight:700;font-size:16px;' : 'font-size:14px;'
  const topBorder = isBold
    ? 'border-top:1px solid #e5e7eb;padding-top:14px;margin-top:14px;'
    : ''
  return `
    <tr>
      <td style="padding:8px 0;${topBorder}${weight}color:#6b7280;">${label}</td>
      <td style="padding:8px 0;${topBorder}${weight}color:#111827;text-align:right;">${value}</td>
    </tr>`
}

function receiptTable(rows: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;padding:20px;border-radius:10px;background-color:#f9fafb;border:1px solid #e5e7eb;">
    ${rows}
  </table>`
}

function ctaButton(href: string, text: string, bg = '#10b981'): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
    <tr>
      <td align="center">
        <a href="${href}" target="_blank" style="display:inline-block;padding:14px 32px;background-color:${bg};color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">${text}</a>
      </td>
    </tr>
  </table>`
}

// ── Template: Contact Form (sent to admin) ───────────────────────────────────

export interface ContactFormEmailData {
  name: string
  email: string
  subject: string
  message: string
  category?: string
  ticketId?: string
  fileUrl?: string
  ip: string
  userAgent: string
}

export function buildContactFormEmail(data: ContactFormEmailData): string {
  const safeName = escapeHtml(data.name)
  const safeEmail = escapeHtml(data.email)
  const safeSubject = escapeHtml(data.subject)
  const safeMessage = escapeHtml(data.message)
  const safeCategory = data.category ? escapeHtml(data.category) : null
  const safeTicketId = data.ticketId ? escapeHtml(data.ticketId) : null
  const safeFileUrl = data.fileUrl ? escapeHtml(data.fileUrl) : null

  const ticketBadge = safeTicketId
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td align="center"><span style="display:inline-block;background-color:#10b981;color:#fff;padding:8px 20px;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:1px;font-family:monospace;">Ticket: ${safeTicketId}</span></td></tr></table>`
    : ''

  const body = `
    ${ticketBadge}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <!-- From -->
      <tr>
        <td style="padding-bottom:20px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">From</p>
          <p style="margin:0;font-size:15px;color:#111827;">${safeName}</p>
        </td>
      </tr>
      <!-- Email -->
      <tr>
        <td style="padding-bottom:20px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Email Address</p>
          <p style="margin:0;font-size:15px;"><a href="mailto:${safeEmail}" style="color:#667eea;text-decoration:none;">${safeEmail}</a></p>
        </td>
      </tr>
      ${safeCategory ? `
      <!-- Category -->
      <tr>
        <td style="padding-bottom:20px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Category</p>
          <p style="margin:0;font-size:15px;color:#111827;">${safeCategory}</p>
        </td>
      </tr>` : ''}
      <!-- Subject -->
      <tr>
        <td style="padding-bottom:20px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Subject</p>
          <p style="margin:0;font-size:15px;color:#111827;">${safeSubject}</p>
        </td>
      </tr>
      <!-- Message -->
      <tr>
        <td style="padding-bottom:20px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Message</p>
          <div style="background-color:#f9fafb;padding:16px 20px;border-radius:8px;border:1px solid #e5e7eb;white-space:pre-wrap;word-wrap:break-word;font-size:14px;line-height:1.6;color:#374151;">${safeMessage}</div>
        </td>
      </tr>
      ${safeFileUrl ? `
      <!-- Attachment -->
      <tr>
        <td style="padding-bottom:20px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">📎 Attachment</p>
          <p style="margin:0;font-size:14px;"><a href="${safeFileUrl}" style="color:#667eea;text-decoration:none;" target="_blank">View Attached File</a></p>
        </td>
      </tr>` : ''}
      <!-- Metadata -->
      <tr>
        <td style="padding:16px;background-color:#f3f4f6;border-radius:8px;font-size:12px;color:#6b7280;">
          <strong style="color:#374151;">📊 Request Metadata</strong><br/>
          ${safeTicketId ? `<span style="display:inline-block;padding-top:8px;">Ticket ID: <strong>${safeTicketId}</strong></span><br/>` : ''}
          <span style="display:inline-block;${safeTicketId ? '' : 'padding-top:8px;'}">IP Address: ${escapeHtml(data.ip)}</span><br/>
          <span>User Agent: ${escapeHtml(data.userAgent)}</span><br/>
          <span>Submitted: ${formatDate()} IST</span>
        </td>
      </tr>
    </table>
    ${ctaButton(`mailto:${safeEmail}?subject=Re: ${encodeURIComponent(data.subject)}`, `Reply to ${safeName}`, '#667eea')}`

  return emailWrapper(
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    safeTicketId ? `📬 Support Request ${safeTicketId}` : '📬 New Contact Form Submission',
    body
  )
}

// ── Template: Purchase Confirmation (sent to buyer) ──────────────────────────

export interface PurchaseConfirmationData {
  pixelName: string
  pixelCount: number
  totalCost: number
  linkUrl?: string
  isTestMode?: boolean
  transactionId?: string
}

export function buildPurchaseConfirmationEmail(data: PurchaseConfirmationData): string {
  const safePixelName = escapeHtml(data.pixelName)
  const safeLinkUrl = data.linkUrl ? escapeHtml(data.linkUrl) : null

  const testBadge = data.isTestMode
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;"><tr><td align="center"><span style="display:inline-block;background-color:#f59e0b;color:#000;padding:6px 16px;border-radius:6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">⚠️ Test Mode Purchase</span></td></tr></table>`
    : ''

  const body = `
    ${testBadge}
    <h1 style="margin:0 0 12px;font-size:24px;color:#111827;text-align:center;">Payment Successful 🎉</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#4b5563;text-align:center;line-height:1.6;">
      You now officially own a piece of the Million Dollar Canvas.<br/>Your pixels are secured forever.
    </p>
    ${receiptTable(`
      ${receiptRow('Pixel Name', safePixelName)}
      ${receiptRow('Quantity', `${data.pixelCount} pixels`)}
      ${receiptRow('Date', formatDate())}
      ${data.transactionId ? receiptRow('Transaction ID', `<span style="font-family:monospace;font-size:12px;">${escapeHtml(data.transactionId.substring(0, 12))}...</span>`) : ''}
      ${safeLinkUrl ? receiptRow('Link', `<a href="${safeLinkUrl}" style="color:#10b981;text-decoration:none;">${safeLinkUrl}</a>`) : ''}
      ${receiptRow('Total Paid', formatINR(data.totalCost), true)}
    `)}
    ${ctaButton('https://buyaspot.in/profile', 'View Your Pixels')}`

  return emailWrapper(
    'linear-gradient(135deg, #10b981, #059669)',
    'BuyASpot',
    body
  )
}

// ── Template: Marketplace Buyer Confirmation ─────────────────────────────────

export interface MarketplaceBuyerData {
  salePrice: number
  pixelCoords: { x: number; y: number } | null
  transactionId: string
}

export function buildMarketplaceBuyerEmail(data: MarketplaceBuyerData): string {
  const coordsText = data.pixelCoords
    ? `(${data.pixelCoords.x}, ${data.pixelCoords.y})`
    : 'Unknown'

  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;color:#111827;text-align:center;">Marketplace Purchase Complete 🛒</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#4b5563;text-align:center;line-height:1.6;">
      Congratulations! You've acquired a pixel from the marketplace.
    </p>
    ${receiptTable(`
      ${receiptRow('Pixel Location', coordsText)}
      ${receiptRow('Transaction ID', `<span style="font-family:monospace;font-size:12px;">${escapeHtml(data.transactionId.substring(0, 8))}...</span>`)}
      ${receiptRow('Total Paid', formatINR(data.salePrice), true)}
    `)}
    ${ctaButton('https://buyaspot.in/profile', 'View Your Pixels', '#6366f1')}`

  return emailWrapper(
    'linear-gradient(135deg, #6366f1, #8b5cf6)',
    'BuyASpot',
    body
  )
}

// ── Template: Marketplace Seller Notification ────────────────────────────────

export interface MarketplaceSellerData {
  salePrice: number
  platformFee: number
  sellerNet: number
  pixelCoords: { x: number; y: number } | null
}

export function buildMarketplaceSellerEmail(data: MarketplaceSellerData): string {
  const coordsText = data.pixelCoords
    ? `(${data.pixelCoords.x}, ${data.pixelCoords.y})`
    : 'Unknown'

  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;color:#111827;text-align:center;">Your Pixel Sold! 💰</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#4b5563;text-align:center;line-height:1.6;">
      Great news! Someone just purchased your pixel from the marketplace.
    </p>
    ${receiptTable(`
      ${receiptRow('Pixel Location', coordsText)}
      ${receiptRow('Sale Price', formatINR(data.salePrice))}
      ${receiptRow('Platform Fee (5%)', `-${formatINR(data.platformFee)}`)}
      ${receiptRow('Your Earnings', `<span style="color:#10b981;font-weight:700;">${formatINR(data.sellerNet)}</span>`, true)}
    `)}
    ${ctaButton('https://buyaspot.in/marketplace', 'View Marketplace')}`

  return emailWrapper(
    'linear-gradient(135deg, #10b981, #059669)',
    'BuyASpot',
    body
  )
}

// ── Template: Payment Notification (webhook reconciliation) ──────────────────

export interface PaymentNotificationData {
  status: string
  paymentId: string
  amount: number // in paise
  reason: string
}

export function buildPaymentNotificationEmail(data: PaymentNotificationData): string {
  const statusBadge = data.status === 'resolved' ? '✅' : data.status === 'failed' ? '❌' : '⚠️'
  const amountINR = data.amount / 100

  const failedNote = data.status === 'failed'
    ? `<p style="margin:20px 0 0;font-size:14px;color:#dc2626;text-align:center;">If your payment was deducted but not reflected, please contact support immediately.</p>`
    : ''

  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;color:#111827;text-align:center;">${statusBadge} Payment Notification</h1>
    ${receiptTable(`
      ${receiptRow('Status', `<strong>${escapeHtml(data.status.toUpperCase())}</strong>`)}
      ${receiptRow('Payment ID', escapeHtml(data.paymentId))}
      ${receiptRow('Amount', `₹${amountINR.toFixed(2)}`)}
      ${receiptRow('Details', escapeHtml(data.reason))}
    `)}
    ${failedNote}
    ${ctaButton('https://buyaspot.in/profile', 'View Your Account')}`

  return emailWrapper(
    'linear-gradient(135deg, #10b981, #059669)',
    'BuyASpot',
    body
  )
}

// ── Template: Welcome Email (new user onboarding) ────────────────────────────

export interface WelcomeEmailData {
  fullName: string
}

export function buildWelcomeEmail(data: WelcomeEmailData): string {
  const safeName = escapeHtml(data.fullName)

  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;color:#111827;text-align:center;">Welcome to BuyASpot! 🎉</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#4b5563;text-align:center;line-height:1.6;">
      Hey ${safeName}, thanks for joining!<br/>You're now part of the modern Million Dollar Homepage.
    </p>

    <!-- Quick Start Cards -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
      <!-- Card 1 -->
      <tr>
        <td style="padding:12px 16px;background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;margin-bottom:12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="width:40px;vertical-align:top;font-size:24px;">🎨</td>
              <td style="vertical-align:top;">
                <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111827;">Browse the Canvas</p>
                <p style="margin:0;font-size:13px;color:#6b7280;">Explore the 100×100 pixel grid and find the perfect spot for your brand.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr><td style="height:12px;"></td></tr>
      <!-- Card 2 -->
      <tr>
        <td style="padding:12px 16px;background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="width:40px;vertical-align:top;font-size:24px;">💎</td>
              <td style="vertical-align:top;">
                <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111827;">Buy Your First Pixel</p>
                <p style="margin:0;font-size:13px;color:#6b7280;">Pixels start at just ₹99. Upload your logo, set your link, and own it forever.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr><td style="height:12px;"></td></tr>
      <!-- Card 3 -->
      <tr>
        <td style="padding:12px 16px;background-color:#fdf4ff;border:1px solid #e9d5ff;border-radius:10px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="width:40px;vertical-align:top;font-size:24px;">🏪</td>
              <td style="vertical-align:top;">
                <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111827;">Marketplace</p>
                <p style="margin:0;font-size:13px;color:#6b7280;">Buy and sell pixels with other users. Trade your digital real estate!</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px;font-size:14px;color:#6b7280;text-align:center;">
      Need help? Check out our <a href="https://buyaspot.in/help" style="color:#667eea;text-decoration:none;font-weight:600;">Help Center</a> or just reply to this email.
    </p>
    ${ctaButton('https://buyaspot.in/canvas', 'Explore the Canvas', '#667eea')}`

  return emailWrapper(
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'BuyASpot',
    body
  )
}
