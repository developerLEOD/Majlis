import { useEffect, useState, useCallback, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MajlisSession } from '../types/meeting';
import { subscribeToCloudActiveRooms, clearAllCloudActiveRooms } from '../services/firebaseMeetingSync';

const STORAGE_ACTIVE_ROOMS_KEY = 'infinitymeet_active_rooms_cache';

export interface RoomVerificationResult {
  isOngoing: boolean;
  roomId: string;
  title?: string;
  hostName?: string;
  session?: MajlisSession;
  error?: string;
}

/**
 * Extracts and cleans a roomId and optional title from raw user input (code or full link)
 */
export function extractRoomInfoFromInput(rawInput: string): { roomId: string; title?: string } | null {
  if (!rawInput || !rawInput.trim()) return null;
  const input = rawInput.trim();

  try {
    // Check if input is a URL or contains query/hash
    if (input.includes('://') || input.includes('?room=') || input.includes('roomId=') || input.includes('#')) {
      const urlStr = input.startsWith('http://') || input.startsWith('https://')
        ? input
        : `${window.location.origin}${input.startsWith('/') ? '' : '/'}${input}`;
      const url = new URL(urlStr);

      const searchRoom = url.searchParams.get('room') || url.searchParams.get('roomId');
      const searchTitle = url.searchParams.get('title');
      if (searchRoom) {
        return {
          roomId: searchRoom.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''),
          title: searchTitle || undefined,
        };
      }

      if (url.hash) {
        const hashClean = url.hash.replace(/^#\/?/, '');
        const hashParams = new URLSearchParams(hashClean.includes('?') ? hashClean.split('?')[1] : hashClean);
        const hashRoom = hashParams.get('room') || hashParams.get('roomId');
        if (hashRoom) {
          return {
            roomId: hashRoom.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''),
            title: hashParams.get('title') || undefined,
          };
        }

        const parts = hashClean.split('/');
        const roomIdx = parts.findIndex((p) => p === 'room' || p === 'majlis');
        if (roomIdx >= 0 && parts[roomIdx + 1]) {
          return {
            roomId: parts[roomIdx + 1].trim().toLowerCase().replace(/[^a-z0-9-]/g, ''),
          };
        }
      }

      const pathParts = url.pathname.split('/').filter(Boolean);
      const roomIdx = pathParts.findIndex((p) => p === 'room' || p === 'majlis');
      if (roomIdx >= 0 && pathParts[roomIdx + 1]) {
        return {
          roomId: pathParts[roomIdx + 1].trim().toLowerCase().replace(/[^a-z0-9-]/g, ''),
        };
      }
    }
  } catch (e) {
    // Fallback to text parsing
  }

  const cleaned = input.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!cleaned) return null;
  return { roomId: cleaned };
}

/**
 * Verifies if a given code or link corresponds to an ongoing live Majlis session
 */
export async function verifyMajlisOngoing(
  rawInput: string,
  localActiveList?: MajlisSession[]
): Promise<RoomVerificationResult> {
  const parsed = extractRoomInfoFromInput(rawInput);
  if (!parsed || !parsed.roomId) {
    return {
      isOngoing: false,
      roomId: '',
      error: 'Please enter a valid Majlis code or link.',
    };
  }

  const { roomId, title: parsedTitle } = parsed;

  // 1. Check in-memory active list
  if (localActiveList && localActiveList.length > 0) {
    const match = localActiveList.find((s) => s.roomId.toLowerCase() === roomId.toLowerCase());
    if (match) {
      return {
        isOngoing: true,
        roomId: match.roomId,
        title: match.title || parsedTitle,
        hostName: match.hostName,
        session: match,
      };
    }
  }

  // 2. Check Firestore rooms collection
  try {
    const roomSnap = await getDoc(doc(db, 'rooms', roomId));
    if (roomSnap.exists()) {
      const d = roomSnap.data();
      if (d && !d.ended) {
        return {
          isOngoing: true,
          roomId,
          title: d.title || parsedTitle || 'Live Majlis',
          hostName: d.hostName || 'Facilitator',
          session: {
            id: `live_${roomId}`,
            roomId,
            title: d.title || parsedTitle || 'Live Majlis',
            hostName: d.hostName || 'Facilitator',
            scheduledAt: 'Happening Now',
            status: 'live',
            participantCount: d.participantCount || 1,
            startedAt: d.createdAt?.toMillis?.() || Date.now(),
            locked: !!d.locked,
          },
        };
      }
    }
  } catch (e) {
    // ignore
  }

  // 3. Check Backend REST endpoint
  try {
    const res = await fetch(`/api/room/${roomId}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.exists) {
        return {
          isOngoing: true,
          roomId,
          title: data.title || parsedTitle || 'Live Majlis',
          hostName: data.hostName || 'Facilitator',
          session: {
            id: `live_${roomId}`,
            roomId,
            title: data.title || parsedTitle || 'Live Majlis',
            hostName: data.hostName || 'Facilitator',
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

  return {
    isOngoing: false,
    roomId,
    error: `No ongoing Majlis found for "${rawInput}". The session may have concluded or the code is incorrect.`,
  };
}

export function useActiveMajalis(isInsideMeeting: boolean) {
  const [activeMajalis, setActiveMajalis] = useState<MajlisSession[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_ACTIVE_ROOMS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      // ignore
    }
    return [];
  });

  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  const clearAllActive = useCallback(async () => {
    try {
      localStorage.removeItem(STORAGE_ACTIVE_ROOMS_KEY);
      setActiveMajalis([]);
      if (broadcastRef.current) {
        broadcastRef.current.postMessage({ type: 'directory-update', rooms: [] });
      }
      await fetch('/api/clear-active-majalis', { method: 'POST' }).catch(() => {});
      await clearAllCloudActiveRooms().catch(() => {});
    } catch (e) {
      console.warn('Error clearing active majalis:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const persistAndBroadcast = useCallback((rooms: MajlisSession[]) => {
    setActiveMajalis(rooms);
    setLoading(false);
    try {
      localStorage.setItem(STORAGE_ACTIVE_ROOMS_KEY, JSON.stringify(rooms));
      if (broadcastRef.current) {
        broadcastRef.current.postMessage({ type: 'directory-update', rooms });
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const fetchActive = useCallback(async () => {
    try {
      const res = await fetch('/api/active-majalis');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.activeMajalis)) {
          persistAndBroadcast(data.activeMajalis);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch active majalis:', e);
    } finally {
      setLoading(false);
    }
  }, [persistAndBroadcast]);

  const addOptimisticMajlis = useCallback((session: MajlisSession) => {
    setActiveMajalis((prev) => {
      const filtered = prev.filter((p) => p.roomId.toLowerCase() !== session.roomId.toLowerCase());
      const updated = [session, ...filtered];
      try {
        localStorage.setItem(STORAGE_ACTIVE_ROOMS_KEY, JSON.stringify(updated));
        if (broadcastRef.current) {
          broadcastRef.current.postMessage({ type: 'directory-update', rooms: updated });
        }
      } catch (e) {}
      return updated;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    // 1. Firebase Cloud Firestore Real-time listener for active meetings
    let cloudUnsub: (() => void) | null = null;
    try {
      cloudUnsub = subscribeToCloudActiveRooms((cloudRooms) => {
        if (Array.isArray(cloudRooms)) {
          persistAndBroadcast(cloudRooms);
        }
        setLoading(false);
      });
    } catch (e) {
      console.warn('Cloud rooms subscription notice:', e);
    }

    // 2. Cross-tab Broadcast Channel
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('infinitymeet_active_majalis');
        broadcastRef.current = bc;
        bc.onmessage = (e) => {
          if (e.data?.type === 'directory-update' && Array.isArray(e.data.rooms)) {
            setActiveMajalis(e.data.rooms);
          }
        };
      } catch (e) {
        // ignore
      }
    }

    // 3. Storage event listener for cross-tab sync
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_ACTIVE_ROOMS_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setActiveMajalis(parsed);
          }
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorage);

    // 4. REST Polling fallback
    fetchActive();
    const pollInterval = setInterval(() => {
      fetchActive();
    }, 5000);

    // 5. WebSocket connection for instant local push updates
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'get-active-majalis' }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'active-majalis-update' && Array.isArray(message.activeMajalis)) {
            persistAndBroadcast(message.activeMajalis);
            setLoading(false);
          }
        } catch (e) {
          // ignore
        }
      };
    } catch (e) {
      // ignore
    }

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('storage', handleStorage);
      if (cloudUnsub) {
        cloudUnsub();
      }
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {}
        wsRef.current = null;
      }
      if (broadcastRef.current) {
        try {
          broadcastRef.current.close();
        } catch (e) {}
        broadcastRef.current = null;
      }
    };
  }, [fetchActive, persistAndBroadcast]);

  return { activeMajalis, refreshActiveMajalis: fetchActive, addOptimisticMajlis, clearAllActive, loading };
}
