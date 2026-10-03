import { ChatMessage, Participant, ReactionItem } from '../types/meeting';
import { saveRoomTitleLocally, getRoomTitleLocally } from '../utils/urlHelper';
import { FirebaseMeetingSync } from './firebaseMeetingSync';

export interface MeetingClientEvents {
  onRoomJoined: (data: {
    roomId: string;
    isHost: boolean;
    locked: boolean;
    isRecording: boolean;
    participants: Participant[];
    title?: string;
    hostName?: string;
  }) => void;
  onRoomInfo?: (info: {
    title?: string;
    hostName?: string;
    locked?: boolean;
    isRecording?: boolean;
  }) => void;
  onUserJoined: (user: Participant) => void;
  onUserLeft: (userId: string, name?: string) => void;
  onRemoteStream: (userId: string, stream: MediaStream) => void;
  onChatMessage: (message: ChatMessage) => void;
  onReaction: (reaction: ReactionItem) => void;
  onForceMute: () => void;
  onKicked: (reason: string) => void;
  onLockChanged: (locked: boolean) => void;
  onRecordingNotice: (isRecording: boolean, recordedBy: string) => void;
  onSessionEnded?: (reason: string) => void;
  onSpotlightChanged?: (targetId: string | null) => void;
  onChatPermissionChanged?: (enabled: boolean) => void;
  onScreenSharePermissionChanged?: (enabled: boolean) => void;
  onHandsLowered?: () => void;
  onPromotedToHost?: (message: string) => void;
  onAnnouncement?: (text: string, senderName?: string) => void;
  onUserStatusChanged: (data: {
    userId: string;
    isMuted?: boolean;
    isVideoOff?: boolean;
    isScreenSharing?: boolean;
    handRaised?: boolean;
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
  private queuedCandidates = new Map<string, RTCIceCandidateInit[]>();
  private localStream: MediaStream | null = null;
  private events: MeetingClientEvents;
  private isClosed = false;
  private isLocked = false;
  private pingInterval: number | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private firebaseSync: FirebaseMeetingSync | null = null;
  private knownParticipants = new Map<string, Participant>();

  public roomId: string = '';
  public userId: string = '';
  public userName: string = '';
  public isHost: boolean = false;
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

    // 1. Initialize Firebase Cloud Sync
    try {
      this.firebaseSync = new FirebaseMeetingSync(this.roomId, this.userId);

      // Register / update room in Firebase Firestore
      this.firebaseSync.setRoom({
        title: this.sessionTitle,
        hostName: this.userName,
        hostId: this.userId,
      });

      // Register participant presence in Firestore
      this.firebaseSync.setParticipant({
        id: this.userId,
        name: this.userName,
        isHost: this.isHost,
        isMuted: !this.localStream?.getAudioTracks().some((t) => t.enabled),
        isVideoOff: !this.localStream?.getVideoTracks().some((t) => t.enabled),
      });

      // Listen to room metadata changes from Firebase
      this.firebaseSync.subscribeToRoom((roomData) => {
        if (!roomData || roomData.ended) {
          if (!this.isHost && this.events.onSessionEnded) {
            this.events.onSessionEnded('The facilitator has concluded this Majlis session.');
          }
          return;
        }

        if (roomData.title && !roomData.title.startsWith('Majlis (')) {
          this.sessionTitle = roomData.title;
          saveRoomTitleLocally(this.roomId, roomData.title);
        }
        this.events.onRoomInfo?.({
          title: roomData.title,
          hostName: roomData.hostName,
          locked: roomData.locked,
          isRecording: roomData.isRecording,
        });
      });

      // Listen to participants from Firebase with two-way join/leave detection
      this.firebaseSync.subscribeToParticipants((participants) => {
        const remoteParticipants = participants.filter((p) => p.id !== this.userId);
        const currentPeerIds = new Set(remoteParticipants.map((p) => p.id));

        // 1. Detect and clean up members who left the meeting
        for (const [peerId, cachedP] of Array.from(this.knownParticipants.entries())) {
          if (!currentPeerIds.has(peerId)) {
            this.knownParticipants.delete(peerId);
            this.closePeerConnection(peerId);
            this.events.onUserLeft(peerId, cachedP.name);
          }
        }

        // 2. Add or update active participants
        for (const p of remoteParticipants) {
          const isNew = !this.knownParticipants.has(p.id);
          this.knownParticipants.set(p.id, p);

          if (isNew) {
            this.events.onUserJoined(p);
          } else {
            this.events.onUserStatusChanged({
              userId: p.id,
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
        this.events.onReaction(react);
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
          switch (msg.type) {
            case 'join': {
              const participant: Participant = {
                id: msg.userId,
                name: msg.userName,
                isHost: msg.isHost,
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

              this.broadcastChannel?.postMessage({
                type: 'announce-presence',
                _senderId: this.userId,
                userId: this.userId,
                userName: this.userName,
                isHost: this.isHost,
                title: this.sessionTitle,
                isMuted: !this.localStream?.getAudioTracks().some((t) => t.enabled),
                isVideoOff: !this.localStream?.getVideoTracks().some((t) => t.enabled),
              });

              if (!this.peerConnections.has(msg.userId)) {
                const isInitiator = this.userId > msg.userId;
                await this.createPeerConnection(msg.userId, isInitiator);
              }
              break;
            }

            case 'announce-presence': {
              const participant: Participant = {
                id: msg.userId,
                name: msg.userName,
                isHost: msg.isHost,
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
              if (msg.title) {
                this.sessionTitle = msg.title;
                this.events.onRoomInfo?.({ title: msg.title });
              }
              if (!this.peerConnections.has(msg.userId)) {
                const isInitiator = this.userId > msg.userId;
                await this.createPeerConnection(msg.userId, isInitiator);
              }
              break;
            }

            case 'session-ended': {
              if (this.events.onSessionEnded) {
                this.events.onSessionEnded(msg.message || 'The facilitator has concluded this Majlis session.');
              }
              this.leave();
              break;
            }

            case 'spotlight-changed': {
              this.events.onSpotlightChanged?.(msg.targetId || null);
              break;
            }

            case 'chat-permission-changed': {
              this.events.onChatPermissionChanged?.(!!msg.enabled);
              break;
            }

            case 'screenshare-permission-changed': {
              this.events.onScreenSharePermissionChanged?.(!!msg.enabled);
              break;
            }

            case 'hands-lowered': {
              this.events.onHandsLowered?.();
              break;
            }

            case 'system-announcement': {
              this.events.onAnnouncement?.(msg.text, msg.senderName);
              break;
            }

            case 'signal': {
              if (msg.targetId === this.userId && msg.signalData) {
                await this.handleSignalingData(msg.senderId, msg.signalData);
              }
              break;
            }

            case 'chat': {
              if (msg.message) {
                this.events.onChatMessage(msg.message);
              }
              break;
            }

            case 'reaction': {
              this.events.onReaction({
                id: msg.id,
                senderId: msg.senderId,
                senderName: msg.senderName,
                emoji: msg.emoji,
              });
              break;
            }

            case 'status-update': {
              this.events.onUserStatusChanged({
                userId: msg.userId,
                isMuted: msg.isMuted,
                isVideoOff: msg.isVideoOff,
                isScreenSharing: msg.isScreenSharing,
                handRaised: msg.handRaised,
              });
              break;
            }

            case 'user-left': {
              this.knownParticipants.delete(msg.userId);
              this.closePeerConnection(msg.userId);
              this.events.onUserLeft(msg.userId, msg.name);
              break;
            }
          }
        };

        this.broadcastChannel.postMessage({
          type: 'join',
          _senderId: this.userId,
          roomId: this.roomId,
          userId: this.userId,
          userName: this.userName,
          isHost: this.isHost,
          title: this.sessionTitle,
          isMuted: !this.localStream?.getAudioTracks().some((t) => t.enabled),
          isVideoOff: !this.localStream?.getVideoTracks().some((t) => t.enabled),
        });
      } catch (e) {
        // ignore
      }
    }

    // 3. Local WebSocket Server Connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

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
          title: this.sessionTitle || (isHost ? `${this.userName}'s Majlis` : 'Live Majlis'),
          isMuted: !this.localStream?.getAudioTracks().some((t) => t.enabled),
          isVideoOff: !this.localStream?.getVideoTracks().some((t) => t.enabled),
        });

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
        if (!this.isClosed) {
          console.log('WebSocket closed.');
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

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
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
        this.isHost = message.isHost;
        this.isLocked = message.locked;

        if (message.title && !message.title.startsWith('Majlis (')) {
          this.sessionTitle = message.title;
          saveRoomTitleLocally(this.roomId, message.title);
        }

        const remoteParticipants: Participant[] = (message.participants || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          isHost: p.isHost,
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
        });

        if (message.title) {
          this.events.onRoomInfo?.({
            title: message.title,
            hostName: message.hostName,
            locked: this.isLocked,
            isRecording: message.isRecording,
          });
        }

        for (const p of remoteParticipants) {
          this.knownParticipants.set(p.id, p);
          const isInitiator = this.userId > p.id;
          await this.createPeerConnection(p.id, isInitiator);
        }
        break;
      }

      case 'room-info-update': {
        if (message.title && !message.title.startsWith('Majlis (')) {
          this.sessionTitle = message.title;
          saveRoomTitleLocally(this.roomId, message.title);
        }
        if (this.events.onRoomInfo) {
          this.events.onRoomInfo({
            title: message.title,
            hostName: message.hostName,
            locked: message.locked,
            isRecording: message.isRecording,
          });
        }
        break;
      }

      case 'user-joined': {
        const user = message.user;
        if (!user || user.id === this.userId) return;

        const participant: Participant = {
          id: user.id,
          name: user.name,
          isHost: user.isHost,
          isLocal: false,
          isMuted: user.isMuted,
          isVideoOff: user.isVideoOff,
          isScreenSharing: user.isScreenSharing,
          handRaised: user.handRaised,
        };

        const isNew = !this.knownParticipants.has(user.id);
        this.knownParticipants.set(user.id, participant);
        if (isNew) {
          this.events.onUserJoined(participant);
        }

        if (!this.peerConnections.has(user.id)) {
          const isInitiator = this.userId > user.id;
          this.createPeerConnection(user.id, isInitiator);
        }
        break;
      }

      case 'user-left': {
        const leftId = message.userId;
        if (!leftId || leftId === this.userId) return;

        this.knownParticipants.delete(leftId);
        this.closePeerConnection(leftId);
        this.events.onUserLeft(leftId, message.name);
        break;
      }

      case 'spotlight-changed': {
        this.events.onSpotlightChanged?.(message.targetId || null);
        break;
      }

      case 'chat-permission-changed': {
        this.events.onChatPermissionChanged?.(!!message.enabled);
        break;
      }

      case 'screenshare-permission-changed': {
        this.events.onScreenSharePermissionChanged?.(!!message.enabled);
        break;
      }

      case 'hands-lowered': {
        this.events.onHandsLowered?.();
        break;
      }

      case 'promoted-to-host': {
        this.isHost = true;
        this.events.onPromotedToHost?.(message.message || 'You are now the facilitator.');
        break;
      }

      case 'new-host': {
        if (message.hostId === this.userId) {
          this.isHost = true;
        }
        break;
      }

      case 'system-announcement': {
        this.events.onAnnouncement?.(message.text, message.senderName);
        break;
      }

      case 'signal': {
        const { senderId, signalData } = message;
        if (!senderId || senderId === this.userId || !signalData) return;

        await this.handleSignalingData(senderId, signalData);
        break;
      }

      case 'chat': {
        if (message.message) {
          this.events.onChatMessage(message.message);
        }
        break;
      }

      case 'reaction': {
        this.events.onReaction({
          id: message.id,
          senderId: message.senderId,
          senderName: message.senderName,
          emoji: message.emoji,
        });
        break;
      }

      case 'user-status-changed': {
        this.events.onUserStatusChanged({
          userId: message.userId,
          isMuted: message.isMuted,
          isVideoOff: message.isVideoOff,
          isScreenSharing: message.isScreenSharing,
          handRaised: message.handRaised,
        });
        break;
      }

      case 'force-mute': {
        this.events.onForceMute();
        break;
      }

      case 'kicked': {
        this.events.onKicked(message.message || 'You were removed from the room.');
        this.leave();
        break;
      }

      case 'room-lock-changed': {
        this.isLocked = message.locked;
        this.events.onLockChanged(this.isLocked);
        break;
      }

      case 'recording-notice': {
        this.events.onRecordingNotice(message.isRecording, message.recordedBy || 'Facilitator');
        break;
      }

      case 'session-ended': {
        if (this.events.onSessionEnded) {
          this.events.onSessionEnded(message.message || 'The facilitator has concluded this Majlis session.');
        }
        this.leave();
        break;
      }

      case 'error': {
        this.events.onError(message.message || 'An error occurred.');
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

    dc.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'sync-room-title' && data.title) {
          this.sessionTitle = data.title;
          saveRoomTitleLocally(this.roomId, data.title);
          this.events.onRoomInfo?.({ title: data.title, hostName: data.hostName });
        }
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
      if (event.streams && event.streams[0]) {
        this.events.onRemoteStream(peerId, event.streams[0]);
      } else if (event.track) {
        const stream = new MediaStream([event.track]);
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

  public setLocalStream(newStream: MediaStream) {
    this.localStream = newStream;

    for (const pc of this.peerConnections.values()) {
      const senders = pc.getSenders();

      const audioTrack = newStream.getAudioTracks()[0];
      const videoTrack = newStream.getVideoTracks()[0];

      if (audioTrack) {
        const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
        if (audioSender) {
          audioSender.replaceTrack(audioTrack).catch(console.warn);
        } else {
          try {
            pc.addTrack(audioTrack, newStream);
          } catch (e) {}
        }
      }

      if (videoTrack) {
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(videoTrack).catch(console.warn);
        } else {
          try {
            pc.addTrack(videoTrack, newStream);
          } catch (e) {}
        }
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

  public sendReaction(emoji: string) {
    const reaction: ReactionItem = {
      id: 'react_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
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

  // Facilitator Controls
  public hostMuteAll() {
    if (!this.isHost) return;
    this.sendWsMessage({
      type: 'host-mute-all',
    });
  }

  public hostMuteUser(targetId: string) {
    if (!this.isHost) return;
    this.sendWsMessage({
      type: 'host-mute-user',
      targetId,
    });
  }

  public hostLowerAllHands() {
    if (!this.isHost) return;
    this.sendWsMessage({
      type: 'host-lower-all-hands',
    });
  }

  public hostLowerHand(targetId: string) {
    if (!this.isHost) return;
    this.sendWsMessage({
      type: 'host-lower-hand',
      targetId,
    });
  }

  public hostSpotlight(targetId: string | null) {
    if (!this.isHost) return;
    this.sendWsMessage({
      type: 'host-spotlight',
      targetId,
    });
  }

  public hostSetChatPermission(enabled: boolean) {
    if (!this.isHost) return;
    this.sendWsMessage({
      type: 'host-toggle-chat',
      enabled,
    });
  }

  public hostSetScreenSharePermission(enabled: boolean) {
    if (!this.isHost) return;
    this.sendWsMessage({
      type: 'host-toggle-screenshare',
      enabled,
    });
  }

  public hostBroadcastAnnouncement(text: string) {
    if (!this.isHost) return;
    this.sendWsMessage({
      type: 'host-announcement',
      text,
    });
  }

  public hostTransfer(targetId: string) {
    if (!this.isHost) return;
    this.sendWsMessage({
      type: 'host-transfer',
      targetId,
    });
  }

  public hostKickUser(targetId: string) {
    if (!this.isHost) return;
    this.sendWsMessage({
      type: 'host-kick',
      targetId,
    });

    this.knownParticipants.delete(targetId);
    this.closePeerConnection(targetId);
    this.events.onUserLeft(targetId);
  }

  public hostToggleLock() {
    if (!this.isHost) return;
    this.sendWsMessage({
      type: 'host-toggle-lock',
    });
  }

  public notifyRecording(isRecording: boolean) {
    this.sendWsMessage({
      type: 'recording-notice',
      isRecording,
    });
  }

  public hostEndSession() {
    if (!this.isHost) return;

    // 1. Notify via WebSocket
    this.sendWsMessage({
      type: 'host-end-session',
    });

    // 2. Notify via BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'session-ended',
          _senderId: this.userId,
          message: 'The facilitator has concluded this Majlis session.',
        });
      } catch (e) {}
    }

    // 3. Delete room and participants from Firestore so it disappears from Ongoing list immediately
    this.firebaseSync?.endRoomSession().catch(() => {});
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
