import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://buyapixel.onrender.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Magic bytes for image format validation
const MAGIC_BYTES = {
  jpeg: [0xFF, 0xD8, 0xFF],
  png: [0x89, 0x50, 0x4E, 0x47],
  gif: [0x47, 0x49, 0x46],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF header
  svg: [0x3C, 0x73, 0x76, 0x67], // <svg
}

interface ImageValidationRequest {
  file_base64: string
  mime_type: string
  file_name: string
}

function validateMagicBytes(data: Uint8Array, mimeType: string): boolean {
  const magicCheck = (bytes: number[]) =>
    bytes.every((byte, i) => data[i] === byte)

  switch (mimeType) {
    case 'image/jpeg':
      return magicCheck(MAGIC_BYTES.jpeg)
    case 'image/png':
      return magicCheck(MAGIC_BYTES.png)
    case 'image/gif':
      return magicCheck(MAGIC_BYTES.gif)
    case 'image/webp':
      // WEBP files have RIFF header followed by WEBP
      return (
        magicCheck(MAGIC_BYTES.webp) &&
        data[8] === 0x57 &&
        data[9] === 0x45 &&
        data[10] === 0x42 &&
        data[11] === 0x50
      )
    case 'image/svg+xml':
      // SVG is text-based — magic bytes N/A. Security is handled
      // separately by hasSuspiciousSVGContent() below.
      return magicCheck(MAGIC_BYTES.svg) ||
        new TextDecoder().decode(data.slice(0, 100)).trimStart().startsWith('<')
    default:
      return false
  }
}

function hasSuspiciousSVGContent(textContent: string): boolean {
  // Check for common XSS vectors in SVG
  const suspiciousPatterns = [
    /<script/i,
    /on\w+\s*=/i, // Event handlers (onclick, onerror, etc.)
    /javascript:/i,
    /<embed/i,
    /<object/i,
    /<iframe/i,
    /data:text\/html/i,
  ]

  return suspiciousPatterns.some(pattern => pattern.test(textContent))
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
    const body: ImageValidationRequest = await req.json()

    if (!body.file_base64 || !body.mime_type || !body.file_name) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'Missing required fields: file_base64, mime_type, file_name',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Decode base64 to bytes
    const binaryString = atob(body.file_base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // Check magic bytes to validate actual file type
    const isValidMagicBytes = validateMagicBytes(bytes, body.mime_type)
    if (!isValidMagicBytes) {
      console.warn(
        `⚠️ Magic bytes validation failed: expected ${body.mime_type}, file: ${body.file_name}`
      )
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'File content does not match declared MIME type (possible malicious file)',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Additional SVG validation (scan for XSS)
    if (body.mime_type === 'image/svg+xml') {
      const textContent = new TextDecoder().decode(bytes)

      if (hasSuspiciousSVGContent(textContent)) {
        console.warn(`⚠️ Suspicious SVG content detected: ${body.file_name}`)
        return new Response(
          JSON.stringify({
            valid: false,
            error: 'SVG file contains potentially malicious content (script tags or event handlers)',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
    }

    // All validations passed
    return new Response(
      JSON.stringify({
        valid: true,
        message: 'Image validation passed',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    console.error('Image validation error:', err)
    return new Response(
      JSON.stringify({
        valid: false,
        error: err instanceof Error ? err.message : 'Unknown validation error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
