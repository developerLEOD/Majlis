/**
 * URL and link sharing utilities for InfinityMeet
 */

// Cache for public app URL retrieved from backend
let cachedPublicAppUrl = '';

export async function fetchAppConfig(): Promise<string> {
  if (cachedPublicAppUrl) return cachedPublicAppUrl;
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data.appUrl) {
        cachedPublicAppUrl = data.appUrl;
        return cachedPublicAppUrl;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch /api/config:', err);
  }
  return '';
}

export function getCachedPublicAppUrl(): string {
  return cachedPublicAppUrl;
}

/**
 * Robust clipboard copy with fallback that works inside iframes and restricted contexts
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  // First attempt: Modern Clipboard API
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed, trying execCommand fallback:', err);
    }
  }

  // Fallback: document.execCommand('copy') via temporary textarea
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    // Ensure invisible and non-scrolling
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);

    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, 99999);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('All clipboard copy attempts failed:', err);
    return false;
  }
}

/**
 * Extracts room code from any URL format:
 * - ?room=abc-def-ghi
 * - ?r=abc-def-ghi
 * - #room=abc-def-ghi
 * - #abc-def-ghi
 * - /room/abc-def-ghi
 */
export function getRoomCodeFromCurrentLocation(): string {
  if (typeof window === 'undefined') return '';

  const clean = (val: string) => val.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

  // 1. Search Query Parameters
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('room') || params.get('r');
  if (fromQuery) {
    return clean(fromQuery);
  }

  // 2. Hash Fragment
  if (window.location.hash) {
    const hashContent = window.location.hash.replace(/^#\/?/, '');
    if (hashContent.startsWith('room=')) {
      return clean(hashContent.replace('room=', ''));
    }
    // If hash looks like a room code (3-20 chars alphanumeric with dashes)
    if (/^[a-z0-9-]+$/i.test(hashContent) && hashContent.length >= 3) {
      return clean(hashContent);
    }
  }

  // 3. Pathname: /room/abc-def-ghi
  const pathMatch = window.location.pathname.match(/\/room\/([a-z0-9-]+)/i);
  if (pathMatch && pathMatch[1]) {
    return clean(pathMatch[1]);
  }

  return '';
}

/**
 * Build clean, shareable invite URL
 */
export function buildMeetingInviteUrl(roomId: string, forcedBaseUrl?: string): string {
  const cleanRoom = roomId.trim().toLowerCase();
  const baseUrl = forcedBaseUrl || cachedPublicAppUrl;

  if (baseUrl && !baseUrl.includes('localhost')) {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    return `${cleanBase}/?room=${encodeURIComponent(cleanRoom)}`;
  }

  // If current origin is not localhost, use it
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin && !origin.includes('localhost')) {
      const pathname = window.location.pathname.replace(/\/+$/, '');
      return `${origin}${pathname}/?room=${encodeURIComponent(cleanRoom)}`;
    }

    // If on localhost, still build proper URL
    return `${window.location.origin}/?room=${encodeURIComponent(cleanRoom)}`;
  }

  return `/?room=${encodeURIComponent(cleanRoom)}`;
}
