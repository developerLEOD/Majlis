import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  ChevronUp,
  Circle,
  Copy,
  Crown,
  Disc,
  Grid,
  Hand,
  HardDrive,
  Info,
  LayoutGrid,
  Lock,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  Pause,
  PhoneOff,
  Play,
  Radio,
  Settings as SettingsIcon,
  Shield,
  Smile,
  Square,
  Unlock,
  Users,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react';
import {
  ChatMessage,
  MeetingLayout,
  Participant,
  ReactionItem,
  RecordingResult,
} from '../types/meeting';
import { LocalMeetingRecorder } from '../services/localRecorder';
import { MeetingClient } from '../services/meetingClient';
import { VideoTile } from './VideoTile';
import { ChatDrawer } from './ChatDrawer';
import { ParticipantsDrawer } from './ParticipantsDrawer';
import { RecordingModal } from './RecordingModal';
import { InviteModal } from './InviteModal';
import { SettingsModal } from './SettingsModal';
import {
  buildMeetingInviteUrl,
  copyTextToClipboard,
  fetchAppConfig,
  getCachedPublicAppUrl,
} from '../utils/urlHelper';

interface MeetingRoomProps {
  roomId: string;
  userId: string;
  userName: string;
  isHost: boolean;
  initialStream: MediaStream | null;
  initialMuted: boolean;
  initialVideoOff: boolean;
  onLeaveMeeting: () => void;
}

export const MeetingRoom: React.FC<MeetingRoomProps> = ({
  roomId,
  userId,
  userName,
  isHost: initialIsHost,
  initialStream,
  initialMuted,
  initialVideoOff,
  onLeaveMeeting,
}) => {
  // State
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isHost, setIsHost] = useState(initialIsHost);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isVideoOff, setIsVideoOff] = useState(initialVideoOff);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  // Layout & UI
  const [layout, setLayout] = useState<MeetingLayout>('grid');
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null);
  const [activeDrawer, setActiveDrawer] = useState<'chat' | 'participants' | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeReactions, setActiveReactions] = useState<ReactionItem[]>([]);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSecurityMenu, setShowSecurityMenu] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mirrorVideo, setMirrorVideo] = useState(true);
  const [appUrl, setAppUrl] = useState<string>(getCachedPublicAppUrl());

  useEffect(() => {
    async function loadConfig() {
      const url = await fetchAppConfig();
      if (url) setAppUrl(url);
    }
    loadConfig();
  }, []);

  // Time elapsed in meeting
  const [meetingSeconds, setMeetingSeconds] = useState(0);

  // Recording State (Moderator local recording)
  const [recorder, setRecorder] = useState<LocalMeetingRecorder | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'paused' | 'stopped'>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingSizeBytes, setRecordingSizeBytes] = useState(0);
  const [remoteRecordingNotice, setRemoteRecordingNotice] = useState<{ isRecording: boolean; by: string } | null>(null);
  const [lastFinishedRecording, setLastFinishedRecording] = useState<RecordingResult | null>(null);
  const [systemBanner, setSystemBanner] = useState<string | null>(null);

  // References
  const localStreamRef = useRef<MediaStream | null>(initialStream);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const clientRef = useRef<MeetingClient | null>(null);
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Setup meeting timer (unlimited)
  useEffect(() => {
    const timer = setInterval(() => {
      setMeetingSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format seconds to HH:MM:SS
  const formatTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Initialize WebRTC & WebSocket client
  useEffect(() => {
    // Local participant entry
    const localParticipant: Participant = {
      id: userId,
      name: userName,
      isHost: initialIsHost,
      isLocal: true,
      isMuted: initialMuted,
      isVideoOff: initialVideoOff,
      isScreenSharing: false,
      handRaised: false,
      stream: initialStream || undefined,
    };

    setParticipants([localParticipant]);

    const client = new MeetingClient({
      onRoomJoined: (data) => {
        setIsHost(data.isHost);
        setIsLocked(data.locked);
        if (data.isRecording) {
          setRemoteRecordingNotice({ isRecording: true, by: 'Moderator' });
        }
        // Add existing participants
        setParticipants((prev) => {
          const list = [...prev];
          for (const p of data.participants) {
            if (!list.some((existing) => existing.id === p.id)) {
              list.push({ ...p, isLocal: false });
            }
          }
          return list;
        });
      },

      onUserJoined: (user) => {
        setParticipants((prev) => {
          if (prev.some((p) => p.id === user.id)) return prev;
          return [...prev, { ...user, isLocal: false }];
        });
        showNotification(`${user.name} joined the meeting`);
      },

      onUserLeft: (leftUserId, leftName) => {
        setParticipants((prev) => prev.filter((p) => p.id !== leftUserId));
        videoElementsRef.current.delete(leftUserId);
        showNotification(`${leftName || 'A participant'} left the meeting`);
      },

      onRemoteStream: (remoteUserId, stream) => {
        setParticipants((prev) =>
          prev.map((p) => (p.id === remoteUserId ? { ...p, stream } : p))
        );
      },

      onChatMessage: (message) => {
        setMessages((prev) => [...prev, message]);
        if (activeDrawer !== 'chat') {
          setUnreadChatCount((count) => count + 1);
        }
      },

      onReaction: (reaction) => {
        setActiveReactions((prev) => [...prev, reaction]);
        setTimeout(() => {
          setActiveReactions((prev) => prev.filter((r) => r.id !== reaction.id));
        }, 3500);
      },

      onForceMute: () => {
        setIsMuted(true);
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = false));
        }
        showNotification('The moderator has muted your microphone');
      },

      onKicked: (reason) => {
        alert(reason || 'You have been removed from the meeting');
        onLeaveMeeting();
      },

      onLockChanged: (locked) => {
        setIsLocked(locked);
        showNotification(locked ? 'Meeting has been locked by the host' : 'Meeting unlocked');
      },

      onRecordingNotice: (recording, by) => {
        setRemoteRecordingNotice(recording ? { isRecording: true, by } : null);
      },

      onUserStatusChanged: (data) => {
        setParticipants((prev) =>
          prev.map((p) => {
            if (p.id !== data.userId) return p;
            return {
              ...p,
              isMuted: data.isMuted !== undefined ? data.isMuted : p.isMuted,
              isVideoOff: data.isVideoOff !== undefined ? data.isVideoOff : p.isVideoOff,
              isScreenSharing: data.isScreenSharing !== undefined ? data.isScreenSharing : p.isScreenSharing,
              handRaised: data.handRaised !== undefined ? data.handRaised : p.handRaised,
            };
          })
        );
      },

      onError: (msg) => {
        showNotification(msg);
      },
    });

    clientRef.current = client;
    client.connect(roomId, userId, userName, initialIsHost, initialStream);

    return () => {
      client.leave();
    };
  }, [roomId, userId, userName, initialIsHost]);

  const showNotification = (text: string) => {
    setSystemBanner(text);
    setTimeout(() => {
      setSystemBanner((current) => (current === text ? null : current));
    }, 4000);
  };

  // Toggle Microphone
  const toggleAudio = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }

    setParticipants((prev) =>
      prev.map((p) => (p.isLocal ? { ...p, isMuted: nextMuted } : p))
    );

    clientRef.current?.updateStatus({ isMuted: nextMuted });
  };

  // Toggle Camera
  const toggleVideo = () => {
    const nextVideoOff = !isVideoOff;
    setIsVideoOff(nextVideoOff);

    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !nextVideoOff;
      });
    }

    setParticipants((prev) =>
      prev.map((p) => (p.isLocal ? { ...p, isVideoOff: nextVideoOff } : p))
    );

    clientRef.current?.updateStatus({ isVideoOff: nextVideoOff });
  };

  // Toggle Screen Share
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);

      if (localStreamRef.current) {
        clientRef.current?.setLocalStream(localStreamRef.current);
        setParticipants((prev) =>
          prev.map((p) => (p.isLocal ? { ...p, stream: localStreamRef.current || undefined, isScreenSharing: false } : p))
        );
      }
      clientRef.current?.updateStatus({ isScreenSharing: false });
    } else {
      // Start sharing
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);

        // Mix or use screen video track
        const combinedStream = new MediaStream();
        screenStream.getVideoTracks().forEach((t) => combinedStream.addTrack(t));
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach((t) => combinedStream.addTrack(t));
        }

        clientRef.current?.setLocalStream(combinedStream);

        setParticipants((prev) =>
          prev.map((p) => (p.isLocal ? { ...p, stream: combinedStream, isScreenSharing: true } : p))
        );
        clientRef.current?.updateStatus({ isScreenSharing: true });

        screenStream.getVideoTracks()[0].onended = () => {
          toggleScreenShare();
        };
      } catch (err) {
        console.warn('Screen share cancelled or rejected:', err);
      }
    }
  };

  // Hand Raise Toggle
  const toggleHandRaise = () => {
    const nextState = !handRaised;
    setHandRaised(nextState);
    setParticipants((prev) =>
      prev.map((p) => (p.isLocal ? { ...p, handRaised: nextState } : p))
    );
    clientRef.current?.updateStatus({ handRaised: nextState });
    clientRef.current?.sendReaction(nextState ? '✋' : '👋');
  };

  // Local Session Recording on Moderator's Device
  const startRecording = async (mode: 'composite' | 'screen' = 'composite') => {
    if (!isHost) {
      alert('Only the moderator can start session recordings.');
      return;
    }

    try {
      const remoteStreams = participants
        .filter((p) => !p.isLocal && p.stream)
        .map((p) => p.stream!);

      const rec = new LocalMeetingRecorder({
        roomId,
        mode,
        localStream: localStreamRef.current,
        remoteStreams,
        getVideoElements: () => {
          return participants.map((p) => ({
            id: p.id,
            name: p.name,
            element: videoElementsRef.current.get(p.id) || null,
            isMuted: p.isMuted,
          }));
        },
        onTick: (duration, size) => {
          setRecordingDuration(duration);
          setRecordingSizeBytes(size);
        },
        onStatusChange: (status) => {
          setRecordingStatus(status);
        },
      });

      await rec.start();
      setRecorder(rec);
      setRecordingStatus('recording');
      clientRef.current?.notifyRecording(true);
      showNotification('Local recording started on your device');
    } catch (err) {
      console.error('Failed to start recording:', err);
      showNotification('Could not start recording: ' + (err as Error).message);
    }
  };

  const pauseResumeRecording = () => {
    if (!recorder) return;
    if (recordingStatus === 'recording') {
      recorder.pause();
    } else if (recordingStatus === 'paused') {
      recorder.resume();
    }
  };

  const stopRecording = async () => {
    if (!recorder) return;
    try {
      const result = await recorder.stop();
      setRecorder(null);
      setRecordingStatus('idle');
      setLastFinishedRecording(result);
      clientRef.current?.notifyRecording(false);
      showNotification('Recording finished and ready for review');
    } catch (err) {
      console.error('Error stopping recording:', err);
    }
  };

  // Reactions
  const sendEmojiReaction = (emoji: string) => {
    clientRef.current?.sendReaction(emoji);
    setShowReactionPicker(false);
  };

  // Chat
  const sendChatMessage = (text: string) => {
    clientRef.current?.sendChatMessage(text);
  };

  // Host Controls
  const handleMuteAll = () => {
    clientRef.current?.hostMuteAll();
    showNotification('Muted all participants');
  };

  const handleToggleLock = () => {
    clientRef.current?.hostToggleLock();
  };

  const handleKickUser = (targetUserId: string) => {
    clientRef.current?.hostKickUser(targetUserId);
  };

  // Copy Room Link
  const copyMeetingLink = async () => {
    const inviteUrl = buildMeetingInviteUrl(roomId, appUrl);
    const success = await copyTextToClipboard(inviteUrl);
    if (success) {
      setCopiedLink(true);
      showNotification('Meeting invite link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setShowInviteModal(true);
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Active speaker or pinned participant
  const pinnedParticipant = participants.find((p) => p.id === pinnedUserId);
  const otherParticipants = participants.filter((p) => p.id !== pinnedUserId);

  return (
    <div className="relative w-screen h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none">
      {/* System Toast / Banner */}
      {systemBanner && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-900/95 border border-slate-750 text-slate-200 text-xs font-medium rounded-full shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-3 flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-blue-400" />
          <span>{systemBanner}</span>
        </div>
      )}

      {/* Floating Emoji Reactions Stream */}
      <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
        {activeReactions.map((reaction) => (
          <div
            key={reaction.id}
            className="absolute bottom-24 right-1/4 animate-bounce text-4xl"
            style={{
              animation: 'floatUp 3.2s ease-out forwards',
              right: `${20 + Math.random() * 40}%`,
            }}
          >
            <div className="flex flex-col items-center">
              <span>{reaction.emoji}</span>
              <span className="text-[10px] bg-slate-900/80 text-slate-300 px-1.5 py-0.5 rounded-full mt-0.5 shadow">
                {reaction.senderName}
              </span>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) scale(0.6);
            opacity: 0;
          }
          15% {
            opacity: 1;
            transform: translateY(-40px) scale(1.1);
          }
          80% {
            opacity: 0.9;
          }
          100% {
            transform: translateY(-240px) scale(1.3);
            opacity: 0;
          }
        }
      `}</style>

      {/* TOP HEADER BAR */}
      <header className="h-14 px-4 sm:px-6 bg-slate-900/80 backdrop-blur border-b border-slate-800/80 flex items-center justify-between z-20 shrink-0">
        {/* Left: Room Code & Link Copy */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm tracking-tight text-white hidden sm:inline">
              Infinity<span className="text-blue-500">Meet</span>
            </span>
            <div className="h-4 w-px bg-slate-800 hidden sm:block" />
            <button
              onClick={copyMeetingLink}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg border border-slate-700/60 text-xs font-mono transition"
              title="Click to copy invite link"
            >
              <span>{roomId}</span>
              {copiedLink ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 rounded-lg border border-blue-500/30 text-xs font-medium transition"
              title="Invite participants"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Invite</span>
            </button>
          </div>

          {/* Room locked badge */}
          {isLocked && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md">
              <Lock className="w-3 h-3" /> Locked
            </span>
          )}
        </div>

        {/* Center: Meeting Duration & Unlimited Tag */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800/80 px-3 py-1 rounded-full text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono font-medium text-slate-200">{formatTime(meetingSeconds)}</span>
            <span className="text-slate-600">•</span>
            <span className="text-blue-400 font-semibold text-[11px] hidden sm:inline">
              Unlimited Session
            </span>
          </div>

          {/* Recording Badge */}
          {recordingStatus !== 'idle' ? (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-3 py-1 rounded-full text-xs text-red-300">
              <span className={`w-2.5 h-2.5 rounded-full bg-red-500 ${recordingStatus === 'recording' ? 'animate-ping' : ''}`} />
              <span className="font-mono font-bold">REC {formatTime(recordingDuration)}</span>
              <span className="text-red-400/80 text-[11px] hidden md:inline">
                ({formatBytes(recordingSizeBytes)} • Local)
              </span>
            </div>
          ) : remoteRecordingNotice?.isRecording ? (
            <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 px-2.5 py-1 rounded-full text-xs text-red-300">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[11px]">Recording by Host</span>
            </div>
          ) : null}
        </div>

        {/* Right: Layout Toggle & Fullscreen */}
        <div className="flex items-center gap-2">
          {/* Grid / Speaker View Toggle */}
          <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-0.5">
            <button
              onClick={() => {
                setLayout('grid');
                setPinnedUserId(null);
              }}
              className={`p-1.5 rounded-lg transition ${
                layout === 'grid' && !pinnedUserId
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setLayout('speaker');
                if (participants.length > 0 && !pinnedUserId) {
                  setPinnedUserId(participants[0].id);
                }
              }}
              className={`p-1.5 rounded-lg transition ${
                layout === 'speaker' || pinnedUserId
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Speaker View"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition hidden sm:block"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* MAIN MEETING VIEWPORT */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* VIDEO STAGE */}
        <main className="flex-1 p-3 sm:p-4 flex items-center justify-center overflow-hidden">
          {pinnedParticipant ? (
            /* SPEAKER / PINNED VIEW */
            <div className="w-full h-full flex flex-col gap-3">
              {/* Top Filmstrip */}
              {otherParticipants.length > 0 && (
                <div className="h-28 sm:h-32 flex gap-3 overflow-x-auto pb-1 shrink-0 scrollbar-thin">
                  {otherParticipants.map((p) => (
                    <div key={p.id} className="w-44 h-full shrink-0">
                      <VideoTile
                        participant={p}
                        isLocal={p.isLocal}
                        mirror={mirrorVideo}
                        onTogglePin={() => setPinnedUserId(p.id)}
                        videoRefCallback={(el) => {
                          if (el) videoElementsRef.current.set(p.id, el);
                          else videoElementsRef.current.delete(p.id);
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Main Stage */}
              <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl relative">
                <VideoTile
                  participant={pinnedParticipant}
                  isLocal={pinnedParticipant.isLocal}
                  mirror={mirrorVideo}
                  isPinned={true}
                  onTogglePin={() => setPinnedUserId(null)}
                  videoRefCallback={(el) => {
                    if (el) videoElementsRef.current.set(pinnedParticipant.id, el);
                    else videoElementsRef.current.delete(pinnedParticipant.id);
                  }}
                />
              </div>
            </div>
          ) : (
            /* DYNAMIC GRID VIEW */
            <div
              className={`w-full h-full grid gap-3 sm:gap-4 max-w-7xl mx-auto transition-all ${
                participants.length === 1
                  ? 'grid-cols-1 max-w-4xl max-h-[85vh]'
                  : participants.length === 2
                  ? 'grid-cols-1 sm:grid-cols-2 max-h-[80vh]'
                  : participants.length <= 4
                  ? 'grid-cols-2 grid-rows-2'
                  : participants.length <= 6
                  ? 'grid-cols-2 sm:grid-cols-3 grid-rows-2'
                  : 'grid-cols-3 sm:grid-cols-4'
              }`}
            >
              {participants.map((p) => (
                <div key={p.id} className="w-full h-full min-h-[160px] min-w-[200px]">
                  <VideoTile
                    participant={p}
                    isLocal={p.isLocal}
                    mirror={mirrorVideo}
                    onTogglePin={() => setPinnedUserId(p.id)}
                    videoRefCallback={(el) => {
                      if (el) videoElementsRef.current.set(p.id, el);
                      else videoElementsRef.current.delete(p.id);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </main>

        {/* SIDE DRAWERS */}
        {activeDrawer === 'chat' && (
          <ChatDrawer
            messages={messages}
            currentUserId={userId}
            onSendMessage={sendChatMessage}
            onClose={() => setActiveDrawer(null)}
          />
        )}

        {activeDrawer === 'participants' && (
          <ParticipantsDrawer
            participants={participants}
            currentUserId={userId}
            isHost={isHost}
            isLocked={isLocked}
            onMuteAll={handleMuteAll}
            onToggleLock={handleToggleLock}
            onKickUser={handleKickUser}
            onOpenInvite={() => setShowInviteModal(true)}
            onClose={() => setActiveDrawer(null)}
          />
        )}
      </div>

      {/* BOTTOM CONTROL DOCK (SLEEK ZOOM STYLE) */}
      <footer className="h-20 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 px-4 sm:px-6 flex items-center justify-between z-30 shrink-0">
        {/* Left: Audio & Video controls */}
        <div className="flex items-center gap-2">
          {/* Microphone */}
          <div className="flex items-center bg-slate-800/80 rounded-2xl border border-slate-750 overflow-hidden">
            <button
              onClick={toggleAudio}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold transition ${
                isMuted
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'text-slate-100 hover:bg-slate-700/60'
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span className="hidden sm:inline">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-2 py-2.5 text-slate-400 hover:text-white hover:bg-slate-700/60 border-l border-slate-700 transition"
              title="Audio Settings"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Camera */}
          <div className="flex items-center bg-slate-800/80 rounded-2xl border border-slate-750 overflow-hidden">
            <button
              onClick={toggleVideo}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold transition ${
                isVideoOff
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'text-slate-100 hover:bg-slate-700/60'
              }`}
            >
              {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              <span className="hidden sm:inline">{isVideoOff ? 'Start Video' : 'Stop Video'}</span>
            </button>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-2 py-2.5 text-slate-400 hover:text-white hover:bg-slate-700/60 border-l border-slate-700 transition"
              title="Video Settings"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Center: Meeting Collaboration & Recording */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            className={`flex flex-col items-center justify-center w-12 sm:w-16 h-14 rounded-2xl transition border ${
              isScreenSharing
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                : 'bg-slate-800/80 text-slate-300 hover:text-white border-slate-750 hover:bg-slate-700/60'
            }`}
            title="Share Screen"
          >
            <MonitorUp className="w-4 h-4" />
            <span className="text-[10px] font-medium mt-1">
              {isScreenSharing ? 'Sharing' : 'Share'}
            </span>
          </button>

          {/* LOCAL RECORDING BUTTON (Moderator Only) */}
          {isHost ? (
            recordingStatus === 'idle' ? (
              <button
                onClick={() => startRecording('composite')}
                className="flex flex-col items-center justify-center w-12 sm:w-16 h-14 rounded-2xl bg-slate-800/80 hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-slate-750 hover:border-red-500/40 transition group"
                title="Start Local Recording on this Device (No time limit)"
              >
                <div className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                </div>
                <span className="text-[10px] font-medium mt-1">Record</span>
              </button>
            ) : (
              <div className="flex items-center bg-red-500/15 border border-red-500/40 rounded-2xl p-1 gap-1 shadow-lg shadow-red-500/20">
                {/* Pause / Resume */}
                <button
                  onClick={pauseResumeRecording}
                  className="p-2 text-slate-200 hover:text-white rounded-xl hover:bg-red-500/20 transition"
                  title={recordingStatus === 'recording' ? 'Pause Recording' : 'Resume Recording'}
                >
                  {recordingStatus === 'recording' ? (
                    <Pause className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Play className="w-4 h-4 text-emerald-400" />
                  )}
                </button>

                {/* Stop & Save */}
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition shadow"
                  title="Stop recording and download locally"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span className="hidden sm:inline">Stop REC</span>
                </button>
              </div>
            )
          ) : (
            /* Non-moderator indicator */
            remoteRecordingNotice?.isRecording && (
              <div className="flex flex-col items-center justify-center w-12 sm:w-16 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
                <Disc className="w-4 h-4 animate-spin" />
                <span className="text-[9px] font-semibold mt-1">Recording</span>
              </div>
            )
          )}

          {/* Security / Moderator Hub */}
          {isHost && (
            <div className="relative">
              <button
                onClick={() => setShowSecurityMenu(!showSecurityMenu)}
                className="flex flex-col items-center justify-center w-12 sm:w-16 h-14 rounded-2xl bg-slate-800/80 text-slate-300 hover:text-white border border-slate-750 hover:bg-slate-700/60 transition"
                title="Moderator Security Controls"
              >
                <Shield className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] font-medium mt-1">Host</span>
              </button>

              {showSecurityMenu && (
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-56 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-2 z-40 text-xs">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Moderator Controls
                  </div>
                  <button
                    onClick={() => {
                      handleToggleLock();
                      setShowSecurityMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-xl hover:bg-slate-700 transition"
                  >
                    {isLocked ? (
                      <>
                        <Unlock className="w-3.5 h-3.5 text-amber-400" /> Unlock Room
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 text-slate-300" /> Lock Room
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      handleMuteAll();
                      setShowSecurityMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-xl text-red-400 hover:bg-slate-700 transition"
                  >
                    <MicOff className="w-3.5 h-3.5" /> Mute All Participants
                  </button>
                  <div className="my-1 border-t border-slate-700/80" />
                  <button
                    onClick={() => {
                      setShowInviteModal(true);
                      setShowSecurityMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-xl text-blue-400 hover:bg-slate-700 transition"
                  >
                    <Users className="w-3.5 h-3.5" /> Invite Link & Code
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Participants Button */}
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'participants' ? null : 'participants')}
            className={`flex flex-col items-center justify-center w-12 sm:w-16 h-14 rounded-2xl transition border relative ${
              activeDrawer === 'participants'
                ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/20'
                : 'bg-slate-800/80 text-slate-300 hover:text-white border-slate-750 hover:bg-slate-700/60'
            }`}
            title="Participants"
          >
            <Users className="w-4 h-4" />
            <span className="text-[10px] font-medium mt-1">Users</span>
            <span className="absolute top-1.5 right-1.5 text-[9px] font-bold bg-slate-900 px-1 rounded-full border border-slate-700">
              {participants.length}
            </span>
          </button>

          {/* Chat Button */}
          <button
            onClick={() => {
              setActiveDrawer(activeDrawer === 'chat' ? null : 'chat');
              setUnreadChatCount(0);
            }}
            className={`flex flex-col items-center justify-center w-12 sm:w-16 h-14 rounded-2xl transition border relative ${
              activeDrawer === 'chat'
                ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/20'
                : 'bg-slate-800/80 text-slate-300 hover:text-white border-slate-750 hover:bg-slate-700/60'
            }`}
            title="Chat"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="text-[10px] font-medium mt-1">Chat</span>
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow">
                {unreadChatCount}
              </span>
            )}
          </button>

          {/* Reactions Button */}
          <div className="relative">
            <button
              onClick={() => setShowReactionPicker(!showReactionPicker)}
              className="flex flex-col items-center justify-center w-12 sm:w-16 h-14 rounded-2xl bg-slate-800/80 text-slate-300 hover:text-white border border-slate-750 hover:bg-slate-700/60 transition"
              title="Send Reaction or Raise Hand"
            >
              <Smile className="w-4 h-4" />
              <span className="text-[10px] font-medium mt-1">React</span>
            </button>

            {showReactionPicker && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-2 z-40 flex items-center gap-1.5 animate-in fade-in zoom-in-95">
                {['👍', '❤️', '👏', '😂', '🎉', '😮'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => sendEmojiReaction(emoji)}
                    className="p-2 text-xl hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
                <div className="h-6 w-px bg-slate-700 mx-1" />
                <button
                  onClick={() => {
                    toggleHandRaise();
                    setShowReactionPicker(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    handRaised
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'bg-slate-750 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  <Hand className="w-3.5 h-3.5" />
                  <span>{handRaised ? 'Lower Hand' : 'Raise Hand'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Leave / End Call */}
        <div className="flex items-center gap-2">
          <button
            onClick={onLeaveMeeting}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 active:scale-98 text-white rounded-2xl text-xs font-semibold shadow-lg shadow-red-600/30 transition"
          >
            <PhoneOff className="w-4 h-4" />
            <span className="hidden sm:inline">
              {isHost ? 'End / Leave' : 'Leave Call'}
            </span>
          </button>
        </div>
      </footer>

      {/* MODALS */}
      {/* 1. Recording Ready Modal */}
      {lastFinishedRecording && (
        <RecordingModal
          recording={lastFinishedRecording}
          onClose={() => setLastFinishedRecording(null)}
        />
      )}

      {/* 2. Invite Modal */}
      {showInviteModal && (
        <InviteModal roomId={roomId} onClose={() => setShowInviteModal(false)} />
      )}

      {/* 3. Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          localStream={localStreamRef.current}
          mirrorVideo={mirrorVideo}
          onToggleMirror={setMirrorVideo}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
};
