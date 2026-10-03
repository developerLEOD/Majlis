import { useEffect, useState, useCallback, useRef } from 'react';
import { MajlisSession } from '../types/meeting';

const DEFAULT_ACTIVE_MAJALIS: MajlisSession[] = [
  {
    id: 'live_quran-tafsir',
    roomId: 'quran-tafsir',
    title: 'The Exegesis of the Noble Quran (Tafsir)',
    hostName: 'Shaykh Abdullah',
    scheduledAt: 'Happening Now',
    status: 'live',
    participantCount: 1,
    startedAt: Date.now() - 1000 * 60 * 15,
  },
];

export function useActiveMajalis(isInsideMeeting: boolean) {
  const [activeMajalis, setActiveMajalis] = useState<MajlisSession[]>(DEFAULT_ACTIVE_MAJALIS);
  const [loading, setLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchActive = useCallback(async () => {
    try {
      const res = await fetch('/api/active-majalis');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.activeMajalis) && data.activeMajalis.length > 0) {
          setActiveMajalis(data.activeMajalis);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch active majalis:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const addOptimisticMajlis = useCallback((session: MajlisSession) => {
    setActiveMajalis((prev) => {
      const filtered = prev.filter((p) => p.roomId !== session.roomId);
      return [session, ...filtered];
    });
  }, []);

  useEffect(() => {
    if (isInsideMeeting) return;

    fetchActive();

    const pollInterval = setInterval(() => {
      fetchActive();
    }, 3000);

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
            setActiveMajalis(message.activeMajalis);
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
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {
          // ignore
        }
        wsRef.current = null;
      }
    };
  }, [isInsideMeeting, fetchActive]);

  return { activeMajalis, refreshActiveMajalis: fetchActive, addOptimisticMajlis, loading };
}
