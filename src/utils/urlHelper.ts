import { doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isFirestoreQuotaExhausted } from '../firebase';
import { MajlisSession } from '../types/meeting';

/**
 * URL, link sharing, and session metadata utilities for InfinityMeet
 */

// Authoritative Cloud Run backend URL for this application
export const CLOUD_RUN_BACKEND_URL = 'https://ais-pre-h6lc7dro2ku2bhha3s6o2z-681773016852.asia-east1.run.app';

/**
 * Resolves the appropriate backend base URL.
 * Automatically connects to the Cloud Run server when frontend is hosted on Vercel, Netlify, or third-party domains.
 */
export function getBackendBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // 1. Explicit environment variable if provided
    const envUrl = (import.meta as any).env?.VITE_BACKEND_URL;
    if (envUrl) return String(envUrl).replace(/\/+$/, '');

    // 2. If running on Vercel or any external static host, connect directly to Cloud Run
    const host = window.location.hostname.toLowerCase();
    if (host.includes('vercel.app') || host.includes('netlify.app') || host.includes('github.io')) {
      return CLOUD_RUN_BACKEND_URL;
    }

    // 3. Same-origin for Cloud Run, AI Studio preview, and localhost dev
    return window.location.origin;
  }
  return CLOUD_RUN_BACKEND_URL;
}

export function getBackendApiUrl(endpointPath: string): string {
  const base = getBackendBaseUrl();
  const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  return `${base}${cleanPath}`;
}

export function getBackendWebSocketUrl(): string {
  const base = getBackendBaseUrl();
  const wsProto = base.startsWith('https:') ? 'wss:' : 'ws:';
  const cleanHost = base.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return `${wsProto}//${cleanHost}`;
}

// Cache for public app URL retrieved from backend
let cachedPublicAppUrl = '';

export async function fetchAppConfig(): Promise<string> {
  if (cachedPublicAppUrl) return cachedPublicAppUrl;
  try {
    const res = await fetch(getBackendApiUrl('/api/config'));
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

  const params = new URLSearchParams();
  params.set('room', cleanRoom);
  if (title && title.trim() && !title.startsWith('Majlis (') && title !== 'Live Majlis') {
    params.set('title', title.trim());
  }
  const queryString = params.toString();

  // 1. If forcedBaseUrl is specified and not localhost, use it
  if (forcedBaseUrl && !forcedBaseUrl.includes('localhost')) {
    const cleanBase = forcedBaseUrl.replace(/\/+$/, '');
    return `${cleanBase}/?${queryString}`;
  }

  // 2. In browser context, use window.location.origin so links match the current accessible domain
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin;
    const pathname = window.location.pathname.replace(/\/+$/, '');
    return `${origin}${pathname}/?${queryString}`;
  }

  // 3. Fallback to cached public app url
  if (cachedPublicAppUrl && !cachedPublicAppUrl.includes('localhost')) {
    const cleanBase = cachedPublicAppUrl.replace(/\/+$/, '');
    return `${cleanBase}/?${queryString}`;
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

/**
 * Extracts a normalized roomId from plain text, query string, or full meeting URL
 */
export function extractRoomIdFromInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  try {
    if (trimmed.includes('?') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://dummy.com/${trimmed}`);
      const roomParam = url.searchParams.get('room') || url.searchParams.get('roomId') || url.searchParams.get('r');
      if (roomParam) {
        return roomParam.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      }
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && !['join', 'room', 'majlis'].includes(lastPart.toLowerCase())) {
          return lastPart.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
        }
      }
    }
  } catch (e) {
    // ignore
  }

  if (trimmed.startsWith('?')) {
    const params = new URLSearchParams(trimmed);
    const r = params.get('room') || params.get('roomId') || params.get('r');
    if (r) return r.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  }

  return trimmed.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

/**
 * Checks whether a given room code or link matches a currently active ongoing session
 */
export async function checkOngoingMajlis(
  roomIdOrLink: string,
  currentActiveList: MajlisSession[] = []
): Promise<{ exists: boolean; roomId: string; session?: MajlisSession; message?: string }> {
  const cleanedId = extractRoomIdFromInput(roomIdOrLink);
  if (!cleanedId || cleanedId.length < 2) {
    return {
      exists: false,
      roomId: '',
      message: 'Please enter a valid Majlis code or invite link.',
    };
  }

  // 1. Check in currently active client list
  const foundInList = currentActiveList.find((s) => s.roomId.toLowerCase() === cleanedId.toLowerCase());
  if (foundInList) {
    return { exists: true, roomId: cleanedId, session: foundInList };
  }

  // 2. Check live server backend
  try {
    const res = await fetch(getBackendApiUrl(`/api/room/${encodeURIComponent(cleanedId)}`));
    if (res.ok) {
      const data = await res.json();
      if (data.exists) {
        return {
          exists: true,
          roomId: cleanedId,
          session: {
            id: `live_${cleanedId}`,
            roomId: cleanedId,
            title: data.title || `Majlis (${cleanedId})`,
            hostName: data.hostName || 'Moderator',
            scheduledAt: 'Happening Now',
            status: 'live',
            participantCount: data.participantCount || 1,
            startedAt: Date.now(),
            locked: !!data.locked,
          },
        };
      }
    }
  } catch (e) {
    // ignore
  }

  // 3. Check Firestore
  if (!isFirestoreQuotaExhausted) {
    const path = `rooms/${cleanedId}`;
    try {
      const docSnap = await getDoc(doc(db, 'rooms', cleanedId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && !data.ended) {
          return {
            exists: true,
            roomId: cleanedId,
            session: {
              id: `live_${cleanedId}`,
              roomId: cleanedId,
              title: data.title || `Majlis (${cleanedId})`,
              hostName: data.hostName || 'Moderator',
              scheduledAt: 'Happening Now',
              status: 'live',
              participantCount: data.participantCount || 1,
              startedAt: data.createdAt ? (typeof data.createdAt.toMillis === 'function' ? data.createdAt.toMillis() : Date.now()) : Date.now(),
              locked: !!data.locked,
            },
          };
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, path);
    }
  }

  return {
    exists: false,
    roomId: cleanedId,
    message: `No ongoing Majlis found for code "${cleanedId}". Please verify the code or start a new gathering.`,
  };
}

