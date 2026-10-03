import { ChatMessage, Participant, ReactionItem } from '../types/meeting';
import { saveRoomTitleLocally, getRoomTitleLocally } from '../utils/urlHelper';

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

    // Set up BroadcastChannel for instant cross-tab / Vercel domain synchronization
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(`infinitymeet_room_${this.roomId}`);
        this.broadcastChannel.onmessage = (e) => {
          if (e.data?.type === 'room-info' && e.data?.title) {
            this.sessionTitle = e.data.title;
            this.events.onRoomInfo?.({ title: e.data.title, hostName: e.data.hostName });
          }
        };

        if (this.sessionTitle && !this.sessionTitle.startsWith('Majlis (')) {
          this.broadcastChannel.postMessage({
            type: 'room-info',
            title: this.sessionTitle,
            hostName: this.userName,
          });
        }
      } catch (e) {
        // ignore
      }
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (this.isClosed || !this.ws) return;

        // Send join packet to server
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

        // Start ping heartbeat
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
        console.warn('WebSocket warning:', err);
      };

      this.ws.onclose = () => {
        if (!this.isClosed) {
          console.log('WebSocket closed.');
        }
      };
    } catch (err) {
      console.warn('WebSocket connection error:', err);
    }
  }

  private sendWsMessage(msg: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
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

        // As the newly joined participant, initiate WebRTC offer to all existing participants in the room
        for (const p of remoteParticipants) {
          await this.createPeerConnection(p.id, true);
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

        this.events.onUserJoined(participant);
        break;
      }

      case 'user-left': {
        const leftId = message.userId;
        if (!leftId || leftId === this.userId) return;

        this.closePeerConnection(leftId);
        this.events.onUserLeft(leftId, message.name);
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
      // Sync room title directly peer-to-peer over WebRTC
      if (this.sessionTitle && !this.sessionTitle.startsWith('Majlis (')) {
        try {
          dc.send(JSON.stringify({
            type: 'sync-room-title',
            title: this.sessionTitle,
            hostName: this.userName,
          }));
        } catch (e) {
          // ignore
        }
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
      } catch (err) {
        // ignore
      }
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

    // Add local tracks if available
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
        this.sendWsMessage({
          type: 'signal',
          targetId: peerId,
          signalData: {
            candidate: event.candidate,
          },
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.events.onRemoteStream(peerId, event.streams[0]);
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

        this.sendWsMessage({
          type: 'signal',
          targetId: peerId,
          signalData: {
            sdp: pc.localDescription,
          },
        });
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

        // Drain any queued ICE candidates
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

        this.sendWsMessage({
          type: 'signal',
          targetId: senderId,
          signalData: {
            sdp: pc.localDescription,
          },
        });
      } else if (sdp.type === 'answer') {
        const pc = this.peerConnections.get(senderId);
        if (pc) {
          await pc.setRemoteDescription(sdp);

          // Drain any queued ICE candidates
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
        // Queue until remoteDescription is set
        const queued = this.queuedCandidates.get(senderId) || [];
        queued.push(signalData.candidate);
        this.queuedCandidates.set(senderId, queued);
      }
    }
  }

  public setLocalStream(newStream: MediaStream) {
    this.localStream = newStream;

    // Replace audio and video tracks on existing peer connections
    for (const pc of this.peerConnections.values()) {
      const senders = pc.getSenders();

      const audioTrack = newStream.getAudioTracks()[0];
      const videoTrack = newStream.getVideoTracks()[0];

      if (audioTrack) {
        const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
        if (audioSender) {
          audioSender.replaceTrack(audioTrack).catch(console.warn);
        }
      }

      if (videoTrack) {
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(videoTrack).catch(console.warn);
        }
      }
    }
  }

  public sendChatMessage(text: string) {
    if (!text.trim()) return;
    this.sendWsMessage({
      type: 'chat',
      text: text.trim(),
    });
  }

  public sendReaction(emoji: string) {
    this.sendWsMessage({
      type: 'reaction',
      emoji,
    });
  }

  public updateStatus(status: {
    isMuted?: boolean;
    isVideoOff?: boolean;
    isScreenSharing?: boolean;
    handRaised?: boolean;
  }) {
    this.sendWsMessage({
      type: 'status-update',
      ...status,
    });
  }

  public hostMuteAll() {
    if (!this.isHost) return;
    this.sendWsMessage({
      type: 'host-mute-all',
    });
  }

  public hostKickUser(targetId: string) {
    if (!this.isHost) return;
    this.sendWsMessage({
      type: 'host-kick',
      targetId,
    });

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
    this.sendWsMessage({
      type: 'host-end-session',
    });
  }

  private closePeerConnection(peerId: string) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      try {
        pc.close();
      } catch (e) {
        // ignore
      }
      this.peerConnections.delete(peerId);
    }

    const dc = this.dataChannels.get(peerId);
    if (dc) {
      try {
        dc.close();
      } catch (e) {
        // ignore
      }
      this.dataChannels.delete(peerId);
    }
  }

  public leave() {
    this.isClosed = true;

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch (e) {
        // ignore
      }
      this.broadcastChannel = null;
    }

    for (const peerId of this.peerConnections.keys()) {
      this.closePeerConnection(peerId);
    }
    this.peerConnections.clear();
    this.dataChannels.clear();
    this.queuedCandidates.clear();

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        // ignore
      }
      this.ws = null;
    }
  }
}
