/**
 * URL, link sharing, and session metadata utilities for InfinityMeet
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
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed, trying execCommand fallback:', err);
    }
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
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
 * Extracts room code and optional title from current URL parameters / hash
 */
export function getRoomInfoFromCurrentLocation(): { roomId: string; title?: string } | null {
  if (typeof window === 'undefined') return null;

  const clean = (val: string) => val.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

  // 1. Search Query Parameters: ?room=123&title=13
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('room') || params.get('r');
  const titleFromQuery = params.get('title') || params.get('t') || params.get('topic');

  if (fromQuery) {
    return {
      roomId: clean(fromQuery),
      title: titleFromQuery ? titleFromQuery.trim() : undefined,
    };
  }

  // 2. Hash Fragment: #room=123&title=13 or #123
  if (window.location.hash) {
    const hashContent = window.location.hash.replace(/^#\/?/, '');
    const hashParams = new URLSearchParams(hashContent);
    const fromHash = hashParams.get('room') || hashParams.get('r');
    const titleFromHash = hashParams.get('title') || hashParams.get('t');

    if (fromHash) {
      return {
        roomId: clean(fromHash),
        title: titleFromHash ? titleFromHash.trim() : undefined,
      };
    }

    if (/^[a-z0-9-]+$/i.test(hashContent) && hashContent.length >= 3) {
      return { roomId: clean(hashContent) };
    }
  }

  // 3. Pathname: /room/abc-def-ghi
  const pathMatch = window.location.pathname.match(/\/room\/([a-z0-9-]+)/i);
  if (pathMatch && pathMatch[1]) {
    return { roomId: clean(pathMatch[1]) };
  }

  return null;
}

export function getRoomCodeFromCurrentLocation(): string {
  const info = getRoomInfoFromCurrentLocation();
  return info ? info.roomId : '';
}

/**
 * Build clean, shareable invite URL with embedded title for cross-platform synchronization
 */
export function buildMeetingInviteUrl(
  roomId: string,
  title?: string,
  forcedBaseUrl?: string
): string {
  const cleanRoom = roomId.trim().toLowerCase();
  const baseUrl = forcedBaseUrl || cachedPublicAppUrl;

  const params = new URLSearchParams();
  params.set('room', cleanRoom);
  if (title && title.trim() && !title.startsWith('Majlis (') && title !== 'Live Majlis') {
    params.set('title', title.trim());
  }
  const queryString = params.toString();

  if (baseUrl && !baseUrl.includes('localhost')) {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    return `${cleanBase}/?${queryString}`;
  }

  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    const pathname = window.location.pathname.replace(/\/+$/, '');
    return `${origin}${pathname}/?${queryString}`;
  }

  return `/?${queryString}`;
}

/**
 * Local cache for room titles to sync across Vercel / serverless sessions
 */
export function saveRoomTitleLocally(roomId: string, title: string): void {
  if (typeof window === 'undefined' || !roomId || !title) return;
  try {
    localStorage.setItem(`infinitymeet_title_${roomId.toLowerCase()}`, title.trim());
  } catch (e) {
    // ignore
  }
}

export function getRoomTitleLocally(roomId: string): string | null {
  if (typeof window === 'undefined' || !roomId) return null;
  try {
    return localStorage.getItem(`infinitymeet_title_${roomId.toLowerCase()}`);
  } catch (e) {
    return null;
  }
}
