import { joinRoom, type Room } from 'trystero';
import { ChatMessage, Participant, ReactionItem } from '../types/meeting';

export interface MeetingClientEvents {
  onRoomJoined: (data: {
    roomId: string;
    isHost: boolean;
    locked: boolean;
    isRecording: boolean;
    participants: Participant[];
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
  onUserStatusChanged: (data: {
    userId: string;
    isMuted?: boolean;
    isVideoOff?: boolean;
    isScreenSharing?: boolean;
    handRaised?: boolean;
  }) => void;
  onError: (message: string) => void;
}

interface ParticipantProfile {
  [key: string]: unknown;
  userId: string;
  name: string;
  isHost: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  handRaised: boolean;
}

interface StatusPayload {
  [key: string]: unknown;
  userId: string;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isScreenSharing?: boolean;
  handRaised?: boolean;
}

interface ModerationPayload {
  [key: string]: unknown;
  type: 'force-mute' | 'kick' | 'lock-changed' | 'recording-notice';
  targetId?: string;
  locked?: boolean;
  isRecording?: boolean;
  recordedBy?: string;
  reason?: string;
}

export class MeetingClient {
  private room: Room | null = null;
  private localStream: MediaStream | null = null;
  private events: MeetingClientEvents;
  private isClosed = false;
  private isLocked = false;

  private profileAction: any = null;
  private chatAction: any = null;
  private reactionAction: any = null;
  private statusAction: any = null;
  private moderationAction: any = null;

  private participants = new Map<string, Participant>();
  private peerIdToUserId = new Map<string, string>();
  private userIdToPeerId = new Map<string, string>();
  private syncTimer: number | null = null;

  public roomId: string = '';
  public userId: string = '';
  public userName: string = '';
  public isHost: boolean = false;

  constructor(events: MeetingClientEvents) {
    this.events = events;
  }

  public connect(
    roomId: string,
    userId: string,
    userName: string,
    isHost: boolean,
    localStream: MediaStream | null
  ) {
    this.roomId = roomId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || 'majlis-main';
    this.userId = userId;
    this.userName = userName;
    this.isHost = isHost;
    this.localStream = localStream;
    this.isClosed = false;
    this.isLocked = false;
    this.participants.clear();
    this.peerIdToUserId.clear();
    this.userIdToPeerId.clear();

    try {
      // Connect to serverless WebRTC room (Works anywhere: Vercel, Netlify, localhost)
      this.room = joinRoom(
        {
          appId: 'the-wisdom-lounge-majlis',
        },
        this.roomId
      );

      // Register typed actions
      this.profileAction = this.room.makeAction('profile');
      this.chatAction = this.room.makeAction('chat');
      this.reactionAction = this.room.makeAction('reaction');
      this.statusAction = this.room.makeAction('status');
      this.moderationAction = this.room.makeAction('moderation');

      // Add local stream if present
      if (this.localStream) {
        try {
          this.room.addStream(this.localStream);
        } catch (e) {
          console.warn('Error adding initial local stream:', e);
        }
      }

      // Handle remote incoming streams
      this.room.onPeerStream = (stream: MediaStream, peerId: string) => {
        const targetUserId = this.peerIdToUserId.get(peerId) || peerId;
        const participant = this.participants.get(targetUserId) || this.participants.get(peerId);
        if (participant) {
          participant.stream = stream;
        } else {
          // If profile message hasn't arrived yet, save stream under peerId
          this.participants.set(peerId, {
            id: peerId,
            name: 'Member',
            isHost: false,
            isLocal: false,
            isMuted: false,
            isVideoOff: false,
            isScreenSharing: false,
            handRaised: false,
            stream: stream,
          });
        }
        this.events.onRemoteStream(targetUserId, stream);
      };

      // When a peer connects to our room
      this.room.onPeerJoin = (peerId: string) => {
        // Broadcast profile immediately and again after a short delay
        this.broadcastMyProfile(peerId);
        setTimeout(() => this.broadcastMyProfile(peerId), 500);

        // Share our media stream with the new peer if active
        if (this.localStream && this.room) {
          try {
            this.room.addStream(this.localStream, { target: peerId });
          } catch (e) {
            console.warn('Error sending stream to new peer:', e);
          }
        }
      };

      // Handle received peer profile
      this.profileAction.onMessage = (profile: ParticipantProfile, context: { peerId: string }) => {
        if (!profile || !profile.userId) return;
        const peerId = context.peerId;

        this.peerIdToUserId.set(peerId, profile.userId);
        this.userIdToPeerId.set(profile.userId, peerId);

        // Check for existing stream saved under either profile.userId or peerId
        const existingByUserId = this.participants.get(profile.userId);
        const existingByPeerId = this.participants.get(peerId);
        const activeStream = existingByUserId?.stream || existingByPeerId?.stream;

        // Clean up temporary peerId entry if it was created prior to profile arrival
        if (existingByPeerId && peerId !== profile.userId) {
          this.participants.delete(peerId);
        }

        const participant: Participant = {
          id: profile.userId,
          name: profile.name || 'Member',
          isHost: !!profile.isHost,
          isLocal: false,
          isMuted: !!profile.isMuted,
          isVideoOff: !!profile.isVideoOff,
          isScreenSharing: !!profile.isScreenSharing,
          handRaised: !!profile.handRaised,
          stream: activeStream,
        };

        this.participants.set(profile.userId, participant);

        if (!existingByUserId) {
          this.events.onUserJoined(participant);
          this.broadcastMyProfile(peerId);
        } else {
          this.events.onUserStatusChanged({
            userId: profile.userId,
            isMuted: participant.isMuted,
            isVideoOff: participant.isVideoOff,
            isScreenSharing: participant.isScreenSharing,
            handRaised: participant.handRaised,
          });
        }

        if (activeStream) {
          this.events.onRemoteStream(profile.userId, activeStream);
        }
      };

      // Periodic heartbeat to guarantee peer profile and stream exchange across all connected peers
      this.syncTimer = window.setInterval(() => {
        if (!this.room || this.isClosed) return;
        try {
          const peers = this.room.getPeers();
          for (const peerId of Object.keys(peers)) {
            this.broadcastMyProfile(peerId);
            if (this.localStream) {
              try {
                this.room.addStream(this.localStream, { target: peerId });
              } catch (e) {
                // Stream may already be added
              }
            }
          }
        } catch (e) {
          // ignore
        }
      }, 1500);

      // Handle peer leaving
      this.room.onPeerLeave = (peerId: string) => {
        const targetUserId = this.peerIdToUserId.get(peerId) || peerId;
        const existing = this.participants.get(targetUserId);
        this.participants.delete(targetUserId);
        this.peerIdToUserId.delete(peerId);
        this.userIdToPeerId.delete(targetUserId);
        this.events.onUserLeft(targetUserId, existing?.name);
      };

      // Handle incoming chat
      this.chatAction.onMessage = (message: ChatMessage) => {
        if (message && message.senderId !== this.userId) {
          this.events.onChatMessage(message);
        }
      };

      // Handle incoming reactions
      this.reactionAction.onMessage = (reaction: ReactionItem) => {
        if (reaction && reaction.senderId !== this.userId) {
          this.events.onReaction(reaction);
        }
      };

      // Handle peer status updates
      this.statusAction.onMessage = (status: StatusPayload) => {
        if (status && status.userId) {
          const participant = this.participants.get(status.userId);
          if (participant) {
            if (status.isMuted !== undefined) participant.isMuted = status.isMuted;
            if (status.isVideoOff !== undefined) participant.isVideoOff = status.isVideoOff;
            if (status.isScreenSharing !== undefined) participant.isScreenSharing = status.isScreenSharing;
            if (status.handRaised !== undefined) participant.handRaised = status.handRaised;
          }
          this.events.onUserStatusChanged(status);
        }
      };

      // Handle moderation
      this.moderationAction.onMessage = (payload: ModerationPayload) => {
        switch (payload.type) {
          case 'force-mute':
            this.events.onForceMute();
            break;
          case 'kick':
            if (payload.targetId === this.userId) {
              this.events.onKicked(payload.reason || 'You were removed from the Majlis by the facilitator.');
              this.leave();
            }
            break;
          case 'lock-changed':
            this.isLocked = !!payload.locked;
            this.events.onLockChanged(this.isLocked);
            break;
          case 'recording-notice':
            this.events.onRecordingNotice(!!payload.isRecording, payload.recordedBy || 'Facilitator');
            break;
        }
      };

      // Notify caller that room joined
      this.events.onRoomJoined({
        roomId: this.roomId,
        isHost: this.isHost,
        locked: this.isLocked,
        isRecording: false,
        participants: Array.from(this.participants.values()),
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Failed to initialize serverless WebRTC room:', err);
      this.events.onError(`Connection error: ${errorMessage}`);
    }
  }

  private broadcastMyProfile(targetPeerId?: string) {
    if (!this.profileAction) return;
    const profile: ParticipantProfile = {
      userId: this.userId,
      name: this.userName,
      isHost: this.isHost,
      isMuted: !this.localStream?.getAudioTracks().some((t) => t.enabled),
      isVideoOff: !this.localStream?.getVideoTracks().some((t) => t.enabled),
      isScreenSharing: false,
      handRaised: false,
    };
    const options = targetPeerId ? { target: targetPeerId } : undefined;
    this.profileAction.send(profile, options).catch(console.warn);
  }

  public setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
    if (!this.room || !stream) return;

    try {
      this.room.addStream(stream);
    } catch (e) {
      console.warn('Error updating stream tracks in room:', e);
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

    if (this.chatAction) {
      this.chatAction.send(message as any).catch(console.warn);
    }

    this.events.onChatMessage(message);
  }

  public sendReaction(emoji: string) {
    if (!emoji) return;
    const reaction: ReactionItem = {
      id: 'react_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      senderId: this.userId,
      senderName: this.userName,
      emoji,
    };

    if (this.reactionAction) {
      this.reactionAction.send(reaction as any).catch(console.warn);
    }

    this.events.onReaction(reaction);
  }

  public updateStatus(status: {
    isMuted?: boolean;
    isVideoOff?: boolean;
    isScreenSharing?: boolean;
    handRaised?: boolean;
  }) {
    const payload: StatusPayload = {
      userId: this.userId,
      ...status,
    };

    if (this.statusAction) {
      this.statusAction.send(payload).catch(console.warn);
    }

    this.events.onUserStatusChanged(payload);
  }

  public hostMuteAll() {
    if (!this.isHost || !this.moderationAction) return;
    this.moderationAction.send({ type: 'force-mute' }).catch(console.warn);
  }

  public hostKickUser(targetId: string) {
    if (!this.isHost || !this.moderationAction) return;
    this.moderationAction.send({
      type: 'kick',
      targetId,
      reason: 'The facilitator has dismissed you from this session.',
    }).catch(console.warn);

    const existing = this.participants.get(targetId);
    this.participants.delete(targetId);
    this.events.onUserLeft(targetId, existing?.name);
  }

  public hostToggleLock() {
    if (!this.isHost || !this.moderationAction) return;
    this.isLocked = !this.isLocked;
    this.moderationAction.send({
      type: 'lock-changed',
      locked: this.isLocked,
    }).catch(console.warn);
    this.events.onLockChanged(this.isLocked);
  }

  public notifyRecording(isRecording: boolean) {
    if (!this.moderationAction) return;
    this.moderationAction.send({
      type: 'recording-notice',
      isRecording,
      recordedBy: this.userName,
    }).catch(console.warn);
  }

  public leave() {
    this.isClosed = true;
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.room) {
      try {
        this.room.leave();
      } catch (e) {
        console.warn('Error leaving room:', e);
      }
      this.room = null;
    }
    this.participants.clear();
    this.peerIdToUserId.clear();
    this.userIdToPeerId.clear();
  }
}
