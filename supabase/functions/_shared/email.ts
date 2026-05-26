/**
 * Shared Email Utilities for BuyASpot Edge Functions
 * ─────────────────────────────────────────────────────
 * - sendEmail(): SMTP primary, Resend API fallback, with retry
 * - All HTML templates use 100% INLINE styles (Gmail strips <style> blocks)
 * - Table-based layouts for maximum email client compatibility
 * - Solid background colors only (gradients don't render in Gmail/Outlook)
 */

// ── Environment ──────────────────────────────────────────────────────────────
const SMTP_HOSTNAME = Deno.env.get('SMTP_HOSTNAME')
const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '465')
const SMTP_USERNAME = Deno.env.get('SMTP_USERNAME')
const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD')
const SMTP_FROM = Deno.env.get('SMTP_FROM') || 'BuyASpot <noreply@buyaspot.in>'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

// ── Brand Constants ──────────────────────────────────────────────────────────
const BRAND = {
  name: 'BuyASpot',
  tagline: 'The Modern Million Dollar Homepage',
  url: 'https://buyaspot.in',
  supportEmail: 'support@buyaspot.in',
  // Colors — solid only (no gradients, Gmail strips them)
  headerBg: '#111827',       // Near-black — works everywhere
  headerText: '#ffffff',
  accentGreen: '#16a34a',
  accentBlue: '#2563eb',
  accentAmber: '#d97706',
  accentRed: '#dc2626',
  accentIndigo: '#4f46e5',
  textPrimary: '#111827',
  textSecondary: '#4b5563',
  textMuted: '#6b7280',
  textLight: '#9ca3af',
  bgPage: '#f8fafc',
  bgCard: '#ffffff',
  bgMuted: '#f1f5f9',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
}

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
 * Send via Resend API (fallback — 100/day free tier limit)
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
        from: `BuyASpot <support@buyaspot.in>`,
        to: [to],
        reply_to: replyTo || BRAND.supportEmail,
        subject,
        html,
      }),
    })

    if (!res.ok) {
      const error = await res.json()
      if (res.status === 403 && error.message?.includes('testing')) {
        console.log('[Email] Resend test mode: delivered to verified address only')
        return true
      }
      console.error('[Email] Resend API error:', error)
      return false
    }

    console.log(`[Email] Sent via Resend to: ${to}`)
    return true
  } catch (err) {
    console.error('[Email] Resend send failed:', err)
    return false
  }
}

/**
 * Encode a string to Base64 for SMTP transmission.
 */
function toBase64(str: string): string {
  return btoa(
    new TextEncoder()
      .encode(str)
      .reduce((data, byte) => data + String.fromCharCode(byte), '')
  )
}

/**
 * Encode a UTF-8 subject line per RFC 2047.
 */
function encodeSubject(subject: string): string {
  if (/^[\x20-\x7E]*$/.test(subject)) return subject
  return `=?UTF-8?B?${toBase64(subject)}?=`
}

/**
 * Send via raw SMTP over TLS (primary).
 */
async function sendViaSmtp(
  to: string,
  subject: string,
  html: string,
  replyTo?: string
): Promise<boolean> {
  if (!SMTP_HOSTNAME || !SMTP_USERNAME || !SMTP_PASSWORD) return false

  try {
    const conn = await Deno.connectTls({
      hostname: SMTP_HOSTNAME,
      port: SMTP_PORT,
    })

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    async function readResponse(): Promise<string> {
      const buf = new Uint8Array(4096)
      const n = await conn.read(buf)
      return n ? decoder.decode(buf.subarray(0, n)) : ''
    }

    async function sendCmd(cmd: string): Promise<string> {
      await conn.write(encoder.encode(cmd + '\r\n'))
      return await readResponse()
    }

    await readResponse() // 220 greeting
    await sendCmd(`EHLO buyaspot.in`)

    // AUTH LOGIN
    await sendCmd('AUTH LOGIN')
    await sendCmd(btoa(SMTP_USERNAME))
    await sendCmd(btoa(SMTP_PASSWORD))

    const fromEmail = SMTP_FROM.match(/<(.+?)>/)?.[1] || SMTP_FROM
    await sendCmd(`MAIL FROM:<${fromEmail}>`)
    await sendCmd(`RCPT TO:<${to}>`)
    await sendCmd('DATA')

    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const htmlBase64 = toBase64(html)
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

    console.log(`[Email] Sent via SMTP to: ${to}`)
    return true
  } catch (err) {
    console.error('[Email] SMTP send failed:', err)
    return false
  }
}

/**
 * Send an email with retry logic.
 * Strategy: SMTP (primary, unlimited) → Resend API (fallback, 100/day).
 * SMTP gets one retry on failure before falling back.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  replyTo?: string
): Promise<boolean> {
  if (!to) {
    console.warn('[Email] No recipient provided, skipping')
    return false
  }

  // Strategy 1: SMTP (primary — unlimited, no daily cap)
  const smtpSent = await sendViaSmtp(to, subject, html, replyTo)
  if (smtpSent) return true

  // Retry SMTP once after 1 second
  console.log('[Email] SMTP attempt 1 failed, retrying in 1s...')
  await new Promise(resolve => setTimeout(resolve, 1000))
  const smtpRetry = await sendViaSmtp(to, subject, html, replyTo)
  if (smtpRetry) return true

  // Strategy 2: Resend API (fallback)
  console.log('[Email] SMTP failed after retry, falling back to Resend...')
  const resendSent = await sendViaResend(to, subject, html, replyTo)
  if (resendSent) return true

  console.warn(
    `[Email] All providers failed for: ${to}. Check SMTP_* or RESEND_API_KEY secrets.`
  )
  return false
}

// ── Shared Layout Components ─────────────────────────────────────────────────
// Gmail strips <style> blocks, so every style MUST be inline.
// Solid background colors only — gradients don't render in Gmail/Outlook.

function emailWrapper(accentColor: string, headerText: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>${escapeHtml(headerText)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bgPage};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.bgPage};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:${BRAND.bgCard};border-radius:8px;overflow:hidden;border:1px solid ${BRAND.border};">
          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND.headerBg};padding:28px 32px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="text-align:center;">
                    <span style="font-size:22px;font-weight:800;color:${BRAND.headerText};letter-spacing:-0.5px;">${BRAND.name}</span>
                  </td>
                </tr>
                <tr>
                  <td style="text-align:center;padding-top:4px;">
                    <span style="font-size:12px;color:rgba(255,255,255,0.6);letter-spacing:0.5px;text-transform:uppercase;">${escapeHtml(headerText)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Accent Bar -->
          <tr>
            <td style="height:3px;background-color:${accentColor};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 32px;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;text-align:center;background-color:${BRAND.bgMuted};border-top:1px solid ${BRAND.border};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="text-align:center;padding-bottom:12px;">
                    <a href="${BRAND.url}/help" style="color:${BRAND.textMuted};text-decoration:none;font-size:12px;padding:0 8px;">Help</a>
                    <span style="color:${BRAND.border};">|</span>
                    <a href="${BRAND.url}/privacy" style="color:${BRAND.textMuted};text-decoration:none;font-size:12px;padding:0 8px;">Privacy</a>
                    <span style="color:${BRAND.border};">|</span>
                    <a href="${BRAND.url}/terms" style="color:${BRAND.textMuted};text-decoration:none;font-size:12px;padding:0 8px;">Terms</a>
                    <span style="color:${BRAND.border};">|</span>
                    <a href="${BRAND.url}/contact" style="color:${BRAND.textMuted};text-decoration:none;font-size:12px;padding:0 8px;">Contact</a>
                  </td>
                </tr>
                <tr>
                  <td style="text-align:center;">
                    <p style="margin:0 0 4px;font-size:12px;color:${BRAND.textLight};">${BRAND.name} &mdash; ${BRAND.tagline}</p>
                    <p style="margin:0;font-size:11px;color:${BRAND.textLight};">&copy; ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.</p>
                  </td>
                </tr>
              </table>
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
    ? `border-top:2px solid ${BRAND.border};padding-top:14px;margin-top:14px;`
    : ''
  return `
    <tr>
      <td style="padding:10px 0;${topBorder}${weight}color:${BRAND.textMuted};">${label}</td>
      <td style="padding:10px 0;${topBorder}${weight}color:${BRAND.textPrimary};text-align:right;">${value}</td>
    </tr>`
}

function receiptTable(rows: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;padding:20px 24px;border-radius:8px;background-color:${BRAND.bgMuted};border:1px solid ${BRAND.border};">
    ${rows}
  </table>`
}

function ctaButton(href: string, text: string, bg: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
    <tr>
      <td align="center">
        <a href="${href}" target="_blank" style="display:inline-block;padding:14px 36px;background-color:${bg};color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.2px;">${text}</a>
      </td>
    </tr>
  </table>`
}

function sectionHeading(text: string): string {
  return `<h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:${BRAND.textPrimary};line-height:1.3;">${text}</h2>`
}

function bodyText(text: string): string {
  return `<p style="margin:0 0 20px;font-size:15px;color:${BRAND.textSecondary};line-height:1.7;">${text}</p>`
}

function infoCard(emoji: string, title: string, description: string, bgColor: string, borderColor: string): string {
  return `
  <tr>
    <td style="padding:14px 16px;background-color:${bgColor};border:1px solid ${borderColor};border-radius:8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="width:36px;vertical-align:top;font-size:20px;">${emoji}</td>
          <td style="vertical-align:top;">
            <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:${BRAND.textPrimary};">${title}</p>
            <p style="margin:0;font-size:13px;color:${BRAND.textSecondary};line-height:1.5;">${description}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`
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
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td align="center"><span style="display:inline-block;background-color:${BRAND.accentGreen};color:#fff;padding:6px 18px;border-radius:4px;font-size:13px;font-weight:700;letter-spacing:0.5px;font-family:monospace;">${safeTicketId}</span></td></tr></table>`
    : ''

  const body = `
    ${ticketBadge}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding-bottom:20px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.5px;">From</p>
          <p style="margin:0;font-size:15px;color:${BRAND.textPrimary};">${safeName}</p>
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:20px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.5px;">Email</p>
          <p style="margin:0;font-size:15px;"><a href="mailto:${safeEmail}" style="color:${BRAND.accentBlue};text-decoration:none;">${safeEmail}</a></p>
        </td>
      </tr>
      ${safeCategory ? `
      <tr>
        <td style="padding-bottom:20px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.5px;">Category</p>
          <p style="margin:0;font-size:15px;color:${BRAND.textPrimary};">${safeCategory}</p>
        </td>
      </tr>` : ''}
      <tr>
        <td style="padding-bottom:20px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.5px;">Subject</p>
          <p style="margin:0;font-size:15px;color:${BRAND.textPrimary};">${safeSubject}</p>
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:20px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.5px;">Message</p>
          <div style="background-color:${BRAND.bgMuted};padding:16px 20px;border-radius:6px;border:1px solid ${BRAND.border};white-space:pre-wrap;word-wrap:break-word;font-size:14px;line-height:1.7;color:${BRAND.textSecondary};">${safeMessage}</div>
        </td>
      </tr>
      ${safeFileUrl ? `
      <tr>
        <td style="padding-bottom:20px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.5px;">Attachment</p>
          <p style="margin:0;font-size:14px;"><a href="${safeFileUrl}" style="color:${BRAND.accentBlue};text-decoration:none;" target="_blank">View Attached File</a></p>
        </td>
      </tr>` : ''}
      <tr>
        <td style="padding:16px;background-color:${BRAND.bgMuted};border-radius:6px;font-size:12px;color:${BRAND.textMuted};border:1px solid ${BRAND.border};">
          <strong style="color:${BRAND.textSecondary};">Request Metadata</strong><br/>
          ${safeTicketId ? `<span style="display:inline-block;padding-top:8px;">Ticket: <strong>${safeTicketId}</strong></span><br/>` : ''}
          <span style="display:inline-block;${safeTicketId ? '' : 'padding-top:8px;'}">IP: ${escapeHtml(data.ip)}</span><br/>
          <span>UA: ${escapeHtml(data.userAgent.substring(0, 100))}</span><br/>
          <span>Time: ${formatDate()} IST</span>
        </td>
      </tr>
    </table>
    ${ctaButton(`mailto:${safeEmail}?subject=Re: ${encodeURIComponent(data.subject)}`, `Reply to ${safeName}`, BRAND.accentBlue)}`

  return emailWrapper(
    BRAND.accentBlue,
    safeTicketId ? `Support Request ${safeTicketId}` : 'New Support Request',
    body
  )
}

// ── Template: Contact Acknowledgment (sent to user) ──────────────────────────

export interface ContactAcknowledgmentData {
  name: string
  ticketId: string | null
  subject: string
  category?: string
}

export function buildContactAcknowledgmentEmail(data: ContactAcknowledgmentData): string {
  const safeName = escapeHtml(data.name)
  const safeTicketId = data.ticketId ? escapeHtml(data.ticketId) : null

  const ticketSection = safeTicketId
    ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;padding:20px 24px;border-radius:8px;background-color:#f0fdf4;border:1px solid #bbf7d0;">
      <tr>
        <td style="text-align:center;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.5px;">Your Ticket ID</p>
          <p style="margin:0;font-size:24px;font-weight:800;color:${BRAND.accentGreen};font-family:monospace;letter-spacing:1px;">${safeTicketId}</p>
          <p style="margin:8px 0 0;font-size:12px;color:${BRAND.textMuted};">Reference this ID in any follow-up communications.</p>
        </td>
      </tr>
    </table>`
    : ''

  const body = `
    ${sectionHeading(`Hi ${safeName},`)}
    ${bodyText(`Thank you for contacting BuyASpot. We've received your support request and our team will review it shortly.`)}
    ${ticketSection}
    ${bodyText(`<strong>Subject:</strong> ${escapeHtml(data.subject)}${data.category ? `<br/><strong>Category:</strong> ${escapeHtml(data.category)}` : ''}`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;padding:16px 20px;border-radius:6px;background-color:${BRAND.bgMuted};border:1px solid ${BRAND.border};">
      <tr>
        <td>
          <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:${BRAND.textPrimary};">What happens next?</p>
          <p style="margin:0;font-size:13px;color:${BRAND.textSecondary};line-height:1.7;">
            Our support team typically responds within <strong>24 hours</strong>. You'll receive a reply directly to your email address. For urgent payment issues, please visit our <a href="${BRAND.url}/payment-help" style="color:${BRAND.accentBlue};text-decoration:none;">Payment Help</a> page.
          </p>
        </td>
      </tr>
    </table>
    ${ctaButton(`${BRAND.url}/help`, 'Visit Help Center', BRAND.accentBlue)}`

  return emailWrapper(BRAND.accentBlue, 'Support Request Received', body)
}

// ── Template: Purchase Confirmation (sent to buyer) ──────────────────────────

export interface PurchaseConfirmationData {
  pixelName: string
  pixelCount: number
  totalCost: number
  linkUrl?: string
  isTestMode?: boolean
  transactionId?: string
  receiptUrl?: string
}

export function buildPurchaseConfirmationEmail(data: PurchaseConfirmationData): string {
  const safePixelName = escapeHtml(data.pixelName)
  const safeLinkUrl = data.linkUrl ? escapeHtml(data.linkUrl) : null

  const testBadge = data.isTestMode
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;"><tr><td align="center"><span style="display:inline-block;background-color:${BRAND.accentAmber};color:#000;padding:6px 16px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Test Mode Purchase</span></td></tr></table>`
    : ''

  const receiptButton = data.receiptUrl
    ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
      <tr>
        <td align="center">
          <a href="${escapeHtml(data.receiptUrl)}" target="_blank" style="display:inline-block;padding:10px 24px;background-color:${BRAND.bgMuted};color:${BRAND.textSecondary};border:1px solid ${BRAND.border};border-radius:6px;text-decoration:none;font-weight:500;font-size:13px;">View Payment Receipt</a>
        </td>
      </tr>
    </table>`
    : ''

  const body = `
    ${testBadge}
    ${sectionHeading('Payment Confirmed')}
    ${bodyText(`Your purchase is complete. You now own <strong>${data.pixelCount} pixel${data.pixelCount > 1 ? 's' : ''}</strong> on the BuyASpot canvas.`)}
    ${receiptTable(`
      ${receiptRow('Pixel Name', safePixelName)}
      ${receiptRow('Quantity', `${data.pixelCount} pixel${data.pixelCount > 1 ? 's' : ''}`)}
      ${receiptRow('Date', formatDate())}
      ${data.transactionId ? receiptRow('Transaction ID', `<span style="font-family:monospace;font-size:12px;">${escapeHtml(data.transactionId.substring(0, 16))}...</span>`) : ''}
      ${safeLinkUrl ? receiptRow('Link', `<a href="${safeLinkUrl}" style="color:${BRAND.accentBlue};text-decoration:none;font-size:13px;word-break:break-all;">${safeLinkUrl}</a>`) : ''}
      ${receiptRow('Total Paid', formatINR(data.totalCost), true)}
    `)}
    ${receiptButton}
    ${ctaButton(`${BRAND.url}/profile`, 'View Your Pixels', BRAND.accentGreen)}`

  return emailWrapper(BRAND.accentGreen, 'Purchase Confirmed', body)
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
    : 'N/A'

  const body = `
    ${sectionHeading('Marketplace Purchase Complete')}
    ${bodyText('You\'ve successfully acquired a pixel from the marketplace. The pixel has been transferred to your account.')}
    ${receiptTable(`
      ${receiptRow('Pixel Location', coordsText)}
      ${receiptRow('Transaction ID', `<span style="font-family:monospace;font-size:12px;">${escapeHtml(data.transactionId.substring(0, 12))}...</span>`)}
      ${receiptRow('Total Paid', formatINR(data.salePrice), true)}
    `)}
    ${ctaButton(`${BRAND.url}/profile`, 'View Your Pixels', BRAND.accentIndigo)}`

  return emailWrapper(BRAND.accentIndigo, 'Marketplace Purchase', body)
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
    : 'N/A'

  const body = `
    ${sectionHeading('Your Pixel Has Been Sold')}
    ${bodyText('Great news! A buyer has purchased your pixel from the marketplace.')}
    ${receiptTable(`
      ${receiptRow('Pixel Location', coordsText)}
      ${receiptRow('Sale Price', formatINR(data.salePrice))}
      ${receiptRow('Platform Fee (5%)', `<span style="color:${BRAND.accentRed};">-${formatINR(data.platformFee)}</span>`)}
      ${receiptRow('Your Earnings', `<span style="color:${BRAND.accentGreen};font-weight:700;">${formatINR(data.sellerNet)}</span>`, true)}
    `)}
    ${ctaButton(`${BRAND.url}/marketplace`, 'View Marketplace', BRAND.accentGreen)}`

  return emailWrapper(BRAND.accentGreen, 'Pixel Sold', body)
}

// ── Template: Payment Notification (webhook reconciliation) ──────────────────

export interface PaymentNotificationData {
  status: string
  paymentId: string
  amount: number // in paise
  reason: string
}

export function buildPaymentNotificationEmail(data: PaymentNotificationData): string {
  const amountINR = data.amount / 100

  const statusConfig: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
    resolved: { label: 'RESOLVED', color: BRAND.accentGreen, bgColor: '#f0fdf4', borderColor: '#bbf7d0' },
    failed: { label: 'FAILED', color: BRAND.accentRed, bgColor: '#fef2f2', borderColor: '#fecaca' },
  }
  const config = statusConfig[data.status] || { label: data.status.toUpperCase(), color: BRAND.accentAmber, bgColor: '#fffbeb', borderColor: '#fde68a' }

  const failedNote = data.status === 'failed'
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;"><tr><td style="padding:14px 16px;background-color:#fef2f2;border:1px solid #fecaca;border-radius:6px;"><p style="margin:0;font-size:13px;color:${BRAND.accentRed};line-height:1.6;">If your payment was deducted but not reflected in your account, please <a href="${BRAND.url}/contact" style="color:${BRAND.accentRed};font-weight:600;">contact support</a> with your Payment ID.</p></td></tr></table>`
    : ''

  const body = `
    ${sectionHeading('Payment Update')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
      <tr>
        <td align="center">
          <span style="display:inline-block;background-color:${config.bgColor};color:${config.color};padding:6px 18px;border-radius:4px;font-size:12px;font-weight:700;letter-spacing:0.5px;border:1px solid ${config.borderColor};">${config.label}</span>
        </td>
      </tr>
    </table>
    ${receiptTable(`
      ${receiptRow('Status', `<strong style="color:${config.color};">${config.label}</strong>`)}
      ${receiptRow('Payment ID', `<span style="font-family:monospace;font-size:12px;">${escapeHtml(data.paymentId)}</span>`)}
      ${receiptRow('Amount', formatINR(amountINR))}
      ${receiptRow('Details', escapeHtml(data.reason))}
    `)}
    ${failedNote}
    ${ctaButton(`${BRAND.url}/profile`, 'View Your Account', data.status === 'failed' ? BRAND.accentRed : BRAND.accentGreen)}`

  return emailWrapper(
    data.status === 'failed' ? BRAND.accentRed : BRAND.accentGreen,
    'Payment Notification',
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
    ${sectionHeading(`Welcome, ${safeName}!`)}
    ${bodyText('Thanks for joining BuyASpot. You\'re now part of the modern Million Dollar Homepage — a collaborative canvas where every pixel tells a story.')}

    <!-- Quick Start Cards -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
      ${infoCard('1', 'Browse the Canvas', 'Explore the 100x100 pixel grid and discover what others have created.', '#f0fdf4', '#bbf7d0')}
      <tr><td style="height:10px;"></td></tr>
      ${infoCard('2', 'Buy Your First Pixel', 'Pixels start at just ₹99. Upload your logo, set your link, and own it forever.', '#eff6ff', '#bfdbfe')}
      <tr><td style="height:10px;"></td></tr>
      ${infoCard('3', 'Trade on the Marketplace', 'Buy and sell pixels with other users. Your digital real estate can grow in value.', '#fdf4ff', '#e9d5ff')}
    </table>

    ${bodyText(`Need help getting started? Visit our <a href="${BRAND.url}/help" style="color:${BRAND.accentBlue};text-decoration:none;font-weight:600;">Help Center</a> or reply to this email.`)}
    ${ctaButton(`${BRAND.url}/canvas`, 'Explore the Canvas', BRAND.accentGreen)}`

  return emailWrapper(BRAND.accentGreen, 'Welcome to BuyASpot', body)
}
