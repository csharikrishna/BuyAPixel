/**
 * Analytics tracking utilities for BuyASpot.
 * Handles client-side UA parsing, session ID generation,
 * and fire-and-forget event logging.
 */

import { supabase } from '@/integrations/supabase/client';

// =============================================================
// SESSION ID (persistent per browser session)
// =============================================================

const SESSION_KEY = 'buyaspot_session_id';

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function getSessionId(): string {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = generateSessionId();
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

// =============================================================
// USER AGENT PARSING (lightweight, no dependency)
// =============================================================

export interface ParsedUA {
  device_type: 'Mobile' | 'Tablet' | 'Desktop';
  browser: string;
  os: string;
}

export function parseUserAgent(ua?: string): ParsedUA {
  const raw = ua || navigator.userAgent;

  // --- Device Type ---
  let device_type: ParsedUA['device_type'] = 'Desktop';
  if (/iPad|Android(?!.*Mobile)|tablet/i.test(raw)) {
    device_type = 'Tablet';
  } else if (/Mobile|iPhone|iPod|Android.*Mobile|webOS|BlackBerry|Opera Mini|IEMobile/i.test(raw)) {
    device_type = 'Mobile';
  }

  // --- Browser ---
  let browser = 'Other';
  if (/Edg\//i.test(raw)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(raw)) browser = 'Opera';
  else if (/Chrome\/.*Safari/i.test(raw) && !/Edg|OPR/i.test(raw)) browser = 'Chrome';
  else if (/Safari\//i.test(raw) && !/Chrome/i.test(raw)) browser = 'Safari';
  else if (/Firefox\//i.test(raw)) browser = 'Firefox';

  // --- OS ---
  let os = 'Other';
  if (/Windows/i.test(raw)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(raw) && !/iPhone|iPad/i.test(raw)) os = 'macOS';
  else if (/iPhone|iPad|iPod/i.test(raw)) os = 'iOS';
  else if (/Android/i.test(raw)) os = 'Android';
  else if (/Linux/i.test(raw)) os = 'Linux';
  else if (/CrOS/i.test(raw)) os = 'ChromeOS';

  return { device_type, browser, os };
}

// =============================================================
// PIXEL VIEW TRACKING
// =============================================================

// Debounce to avoid logging duplicate views for the same pixel in quick succession
const recentlyViewed = new Map<string, number>();
const VIEW_COOLDOWN_MS = 30_000; // 30 seconds

export async function trackPixelView(pixelId: string): Promise<void> {
  const now = Date.now();
  const lastViewed = recentlyViewed.get(pixelId);
  if (lastViewed && now - lastViewed < VIEW_COOLDOWN_MS) return;
  recentlyViewed.set(pixelId, now);

  // Cleanup old entries periodically
  if (recentlyViewed.size > 500) {
    const cutoff = now - VIEW_COOLDOWN_MS;
    for (const [key, ts] of recentlyViewed) {
      if (ts < cutoff) recentlyViewed.delete(key);
    }
  }

  const ua = parseUserAgent();
  const sessionId = getSessionId();

  try {
    await supabase.rpc('log_pixel_view', {
      p_pixel_id: pixelId,
      p_session_id: sessionId,
      p_device_type: ua.device_type,
      p_browser: ua.browser,
      p_os: ua.os,
      p_referrer: document.referrer || null,
    });
  } catch {
    // Fire-and-forget — don't break the UX
  }
}

// =============================================================
// PIXEL CLICK TRACKING
// =============================================================

export async function trackPixelClick(
  pixelId: string,
  blockId?: string | null,
  source: string = 'grid'
): Promise<void> {
  const ua = parseUserAgent();

  try {
    await supabase.rpc('log_pixel_click', {
      p_pixel_id: pixelId,
      p_block_id: blockId || null,
      p_source: source,
      p_referrer: document.referrer || null,
      p_user_agent: navigator.userAgent,
      p_device_type: ua.device_type,
      p_browser: ua.browser,
      p_os: ua.os,
      p_country: null, // GeoIP would be done server-side in a future phase
    });
  } catch {
    // Fire-and-forget
  }
}
