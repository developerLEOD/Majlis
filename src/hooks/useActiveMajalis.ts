import { useEffect, useState, useCallback, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MajlisSession } from '../types/meeting';
import { subscribeToCloudActiveRooms, clearAllCloudActiveRooms } from '../services/firebaseMeetingSync';

const STORAGE_ACTIVE_ROOMS_KEY = 'infinitymeet_active_rooms_cache';
const STORAGE_ENDED_ROOMS_KEY = 'infinitymeet_ended_rooms';

function getStoredEndedRooms(): Set<string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_ENDED_ROOMS_KEY) || localStorage.getItem(STORAGE_ENDED_ROOMS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.map((s) => String(s).toLowerCase()));
      }
    }
  } catch (e) {}
  return new Set();
}

function saveStoredEndedRooms(set: Set<string>) {
  try {
    const arr = Array.from(set);
    sessionStorage.setItem(STORAGE_ENDED_ROOMS_KEY, JSON.stringify(arr));
    localStorage.setItem(STORAGE_ENDED_ROOMS_KEY, JSON.stringify(arr));
  } catch (e) {}
}

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
 * Verifies if a given code or link corresponds to an ongoing live or scheduled Majlis session
 */
export async function verifyMajlisOngoing(
  rawInput: string,
  localActiveList?: MajlisSession[],
  upcomingList?: MajlisSession[]
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

  // 2. Check in-memory upcoming list
  if (upcomingList && upcomingList.length > 0) {
    const match = upcomingList.find((s) => s.roomId.toLowerCase() === roomId.toLowerCase());
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

  // 3. Check Firestore rooms collection
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

  // 4. Check Firestore scheduled_sessions collection
  try {
    const schedSnap = await getDoc(doc(db, 'scheduled_sessions', `sched_${roomId}`));
    if (schedSnap.exists()) {
      const d = schedSnap.data();
      if (d) {
        return {
          isOngoing: true,
          roomId,
          title: d.title || parsedTitle || 'Scheduled Majlis',
          hostName: d.hostName || 'Facilitator',
          session: {
            id: schedSnap.id,
            roomId,
            title: d.title || parsedTitle || 'Scheduled Majlis',
            hostName: d.hostName || 'Facilitator',
            scheduledAt: d.scheduledAt || 'Scheduled Gathering',
            status: 'upcoming',
            participantCount: 0,
            startedAt: typeof d.createdAt === 'number' ? d.createdAt : Date.now(),
          },
        };
      }
    }
  } catch (e) {
    // ignore
  }

  // 5. Check Backend REST endpoint
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

  // If user provided a valid code format (alphanumeric with hyphens), allow opening circle
  if (roomId.length >= 3) {
    return {
      isOngoing: true,
      roomId,
      title: parsedTitle || `Majlis (${roomId})`,
      hostName: 'Circle Host',
    };
  }

  return {
    isOngoing: false,
    roomId,
    error: `No ongoing Majlis found for "${rawInput}". Please check the code or start a new Majlis.`,
  };
}

export function useActiveMajalis(isInsideMeeting: boolean) {
  const [activeMajalis, setActiveMajalis] = useState<MajlisSession[]>([]);
  const [loading, setLoading] = useState(true);
  const endedRoomsSetRef = useRef<Set<string>>(getStoredEndedRooms());
  const cloudRoomsRef = useRef<MajlisSession[]>([]);
  const serverRoomsRef = useRef<MajlisSession[]>([]);
  const optimisticRoomsRef = useRef<MajlisSession[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  // Helper to merge all active sources without stale ghosts
  const mergeAndSync = useCallback(() => {
    const mergedMap = new Map<string, MajlisSession>();
    const endedSet = endedRoomsSetRef.current;

    // 1. Add cloud rooms from Firestore
    for (const r of cloudRoomsRef.current) {
      if (r && r.roomId && (r.participantCount ?? 0) > 0) {
        const key = r.roomId.toLowerCase();
        if (!endedSet.has(key)) {
          mergedMap.set(key, r);
        }
      }
    }

    // 2. Add server rooms from WebSocket / REST
    for (const r of serverRoomsRef.current) {
      if (r && r.roomId && (r.participantCount ?? 0) > 0) {
        const key = r.roomId.toLowerCase();
        if (!endedSet.has(key)) {
          const existing = mergedMap.get(key);
          if (existing) {
            mergedMap.set(key, {
              ...existing,
              ...r,
              title: r.title || existing.title,
              hostName: r.hostName || existing.hostName,
              participantCount: Math.max(existing.participantCount || 1, r.participantCount || 1),
            });
          } else {
            mergedMap.set(key, r);
          }
        }
      }
    }

    // 3. Add fresh locally created rooms (for 5 minutes while room is live)
    const now = Date.now();
    optimisticRoomsRef.current = optimisticRoomsRef.current.filter(
      (r) => r && typeof r.startedAt === 'number' && now - r.startedAt < 1000 * 60 * 5
    );
    for (const r of optimisticRoomsRef.current) {
      if (r && r.roomId) {
        const key = r.roomId.toLowerCase();
        if (!endedSet.has(key) && !mergedMap.has(key)) {
          mergedMap.set(key, { ...r, participantCount: Math.max(r.participantCount ?? 1, 1) });
        }
      }
    }

    const mergedList = Array.from(mergedMap.values());
    setActiveMajalis(mergedList);
    setLoading(false);

    try {
      if (mergedList.length > 0) {
        localStorage.setItem(STORAGE_ACTIVE_ROOMS_KEY, JSON.stringify(mergedList));
      } else {
        localStorage.removeItem(STORAGE_ACTIVE_ROOMS_KEY);
      }
      if (broadcastRef.current) {
        broadcastRef.current.postMessage({ type: 'directory-update', rooms: mergedList });
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const removeRoom = useCallback(
    (roomId: string) => {
      if (!roomId) return;
      const cleanId = roomId.trim().toLowerCase();

      // Record in ended set so background snapshots never revive it
      endedRoomsSetRef.current.add(cleanId);
      saveStoredEndedRooms(endedRoomsSetRef.current);

      cloudRoomsRef.current = cloudRoomsRef.current.filter((r) => r.roomId.toLowerCase() !== cleanId);
      serverRoomsRef.current = serverRoomsRef.current.filter((r) => r.roomId.toLowerCase() !== cleanId);
      optimisticRoomsRef.current = optimisticRoomsRef.current.filter((r) => r.roomId.toLowerCase() !== cleanId);
      mergeAndSync();

      fetch('/api/end-majlis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: cleanId }),
      }).catch(() => {});

      try {
        if (broadcastRef.current) {
          broadcastRef.current.postMessage({ type: 'room-ended', roomId: cleanId });
        }
      } catch (e) {}
    },
    [mergeAndSync]
  );

  const clearAllActive = useCallback(async () => {
    try {
      // Mark all current active room IDs as ended
      activeMajalis.forEach((r) => {
        if (r.roomId) endedRoomsSetRef.current.add(r.roomId.toLowerCase());
      });
      cloudRoomsRef.current.forEach((r) => {
        if (r.roomId) endedRoomsSetRef.current.add(r.roomId.toLowerCase());
      });
      saveStoredEndedRooms(endedRoomsSetRef.current);

      cloudRoomsRef.current = [];
      serverRoomsRef.current = [];
      optimisticRoomsRef.current = [];
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
  }, [activeMajalis]);

  const fetchActive = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/active-majalis');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.activeMajalis)) {
          serverRoomsRef.current = data.activeMajalis.filter(
            (r: MajlisSession) => r && r.roomId && !endedRoomsSetRef.current.has(r.roomId.toLowerCase())
          );
          mergeAndSync();
        }
      }
    } catch (e) {
      console.warn('Failed to fetch active majalis from server:', e);
    } finally {
      setLoading(false);
    }
  }, [mergeAndSync]);

  const addOptimisticMajlis = useCallback(
    (session: MajlisSession) => {
      const cleanId = session.roomId.trim().toLowerCase();
      // Un-end if creating a new room with the same ID
      endedRoomsSetRef.current.delete(cleanId);
      saveStoredEndedRooms(endedRoomsSetRef.current);

      const formatted: MajlisSession = {
        ...session,
        status: 'live',
        participantCount: Math.max(session.participantCount ?? 1, 1),
        startedAt: Date.now(),
      };
      optimisticRoomsRef.current = [
        formatted,
        ...optimisticRoomsRef.current.filter((p) => p.roomId.toLowerCase() !== cleanId),
      ];
      mergeAndSync();
    },
    [mergeAndSync]
  );

  useEffect(() => {
    // 1. Firebase Cloud Firestore Real-time listener for active meetings
    let cloudUnsub: (() => void) | null = null;
    try {
      cloudUnsub = subscribeToCloudActiveRooms((cloudRooms) => {
        if (Array.isArray(cloudRooms)) {
          cloudRoomsRef.current = cloudRooms;
          mergeAndSync();
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
          } else if (e.data?.type === 'room-ended' && e.data.roomId) {
            removeRoom(e.data.roomId);
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
      } else if (e.key === STORAGE_ACTIVE_ROOMS_KEY && !e.newValue) {
        setActiveMajalis([]);
      }
    };
    window.addEventListener('storage', handleStorage);

    // 4. REST Polling
    fetchActive();
    const pollInterval = setInterval(() => {
      fetchActive();
    }, 4000);

    // 5. WebSocket connection for instant push updates
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
            serverRoomsRef.current = message.activeMajalis;
            mergeAndSync();
          } else if (message.type === 'session-ended' && message.roomId) {
            removeRoom(message.roomId);
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
  }, [fetchActive, mergeAndSync, removeRoom]);

  return { activeMajalis, refreshActiveMajalis: fetchActive, addOptimisticMajlis, removeRoom, clearAllActive, loading };
}
