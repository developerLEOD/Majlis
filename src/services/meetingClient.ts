import { ChatMessage, Participant, ReactionItem } from '../types/meeting';

export interface MeetingClientEvents {
  onRoomJoined: (data: { roomId: string; isHost: boolean; locked: boolean; isRecording: boolean; participants: Participant[] }) => void;
  onUserJoined: (user: Participant) => void;
  onUserLeft: (userId: string, name?: string) => void;
  onRemoteStream: (userId: string, stream: MediaStream) => void;
  onChatMessage: (message: ChatMessage) => void;
  onReaction: (reaction: ReactionItem) => void;
  onForceMute: () => void;
  onKicked: (reason: string) => void;
  onLockChanged: (locked: boolean) => void;
  onRecordingNotice: (isRecording: boolean, recordedBy: string) => void;
  onUserStatusChanged: (data: { userId: string; isMuted?: boolean; isVideoOff?: boolean; isScreenSharing?: boolean; handRaised?: boolean }) => void;
  onError: (message: string) => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export class MeetingClient {
  private ws: WebSocket | null = null;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private iceCandidateQueues = new Map<string, RTCIceCandidateInit[]>();
  private localStream: MediaStream | null = null;
  private events: MeetingClientEvents;
  private heartbeatTimer: number | null = null;
  private isClosed = false;

  public roomId: string = '';
  public userId: string = '';
  public userName: string = '';
  public isHost: boolean = false;

  constructor(events: MeetingClientEvents) {
    this.events = events;
  }

  public connect(roomId: string, userId: string, userName: string, isHost: boolean, localStream: MediaStream | null) {
    this.roomId = roomId;
    this.userId = userId;
    this.userName = userName;
    this.isHost = isHost;
    this.localStream = localStream;
    this.isClosed = false;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      // Send join event
      const isMuted = !localStream?.getAudioTracks().some((t) => t.enabled);
      const isVideoOff = !localStream?.getVideoTracks().some((t) => t.enabled);

      this.sendMessage({
        type: 'join',
        roomId,
        userId,
        userName,
        isHost,
        isMuted,
        isVideoOff,
      });

      // Heartbeat
      this.heartbeatTimer = window.setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.sendMessage({ type: 'ping' });
        }
      }, 20000);
    };

    this.ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        await this.handleMessage(data);
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };

    this.ws.onerror = (err) => {
      console.warn('WebSocket encountered error:', err);
    };

    this.ws.onclose = () => {
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      if (!this.isClosed) {
        console.log('WS connection closed.');
      }
    };
  }

  public setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
    if (!stream) return;

    // Replace tracks on all active peer connections
    for (const [peerId, pc] of this.peerConnections.entries()) {
      const senders = pc.getSenders();
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      if (videoTrack) {
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(videoTrack).catch(console.warn);
        } else {
          try {
            pc.addTrack(videoTrack, stream);
          } catch (e) {
            console.warn(`Could not add video track to peer ${peerId}:`, e);
          }
        }
      }

      if (audioTrack) {
        const audioSender = senders.find((s) => s.track?.kind === 'audio');
        if (audioSender) {
          audioSender.replaceTrack(audioTrack).catch(console.warn);
        } else {
          try {
            pc.addTrack(audioTrack, stream);
          } catch (e) {
            console.warn(`Could not add audio track to peer ${peerId}:`, e);
          }
        }
      }
    }
  }

  private async handleMessage(data: { type: string; [key: string]: unknown }) {
    switch (data.type) {
      case 'room-joined': {
        const participants = (data.participants as Participant[]) || [];
        this.isHost = !!data.isHost;
        this.events.onRoomJoined({
          roomId: data.roomId as string,
          isHost: this.isHost,
          locked: !!data.locked,
          isRecording: !!data.isRecording,
          participants,
        });

        // For each existing participant, initiate WebRTC connection
        for (const p of participants) {
          await this.initiatePeerConnection(p.id, true);
        }
        break;
      }

      case 'user-joined': {
        const user = data.user as Participant;
        this.events.onUserJoined(user);
        // Will receive offer from the new participant or handle via signalling
        break;
      }

      case 'user-left': {
        const userId = data.userId as string;
        this.closePeerConnection(userId);
        this.events.onUserLeft(userId, data.name as string | undefined);
        break;
      }

      case 'signal': {
        const senderId = data.senderId as string;
        const signalData = data.signalData as {
          type?: string;
          sdp?: string;
          candidate?: RTCIceCandidateInit;
        };

        let pc = this.peerConnections.get(senderId);
        if (!pc) {
          pc = await this.initiatePeerConnection(senderId, false);
        }

        if (signalData.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData as RTCSessionDescriptionInit));
          // Process queued ICE candidates
          const queued = this.iceCandidateQueues.get(senderId) || [];
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(console.warn);
          }
          this.iceCandidateQueues.delete(senderId);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.sendMessage({
            type: 'signal',
            targetId: senderId,
            signalData: pc.localDescription,
          });
        } else if (signalData.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData as RTCSessionDescriptionInit));
          // Process queued ICE candidates
          const queued = this.iceCandidateQueues.get(senderId) || [];
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(console.warn);
          }
          this.iceCandidateQueues.delete(senderId);
        } else if (signalData.candidate) {
          if (!pc.remoteDescription) {
            const list = this.iceCandidateQueues.get(senderId) || [];
            list.push(signalData.candidate);
            this.iceCandidateQueues.set(senderId, list);
          } else {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
            } catch (e) {
              console.warn('Error adding ICE candidate:', e);
            }
          }
        }
        break;
      }

      case 'chat': {
        this.events.onChatMessage(data.message as ChatMessage);
        break;
      }

      case 'reaction': {
        this.events.onReaction(data as unknown as ReactionItem);
        break;
      }

      case 'force-mute': {
        this.events.onForceMute();
        break;
      }

      case 'kicked': {
        this.events.onKicked(data.message as string);
        this.leave();
        break;
      }

      case 'room-lock-changed': {
        this.events.onLockChanged(!!data.locked);
        break;
      }

      case 'recording-notice': {
        this.events.onRecordingNotice(!!data.isRecording, (data.recordedBy as string) || 'Host');
        break;
      }

      case 'user-status-changed': {
        this.events.onUserStatusChanged(data as unknown as { userId: string });
        break;
      }

      case 'error': {
        this.events.onError(data.message as string);
        break;
      }
    }
  }

  private async initiatePeerConnection(targetUserId: string, isInitiator: boolean): Promise<RTCPeerConnection> {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peerConnections.set(targetUserId, pc);

    // Add local media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, this.localStream!);
        } catch (e) {
          console.warn('Error adding track to peer:', e);
        }
      });
    }

    // Handle remote tracks
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.events.onRemoteStream(targetUserId, event.streams[0]);
      } else {
        const stream = new MediaStream([event.track]);
        this.events.onRemoteStream(targetUserId, stream);
      }
    };

    // Relay ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendMessage({
          type: 'signal',
          targetId: targetUserId,
          signalData: { candidate: event.candidate.toJSON() },
        });
      }
    };

    if (isInitiator) {
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        this.sendMessage({
          type: 'signal',
          targetId: targetUserId,
          signalData: pc.localDescription,
        });
      } catch (err) {
        console.error('Failed to create offer for peer:', err);
      }
    }

    return pc;
  }

  private closePeerConnection(userId: string) {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
    }
  }

  public sendChatMessage(text: string) {
    this.sendMessage({
      type: 'chat',
      text,
    });
  }

  public sendReaction(emoji: string) {
    this.sendMessage({
      type: 'reaction',
      emoji,
    });
  }

  public updateStatus(status: { isMuted?: boolean; isVideoOff?: boolean; isScreenSharing?: boolean; handRaised?: boolean }) {
    this.sendMessage({
      type: 'status-update',
      ...status,
    });
  }

  public hostMuteAll() {
    this.sendMessage({
      type: 'host-mute-all',
    });
  }

  public hostKickUser(targetId: string) {
    this.sendMessage({
      type: 'host-kick',
      targetId,
    });
  }

  public hostToggleLock() {
    this.sendMessage({
      type: 'host-toggle-lock',
    });
  }

  public notifyRecording(isRecording: boolean) {
    this.sendMessage({
      type: 'recording-notice',
      isRecording,
    });
  }

  private sendMessage(msg: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public leave() {
    this.isClosed = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    for (const pc of this.peerConnections.values()) {
      pc.close();
    }
    this.peerConnections.clear();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
