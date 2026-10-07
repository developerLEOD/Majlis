import { useEffect, useState, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, isFirestoreQuotaExhausted, handleFirestoreError, OperationType } from '../firebase';
import { MajlisSession } from '../types/meeting';
import { activeSessionsStore } from '../services/activeSessionsStore';

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

  // 2. Check dedicated active sessions store
  const storedActive = activeSessionsStore.getStoredActiveSessions();
  const matchStored = storedActive.find((s) => s.roomId.toLowerCase() === roomId.toLowerCase());
  if (matchStored) {
    return {
      isOngoing: true,
      roomId: matchStored.roomId,
      title: matchStored.title || parsedTitle,
      hostName: matchStored.hostName,
      session: matchStored,
    };
  }

  // 3. Check in-memory upcoming list
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

  // 4. Check Backend REST endpoint
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
  const [activeMajalis, setActiveMajalis] = useState<MajlisSession[]>(() =>
    activeSessionsStore.getStoredActiveSessions()
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Subscribe to dedicated store updates
    const unsub = activeSessionsStore.subscribe((sessions) => {
      setActiveMajalis(sessions);
      setLoading(false);
    });

    // Initial silent refresh from server
    activeSessionsStore.refreshFromServer().catch(() => {});

    // Silent background poll
    const interval = setInterval(() => {
      activeSessionsStore.refreshFromServer().catch(() => {});
    }, 6000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  const refreshActiveMajalis = useCallback(async () => {
    setLoading(true);
    try {
      const refreshed = await activeSessionsStore.refreshFromServer();
      setActiveMajalis(refreshed);
    } finally {
      setLoading(false);
    }
  }, []);

  const addOptimisticMajlis = useCallback((session: MajlisSession) => {
    activeSessionsStore.saveSession({
      roomId: session.roomId,
      title: session.title,
      hostName: session.hostName,
      participantCount: session.participantCount,
      locked: session.locked,
    });
    setActiveMajalis(activeSessionsStore.getStoredActiveSessions());
  }, []);

  const removeRoom = useCallback((roomId: string) => {
    activeSessionsStore.markSessionEnded(roomId);
    setActiveMajalis(activeSessionsStore.getStoredActiveSessions());
  }, []);

  const clearAllActive = useCallback(() => {
    activeSessionsStore.clearAll();
    setActiveMajalis([]);
  }, []);

  return {
    activeMajalis,
    refreshActiveMajalis,
    addOptimisticMajlis,
    removeRoom,
    clearAllActive,
    loading,
  };
}
