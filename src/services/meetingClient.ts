import { joinRoom, selfId, type Room } from 'trystero';
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
    this.userId = userId || selfId;
    this.userName = userName || 'Member';
    this.isHost = isHost;
    this.localStream = localStream;
    this.isClosed = false;
    this.isLocked = false;
    this.participants.clear();

    try {
      // Connect using Trystero's default Nostr discovery engine
      this.room = joinRoom(
        {
          appId: 'the-wisdom-lounge-majlis',
        },
        this.roomId
      );

      // Register typed action channels
      this.profileAction = this.room.makeAction('profile');
      this.chatAction = this.room.makeAction('chat');
      this.reactionAction = this.room.makeAction('reaction');
      this.statusAction = this.room.makeAction('status');
      this.moderationAction = this.room.makeAction('moderation');

      // Add local media stream
      if (this.localStream) {
        try {
          this.room.addStream(this.localStream);
        } catch (e) {
          console.warn('Error adding initial local stream:', e);
        }
      }

      // 1. Handle incoming peer media streams
      this.room.onPeerStream = (stream: MediaStream, peerId: string) => {
        let participant = this.participants.get(peerId);
        if (participant) {
          participant.stream = stream;
        } else {
          participant = {
            id: peerId,
            name: 'Member',
            isHost: false,
            isLocal: false,
            isMuted: false,
            isVideoOff: false,
            isScreenSharing: false,
            handRaised: false,
            stream,
          };
          this.participants.set(peerId, participant);
          this.events.onUserJoined(participant);
        }
        this.events.onRemoteStream(peerId, stream);
      };

      // 2. Handle peer connection
      this.room.onPeerJoin = (peerId: string) => {
        let participant = this.participants.get(peerId);
        if (!participant) {
          participant = {
            id: peerId,
            name: 'Member',
            isHost: false,
            isLocal: false,
            isMuted: false,
            isVideoOff: false,
            isScreenSharing: false,
            handRaised: false,
          };
          this.participants.set(peerId, participant);
          this.events.onUserJoined(participant);
        }

        // Send our profile to the newly joined peer
        this.broadcastMyProfile(peerId);
      };

      // 3. Handle peer profile data
      this.profileAction.onMessage = (profile: ParticipantProfile, peerId: string) => {
        if (!profile || !peerId || peerId === selfId) return;

        const existing = this.participants.get(peerId);
        const stream = existing?.stream;

        const participant: Participant = {
          id: peerId,
          name: profile.name || 'Member',
          isHost: !!profile.isHost,
          isLocal: false,
          isMuted: !!profile.isMuted,
          isVideoOff: !!profile.isVideoOff,
          isScreenSharing: !!profile.isScreenSharing,
          handRaised: !!profile.handRaised,
          stream,
        };

        this.participants.set(peerId, participant);

        if (!existing) {
          this.events.onUserJoined(participant);
        } else {
          this.events.onUserStatusChanged({
            userId: peerId,
            isMuted: participant.isMuted,
            isVideoOff: participant.isVideoOff,
            isScreenSharing: participant.isScreenSharing,
            handRaised: participant.handRaised,
          });
        }

        if (stream) {
          this.events.onRemoteStream(peerId, stream);
        }
      };

      // 4. Handle peer disconnect
      this.room.onPeerLeave = (peerId: string) => {
        const existing = this.participants.get(peerId);
        this.participants.delete(peerId);
        this.events.onUserLeft(peerId, existing?.name);
      };

      // 5. Periodic reconciliation
      this.syncTimer = window.setInterval(() => {
        if (!this.room || this.isClosed) return;
        try {
          const peers = this.room.getPeers();
          for (const peerId of Object.keys(peers)) {
            if (!this.participants.has(peerId)) {
              const p: Participant = {
                id: peerId,
                name: 'Member',
                isHost: false,
                isLocal: false,
                isMuted: false,
                isVideoOff: false,
                isScreenSharing: false,
                handRaised: false,
              };
              this.participants.set(peerId, p);
              this.events.onUserJoined(p);
            }
          }
          this.broadcastMyProfile();
        } catch (e) {
          // ignore
        }
      }, 2000);

      // 6. Handle chat
      this.chatAction.onMessage = (message: ChatMessage) => {
        if (message && message.senderId !== this.userId) {
          this.events.onChatMessage(message);
        }
      };

      // 7. Handle reactions
      this.reactionAction.onMessage = (reaction: ReactionItem) => {
        if (reaction && reaction.senderId !== this.userId) {
          this.events.onReaction(reaction);
        }
      };

      // 8. Handle status changes
      this.statusAction.onMessage = (status: StatusPayload, peerId: string) => {
        const targetId = peerId || status?.userId;
        if (status && targetId) {
          const participant = this.participants.get(targetId);
          if (participant) {
            if (status.isMuted !== undefined) participant.isMuted = status.isMuted;
            if (status.isVideoOff !== undefined) participant.isVideoOff = status.isVideoOff;
            if (status.isScreenSharing !== undefined) participant.isScreenSharing = status.isScreenSharing;
            if (status.handRaised !== undefined) participant.handRaised = status.handRaised;
          }
          this.events.onUserStatusChanged({ ...status, userId: targetId });
        }
      };

      // 9. Handle moderation
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

      // Notify room joined
      this.events.onRoomJoined({
        roomId: this.roomId,
        isHost: this.isHost,
        locked: this.isLocked,
        isRecording: false,
        participants: Array.from(this.participants.values()),
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Failed to initialize WebRTC room:', err);
      this.events.onError(`Connection error: ${errorMessage}`);
    }
  }

  private broadcastMyProfile(targetPeerId?: string) {
    if (!this.profileAction) return;

    const profile: ParticipantProfile = {
      name: this.userName,
      isHost: this.isHost,
      isMuted: !this.localStream?.getAudioTracks().some((t) => t.enabled),
      isVideoOff: !this.localStream?.getVideoTracks().some((t) => t.enabled),
      isScreenSharing: false,
      handRaised: false,
    };

    const options = targetPeerId ? { target: targetPeerId } : undefined;
    this.profileAction.send(profile, options).catch(() => {});
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
        // ignore
      }
      this.room = null;
    }
    this.participants.clear();
  }
}
