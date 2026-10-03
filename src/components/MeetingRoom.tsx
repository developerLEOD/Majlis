import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ChevronUp,
  Copy,
  Crown,
  Disc,
  Hand,
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
  Settings as SettingsIcon,
  Shield,
  Smile,
  Square,
  Unlock,
  Users,
  Video,
  VideoOff,
  X,
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
import { ReactionPicker } from './ReactionPicker';
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
  sessionTitle?: string;
  isHost: boolean;
  initialStream: MediaStream | null;
  initialMuted: boolean;
  initialVideoOff: boolean;
  onEndOrLeaveMeeting: () => void;
}

export const MeetingRoom: React.FC<MeetingRoomProps> = ({
  roomId,
  userId,
  userName,
  sessionTitle,
  isHost: initialIsHost,
  initialStream,
  initialMuted,
  initialVideoOff,
  onEndOrLeaveMeeting,
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
  const [showLeaveConfirmDialog, setShowLeaveConfirmDialog] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mirrorVideo, setMirrorVideo] = useState(true);
  const [appUrl, setAppUrl] = useState<string>(getCachedPublicAppUrl());

  // Time elapsed
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

  useEffect(() => {
    const timer = setInterval(() => {
      setMeetingSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadConfig() {
      const url = await fetchAppConfig();
      if (url) setAppUrl(url);
    }
    loadConfig();
  }, []);

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
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  useEffect(() => {
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
          setRemoteRecordingNotice({ isRecording: true, by: 'Host' });
        }
        setParticipants((prev) => {
          const list = [...prev];
          for (const p of data.participants) {
            if (String(p.id) !== userId && !list.some((existing) => String(existing.id) === String(p.id))) {
              list.push({ ...p, id: String(p.id), isLocal: false });
            }
          }
          return list;
        });
      },

      onUserJoined: (user) => {
        const idStr = String(user.id);
        if (!idStr || idStr === userId) return;
        setParticipants((prev) => {
          const index = prev.findIndex((p) => String(p.id) === idStr);
          if (index >= 0) {
            const list = [...prev];
            const prevP = list[index];
            list[index] = {
              ...prevP,
              ...user,
              id: idStr,
              isLocal: false,
              stream: user.stream || prevP.stream,
            };
            return list;
          }
          return [...prev, { ...user, id: idStr, isLocal: false }];
        });
        showNotification(`${user.name || 'A seeker'} joined`);
      },

      onUserLeft: (leftUserId, leftName) => {
        const idStr = String(leftUserId);
        if (!idStr || idStr === userId) return;
        setParticipants((prev) => prev.filter((p) => String(p.id) !== idStr));
        videoElementsRef.current.delete(idStr);
        showNotification(`${leftName || 'A member'} left`);
      },

      onRemoteStream: (remoteUserId, stream) => {
        const idStr = String(remoteUserId);
        if (!idStr || idStr === userId) return;
        setParticipants((prev) => {
          const index = prev.findIndex((p) => String(p.id) === idStr);
          if (index >= 0) {
            const list = [...prev];
            list[index] = { ...list[index], id: idStr, stream };
            return list;
          }
          return [
            ...prev,
            {
              id: idStr,
              name: 'Member',
              isHost: false,
              isLocal: false,
              isMuted: false,
              isVideoOff: false,
              isScreenSharing: false,
              handRaised: false,
              stream,
            },
          ];
        });
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
        showNotification('Muted by host');
      },

      onKicked: (reason) => {
        alert(reason || 'Removed from Majlis');
        handleFinalExit();
      },

      onLockChanged: (locked) => {
        setIsLocked(locked);
        showNotification(locked ? 'Majlis locked' : 'Majlis unlocked');
      },

      onRecordingNotice: (recording, by) => {
        setRemoteRecordingNotice(recording ? { isRecording: true, by } : null);
      },

      onSessionEnded: (reason) => {
        alert(reason || 'The facilitator has concluded this Majlis session.');
        handleFinalExit();
      },

      onUserStatusChanged: (data) => {
        const targetId = String(data.userId);
        setParticipants((prev) =>
          prev.map((p) => {
            if (String(p.id) !== targetId) return p;
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
    client.connect(roomId, userId, userName, initialIsHost, initialStream, sessionTitle);

    return () => {
      client.leave();
    };
  }, [roomId, userId]);

  const showNotification = (text: string) => {
    setSystemBanner(text);
    setTimeout(() => {
      setSystemBanner((current) => (current === text ? null : current));
    }, 4000);
  };

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

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
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
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);

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
        console.warn('Screen share cancelled:', err);
      }
    }
  };

  const toggleHandRaise = () => {
    const nextState = !handRaised;
    setHandRaised(nextState);
    setParticipants((prev) =>
      prev.map((p) => (p.isLocal ? { ...p, handRaised: nextState } : p))
    );
    clientRef.current?.updateStatus({ handRaised: nextState });
    clientRef.current?.sendReaction(nextState ? '✋' : '👋');
  };

  const handleSendReaction = (emoji: string) => {
    clientRef.current?.sendReaction(emoji);
    const newReaction: ReactionItem = {
      id: 'react_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      senderId: userId,
      senderName: userName,
      emoji,
    };
    setActiveReactions((prev) => [...prev, newReaction]);
    setTimeout(() => {
      setActiveReactions((prev) => prev.filter((r) => r.id !== newReaction.id));
    }, 3200);
  };

  const startRecording = async () => {
    if (!isHost) {
      alert('Only the host can record.');
      return;
    }

    try {
      const remoteStreams = participants
        .filter((p) => !p.isLocal && p.stream)
        .map((p) => p.stream!);

      const rec = new LocalMeetingRecorder({
        roomId,
        mode: 'composite',
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
      showNotification('Recording session locally');
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  const pauseResumeRecording = () => {
    if (!recorder) return;
    if (recordingStatus === 'recording') recorder.pause();
    else if (recordingStatus === 'paused') recorder.resume();
  };

  const stopRecording = async () => {
    if (!recorder) return;
    try {
      const result = await recorder.stop();
      setRecorder(null);
      setRecordingStatus('idle');
      setLastFinishedRecording(result);
      clientRef.current?.notifyRecording(false);
      showNotification('Recording ready');
    } catch (err) {
      console.error('Error stopping recording:', err);
    }
  };

  const sendEmojiReaction = (emoji: string) => {
    clientRef.current?.sendReaction(emoji);
    setShowReactionPicker(false);
  };

  const sendChatMessage = (text: string) => {
    clientRef.current?.sendChatMessage(text);
  };

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

  const copyMeetingLink = async () => {
    const inviteUrl = buildMeetingInviteUrl(roomId, appUrl);
    const success = await copyTextToClipboard(inviteUrl);
    if (success) {
      setCopiedLink(true);
      showNotification('Link copied');
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setShowInviteModal(true);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleFinalExit = () => {
    setShowLeaveConfirmDialog(false);
    if (recorder) {
      recorder.stop().catch(console.warn);
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (isHost) {
      clientRef.current?.hostEndSession();
    }
    clientRef.current?.leave();
    onEndOrLeaveMeeting();
  };

  const pinnedParticipant = participants.find((p) => p.id === pinnedUserId);
  const otherParticipants = participants.filter((p) => p.id !== pinnedUserId);

  return (
    <div className="relative w-screen h-screen bg-[#140F0C] text-[#FFFCF5] flex flex-col overflow-hidden select-none font-sans">
      {/* Toast Notification */}
      {systemBanner && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 bg-[#2B1706]/95 border border-[#D4AF37]/30 text-[#E0C2A6] text-xs font-medium rounded-full shadow-lg backdrop-blur-md flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>{systemBanner}</span>
        </div>
      )}

      {/* Floating Reactions */}
      <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
        {activeReactions.map((reaction) => (
          <div
            key={reaction.id}
            className="absolute bottom-24 right-1/4 text-3xl"
            style={{
              animation: 'floatUp 3s ease-out forwards',
              right: `${20 + Math.random() * 40}%`,
            }}
          >
            <div className="flex flex-col items-center">
              <span>{reaction.emoji}</span>
              <span className="text-[10px] bg-[#1A1410]/90 text-[#E0C2A6] px-2 py-0.5 rounded-full mt-0.5 border border-[#3C230B]">
                {reaction.senderName}
              </span>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0) scale(0.6); opacity: 0; }
          15% { opacity: 1; transform: translateY(-30px) scale(1); }
          80% { opacity: 0.9; }
          100% { transform: translateY(-200px) scale(1.2); opacity: 0; }
        }
      `}</style>

      {/* TOP COMPACT HEADER */}
      <header className="h-12 px-4 bg-[#1A1410]/90 backdrop-blur border-b border-[#3C230B]/60 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#8E7E73] hidden sm:inline">
              The Wisdom Lounge
            </span>
            <span className="text-xs font-bold text-[#E0C2A6]">Majlis</span>
            <button
              onClick={copyMeetingLink}
              className="flex items-center gap-1.5 px-2 py-0.5 bg-[#241710] hover:bg-[#2B1706] text-[#D9D0C3] rounded border border-[#3C230B] text-xs font-mono transition"
              title="Copy Majlis Link"
            >
              <span>{roomId}</span>
              {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-[#8E7E73]" />}
            </button>
          </div>

          {sessionTitle && (
            <span className="text-xs font-semibold text-[#FFFCF5] truncate max-w-xs hidden md:inline">
              {sessionTitle}
            </span>
          )}

          {isLocked && (
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/40 rounded">
              Locked
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs">
          {/* Participant Count in Header */}
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'participants' ? null : 'participants')}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1A1410] hover:bg-[#241710] border border-[#3C230B] rounded-lg text-[#E0C2A6] text-xs font-mono transition"
            title="View participants in Majlis"
          >
            <Users className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span className="font-bold text-[#FFFCF5]">{participants.length}</span>
            <span className="hidden sm:inline text-[11px] text-[#A8988B]">in room</span>
          </button>

          {/* Duration & Status */}
          <div className="flex items-center gap-2 text-[#E0C2A6] font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{formatTime(meetingSeconds)}</span>
          </div>

          {/* Recording Badge */}
          {recordingStatus !== 'idle' && (
            <div className="flex items-center gap-2 bg-red-950/60 border border-red-800/40 px-2.5 py-0.5 rounded text-red-300 font-mono text-[11px]">
              <span className={`w-2 h-2 rounded-full bg-red-500 ${recordingStatus === 'recording' ? 'animate-ping' : ''}`} />
              <span>REC {formatTime(recordingDuration)}</span>
            </div>
          )}

          {/* Layout Toggle */}
          <div className="flex bg-[#140F0C] border border-[#3C230B] rounded p-0.5">
            <button
              onClick={() => { setLayout('grid'); setPinnedUserId(null); }}
              className={`p-1 rounded transition ${layout === 'grid' && !pinnedUserId ? 'bg-[#3C230B] text-[#E0C2A6]' : 'text-[#8E7E73]'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setLayout('speaker'); if (participants.length > 0 && !pinnedUserId) setPinnedUserId(participants[0].id); }}
              className={`p-1 rounded transition ${layout === 'speaker' || pinnedUserId ? 'bg-[#3C230B] text-[#E0C2A6]' : 'text-[#8E7E73]'}`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN VIDEO STAGE */}
      <div className="flex-1 flex overflow-hidden relative bg-[#120D0A]">
        {/* Floating Animated Emoji Reactions */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
          {activeReactions.map((reaction, index) => {
            const leftPercent = 15 + ((reaction.id.charCodeAt(reaction.id.length - 1) * 7 + index * 17) % 70);
            return (
              <div
                key={reaction.id}
                className="absolute bottom-16 flex flex-col items-center animate-float-up pointer-events-none select-none"
                style={{
                  left: `${leftPercent}%`,
                }}
              >
                <span className="text-4xl sm:text-5xl filter drop-shadow-lg transform transition-transform">
                  {reaction.emoji}
                </span>
                <span className="text-[10px] sm:text-[11px] font-semibold text-[#FFFCF5] bg-[#1A1410]/90 border border-[#3C230B] px-2 py-0.5 rounded-full mt-1 backdrop-blur-xs shadow-md">
                  {reaction.senderName}
                </span>
              </div>
            );
          })}
        </div>

        <main className="flex-1 p-3 flex items-center justify-center overflow-hidden">
          {pinnedParticipant ? (
            <div className="w-full h-full flex flex-col gap-2">
              {otherParticipants.length > 0 && (
                <div className="h-28 flex gap-2 overflow-x-auto pb-1 shrink-0">
                  {otherParticipants.map((p) => (
                    <div key={p.id} className="w-40 h-full shrink-0">
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
              <div className="flex-1 rounded-xl overflow-hidden relative">
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
            <div
              className={`w-full h-full grid gap-3.5 mx-auto items-center justify-center p-1 ${
                participants.length === 1
                  ? 'grid-cols-1 max-w-4xl h-full'
                  : participants.length === 2
                  ? 'grid-cols-1 sm:grid-cols-2 max-w-5xl h-full'
                  : participants.length === 3
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl h-full'
                  : participants.length === 4
                  ? 'grid-cols-2 grid-rows-2 max-w-6xl h-full'
                  : 'grid-cols-2 sm:grid-cols-3 max-w-7xl h-full'
              }`}
            >
              {participants.map((p) => (
                <div key={p.id} className="w-full h-full min-h-0 min-w-0 overflow-hidden relative rounded-2xl flex items-center justify-center">
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

        {/* Side Panels */}
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

      {/* BOTTOM CONTROL BAR */}
      <footer className="h-16 bg-[#1A1410] border-t border-[#3C230B]/60 px-4 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-2">
          {/* Audio */}
          <button
            onClick={toggleAudio}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
              isMuted ? 'bg-red-950/70 text-red-400' : 'bg-[#241710] text-[#FFFCF5] hover:bg-[#2B1706]'
            }`}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span className="hidden sm:inline">{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          {/* Video */}
          <button
            onClick={toggleVideo}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
              isVideoOff ? 'bg-red-950/70 text-red-400' : 'bg-[#241710] text-[#FFFCF5] hover:bg-[#2B1706]'
            }`}
          >
            {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            <span className="hidden sm:inline">{isVideoOff ? 'Start Video' : 'Stop Video'}</span>
          </button>
        </div>

        {/* Center Controls */}
        <div className="flex items-center gap-2">
          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            className={`p-2.5 rounded-xl border text-xs transition ${
              isScreenSharing
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/50'
                : 'bg-[#241710] text-[#D9D0C3] border-[#3C230B] hover:bg-[#2B1706]'
            }`}
            title="Screen Share"
          >
            <MonitorUp className="w-4 h-4" />
          </button>

          {/* Emoji Reactions Button & Picker */}
          <div className="relative">
            <button
              onClick={() => setShowReactionPicker((prev) => !prev)}
              className={`p-2.5 rounded-xl border text-xs transition flex items-center gap-1.5 ${
                showReactionPicker
                  ? 'bg-[#3C230B] text-[#D4AF37] border-[#D4AF37]/50 shadow-sm'
                  : 'bg-[#241710] text-[#D9D0C3] border-[#3C230B] hover:bg-[#2B1706]'
              }`}
              title="Emoji Reactions"
            >
              <Smile className="w-4 h-4 text-[#D4AF37]" />
              <span className="hidden md:inline font-medium">React</span>
            </button>

            {showReactionPicker && (
              <ReactionPicker
                onSelectReaction={(emoji) => {
                  handleSendReaction(emoji);
                }}
                onToggleHandRaise={() => {
                  toggleHandRaise();
                }}
                handRaised={handRaised}
                onClose={() => setShowReactionPicker(false)}
              />
            )}
          </div>

          {/* Quick Raise Hand Button */}
          <button
            onClick={toggleHandRaise}
            className={`p-2.5 rounded-xl border text-xs transition ${
              handRaised
                ? 'bg-[#D4AF37] text-[#241710] border-[#D4AF37] shadow-sm font-bold animate-pulse'
                : 'bg-[#241710] text-[#D9D0C3] border-[#3C230B] hover:bg-[#2B1706]'
            }`}
            title={handRaised ? 'Lower Hand' : 'Raise Hand'}
          >
            <Hand className="w-4 h-4" />
          </button>

          {/* Local Recording */}
          {isHost && (
            recordingStatus === 'idle' ? (
              <button
                onClick={startRecording}
                className="p-2.5 rounded-xl bg-[#241710] text-[#D9D0C3] border border-[#3C230B] hover:bg-[#2B1706] transition"
                title="Record Session"
              >
                <Square className="w-4 h-4 text-red-400" />
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="px-3 py-1.5 bg-red-800 text-white text-xs font-bold rounded-xl"
              >
                Stop REC
              </button>
            )
          )}

          {/* Participants */}
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'participants' ? null : 'participants')}
            className={`p-2.5 rounded-xl border text-xs transition relative flex items-center justify-center ${
              activeDrawer === 'participants' ? 'bg-[#3C230B] text-white border-[#D4AF37]/50 shadow-sm' : 'bg-[#241710] text-[#D9D0C3] border-[#3C230B] hover:bg-[#2B1706]'
            }`}
            title="Participants List"
          >
            <Users className="w-4 h-4" />
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-[#D4AF37] text-[#241710] rounded-full text-[10px] font-bold flex items-center justify-center font-mono shadow-xs border border-[#1A1410]">
              {participants.length}
            </span>
          </button>

          {/* Chat */}
          <button
            onClick={() => { setActiveDrawer(activeDrawer === 'chat' ? null : 'chat'); setUnreadChatCount(0); }}
            className={`p-2.5 rounded-xl border text-xs transition relative ${
              activeDrawer === 'chat' ? 'bg-[#3C230B] text-white border-[#D4AF37]/50' : 'bg-[#241710] text-[#D9D0C3] border-[#3C230B]'
            }`}
            title="Chat"
          >
            <MessageSquare className="w-4 h-4" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#D4AF37] text-[#3C230B] rounded-full text-[9px] font-bold flex items-center justify-center">
                {unreadChatCount}
              </span>
            )}
          </button>
        </div>

        {/* Leave Action */}
        <div>
          <button
            onClick={() => setShowLeaveConfirmDialog(true)}
            className="px-3.5 py-2 bg-red-800 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition"
          >
            {isHost ? 'End Majlis' : 'Leave Majlis'}
          </button>
        </div>
      </footer>

      {/* Confirmation Dialog */}
      {showLeaveConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
          <div className="w-full max-w-xs bg-[#FFFCF5] border border-[#E6DFD5] rounded-2xl p-5 text-center space-y-3">
            <h3 className="text-base font-bold text-[#3C230B]">
              {isHost ? 'End Majlis?' : 'Leave Majlis?'}
            </h3>
            <p className="text-xs text-[#68594E]">
              Are you sure you want to exit the live room?
            </p>
            <div className="space-y-2 pt-2">
              <button
                onClick={handleFinalExit}
                className="w-full py-2 bg-red-800 hover:bg-red-900 text-white rounded-xl text-xs font-semibold"
              >
                {isHost ? 'End Majlis for All' : 'Leave Majlis'}
              </button>
              <button
                onClick={() => setShowLeaveConfirmDialog(false)}
                className="w-full py-1.5 text-xs text-[#8E7E73]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {lastFinishedRecording && (
        <RecordingModal recording={lastFinishedRecording} onClose={() => setLastFinishedRecording(null)} />
      )}
      {showInviteModal && (
        <InviteModal roomId={roomId} onClose={() => setShowInviteModal(false)} />
      )}
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
