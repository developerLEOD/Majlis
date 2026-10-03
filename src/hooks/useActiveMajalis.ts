import { useEffect, useState, useCallback, useRef } from 'react';
import { MajlisSession } from '../types/meeting';
import { subscribeToCloudActiveRooms } from '../services/firebaseMeetingSync';

const STORAGE_ACTIVE_ROOMS_KEY = 'infinitymeet_active_rooms_cache';

export function useActiveMajalis(isInsideMeeting: boolean) {
  const [activeMajalis, setActiveMajalis] = useState<MajlisSession[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_ACTIVE_ROOMS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((s: MajlisSession) => !s.startedAt || Date.now() - s.startedAt < 7200000);
        }
      }
    } catch (e) {
      // ignore
    }
    return [];
  });

  const [loading, setLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  // Sync to local storage & broadcast to other tabs
  const persistAndBroadcast = useCallback((rooms: MajlisSession[]) => {
    setActiveMajalis(rooms);
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
  }, []);

  useEffect(() => {
    // 1. Firebase Cloud Firestore Real-time listener for active meetings
    let cloudUnsub: (() => void) | null = null;
    try {
      cloudUnsub = subscribeToCloudActiveRooms((cloudRooms) => {
        persistAndBroadcast(cloudRooms || []);
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
    }, 4000);

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

  return { activeMajalis, refreshActiveMajalis: fetchActive, addOptimisticMajlis, loading };
}
