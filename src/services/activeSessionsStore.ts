import { MajlisSession } from '../types/meeting';

const ACTIVE_SESSIONS_STORAGE_KEY = 'infinitymeet_dedicated_active_sessions_v2';
const ENDED_SESSIONS_STORAGE_KEY = 'infinitymeet_dedicated_ended_sessions_v2';

class ActiveSessionsStoreService {
  private listeners: Set<(sessions: MajlisSession[]) => void> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('infinitymeet_active_sessions_channel');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'sessions_updated') {
            this.notifyListeners();
          } else if (event.data?.type === 'session_ended' && event.data.roomId) {
            this.markSessionEnded(event.data.roomId);
          }
        };
      } catch (e) {
        // ignore
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === ACTIVE_SESSIONS_STORAGE_KEY || e.key === ENDED_SESSIONS_STORAGE_KEY) {
          this.notifyListeners();
        }
      });
    }
  }

  /**
   * Returns set of clean room IDs that have been explicitly ended or deleted
   */
  public getEndedRoomIds(): Set<string> {
    try {
      const raw = localStorage.getItem(ENDED_SESSIONS_STORAGE_KEY) || sessionStorage.getItem(ENDED_SESSIONS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return new Set(parsed.map((id) => String(id).toLowerCase().trim()));
        }
      }
    } catch (e) {}
    return new Set();
  }

  /**
   * Permanently marks a session as ended and removes it from active list and storage
   */
  public markSessionEnded(roomId: string) {
    if (!roomId) return;
    const cleanId = roomId.toLowerCase().trim();

    // 1. Add to ended set
    const ended = this.getEndedRoomIds();
    ended.add(cleanId);
    try {
      const arr = Array.from(ended);
      localStorage.setItem(ENDED_SESSIONS_STORAGE_KEY, JSON.stringify(arr));
      sessionStorage.setItem(ENDED_SESSIONS_STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {}

    // 2. Remove from active stored list
    const active = this.getStoredActiveSessions();
    const filtered = active.filter((s) => s.roomId.toLowerCase().trim() !== cleanId);
    this.saveStoredActiveSessions(filtered);

    // 3. Notify server endpoint
    fetch('/api/end-majlis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: cleanId }),
    }).catch(() => {});

    this.broadcastUpdate({ type: 'session_ended', roomId: cleanId });
  }

  /**
   * Retrieves current active sessions from dedicated local storage
   */
  public getStoredActiveSessions(): MajlisSession[] {
    try {
      const raw = localStorage.getItem(ACTIVE_SESSIONS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const ended = this.getEndedRoomIds();
          const now = Date.now();
          return parsed.filter((s: MajlisSession) => {
            if (!s || !s.roomId) return false;
            const cleanId = s.roomId.toLowerCase().trim();
            if (ended.has(cleanId)) return false;
            if (s.startedAt && now - s.startedAt > 1000 * 60 * 60 * 3 && (s.participantCount ?? 0) <= 0) {
              return false;
            }
            return true;
          });
        }
      }
    } catch (e) {}
    return [];
  }

  /**
   * Saves active sessions list to dedicated local storage
   */
  public saveStoredActiveSessions(sessions: MajlisSession[]) {
    try {
      const ended = this.getEndedRoomIds();
      const valid = sessions.filter((s) => s && s.roomId && !ended.has(s.roomId.toLowerCase().trim()));
      localStorage.setItem(ACTIVE_SESSIONS_STORAGE_KEY, JSON.stringify(valid));
    } catch (e) {}
    this.notifyListeners();
  }

  /**
   * Secures a new or ongoing session and all its details in the dedicated active sessions store
   */
  public saveSession(session: {
    roomId: string;
    title: string;
    hostName: string;
    participantCount?: number;
    locked?: boolean;
  }): MajlisSession {
    const cleanId = session.roomId.toLowerCase().trim();

    // Remove from ended set if re-creating room with same ID
    const ended = this.getEndedRoomIds();
    if (ended.has(cleanId)) {
      ended.delete(cleanId);
      try {
        const arr = Array.from(ended);
        localStorage.setItem(ENDED_SESSIONS_STORAGE_KEY, JSON.stringify(arr));
        sessionStorage.setItem(ENDED_SESSIONS_STORAGE_KEY, JSON.stringify(arr));
      } catch (e) {}
    }

    const current = this.getStoredActiveSessions();
    const existingIdx = current.findIndex((s) => s.roomId.toLowerCase().trim() === cleanId);

    const updatedSession: MajlisSession = {
      id: `live_${cleanId}`,
      roomId: cleanId,
      title: session.title.trim() || 'Live Majlis',
      hostName: session.hostName.trim() || 'Facilitator',
      scheduledAt: 'Happening Now',
      status: 'live',
      participantCount: Math.max(session.participantCount ?? 1, 1),
      startedAt: existingIdx >= 0 && current[existingIdx].startedAt ? current[existingIdx].startedAt : Date.now(),
      locked: !!session.locked,
    };

    if (existingIdx >= 0) {
      current[existingIdx] = updatedSession;
    } else {
      current.unshift(updatedSession);
    }

    this.saveStoredActiveSessions(current);

    // Sync with backend REST
    fetch('/api/create-majlis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: cleanId,
        title: updatedSession.title,
        hostName: updatedSession.hostName,
      }),
    }).catch(() => {});

    this.broadcastUpdate({ type: 'sessions_updated' });
    return updatedSession;
  }

  /**
   * Clears all active sessions everywhere
   */
  public clearAll() {
    const current = this.getStoredActiveSessions();
    current.forEach((s) => this.markSessionEnded(s.roomId));

    localStorage.removeItem(ACTIVE_SESSIONS_STORAGE_KEY);
    fetch('/api/clear-active-majalis', { method: 'POST' }).catch(() => {});
    this.broadcastUpdate({ type: 'sessions_updated' });
  }

  /**
   * Refreshes active sessions directly from server REST endpoint & merges into dedicated store
   */
  public async refreshFromServer(): Promise<MajlisSession[]> {
    try {
      const res = await fetch('/api/active-majalis');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.activeMajalis)) {
          const ended = this.getEndedRoomIds();

          // Server active list is authoritative for ongoing sessions
          const serverSessions: MajlisSession[] = data.activeMajalis.map((s: MajlisSession) => {
            const cleanId = s.roomId.toLowerCase().trim();
            // If server says room is active, remove from ended set
            if (ended.has(cleanId)) {
              ended.delete(cleanId);
            }
            return {
              id: `live_${cleanId}`,
              roomId: cleanId,
              title: s.title || 'Live Majlis',
              hostName: s.hostName || 'Facilitator',
              scheduledAt: 'Happening Now',
              status: 'live' as const,
              participantCount: Math.max(s.participantCount ?? 1, 1),
              startedAt: s.startedAt || Date.now(),
              locked: !!s.locked,
            };
          });

          // Save updated ended set
          try {
            const arr = Array.from(ended);
            localStorage.setItem(ENDED_SESSIONS_STORAGE_KEY, JSON.stringify(arr));
            sessionStorage.setItem(ENDED_SESSIONS_STORAGE_KEY, JSON.stringify(arr));
          } catch (e) {}

          // Merge server sessions into local sessions
          const local = this.getStoredActiveSessions();
          const mergedMap = new Map<string, MajlisSession>();

          for (const s of serverSessions) {
            mergedMap.set(s.roomId.toLowerCase().trim(), s);
          }
          for (const s of local) {
            const key = s.roomId.toLowerCase().trim();
            if (!ended.has(key) && !mergedMap.has(key)) {
              mergedMap.set(key, s);
            }
          }

          const finalList = Array.from(mergedMap.values());
          this.saveStoredActiveSessions(finalList);
          return finalList;
        }
      }
    } catch (e) {
      console.warn('Unable to refresh sessions from server:', e);
    }
    return this.getStoredActiveSessions();
  }

  /**
   * Subscribes to real-time changes in active sessions store
   */
  public subscribe(callback: (sessions: MajlisSession[]) => void): () => void {
    this.listeners.add(callback);
    callback(this.getStoredActiveSessions());
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners() {
    const active = this.getStoredActiveSessions();
    this.listeners.forEach((cb) => {
      try {
        cb(active);
      } catch (e) {}
    });
  }

  private broadcastUpdate(payload: any) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(payload);
      } catch (e) {}
    }
  }
}

export const activeSessionsStore = new ActiveSessionsStoreService();
