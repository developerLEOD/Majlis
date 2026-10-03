export interface Participant {
  id: string;
  name: string;
  isHost: boolean;
  isLocal: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  handRaised: boolean;
  stream?: MediaStream;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  isHost: boolean;
  text: string;
  timestamp: number;
}

export interface ReactionItem {
  id: string;
  senderId: string;
  senderName: string;
  emoji: string;
}

export interface RecordingResult {
  blob: Blob;
  url: string;
  durationSeconds: number;
  sizeBytes: number;
  createdAt: number;
  fileName: string;
}

export type MeetingLayout = 'grid' | 'speaker';
export type VirtualBackground = 'none' | 'blur' | 'office' | 'cozy' | 'gradient';

export interface RoomSecuritySettings {
  isLocked: boolean;
  allowParticipantScreenShare: boolean;
  allowParticipantChat: boolean;
}
