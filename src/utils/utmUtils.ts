/**
 * UTM Parameter Utility
 *
 * Appends UTM tracking parameters to outgoing advertiser links so they can
 * measure BuyASpot traffic in Google Analytics. This is invisible to visitors
 * but a huge trust signal for advertisers.
 */

const DEFAULT_UTM_PARAMS = {
  utm_source: 'buyaspot',
  utm_medium: 'pixel_grid',
} as const;

/**
 * Append UTM tracking parameters to an advertiser URL.
 *
 * - Preserves existing query parameters
 * - Does NOT overwrite UTM params if they already exist
 * - Handles bare domains (prepends https://)
 *
 * @param url       The raw advertiser URL
 * @param campaign  Optional campaign name (e.g. 'billboard', 'directory')
 * @returns         The URL with UTM params appended
 */
export function appendUtmParams(
  url: string,
  campaign: string = 'pixel_ad'
): string {
  if (!url) return url;

  try {
    // Normalize: prepend https:// for bare domains
    const normalized =
      url.startsWith('http://') || url.startsWith('https://')
        ? url
        : `https://${url}`;

    const urlObj = new URL(normalized);

    // Only add UTM params that don't already exist
    if (!urlObj.searchParams.has('utm_source')) {
      urlObj.searchParams.set('utm_source', DEFAULT_UTM_PARAMS.utm_source);
    }
    if (!urlObj.searchParams.has('utm_medium')) {
      urlObj.searchParams.set('utm_medium', DEFAULT_UTM_PARAMS.utm_medium);
    }
    if (!urlObj.searchParams.has('utm_campaign')) {
      urlObj.searchParams.set('utm_campaign', campaign);
    }

    return urlObj.toString();
  } catch {
    // If URL parsing fails, return the original
    return url;
  }
}

/**
 * Open a URL in a new tab with UTM parameters appended.
 * This is the primary entry point for all advertiser link clicks.
 */
export function openAdvertiserUrl(
  url: string,
  campaign: string = 'pixel_ad'
): void {
  const validUrl =
    url.startsWith('http://') || url.startsWith('https://')
      ? url
      : `https://${url}`;

  const utmUrl = appendUtmParams(validUrl, campaign);
  window.open(utmUrl, '_blank', 'noopener,noreferrer');
}
