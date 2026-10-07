import { ChatMessage, Participant, ReactionItem } from '../types/meeting';
import { saveRoomTitleLocally, getRoomTitleLocally, getBackendWebSocketUrl, getBackendApiUrl } from '../utils/urlHelper';
import { FirebaseMeetingSync } from './firebaseMeetingSync';
import { activeSessionsStore } from './activeSessionsStore';
import { sessionSecurityStore } from './sessionSecurityStore';
import { UniversalSignalingTransport } from './universalSignaling';

export interface MeetingClientEvents {
  onRoomJoined: (data: {
    roomId: string;
    isHost: boolean;
    locked: boolean;
    isRecording: boolean;
    participants: Participant[];
    title?: string;
    hostName?: string;
    spotlightUserId?: string | null;
    chatEnabled?: boolean;
    screenShareEnabled?: boolean;
  }) => void;
  onRoomInfo?: (info: {
    title?: string;
    hostName?: string;
    locked?: boolean;
    isRecording?: boolean;
    spotlightUserId?: string | null;
    chatEnabled?: boolean;
    screenShareEnabled?: boolean;
  }) => void;
  onUserJoined: (user: Participant) => void;
  onUserLeft: (userId: string, name?: string) => void;
  onRemoteStream: (userId: string, stream: MediaStream) => void;
  onChatMessage: (message: ChatMessage) => void;
  onReaction: (reaction: ReactionItem) => void;
  onForceMute: () => void;
  onForceUnmute?: () => void;
  onForceStopVideo?: () => void;
  onForceStartVideo?: () => void;
  onKicked: (reason: string) => void;
  onLockChanged: (locked: boolean) => void;
  onRecordingNotice: (isRecording: boolean, recordedBy: string) => void;
  onSessionEnded?: (reason: string) => void;
  onSpotlightChanged?: (targetId: string | null) => void;
  onChatPermissionChanged?: (enabled: boolean) => void;
  onScreenSharePermissionChanged?: (enabled: boolean) => void;
  onHandsLowered?: () => void;
  onPromotedToHost?: (message: string) => void;
  onCoModeratorStatusChanged?: (isCoModerator: boolean, assignedBy?: string) => void;
  onAnnouncement?: (text: string, senderName?: string) => void;
  onSpeakerStatusChanged?: (userId: string, isSpeaker: boolean) => void;
  onUserStatusChanged: (data: {
    userId: string;
    isHost?: boolean;
    isMuted?: boolean;
    isVideoOff?: boolean;
    isScreenSharing?: boolean;
    handRaised?: boolean;
    isCoModerator?: boolean;
    isSpeaker?: boolean;
  }) => void;
  onError: (message: string) => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

export class MeetingClient {
  private ws: WebSocket | null = null;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  private remoteStreams = new Map<string, MediaStream>();
  private queuedCandidates = new Map<string, RTCIceCandidateInit[]>();
  private localStream: MediaStream | null = null;
  private events: MeetingClientEvents;
  private isClosed = false;
  private isLocked = false;
  private pingInterval: number | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private firebaseSync: FirebaseMeetingSync | null = null;
  private knownParticipants = new Map<string, Participant>();
  private universalTransport: UniversalSignalingTransport | null = null;

  public roomId: string = '';
  public userId: string = '';
  public userName: string = '';
  public isHost: boolean = false;
  public isCoModerator: boolean = false;
  public sessionTitle: string = '';

  constructor(events: MeetingClientEvents) {
    this.events = events;
  }

  public connect(
    roomId: string,
    userId: string,
    userName: string,
    isHost: boolean,
    localStream: MediaStream | null,
    title?: string
  ) {
    this.leave(); // Clean up any previous session

    this.roomId = roomId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || 'majlis-main';
    this.userId = userId;
    this.userName = userName || 'Member';
    this.isHost = isHost;
    this.localStream = localStream;
    this.isClosed = false;

    // Resolve initial title
    const localTitle = getRoomTitleLocally(this.roomId);
    this.sessionTitle = (title && !title.startsWith('Majlis (')) ? title : (localTitle || title || 'Live Majlis');

    if (this.sessionTitle && !this.sessionTitle.startsWith('Majlis (')) {
      saveRoomTitleLocally(this.roomId, this.sessionTitle);
    }

    // Save/secure session in dedicated sessionSecurityStore & activeSessionsStore
    activeSessionsStore.saveSession({
      roomId: this.roomId,
      title: this.sessionTitle,
      hostName: this.isHost ? this.userName : 'Facilitator',
    });

    sessionSecurityStore.saveSecuredMeeting({
      roomId: this.roomId,
      title: this.sessionTitle,
      userName: this.userName,
      userId: this.userId,
      isHost: this.isHost,
      isCoModerator: this.isCoModerator,
      isMuted: !this.localStream?.getAudioTracks().some((t) => t.enabled),
      isVideoOff: !this.localStream?.getVideoTracks().some((t) => t.enabled),
    });

    // Initialize universal multi-peer signaling (works across Vercel, external networks, and Node WS)
    try {
      this.universalTransport = new UniversalSignalingTransport(
        this.roomId,
        this.userId,
        (msg) => {
          this.handleServerMessage(msg);
        }
      );
    } catch (e) {
      console.warn('Universal signaling init error:', e);
    }

    // 1. Initialize Firebase Cloud Sync
    try {
      this.firebaseSync = new FirebaseMeetingSync(this.roomId, this.userId);

      // Register / update room in Firebase Firestore ONLY IF THIS USER IS HOST
      if (this.isHost) {
        this.firebaseSync.setRoom({
          title: this.sessionTitle,
          hostName: this.userName,
          hostId: this.userId,
        });
      }

      // Register participant presence in Firestore
      this.firebaseSync.setParticipant({
        id: this.userId,
        name: this.userName,
        isHost: this.isHost,
        isCoModerator: this.isCoModerator,
        isMuted: !this.localStream?.getAudioTracks().some((t) => t.enabled),
        isVideoOff: !this.localStream?.getVideoTracks().some((t) => t.enabled),
      });

      // Listen to room metadata changes from Firebase
      this.firebaseSync.subscribeToRoom((roomData) => {
        if (!roomData) return;
        // Only trigger session ended if explicitly concluded by host with ended === true
        if (roomData.ended === true) {
          if (!this.isHost && this.events.onSessionEnded) {
            this.events.onSessionEnded('The facilitator has concluded this Majlis session.');
          }
          return;
        }

        if (roomData.title && !roomData.title.startsWith('Majlis (')) {
          this.sessionTitle = roomData.title;
          saveRoomTitleLocally(this.roomId, roomData.title);
        }
        if (roomData.spotlightUserId !== undefined) {
          this.events.onSpotlightChanged?.(roomData.spotlightUserId || null);
        }
        if (roomData.chatEnabled !== undefined) {
          this.events.onChatPermissionChanged?.(roomData.chatEnabled);
        }
        if (roomData.screenShareEnabled !== undefined) {
          this.events.onScreenSharePermissionChanged?.(roomData.screenShareEnabled);
        }
        if (roomData.locked !== undefined) {
          this.isLocked = !!roomData.locked;
          this.events.onLockChanged(this.isLocked);
        }
        if (roomData.hostId) {
          if (roomData.hostId === this.userId && !this.isHost) {
            this.isHost = true;
            this.events.onPromotedToHost?.('You are now the facilitator.');
          }
        }
        if (roomData.announcement?.text) {
          this.events.onAnnouncement?.(roomData.announcement.text, roomData.announcement.senderName);
        }
        this.events.onRoomInfo?.({
          title: roomData.title,
          hostName: roomData.hostName,
          locked: roomData.locked,
          isRecording: roomData.isRecording,
          spotlightUserId: roomData.spotlightUserId || null,
          chatEnabled: roomData.chatEnabled,
          screenShareEnabled: roomData.screenShareEnabled,
        });
      });

      // Listen to participants from Firebase
      this.firebaseSync.subscribeToParticipants((participants) => {
        if (!participants) return;
        const remoteParticipants = participants.filter((p) => p.id !== this.userId);
        const currentRemoteIds = new Set(remoteParticipants.map((p) => p.id));

        // Detect participants who left (in knownParticipants but missing from snapshot)
        for (const knownId of this.knownParticipants.keys()) {
          if (!currentRemoteIds.has(knownId)) {
            this.knownParticipants.delete(knownId);
            this.closePeerConnection(knownId);
            this.events.onUserLeft(knownId);
          }
        }

        // Add or update active participants in real-time
        for (const p of remoteParticipants) {
          const isNew = !this.knownParticipants.has(p.id);
          this.knownParticipants.set(p.id, p);

          if (isNew) {
            this.events.onUserJoined(p);
          } else {
            this.events.onUserStatusChanged({
              userId: p.id,
              isHost: p.isHost,
              isCoModerator: p.isCoModerator,
              isSpeaker: p.isSpeaker,
              isMuted: p.isMuted,
              isVideoOff: p.isVideoOff,
              isScreenSharing: p.isScreenSharing,
              handRaised: p.handRaised,
            });
          }

          // Deterministic WebRTC connection: higher ID initiates connection
          if (!this.peerConnections.has(p.id)) {
            const isInitiator = this.userId > p.id;
            this.createPeerConnection(p.id, isInitiator);
          }
        }

        // Check if our own participant record in Firestore changed (e.g. muted by mod, assigned co-mod)
        const localDoc = participants.find((p) => p.id === this.userId);
        if (localDoc) {
          if (localDoc.isMuted && this.localStream?.getAudioTracks().some((t) => t.enabled)) {
            this.events.onForceMute();
          }
          if (localDoc.isVideoOff && this.localStream?.getVideoTracks().some((t) => t.enabled)) {
            this.events.onForceStopVideo?.();
          }
          if (localDoc.isCoModerator !== undefined && localDoc.isCoModerator !== this.isCoModerator) {
            this.isCoModerator = !!localDoc.isCoModerator;
            this.events.onCoModeratorStatusChanged?.(this.isCoModerator);
          }
          if (localDoc.isHost && !this.isHost) {
            this.isHost = true;
            this.events.onPromotedToHost?.('You are now the facilitator.');
          }
          if (localDoc.isSpeaker !== undefined) {
            this.events.onSpeakerStatusChanged?.(this.userId, !!localDoc.isSpeaker);
          }
        }
      });

      // Listen to WebRTC signals via Firebase
      this.firebaseSync.subscribeToSignals(async (senderId, signalData) => {
        await this.handleSignalingData(senderId, signalData);
      });

      // Listen to in-room chat messages via Firebase
      this.firebaseSync.subscribeToChatMessages((msg) => {
        this.events.onChatMessage(msg);
      });

      // Listen to reactions via Firebase
      this.firebaseSync.subscribeToReactions((react) => {
        if (react.senderId !== this.userId) {
          this.events.onReaction(react);
        }
      });

      // Listen to kick notices via Firebase
      this.firebaseSync.subscribeToKicked(() => {
        this.events.onKicked('You have been removed from the meeting by the moderator.');
        this.leave();
      });
    } catch (e) {
      console.warn('Firebase sync initialization warning:', e);
    }

    // 2. Set up BroadcastChannel for instant cross-tab synchronization
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(`infinitymeet_room_${this.roomId}`);
        this.broadcastChannel.onmessage = async (e) => {
          if (!e.data || e.data._senderId === this.userId) return;

          const msg = e.data;
          if (msg.type === 'join' || msg.type === 'announce-presence') {
            const participant: Participant = {
              id: msg.userId,
              name: msg.userName,
              isHost: !!msg.isHost,
              isCoModerator: !!msg.isCoModerator,
              isSpeaker: !!msg.isSpeaker,
              isLocal: false,
              isMuted: !!msg.isMuted,
              isVideoOff: !!msg.isVideoOff,
              isScreenSharing: false,
              handRaised: false,
            };

            const isNew = !this.knownParticipants.has(msg.userId);
            this.knownParticipants.set(msg.userId, participant);
            if (isNew) {
              this.events.onUserJoined(participant);
            }

            if (msg.type === 'join') {
              this.broadcastChannel?.postMessage({
                type: 'announce-presence',
                _senderId: this.userId,
                userId: this.userId,
                userName: this.userName,
                isHost: this.isHost,
                isCoModerator: this.isCoModerator,
                title: this.sessionTitle,
                isMuted: !this.localStream?.getAudioTracks().some((t) => t.enabled),
                isVideoOff: !this.localStream?.getVideoTracks().some((t) => t.enabled),
              });
            }

            if (msg.title) {
              this.sessionTitle = msg.title;
              this.events.onRoomInfo?.({ title: msg.title });
            }

            if (!this.peerConnections.has(msg.userId)) {
              const isInitiator = this.userId > msg.userId;
              await this.createPeerConnection(msg.userId, isInitiator);
            }
            return;
          }

          if (msg.type === 'signal') {
            if (msg.targetId === this.userId && msg.signalData) {
              await this.handleSignalingData(msg.senderId, msg.signalData);
            }
            return;
          }

          await this.handleIncomingControlMessage(msg);
        };

        this.broadcastChannel.postMessage({
          type: 'join',
          _senderId: this.userId,
          roomId: this.roomId,
          userId: this.userId,
          userName: this.userName,
          isHost: this.isHost,
          isCoModerator: this.isCoModerator,
          title: this.sessionTitle,
          isMuted: !this.localStream?.getAudioTracks().some((t) => t.enabled),
          isVideoOff: !this.localStream?.getVideoTracks().some((t) => t.enabled),
        });
      } catch (e) {
        // ignore
      }
    }

    // 3. Local WebSocket Server Connection
    this.initWebSocket();
  }

  private initWebSocket() {
    if (this.isClosed) return;
    const wsUrl = getBackendWebSocketUrl();

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (this.isClosed || !this.ws) return;

        this.sendWsMessage({
          type: 'join',
          roomId: this.roomId,
          userId: this.userId,
          userName: this.userName,
          isHost: this.isHost,
          title: this.sessionTitle || (this.isHost ? `${this.userName}'s Majlis` : 'Live Majlis'),
          isMuted: !this.localStream?.getAudioTracks().some((t) => t.enabled),
          isVideoOff: !this.localStream?.getVideoTracks().some((t) => t.enabled),
        });

        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = window.setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 15000);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleServerMessage(data);
        } catch (e) {
          console.warn('Failed to parse websocket message:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket status:', err);
      };

      this.ws.onclose = () => {
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }
        if (!this.isClosed) {
          console.log('WebSocket connection closed. Reconnecting in 2s...');
          setTimeout(() => {
            if (!this.isClosed) {
              this.initWebSocket();
            }
          }, 2000);
        }
      };
    } catch (err) {
      console.warn('WebSocket connection warning:', err);
    }
  }

  private sendWsMessage(msg: any) {
    const payload = {
      ...msg,
      _senderId: this.userId,
    };

    if (this.universalTransport) {
      try {
        this.universalTransport.send(payload);
      } catch (e) {}
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
      } catch (e) {}
    }

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(payload);
      } catch (e) {
        // ignore
      }
    }
  }

  private async handleServerMessage(message: any) {
    if (!message || !message.type) return;

    switch (message.type) {
      case 'room-joined': {
        this.roomId = message.roomId;
        this.userId = message.userId;
        this.isHost = !!message.isHost;
        this.isCoModerator = !!message.isCoModerator;
        this.isLocked = !!message.locked;

        if (message.title && !message.title.startsWith('Majlis (')) {
          this.sessionTitle = message.title;
          saveRoomTitleLocally(this.roomId, message.title);
        }

        const remoteParticipants: Participant[] = (message.participants || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          isHost: !!p.isHost,
          isCoModerator: !!p.isCoModerator,
          isSpeaker: !!p.isSpeaker,
          isLocal: false,
          isMuted: p.isMuted,
          isVideoOff: p.isVideoOff,
          isScreenSharing: p.isScreenSharing,
          handRaised: p.handRaised,
        }));

        this.events.onRoomJoined({
          roomId: this.roomId,
          isHost: this.isHost,
          locked: this.isLocked,
          isRecording: message.isRecording || false,
          participants: remoteParticipants,
          title: this.sessionTitle || message.title,
          hostName: message.hostName,
          spotlightUserId: message.spotlightUserId,
          chatEnabled: message.chatEnabled,
          screenShareEnabled: message.screenShareEnabled,
        });

        if (message.title) {
          this.events.onRoomInfo?.({
            title: message.title,
            hostName: message.hostName,
            locked: this.isLocked,
            isRecording: message.isRecording,
            spotlightUserId: message.spotlightUserId,
            chatEnabled: message.chatEnabled,
            screenShareEnabled: message.screenShareEnabled,
          });
        }

        for (const p of remoteParticipants) {
          this.knownParticipants.set(p.id, p);
          const isInitiator = this.userId > p.id;
          await this.createPeerConnection(p.id, isInitiator);
        }
        break;
      }

      case 'signal': {
        const { senderId, signalData } = message;
        if (!senderId || senderId === this.userId || !signalData) return;
        await this.handleSignalingData(senderId, signalData);
        break;
      }

      default: {
        await this.handleIncomingControlMessage(message);
        break;
      }
    }
  }

  private async handleIncomingControlMessage(msg: any) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'sync-room-title':
      case 'room-info-update': {
        if (msg.title && !msg.title.startsWith('Majlis (')) {
          this.sessionTitle = msg.title;
          saveRoomTitleLocally(this.roomId, msg.title);
        }
        this.events.onRoomInfo?.({
          title: msg.title,
          hostName: msg.hostName,
          locked: msg.locked,
          isRecording: msg.isRecording,
          spotlightUserId: msg.spotlightUserId,
          chatEnabled: msg.chatEnabled,
          screenShareEnabled: msg.screenShareEnabled,
        });
        break;
      }

      case 'user-joined': {
        const user = msg.user || msg;
        if (!user || !user.id || user.id === this.userId) return;

        const participant: Participant = {
          id: user.id,
          name: user.name || user.userName || 'Attendee',
          isHost: !!user.isHost,
          isCoModerator: !!user.isCoModerator,
          isSpeaker: !!user.isSpeaker,
          isLocal: false,
          isMuted: !!user.isMuted,
          isVideoOff: !!user.isVideoOff,
          isScreenSharing: !!user.isScreenSharing,
          handRaised: !!user.handRaised,
        };

        const isNew = !this.knownParticipants.has(user.id);
        this.knownParticipants.set(user.id, participant);
        if (isNew) {
          this.events.onUserJoined(participant);
        }

        if (!this.peerConnections.has(user.id)) {
          const isInitiator = this.userId > user.id;
          await this.createPeerConnection(user.id, isInitiator);
        }
        break;
      }

      case 'comoderator-status-changed':
      case 'host-toggle-comoderator': {
        const targetId = msg.targetId || msg.userId;
        const isCoMod = !!msg.isCoModerator;
        if (targetId === this.userId) {
          this.isCoModerator = isCoMod;
          this.events.onCoModeratorStatusChanged?.(isCoMod, msg.assignedBy);
        }
        if (targetId) {
          const p = this.knownParticipants.get(targetId);
          if (p) p.isCoModerator = isCoMod;
          this.events.onUserStatusChanged({
            userId: targetId,
            isCoModerator: isCoMod,
          });
        }
        break;
      }

      case 'user-left': {
        const leftId = msg.userId || msg.targetId;
        if (!leftId || leftId === this.userId) return;

        this.knownParticipants.delete(leftId);
        this.closePeerConnection(leftId);
        this.events.onUserLeft(leftId, msg.name);
        break;
      }

      case 'spotlight-changed':
      case 'host-spotlight': {
        const targetId = msg.targetId || null;
        this.events.onSpotlightChanged?.(targetId);
        break;
      }

      case 'chat-permission-changed':
      case 'host-toggle-chat': {
        this.events.onChatPermissionChanged?.(!!msg.enabled);
        break;
      }

      case 'screenshare-permission-changed':
      case 'host-toggle-screenshare': {
        this.events.onScreenSharePermissionChanged?.(!!msg.enabled);
        break;
      }

      case 'hands-lowered':
      case 'host-lower-all-hands': {
        for (const p of this.knownParticipants.values()) {
          p.handRaised = false;
        }
        this.events.onHandsLowered?.();
        break;
      }

      case 'host-lower-hand': {
        if (msg.targetId) {
          const p = this.knownParticipants.get(msg.targetId);
          if (p) p.handRaised = false;
          this.events.onUserStatusChanged({
            userId: msg.targetId,
            handRaised: false,
          });
        }
        break;
      }

      case 'promoted-to-host': {
        this.isHost = true;
        this.events.onPromotedToHost?.(msg.message || 'You are now the facilitator.');
        this.events.onUserStatusChanged({
          userId: this.userId,
          isHost: true,
        });
        break;
      }

      case 'new-host': {
        if (msg.hostId === this.userId) {
          this.isHost = true;
        } else if (this.isHost) {
          this.isHost = false;
        }
        if (msg.hostId) {
          for (const [pId, p] of this.knownParticipants.entries()) {
            p.isHost = (pId === msg.hostId);
          }
          this.events.onUserStatusChanged({
            userId: msg.hostId,
            isHost: true,
          });
        }
        break;
      }

      case 'host-transfer': {
        if (msg.targetId === this.userId) {
          this.isHost = true;
          this.events.onPromotedToHost?.(msg.message || 'You have been appointed as the facilitator.');
        } else if (this.isHost) {
          this.isHost = false;
        }
        if (msg.targetId) {
          for (const [pId, p] of this.knownParticipants.entries()) {
            p.isHost = (pId === msg.targetId);
          }
          this.events.onUserStatusChanged({
            userId: msg.targetId,
            isHost: true,
          });
        }
        break;
      }

      case 'host-mute-all': {
        if (!this.isHost) {
          this.events.onForceMute();
        }
        break;
      }

      case 'host-stop-all-video': {
        if (!this.isHost) {
          this.events.onForceStopVideo?.();
        }
        for (const p of this.knownParticipants.values()) {
          p.isVideoOff = true;
        }
        break;
      }

      case 'host-stop-video':
      case 'force-stop-video': {
        if (msg.targetId === this.userId || !msg.targetId) {
          this.events.onForceStopVideo?.();
        }
        if (msg.targetId) {
          const p = this.knownParticipants.get(msg.targetId);
          if (p) p.isVideoOff = true;
          this.events.onUserStatusChanged({
            userId: msg.targetId,
            isVideoOff: true,
          });
        }
        break;
      }

      case 'host-start-video':
      case 'force-start-video': {
        if (msg.targetId === this.userId || !msg.targetId) {
          this.events.onForceStartVideo?.();
        }
        if (msg.targetId) {
          const p = this.knownParticipants.get(msg.targetId);
          if (p) p.isVideoOff = false;
          this.events.onUserStatusChanged({
            userId: msg.targetId,
            isVideoOff: false,
          });
        }
        break;
      }

      case 'host-mute-user':
      case 'force-mute': {
        if (msg.targetId === this.userId || !msg.targetId) {
          this.events.onForceMute();
        }
        if (msg.targetId) {
          const p = this.knownParticipants.get(msg.targetId);
          if (p) p.isMuted = true;
          this.events.onUserStatusChanged({
            userId: msg.targetId,
            isMuted: true,
          });
        }
        break;
      }

      case 'host-unmute-user':
      case 'force-unmute': {
        if (msg.targetId === this.userId || !msg.targetId) {
          this.events.onForceUnmute?.();
        }
        if (msg.targetId) {
          const p = this.knownParticipants.get(msg.targetId);
          if (p) p.isMuted = false;
          this.events.onUserStatusChanged({
            userId: msg.targetId,
            isMuted: false,
          });
        }
        break;
      }

      case 'system-announcement':
      case 'host-announcement': {
        this.events.onAnnouncement?.(msg.text, msg.senderName);
        break;
      }

      case 'chat': {
        if (msg.message) {
          this.events.onChatMessage(msg.message);
        }
        break;
      }

      case 'reaction': {
        if (msg.senderId !== this.userId) {
          this.events.onReaction({
            id: msg.id,
            senderId: msg.senderId,
            senderName: msg.senderName,
            emoji: msg.emoji,
          });
        }
        break;
      }

      case 'speaker-status-changed':
      case 'host-toggle-speaker': {
        const targetId = msg.targetId || msg.userId;
        const isSpeaker = !!msg.isSpeaker;
        if (targetId) {
          const p = this.knownParticipants.get(targetId);
          if (p) p.isSpeaker = isSpeaker;
          this.events.onSpeakerStatusChanged?.(targetId, isSpeaker);
          this.events.onUserStatusChanged({
            userId: targetId,
            isSpeaker,
          });
        }
        break;
      }

      case 'user-status-changed':
      case 'status-update': {
        const uId = msg.userId || msg.targetId;
        if (uId) {
          const p = this.knownParticipants.get(uId);
          if (p) {
            if (msg.isMuted !== undefined) p.isMuted = msg.isMuted;
            if (msg.isVideoOff !== undefined) p.isVideoOff = msg.isVideoOff;
            if (msg.isScreenSharing !== undefined) p.isScreenSharing = msg.isScreenSharing;
            if (msg.handRaised !== undefined) p.handRaised = msg.handRaised;
            if (msg.isHost !== undefined) p.isHost = msg.isHost;
            if (msg.isCoModerator !== undefined) p.isCoModerator = msg.isCoModerator;
            if (msg.isSpeaker !== undefined) p.isSpeaker = msg.isSpeaker;
          }
          this.events.onUserStatusChanged({
            userId: uId,
            isHost: msg.isHost,
            isMuted: msg.isMuted,
            isVideoOff: msg.isVideoOff,
            isScreenSharing: msg.isScreenSharing,
            handRaised: msg.handRaised,
            isCoModerator: msg.isCoModerator,
            isSpeaker: msg.isSpeaker,
          });
        }
        break;
      }

      case 'host-kick':
      case 'kicked': {
        const kickedId = msg.targetId || msg.userId;
        if (kickedId === this.userId) {
          this.events.onKicked(msg.message || 'You were removed from the room.');
          this.leave();
        } else if (kickedId) {
          this.knownParticipants.delete(kickedId);
          this.closePeerConnection(kickedId);
          this.events.onUserLeft(kickedId, msg.name);
        }
        break;
      }

      case 'room-lock-changed':
      case 'host-toggle-lock': {
        this.isLocked = !!msg.locked;
        this.events.onLockChanged(this.isLocked);
        break;
      }

      case 'recording-notice': {
        this.events.onRecordingNotice(!!msg.isRecording, msg.recordedBy || 'Facilitator');
        break;
      }

      case 'session-ended':
      case 'host-end-session': {
        if (this.events.onSessionEnded) {
          this.events.onSessionEnded(msg.message || 'The facilitator has concluded this Majlis session.');
        }
        this.leave();
        break;
      }

      case 'error': {
        this.events.onError(msg.message || 'An error occurred.');
        break;
      }
    }
  }

  private setupDataChannel(peerId: string, dc: RTCDataChannel) {
    this.dataChannels.set(peerId, dc);

    dc.onopen = () => {
      if (this.sessionTitle && !this.sessionTitle.startsWith('Majlis (')) {
        try {
          dc.send(JSON.stringify({
            type: 'sync-room-title',
            title: this.sessionTitle,
            hostName: this.userName,
          }));
        } catch (e) {}
      }
    };

    dc.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        await this.handleIncomingControlMessage(data);
      } catch (err) {}
    };

    dc.onclose = () => {
      this.dataChannels.delete(peerId);
    };
  }

  private async createPeerConnection(peerId: string, isInitiator: boolean): Promise<RTCPeerConnection> {
    if (this.peerConnections.has(peerId)) {
      return this.peerConnections.get(peerId)!;
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peerConnections.set(peerId, pc);

    if (isInitiator) {
      try {
        const dc = pc.createDataChannel('infinitymeet_meta', { ordered: true });
        this.setupDataChannel(peerId, dc);
      } catch (e) {
        console.warn('Error creating data channel:', e);
      }
    } else {
      pc.ondatachannel = (event) => {
        this.setupDataChannel(peerId, event.channel);
      };
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, this.localStream!);
        } catch (e) {
          console.warn('Error adding track to peer connection:', e);
        }
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const signalData = { candidate: event.candidate };
        this.sendWsMessage({
          type: 'signal',
          senderId: this.userId,
          targetId: peerId,
          signalData,
        });
        this.firebaseSync?.sendSignal(peerId, signalData).catch(() => {});
      }
    };

    pc.ontrack = (event) => {
      let stream = this.remoteStreams.get(peerId);
      if (event.streams && event.streams[0]) {
        stream = event.streams[0];
        this.remoteStreams.set(peerId, stream);
      } else if (event.track) {
        if (!stream) {
          stream = new MediaStream();
          this.remoteStreams.set(peerId, stream);
        }
        if (!stream.getTracks().some((t) => t.id === event.track.id)) {
          stream.addTrack(event.track);
        }
      }
      if (stream) {
        this.events.onRemoteStream(peerId, stream);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        console.log(`Peer ${peerId} connection state: ${pc.connectionState}`);
      }
    };

    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const signalData = { sdp: pc.localDescription };
        this.sendWsMessage({
          type: 'signal',
          senderId: this.userId,
          targetId: peerId,
          signalData,
        });
        this.firebaseSync?.sendSignal(peerId, signalData).catch(() => {});
      } catch (err) {
        console.error('Error creating offer for peer:', peerId, err);
      }
    }

    return pc;
  }

  private async handleSignalingData(senderId: string, signalData: any) {
    if (signalData.sdp) {
      const sdp = new RTCSessionDescription(signalData.sdp);

      if (sdp.type === 'offer') {
        const pc = await this.createPeerConnection(senderId, false);
        await pc.setRemoteDescription(sdp);

        const queued = this.queuedCandidates.get(senderId) || [];
        for (const candidate of queued) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn('Error applying queued ICE candidate:', e);
          }
        }
        this.queuedCandidates.delete(senderId);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        const ansData = { sdp: pc.localDescription };
        this.sendWsMessage({
          type: 'signal',
          senderId: this.userId,
          targetId: senderId,
          signalData: ansData,
        });
        this.firebaseSync?.sendSignal(senderId, ansData).catch(() => {});
      } else if (sdp.type === 'answer') {
        const pc = this.peerConnections.get(senderId);
        if (pc) {
          await pc.setRemoteDescription(sdp);

          const queued = this.queuedCandidates.get(senderId) || [];
          for (const candidate of queued) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.warn('Error applying queued ICE candidate:', e);
            }
          }
          this.queuedCandidates.delete(senderId);
        }
      }
    } else if (signalData.candidate) {
      const pc = this.peerConnections.get(senderId);
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
        } catch (e) {
          console.warn('Error adding ICE candidate:', e);
        }
      } else {
        const queued = this.queuedCandidates.get(senderId) || [];
        queued.push(signalData.candidate);
        this.queuedCandidates.set(senderId, queued);
      }
    }
  }

  private async renegotiatePeer(peerId: string, pc: RTCPeerConnection) {
    if (pc.signalingState !== 'stable') return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const signalData = { sdp: pc.localDescription };
      this.sendWsMessage({
        type: 'signal',
        senderId: this.userId,
        targetId: peerId,
        signalData,
      });
      this.firebaseSync?.sendSignal(peerId, signalData).catch(() => {});
    } catch (err) {
      console.warn('Renegotiation error with peer:', peerId, err);
    }
  }

  public setLocalStream(newStream: MediaStream) {
    this.localStream = newStream;

    for (const [peerId, pc] of this.peerConnections.entries()) {
      const senders = pc.getSenders();
      let needsRenegotiation = false;

      const audioTrack = newStream.getAudioTracks()[0];
      const videoTrack = newStream.getVideoTracks()[0];

      if (audioTrack) {
        const audioSender = senders.find(
          (s) => (s.track && s.track.kind === 'audio') || ((s as any).kind === 'audio')
        );
        if (audioSender) {
          audioSender.replaceTrack(audioTrack).catch(console.warn);
        } else {
          try {
            pc.addTrack(audioTrack, newStream);
            needsRenegotiation = true;
          } catch (e) {}
        }
      }

      if (videoTrack) {
        const videoSender = senders.find(
          (s) => (s.track && s.track.kind === 'video') || ((s as any).kind === 'video')
        );
        if (videoSender) {
          videoSender.replaceTrack(videoTrack).catch(console.warn);
        } else {
          try {
            pc.addTrack(videoTrack, newStream);
            needsRenegotiation = true;
          } catch (e) {}
        }
      }

      if (needsRenegotiation) {
        this.renegotiatePeer(peerId, pc).catch(() => {});
      }
    }
  }

  public sendChatMessage(text: string) {
    if (!text.trim()) return;
    const message: ChatMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      senderId: this.userId,
      senderName: this.userName,
      isHost: this.isHost,
      text: text.trim(),
      timestamp: Date.now(),
    };

    this.sendWsMessage({
      type: 'chat',
      message,
    });
    this.firebaseSync?.sendChatMessage(message).catch(() => {});
  }

  public setHost(isHost: boolean) {
    this.isHost = isHost;
  }

  public sendReaction(emoji: string, existingId?: string) {
    const reaction: ReactionItem = {
      id: existingId || ('react_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
      senderId: this.userId,
      senderName: this.userName,
      emoji,
    };

    this.sendWsMessage({
      type: 'reaction',
      ...reaction,
    });
    this.firebaseSync?.sendReaction(reaction).catch(() => {});
  }

  public updateStatus(status: {
    isMuted?: boolean;
    isVideoOff?: boolean;
    isScreenSharing?: boolean;
    handRaised?: boolean;
  }) {
    this.sendWsMessage({
      type: 'status-update',
      userId: this.userId,
      ...status,
    });
    this.firebaseSync?.updateParticipantStatus(status).catch(() => {});
  }

  // Broadcast control message across WebSocket, direct DataChannels, and local BroadcastChannel
  private broadcastToAllChannels(payload: any) {
    this.sendWsMessage(payload);

    for (const dc of this.dataChannels.values()) {
      if (dc.readyState === 'open') {
        try {
          dc.send(JSON.stringify(payload));
        } catch (e) {}
      }
    }

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          ...payload,
          _senderId: this.userId,
        });
      } catch (e) {}
    }
  }

  // Facilitator & Moderator Controls
  public hostMuteAll() {
    this.broadcastToAllChannels({
      type: 'host-mute-all',
    });
    for (const pId of this.knownParticipants.keys()) {
      this.firebaseSync?.updateParticipantStatusForUser(pId, { isMuted: true }).catch(() => {});
    }
  }

  public hostMuteUser(targetId: string) {
    this.broadcastToAllChannels({
      type: 'host-mute-user',
      targetId,
    });
    this.firebaseSync?.updateParticipantStatusForUser(targetId, { isMuted: true }).catch(() => {});
  }

  public hostUnmuteUser(targetId: string) {
    this.broadcastToAllChannels({
      type: 'host-unmute-user',
      targetId,
    });
    this.firebaseSync?.updateParticipantStatusForUser(targetId, { isMuted: false }).catch(() => {});
  }

  public hostStopVideo(targetId: string) {
    this.broadcastToAllChannels({
      type: 'host-stop-video',
      targetId,
    });
    this.firebaseSync?.updateParticipantStatusForUser(targetId, { isVideoOff: true }).catch(() => {});
  }

  public hostStartVideo(targetId: string) {
    this.broadcastToAllChannels({
      type: 'host-start-video',
      targetId,
    });
    this.firebaseSync?.updateParticipantStatusForUser(targetId, { isVideoOff: false }).catch(() => {});
  }

  public hostStopAllVideo() {
    this.broadcastToAllChannels({
      type: 'host-stop-all-video',
    });
    for (const pId of this.knownParticipants.keys()) {
      this.firebaseSync?.updateParticipantStatusForUser(pId, { isVideoOff: true }).catch(() => {});
    }
  }

  public hostLowerAllHands() {
    this.broadcastToAllChannels({
      type: 'host-lower-all-hands',
    });
    for (const pId of this.knownParticipants.keys()) {
      this.firebaseSync?.updateParticipantStatusForUser(pId, { handRaised: false }).catch(() => {});
    }
  }

  public hostLowerHand(targetId: string) {
    this.broadcastToAllChannels({
      type: 'host-lower-hand',
      targetId,
    });
    this.firebaseSync?.updateParticipantStatusForUser(targetId, { handRaised: false }).catch(() => {});
  }

  public hostSpotlight(targetId: string | null) {
    this.broadcastToAllChannels({
      type: 'host-spotlight',
      targetId: targetId || null,
    });
    this.firebaseSync?.setRoom({ spotlightUserId: targetId || null }).catch(() => {});
  }

  public hostSetChatPermission(enabled: boolean) {
    this.broadcastToAllChannels({
      type: 'host-toggle-chat',
      enabled,
    });
    this.firebaseSync?.setRoom({ chatEnabled: enabled }).catch(() => {});
  }

  public hostSetScreenSharePermission(enabled: boolean) {
    this.broadcastToAllChannels({
      type: 'host-toggle-screenshare',
      enabled,
    });
    this.firebaseSync?.setRoom({ screenShareEnabled: enabled }).catch(() => {});
  }

  public hostBroadcastAnnouncement(text: string) {
    this.broadcastToAllChannels({
      type: 'host-announcement',
      text,
      senderName: this.userName,
    });
    this.firebaseSync?.setRoom({
      announcement: { text, senderName: this.userName },
    }).catch(() => {});
  }

  public hostToggleCoModerator(targetId: string, isCoModerator: boolean) {
    this.broadcastToAllChannels({
      type: 'host-toggle-comoderator',
      targetId,
      isCoModerator,
      assignedBy: this.userName,
    });
    this.firebaseSync?.updateParticipantStatusForUser(targetId, { isCoModerator }).catch(() => {});
  }

  public hostTransfer(targetId: string) {
    const target = this.knownParticipants.get(targetId);
    this.broadcastToAllChannels({
      type: 'host-transfer',
      targetId,
      hostName: target?.name || 'Facilitator',
    });
    this.isHost = false;
    this.firebaseSync?.setRoom({
      hostId: targetId,
      hostName: target?.name || 'Facilitator',
    }).catch(() => {});
    this.firebaseSync?.updateParticipantStatusForUser(this.userId, { isHost: false }).catch(() => {});
    this.firebaseSync?.updateParticipantStatusForUser(targetId, { isHost: true }).catch(() => {});
  }

  public hostKickUser(targetId: string) {
    // 1. Broadcast kick to all channels
    this.broadcastToAllChannels({
      type: 'host-kick',
      targetId,
      message: 'You have been removed from the meeting by the moderator.',
    });

    // 2. Remove & mark kicked in Firebase Firestore so all attendees sync
    this.firebaseSync?.deleteParticipant(targetId).catch(() => {});
    this.firebaseSync?.markKicked(targetId).catch(() => {});

    // 3. Clean up locally
    this.knownParticipants.delete(targetId);
    this.closePeerConnection(targetId);
    this.events.onUserLeft(targetId);
  }

  public hostToggleSpeaker(targetId: string, isSpeaker: boolean) {
    this.broadcastToAllChannels({
      type: 'host-toggle-speaker',
      targetId,
      isSpeaker,
    });
    this.firebaseSync?.updateParticipantStatusForUser(targetId, { isSpeaker }).catch(() => {});
  }

  public hostToggleLock(forcedState?: boolean) {
    const nextLocked = forcedState !== undefined ? forcedState : !this.isLocked;
    this.isLocked = nextLocked;
    this.broadcastToAllChannels({
      type: 'host-toggle-lock',
      locked: nextLocked,
    });
    this.firebaseSync?.setRoom({
      title: this.sessionTitle,
      hostName: this.userName,
      hostId: this.userId,
      locked: nextLocked,
    }).catch(() => {});
  }

  public notifyRecording(isRecording: boolean) {
    this.broadcastToAllChannels({
      type: 'recording-notice',
      isRecording,
      recordedBy: this.userName || 'Facilitator',
    });
    this.firebaseSync?.setRoom({ isRecording }).catch(() => {});
  }

  public hostEndSession() {
    this.broadcastToAllChannels({
      type: 'host-end-session',
      roomId: this.roomId,
      message: 'The facilitator has concluded this Majlis session.',
    });
    // Remove from dedicated session security store and active sessions store
    sessionSecurityStore.endSecuredMeeting(this.roomId);
    activeSessionsStore.markSessionEnded(this.roomId);

    // Delete room and participants from Firestore so it disappears from Ongoing list immediately
    this.firebaseSync?.endRoomSession().catch(() => {});
    // Notify server to purge from active rooms
    fetch(getBackendApiUrl('/api/end-majlis'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: this.roomId }),
    }).catch(() => {});
  }

  private closePeerConnection(peerId: string) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      try {
        pc.close();
      } catch (e) {}
      this.peerConnections.delete(peerId);
    }

    const dc = this.dataChannels.get(peerId);
    if (dc) {
      try {
        dc.close();
      } catch (e) {}
      this.dataChannels.delete(peerId);
    }

    this.remoteStreams.delete(peerId);
  }

  public leave() {
    this.isClosed = true;

    // Remove our record from Firebase Firestore immediately
    if (this.firebaseSync) {
      try {
        this.firebaseSync.destroy();
      } catch (e) {}
      this.firebaseSync = null;
    }

    // Send leave message via WebSocket and BroadcastChannel
    this.sendWsMessage({
      type: 'leave',
      roomId: this.roomId,
      userId: this.userId,
      name: this.userName,
    });

    if (this.universalTransport) {
      try {
        this.universalTransport.close();
      } catch (e) {}
      this.universalTransport = null;
    }

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'user-left',
          _senderId: this.userId,
          userId: this.userId,
          name: this.userName,
        });
        this.broadcastChannel.close();
      } catch (e) {}
      this.broadcastChannel = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    for (const peerId of this.peerConnections.keys()) {
      this.closePeerConnection(peerId);
    }
    this.peerConnections.clear();
    this.dataChannels.clear();
    this.queuedCandidates.clear();
    this.knownParticipants.clear();

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
  }
}
