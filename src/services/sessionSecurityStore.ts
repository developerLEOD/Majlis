import { MajlisSession } from '../types/meeting';
import { getBackendApiUrl } from '../utils/urlHelper';

/**
 * Dedicated session security store for InfinityMeet / Majlis.
 * Secures a live session and all its parameters across page refreshes,
 * synchronizes with the ongoing circles list on the homepage,
 * and completely removes the session from storage when concluded.
 */

export interface SecuredSessionDetails {
  roomId: string;
  title: string;
  userName: string;
  userId: string;
  isHost: boolean;
  isCoModerator?: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  joinedAt: number;
  participantCount?: number;
  locked?: boolean;
  status: 'live';
}

const SECURED_SESSION_KEY = 'infinitymeet_secured_session_v3';
const SECURED_ENDED_KEY = 'infinitymeet_secured_ended_v3';
const ALL_ACTIVE_SESSIONS_KEY = 'infinitymeet_dedicated_active_sessions_v2';

class SessionSecurityStoreService {
  private broadcastChannel: BroadcastChannel | null = null;
  private listeners: Set<(sessions: MajlisSession[]) => void> = new Set();
  private remoteDiscoveredRooms = new Map<string, MajlisSession>();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('infinitymeet_security_bus_v3');
        this.broadcastChannel.onmessage = (event) => {
          const msg = event.data;
          if (!msg) return;

          if (msg.type === 'session_ended' && msg.roomId) {
            this.handleLocalSessionEnded(msg.roomId);
          } else if (msg.type === 'session_saved' || msg.type === 'sessions_updated') {
            this.notifyListeners();
          } else if (msg.type === 'announce_room' && msg.session) {
            this.remoteDiscoveredRooms.set(msg.session.roomId.toLowerCase(), msg.session);
            this.notifyListeners();
          }
        };
      } catch (e) {
        // ignore
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === SECURED_SESSION_KEY || e.key === SECURED_ENDED_KEY || e.key === ALL_ACTIVE_SESSIONS_KEY) {
          this.notifyListeners();
        }
      });
    }
  }

  /**
   * Retrieves any currently secured active meeting for the current browser/tab
   */
  public getSecuredActiveMeeting(): SecuredSessionDetails | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(SECURED_SESSION_KEY) || localStorage.getItem(SECURED_SESSION_KEY);
      if (!raw) return null;
      const parsed: SecuredSessionDetails = JSON.parse(raw);
      if (!parsed || !parsed.roomId) return null;

      // Check if this room has been marked ended
      if (this.isRoomEnded(parsed.roomId)) {
        this.clearSecuredMeetingOnly();
        return null;
      }

      // Check age (auto-expire after 6 hours if abandoned)
      if (parsed.joinedAt && Date.now() - parsed.joinedAt > 1000 * 60 * 60 * 6) {
        this.clearSecuredMeetingOnly();
        return null;
      }

      return parsed;
    } catch (e) {
      return null;
    }
  }

  /**
   * Secures a session and all its details in the dedicated store
   */
  public saveSecuredMeeting(details: {
    roomId: string;
    title: string;
    userName: string;
    userId: string;
    isHost: boolean;
    isCoModerator?: boolean;
    isMuted?: boolean;
    isVideoOff?: boolean;
    participantCount?: number;
    locked?: boolean;
  }): SecuredSessionDetails {
    const cleanId = String(details.roomId).trim().toLowerCase();

    // Remove from ended set if re-opened
    this.removeRoomFromEnded(cleanId);

    const secured: SecuredSessionDetails = {
      roomId: cleanId,
      title: details.title.trim() || `Majlis (${cleanId})`,
      userName: details.userName.trim() || 'Attendee',
      userId: details.userId,
      isHost: Boolean(details.isHost),
      isCoModerator: Boolean(details.isCoModerator),
      isMuted: Boolean(details.isMuted),
      isVideoOff: Boolean(details.isVideoOff),
      joinedAt: Date.now(),
      participantCount: Math.max(details.participantCount ?? 1, 1),
      locked: Boolean(details.locked),
      status: 'live',
    };

    if (typeof window !== 'undefined') {
      try {
        const str = JSON.stringify(secured);
        sessionStorage.setItem(SECURED_SESSION_KEY, str);
        localStorage.setItem(SECURED_SESSION_KEY, str);
      } catch (e) {
        // ignore
      }
    }

    // Also update all-active sessions list for Ongoing Circles on homepage
    this.upsertToActiveCirclesList(secured);

    // Sync with server dedicated active_sessions.json if backend available
    this.syncCreateWithServer(secured);

    // Broadcast across tabs
    this.broadcastMessage({ type: 'session_saved', roomId: cleanId, session: secured });
    this.notifyListeners();

    return secured;
  }

  /**
   * Completely ends the session: removes it from dedicated file, local store, and active list
   */
  public endSecuredMeeting(roomId: string) {
    if (!roomId) return;
    const cleanId = String(roomId).trim().toLowerCase();

    // 1. Mark as ended
    this.addRoomToEnded(cleanId);

    // 2. Remove secured session from storage
    this.clearSecuredMeetingOnly();

    // 3. Remove from active circles list
    this.removeFromActiveCirclesList(cleanId);
    this.remoteDiscoveredRooms.delete(cleanId);

    // 4. Notify backend server to remove from active_sessions.json
    this.syncEndWithServer(cleanId);

    // 5. Broadcast to other tabs & windows
    this.broadcastMessage({ type: 'session_ended', roomId: cleanId });
    this.notifyListeners();
  }

  /**
   * Clears the current tab's secured session without marking room ended globally
   */
  public clearSecuredMeetingOnly() {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(SECURED_SESSION_KEY);
        localStorage.removeItem(SECURED_SESSION_KEY);
      } catch (e) {}
    }
  }

  /**
   * Returns list of ongoing circles linked to the homepage
   */
  public getOngoingCircles(): MajlisSession[] {
    const ended = this.getEndedRoomIds();
    const map = new Map<string, MajlisSession>();

    // 1. Current user's secured session (if any)
    const current = this.getSecuredActiveMeeting();
    if (current && !ended.has(current.roomId)) {
      map.set(current.roomId, {
        id: `live_${current.roomId}`,
        roomId: current.roomId,
        title: current.title,
        hostName: current.isHost ? current.userName : 'Circle Moderator',
        scheduledAt: 'Happening Now',
        status: 'live',
        participantCount: current.participantCount || 1,
        startedAt: current.joinedAt,
        locked: current.locked,
      });
    }

    // 2. Dedicated active sessions stored in localStorage
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(ALL_ACTIVE_SESSIONS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const s of parsed) {
              if (s && s.roomId && !ended.has(s.roomId.toLowerCase().trim())) {
                const id = s.roomId.toLowerCase().trim();
                if (!map.has(id)) {
                  map.set(id, {
                    id: s.id || `live_${id}`,
                    roomId: id,
                    title: s.title || `Majlis (${id})`,
                    hostName: s.hostName || 'Circle Moderator',
                    scheduledAt: 'Happening Now',
                    status: 'live',
                    participantCount: Math.max(s.participantCount || 1, 1),
                    startedAt: s.startedAt || Date.now(),
                    locked: !!s.locked,
                  });
                }
              }
            }
          }
        }
      } catch (e) {}
    }

    // 3. Remote discovered rooms via lobby/peer
    for (const [id, s] of this.remoteDiscoveredRooms.entries()) {
      if (!ended.has(id) && !map.has(id)) {
        map.set(id, s);
      }
    }

    return Array.from(map.values());
  }

  /**
   * Subscribes to changes in ongoing circles
   */
  public subscribe(callback: (sessions: MajlisSession[]) => void): () => void {
    this.listeners.add(callback);
    callback(this.getOngoingCircles());
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Refreshes active list from server's dedicated active_sessions.json (if available)
   */
  public async refreshFromServer(): Promise<MajlisSession[]> {
    try {
      const url = getBackendApiUrl('/api/active-majalis');
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.activeMajalis)) {
          const ended = this.getEndedRoomIds();
          const serverRooms: MajlisSession[] = data.activeMajalis
            .filter((s: any) => s && s.roomId && !ended.has(String(s.roomId).toLowerCase().trim()))
            .map((s: any) => {
              const cleanId = String(s.roomId).toLowerCase().trim();
              return {
                id: s.id || `live_${cleanId}`,
                roomId: cleanId,
                title: s.title || `Majlis (${cleanId})`,
                hostName: s.hostName || 'Circle Moderator',
                scheduledAt: 'Happening Now',
                status: 'live' as const,
                participantCount: Math.max(s.participantCount || 1, 1),
                startedAt: s.startedAt || Date.now(),
                locked: !!s.locked,
              };
            });

          // Save to local list
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(ALL_ACTIVE_SESSIONS_KEY, JSON.stringify(serverRooms));
            } catch (e) {}
          }
          this.notifyListeners();
          return this.getOngoingCircles();
        }
      }
    } catch (e) {
      // Backend not running (e.g. static host); fallback to client store seamlessly
    }
    return this.getOngoingCircles();
  }

  private upsertToActiveCirclesList(session: SecuredSessionDetails) {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getOngoingCircles();
      const existingIdx = current.findIndex((s) => s.roomId.toLowerCase() === session.roomId.toLowerCase());
      const item: MajlisSession = {
        id: `live_${session.roomId}`,
        roomId: session.roomId,
        title: session.title,
        hostName: session.isHost ? session.userName : 'Circle Moderator',
        scheduledAt: 'Happening Now',
        status: 'live',
        participantCount: Math.max(session.participantCount || 1, 1),
        startedAt: session.joinedAt,
        locked: !!session.locked,
      };

      if (existingIdx >= 0) {
        current[existingIdx] = item;
      } else {
        current.unshift(item);
      }
      localStorage.setItem(ALL_ACTIVE_SESSIONS_KEY, JSON.stringify(current));
    } catch (e) {}
  }

  private removeFromActiveCirclesList(cleanRoomId: string) {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getOngoingCircles().filter(
        (s) => s.roomId.toLowerCase().trim() !== cleanRoomId.toLowerCase().trim()
      );
      localStorage.setItem(ALL_ACTIVE_SESSIONS_KEY, JSON.stringify(current));
    } catch (e) {}
  }

  private getEndedRoomIds(): Set<string> {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(SECURED_ENDED_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          return new Set(arr.map((id) => String(id).toLowerCase().trim()));
        }
      }
    } catch (e) {}
    return new Set();
  }

  private addRoomToEnded(cleanId: string) {
    if (typeof window === 'undefined') return;
    const ended = this.getEndedRoomIds();
    ended.add(cleanId);
    try {
      localStorage.setItem(SECURED_ENDED_KEY, JSON.stringify(Array.from(ended)));
    } catch (e) {}
  }

  private removeRoomFromEnded(cleanId: string) {
    if (typeof window === 'undefined') return;
    const ended = this.getEndedRoomIds();
    if (ended.has(cleanId)) {
      ended.delete(cleanId);
      try {
        localStorage.setItem(SECURED_ENDED_KEY, JSON.stringify(Array.from(ended)));
      } catch (e) {}
    }
  }

  private isRoomEnded(cleanId: string): boolean {
    return this.getEndedRoomIds().has(cleanId.toLowerCase().trim());
  }

  private handleLocalSessionEnded(roomId: string) {
    const current = this.getSecuredActiveMeeting();
    if (current && current.roomId.toLowerCase() === roomId.toLowerCase()) {
      this.clearSecuredMeetingOnly();
    }
    this.removeFromActiveCirclesList(roomId.toLowerCase());
    this.remoteDiscoveredRooms.delete(roomId.toLowerCase());
    this.notifyListeners();
  }

  private notifyListeners() {
    const list = this.getOngoingCircles();
    this.listeners.forEach((cb) => {
      try {
        cb(list);
      } catch (e) {}
    });
  }

  private broadcastMessage(payload: any) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(payload);
      } catch (e) {}
    }
  }

  private syncCreateWithServer(session: SecuredSessionDetails) {
    fetch(getBackendApiUrl('/api/create-majlis'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: session.roomId,
        title: session.title,
        hostName: session.userName,
      }),
    }).catch(() => {});
  }

  private syncEndWithServer(cleanId: string) {
    fetch(getBackendApiUrl('/api/end-majlis'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: cleanId }),
    }).catch(() => {});
  }
}

export const sessionSecurityStore = new SessionSecurityStoreService();
