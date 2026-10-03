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
  title?: string;
}

export type MeetingLayout = 'grid' | 'speaker';

export interface MajlisSession {
  id: string;
  roomId: string;
  title: string;
  scheduledAt: string;
  status: 'live' | 'upcoming' | 'completed';
  hostName: string;
}

export type NavTab = 'home' | 'majalis' | 'profile' | 'settings';
